'use client';

import { Sparkles } from '@react-three/drei';
import { Canvas, useStore, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { IS_DEV } from '@/lib/env';
import * as THREE from 'three';
import { anchorsFor } from '../anchors';
import { hideAllCallouts, writeCallouts, type CalloutFrame } from '../callouts';
import { FOV } from '../camera';
import { ISLAND, QUALITY } from '../config';
import { LANDMARKS, type WorldQuality } from '../contract';
import { QualityGovernor, resolveDpr } from '../quality';
import {
  getWorldStats,
  registerCapturer,
  statsWanted,
  stickingPoint,
  useWorldStore,
  worldStats,
} from '../store';
import { onWorldFrame, popWorld, type WorldFrame } from '../tracker';
import { Bursts } from './Bursts';
import { captureScene } from './capture';
import { CameraRig, Director, IslandGroup, Pointer } from './Director';
import { Effects } from './Effects';
import { Island } from './Island';
import { Life } from './Life';
import { Lights } from './Lights';
import { live } from './live';
import { Meadow } from './Meadow';
import { Moments } from './Moments';
import { Props } from './Props';
import { useScene } from './sceneStore';
import { Sky } from './Sky';
import { Tree } from './Tree';
import { Water } from './Water';

/**
 * Two lines three.js prints that are not about this scene: R3F 9 still constructs the
 * deprecated `THREE.Clock` (we never read it: time comes from the tracker), and Direct3D
 * warns about a gradient inside a loop in the ambient-occlusion shader of the high tier.
 * Everything else three has to say still reaches the console.
 */
const NOT_OURS = [/^THREE\.Clock: This module has been deprecated/, /warning X3595/];
THREE.setConsoleFunction((type: 'log' | 'warn' | 'error', message: string, ...rest: unknown[]) => {
  const line = [message, ...rest].join(' ');
  if (type === 'warn' && NOT_OURS.some((pattern) => pattern.test(line))) return;
  if (type === 'error') console.error(message, ...rest);
  else console.warn(message, ...rest);
});

/** How long a lost WebGL context may take to come back before 3D is given up for the session. */
const CONTEXT_GRACE_MS = 3000;
/** Frame intervals kept for the percentile readout. */
const SAMPLES = 120;

interface SceneProps {
  onFail: () => void;
  /** Whether `auto` may lower the resolution and the tier when frames are slow. */
  adaptive: boolean;
}

const projected = new THREE.Vector3();
const viewed = new THREE.Vector3();
const centre = new THREE.Vector3();

/**
 * The bridge between the tracker (which owns time, placement and the stage) and the
 * R3F scene: it advances the scene once per tracker frame, decides when a frame is due,
 * measures, adapts quality, and writes the DOM that follows the 3D (callouts, the
 * sticking point).
 */
function Loop({ onFail, adaptive, frame }: SceneProps & { frame: RefObject<WorldFrame | null> }) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const advance = useThree((state) => state.advance);
  const store = useStore();

  useEffect(() => {
    const canvas = gl.domElement;
    const { setStatus, setQuality, setDprScale } = useWorldStore.getState();
    let reported = false;
    let lost = false;
    let lostTimer = 0;
    let rendered = 0;
    let compiled = false;
    let cancelled = false;
    const governor = new QualityGovernor(useWorldStore.getState().quality);
    let governed = useWorldStore.getState().preference;
    let lastDrawn = -1;
    const samples = new Float32Array(SAMPLES);
    const sorted = new Float32Array(SAMPLES);
    let sampleCount = 0;
    // GPU time of a frame, where the driver offers timer queries: the one number that
    // tells fill-rate cost apart from a busy main thread. Development only.
    const context = gl.getContext() as WebGL2RenderingContext;
    const timerExtension = () =>
      IS_DEV ? context.getExtension('EXT_disjoint_timer_query_webgl2') : null;
    let timer = timerExtension();
    let query: WebGLQuery | null = null;
    const anchors = new Float32Array(LANDMARKS.length * 3);
    const callouts: CalloutFrame = {
      stageId: null,
      box: { x: 0, y: 0, width: 1, height: 1 },
      locked: false,
      reducedMotion: false,
    };

    // Shaders are compiled off the critical path: the illustrated tree stays up until the
    // programs are linked, so the page never stalls on the first 3D frame.
    if (gl.extensions.has('KHR_parallel_shader_compile')) {
      void gl.compileAsync(scene, camera).then(
        () => {
          compiled = true;
        },
        () => {
          compiled = true;
        },
      );
    } else {
      compiled = true;
    }

    // three.js restores its own state; we only switch the app to the illustrated tree
    // while the context is gone, and give up if it does not come back.
    const onLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      reported = false;
      // A query of the lost context means nothing to the restored one.
      query = null;
      hideAllCallouts();
      stickingPoint.valid = false;
      setStatus('fallback');
      lostTimer = window.setTimeout(onFail, CONTEXT_GRACE_MS);
    };
    const onRestored = () => {
      window.clearTimeout(lostTimer);
      lost = false;
      rendered = 0;
      // Extensions belong to the context that was lost: ask the new one.
      timer = timerExtension();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    // A new size or pixel ratio (the governor stepping the resolution or the tier, a
    // stage that resizes) reallocates the drawing buffer, which clears it: the browser
    // would composite that empty canvas until the next frame, a flash of the page behind
    // it. R3F resizes inside this same store update, before this listener runs, so the
    // scene is drawn into the new buffer here, in the same task: what reaches the screen
    // next is a finished frame at the new size, never a blank one.
    const stopResize = store.subscribe((state, previous) => {
      if (state.size === previous.size && state.viewport.dpr === previous.viewport.dpr) return;
      if (lost || !compiled || rendered === 0 || !frame.current?.render) return;
      gl.info.reset();
      // While the composer owns the frame (the high tier) a bare render would be one
      // frame without tone mapping, bloom and occlusion: a flash of another kind. The
      // same frame is drawn again through the pipeline instead, at the time it had.
      if (state.internal.priority > 0) advance(frame.current.time);
      else gl.render(scene, camera);
    });

    registerCapturer((options) =>
      lost || cancelled ? Promise.resolve(null) : captureScene(gl, scene, options),
    );
    // What the measuring script (scripts/world-perf.mjs) reads; development only.
    // `govern` asks for a tier or a resolution step exactly where the governor would
    // change them (inside a frame, after it is drawn): how a change is proven invisible.
    type Forced = { tier?: WorldQuality; dprScale?: number };
    const probe = globalThis as {
      __touchgrassWorld?: { stats: typeof getWorldStats; govern: (next: Forced) => void };
    };
    let forced: Forced | null = null;
    if (IS_DEV) {
      probe.__touchgrassWorld = {
        stats: getWorldStats,
        govern: (next) => {
          forced = next;
        },
      };
    }

    const stop = onWorldFrame((current) => {
      frame.current = current;
      if (lost || !compiled) return;
      const { quality, preference, dprScale } = useWorldStore.getState();
      if (preference !== governed) {
        governed = preference;
        governor.reset(quality);
      }

      // Every visible frame is drawn: a swaying tree at half the display rate reads as
      // lag. Only reduced motion, whose sway is slow by design, idles at 30 fps.
      const moved =
        !current.locked || current.interacting || live.growing > 0 || live.channels.flash > 0;
      const due = !current.reducedMotion || moved || current.time - lastDrawn >= 1 / 30 - 0.002;
      const draw = current.render && (due || rendered < 3);
      if (draw) {
        const sinceDrawn = lastDrawn < 0 ? 0 : (current.time - lastDrawn) * 1000;
        lastDrawn = current.time;
        const started = performance.now();
        // Counted per frame, not per render call: the composer's passes would otherwise
        // leave only the last full-screen triangle in the numbers.
        gl.info.reset();
        const timed = timer !== null && query === null && (statsWanted() || rendered % 7 === 0);
        if (timed) {
          query = context.createQuery();
          if (query) context.beginQuery(timer.TIME_ELAPSED_EXT, query);
        }
        advance(current.time);
        if (timed && query) context.endQuery(timer.TIME_ELAPSED_EXT);
        else if (
          timer &&
          query &&
          context.getQueryParameter(query, context.QUERY_RESULT_AVAILABLE)
        ) {
          if (!context.getParameter(timer.GPU_DISJOINT_EXT)) {
            const ms = (context.getQueryParameter(query, context.QUERY_RESULT) as number) / 1e6;
            worldStats.gpuMs += (ms - worldStats.gpuMs) * (worldStats.gpuMs > 0 ? 0.2 : 1);
          }
          context.deleteQuery(query);
          query = null;
        }
        const cost = performance.now() - started;
        rendered += 1;
        worldStats.drawCalls = gl.info.render.calls;
        worldStats.triangles = gl.info.render.triangles;
        worldStats.geometries = gl.info.memory.geometries;
        worldStats.textures = gl.info.memory.textures;
        worldStats.programs = gl.info.programs?.length ?? 0;
        worldStats.frames += 1;
        worldStats.cpuMs += (cost - worldStats.cpuMs) * 0.1;
        if (sinceDrawn > 0 && sinceDrawn < 1000) {
          worldStats.frameMs += (sinceDrawn - worldStats.frameMs) * 0.1;
          worldStats.fps = 1000 / Math.max(1, worldStats.frameMs);
          // The percentile readout is a dev tool: it costs a sort, so only when asked for.
          if (statsWanted()) {
            samples[sampleCount % SAMPLES] = sinceDrawn;
            sampleCount += 1;
            if (sampleCount % 30 === 0) {
              const filled = Math.min(sampleCount, SAMPLES);
              sorted.set(samples);
              const window = sorted.subarray(0, filled).sort();
              worldStats.p95Ms = window[Math.min(filled - 1, Math.floor(filled * 0.95))] ?? 0;
              worldStats.worstMs = window[filled - 1] ?? 0;
            }
          }
        }
        // `auto` steps the resolution down, then the tier, and never climbs back. It
        // judges only a world at rest in its stage: never mid-drag (a resize of the
        // drawing buffer under the user's finger is itself a stutter) or mid-flight.
        if (adaptive && preference === 'auto' && !current.reducedMotion) {
          if (current.interacting || !current.locked) governor.pause();
          else if (sinceDrawn > 0 && governor.sample(sinceDrawn)) {
            setQuality(governor.tier);
            setDprScale(governor.dprScale);
          }
        }
        if (forced) {
          const next: Forced = forced;
          forced = null;
          if (next.tier) setQuality(next.tier);
          if (next.dprScale) setDprScale(next.dprScale);
        }
      }

      // Landmark buttons follow their places on the island: written straight to the DOM.
      const width = current.view.width;
      const height = current.view.height;
      const wantsCallouts = current.stage?.options.landmarks === true;
      callouts.stageId = wantsCallouts && current.stage ? current.stage.id : null;
      callouts.box.width = width;
      callouts.box.height = height;
      callouts.locked = current.locked && current.render;
      callouts.reducedMotion = current.reducedMotion;
      if (wantsCallouts) {
        const places = anchorsFor(live.seed);
        centre.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
        LANDMARKS.forEach((landmark, index) => {
          const place = places[landmark];
          projected.set(place.x, place.y + place.lift, place.z);
          if (landmark === 'me') {
            projected.set(
              live.tree.x + 0.1,
              live.tree.y + Math.min(0.9, live.tree.top * 0.45),
              live.tree.z + 0.15,
            );
          }
          const depth = viewed.copy(projected).applyMatrix4(camera.matrixWorldInverse).z - centre.z;
          projected.project(camera);
          anchors[index * 3] = (projected.x * 0.5 + 0.5) * width;
          anchors[index * 3 + 1] = (0.5 - projected.y * 0.5) * height;
          anchors[index * 3 + 2] = depth / ISLAND.radius;
        });
      }
      writeCallouts(callouts, anchors);

      // Where a logged action sticks, for the page's peel-and-stick flight: kept as
      // shares of the canvas box, turned into viewport pixels only when someone asks.
      const { tree } = live;
      projected
        .set(
          tree.x - tree.halfWidth * 0.3,
          tree.y + tree.top * 0.74,
          tree.z + tree.halfWidth * 0.45,
        )
        .project(camera);
      stickingPoint.el = canvas;
      stickingPoint.valid = current.locked && rendered > 0;
      stickingPoint.u = projected.x * 0.5 + 0.5;
      stickingPoint.v = 0.5 - projected.y * 0.5;

      worldStats.dpr = gl.getPixelRatio();
      worldStats.tier = quality;
      worldStats.dprScale = dprScale;
      worldStats.bufferWidth = canvas.width;
      worldStats.bufferHeight = canvas.height;
      // Ready means "a frame is on screen" (or there is nothing to draw on this page).
      if (!reported && (draw || !current.render)) {
        reported = true;
        setStatus('ready');
        popWorld();
      }
    });

    return () => {
      cancelled = true;
      stop();
      stopResize();
      registerCapturer(null);
      delete probe.__touchgrassWorld;
      stickingPoint.valid = false;
      stickingPoint.el = null;
      hideAllCallouts();
      window.clearTimeout(lostTimer);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [adaptive, advance, camera, frame, gl, onFail, scene, store]);

  return null;
}

function World(props: SceneProps) {
  const frame = useRef<WorldFrame | null>(null);
  const sky = useScene((state) => state.sky);
  const quality = useWorldStore((state) => state.quality);
  const tier = QUALITY[quality];
  return (
    <>
      <Director frame={frame} />
      <CameraRig frame={frame} />
      <Pointer frame={frame} />
      <Lights />
      <Sky painted={sky} />
      <IslandGroup>
        <Island />
        <Meadow />
        <Water />
        <Tree />
        <Props shadows={tier.shadowMap > 0} />
        <Life />
        <Moments />
      </IslandGroup>
      <Bursts />
      {tier.motes > 0 && (
        <Sparkles
          count={tier.motes}
          position={[0, 2.4, 0]}
          scale={[8, 4.5, 8]}
          size={2.2}
          speed={0.25}
          opacity={0.55}
          noise={1.2}
          color="#fff6c9"
        />
      )}
      {tier.post && sky && <Effects ao={tier.ao} />}
      <Loop {...props} frame={frame} />
    </>
  );
}

/** Seeds the scene's structure from the store, so the first build is already the right tree. */
function primeScene(): true {
  const { snapshot, stages, activeStageId, quality } = useWorldStore.getState();
  const stage = activeStageId ? stages[activeStageId] : undefined;
  const merged = { ...snapshot, ...stage?.options.preview };
  live.seed = merged.seed;
  live.species = merged.species;
  live.quality = quality;
  useScene.setState({
    seed: merged.seed,
    species: merged.species,
    sky: stage ? stage.options.sky : true,
    mode: stage ? stage.options.mode : 'companion',
  });
  return true;
}

/**
 * The WebGL half of the world, loaded lazily. One antialiased canvas with a clear
 * background that fills the world layer (and so the active stage), driven by the
 * tracker (`frameloop="never"`): never while nothing is visible. Its resolution follows
 * the tier's pixel budget, so a large stage on a dense screen costs no more than a small
 * one.
 */
export default function WorldScene(props: SceneProps) {
  const quality = useWorldStore((state) => state.quality);
  const dprScale = useWorldStore((state) => state.dprScale);
  const [deviceDpr, setDeviceDpr] = useState(() => window.devicePixelRatio || 1);
  const [coarse] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  const [pixels, setPixels] = useState(() => window.innerWidth * window.innerHeight);
  const box = useRef<HTMLDivElement>(null);
  useState(primeScene);

  // The ratio changes without a resize when a window moves to another monitor.
  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${deviceDpr}dppx)`);
    const update = () => setDeviceDpr(window.devicePixelRatio || 1);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [deviceDpr]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const size = entries.at(-1)?.contentRect;
      if (size && size.width >= 2 && size.height >= 2) setPixels(size.width * size.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const tier = QUALITY[quality];
  // In steps of a twentieth, so a stage that resizes by a few pixels keeps its buffer scale.
  const dpr = Math.round(resolveDpr(quality, pixels, deviceDpr, coarse, dprScale) * 20) / 20;
  return (
    <div ref={box} className="absolute inset-0">
      <Canvas
        frameloop="never"
        dpr={dpr}
        shadows={tier.shadowMap > 0 ? { type: THREE.PCFShadowMap } : false}
        resize={{ scroll: false, debounce: 0, offsetSize: true }}
        gl={{ antialias: true, alpha: true, stencil: false, powerPreference: 'high-performance' }}
        camera={{ fov: FOV, near: 0.5, far: 420, position: [0, 4, 18] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NeutralToneMapping;
          gl.setClearColor(0x000000, 0);
          gl.info.autoReset = false;
        }}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <World {...props} />
      </Canvas>
    </div>
  );
}
