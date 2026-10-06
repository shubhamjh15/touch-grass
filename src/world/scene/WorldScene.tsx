'use client';

import { Sparkles } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { anchorsFor } from '../anchors';
import { hideAllCallouts, writeCallouts, type CalloutFrame } from '../callouts';
import { FOV } from '../camera';
import { ISLAND, QUALITY } from '../config';
import { LANDMARKS } from '../contract';
import { QualityGovernor, frameInterval } from '../quality';
import { registerCapturer, statsWanted, stickingPoint, useWorldStore, worldStats } from '../store';
import { onWorldFrame, popWorld, type WorldFrame } from '../tracker';
import { Bursts } from './Bursts';
import { captureScene } from './capture';
import { CameraRig, Director, IslandGroup, Pointer } from './Director';
import { Effects } from './Effects';
import { Island } from './Island';
import { Lights } from './Lights';
import { live } from './live';
import { Meadow } from './Meadow';
import { useScene } from './sceneStore';
import { Sky } from './Sky';
import { Tree } from './Tree';
import { Water } from './Water';

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
    let lastMoved = 0;
    let lastDrawn = -1;
    const lastBox = { x: Number.NaN, y: 0, width: 0, height: 0 };
    const samples = new Float32Array(SAMPLES);
    const sorted = new Float32Array(SAMPLES);
    let sampleCount = 0;
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
      hideAllCallouts();
      stickingPoint.valid = false;
      setStatus('fallback');
      lostTimer = window.setTimeout(onFail, CONTEXT_GRACE_MS);
    };
    const onRestored = () => {
      window.clearTimeout(lostTimer);
      lost = false;
      rendered = 0;
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    registerCapturer((options) =>
      lost || cancelled ? Promise.resolve(null) : captureScene(gl, scene, options),
    );

    const stop = onWorldFrame((current) => {
      frame.current = current;
      if (lost || !compiled) return;
      const { quality, preference, dprScale } = useWorldStore.getState();
      if (preference !== governed) {
        governed = preference;
        governor.reset(quality);
      }

      // A world that moves on the page (scroll, flight, drag, pulse) is drawn every frame;
      // one that only sways in the wind may idle at the tier's frame cap.
      const { box } = current;
      const moved =
        !current.locked ||
        current.interacting ||
        live.growing > 0 ||
        live.channels.flash > 0 ||
        box.x !== lastBox.x ||
        box.y !== lastBox.y ||
        box.width !== lastBox.width ||
        box.height !== lastBox.height;
      lastBox.x = box.x;
      lastBox.y = box.y;
      lastBox.width = box.width;
      lastBox.height = box.height;
      if (moved) lastMoved = current.time;
      const idle = current.time - lastMoved;
      const interval = current.reducedMotion
        ? 1 / 30
        : frameInterval(quality, moved ? 0 : Math.max(idle, 0.001));
      const due = moved || current.time - lastDrawn >= interval - 0.002;
      const draw = current.render && (due || rendered < 3);
      if (draw) {
        const sinceDrawn = lastDrawn < 0 ? 0 : (current.time - lastDrawn) * 1000;
        lastDrawn = current.time;
        const started = performance.now();
        // Counted per frame, not per render call: the composer's passes would otherwise
        // leave only the last full-screen triangle in the numbers.
        gl.info.reset();
        advance(current.time);
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
        // `auto` steps the resolution down, then the tier, and never climbs back.
        const judged =
          adaptive && preference === 'auto' && !current.reducedMotion && interval === 0;
        if (judged && sinceDrawn > 0 && governor.sample(sinceDrawn)) {
          setQuality(governor.tier);
          setDprScale(governor.dprScale);
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

      // Where a logged action sticks, for the page's peel-and-stick flight (viewport px).
      const { tree } = live;
      projected
        .set(
          tree.x - tree.halfWidth * 0.3,
          tree.y + tree.top * 0.74,
          tree.z + tree.halfWidth * 0.45,
        )
        .project(camera);
      stickingPoint.valid = current.locked && rendered > 0;
      stickingPoint.x =
        current.originX + current.box.x + (projected.x * 0.5 + 0.5) * current.box.width;
      stickingPoint.y =
        current.originY + current.box.y + (0.5 - projected.y * 0.5) * current.box.height;

      worldStats.dpr = gl.getPixelRatio();
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
      registerCapturer(null);
      stickingPoint.valid = false;
      hideAllCallouts();
      window.clearTimeout(lostTimer);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [adaptive, advance, camera, frame, gl, onFail, scene]);

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
 * background, sized to the active stage by the tracker and driven by it
 * (`frameloop="never"`): the scene renders in the same task that measured the DOM, and
 * never while nothing is visible.
 */
export default function WorldScene(props: SceneProps) {
  const quality = useWorldStore((state) => state.quality);
  const dprScale = useWorldStore((state) => state.dprScale);
  const [deviceDpr, setDeviceDpr] = useState(() => window.devicePixelRatio || 1);
  const [coarse] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  useState(primeScene);

  // The ratio changes without a resize when a window moves to another monitor.
  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${deviceDpr}dppx)`);
    const update = () => setDeviceDpr(window.devicePixelRatio || 1);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [deviceDpr]);

  const tier = QUALITY[quality];
  const cap = coarse ? tier.dprTouch : tier.dpr;
  return (
    <Canvas
      frameloop="never"
      dpr={Math.max(0.5, Math.min(deviceDpr, cap) * dprScale)}
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
  );
}
