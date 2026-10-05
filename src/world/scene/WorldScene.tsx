'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import type { OrthographicCamera } from 'three';
import { QUALITY } from '../config';
import type { WorldQuality } from '../contract';
import { onTap } from '../interaction';
import { onPulse, stickingPoint, useWorldStore, worldStats } from '../store';
import { onWorldFrame, popWorld } from '../tracker';
import { GroveRig } from './GroveRig';

/** How long a lost WebGL context may take to come back before 3D is given up for the session. */
const CONTEXT_GRACE_MS = 3000;
/** `auto` drops a tier when the average frame time stays above this for a while. */
const SLOW_FRAME_MS = 34;
const SLOW_WINDOW = 150;
const LOWER: Record<WorldQuality, WorldQuality | null> = {
  high: 'medium',
  medium: 'low',
  low: null,
};

function Grove({ onFail }: { onFail: () => void }) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const advance = useThree((state) => state.advance);
  const rig = useMemo(() => new GroveRig(), []);

  useEffect(() => {
    const canvas = gl.domElement;
    const { setStatus, setQuality } = useWorldStore.getState();
    let reported = false;
    let lost = false;
    let lostTimer = 0;
    let rendered = 0;
    let slowTime = 0;
    let slowFrames = 0;

    // three.js restores its own state; we only switch the app to the illustrated tree
    // while the context is gone, and give up if it does not come back.
    const onLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      reported = false;
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

    // Pulses and taps are queued by time: the scheduler plays them from the next frame on.
    let clock = 0;
    const size = { width: 1, height: 1 };
    const origin = { x: 0, y: 0 };
    const stopPulses = onPulse((pulse) => rig.life.pulse(pulse, clock));
    const stopTaps = onTap((clientX, clientY) => {
      rig.life.tap(clientX - origin.x, clientY - origin.y, size);
    });

    const stop = onWorldFrame((frame) => {
      if (lost) return;
      clock = frame.time;
      size.width = frame.canvas.width;
      size.height = frame.canvas.height;
      origin.x = frame.originX;
      origin.y = frame.originY;
      const { quality, preference } = useWorldStore.getState();
      const dirty = rig.update(frame, camera as OrthographicCamera, quality);
      // Reduced motion renders on demand: nothing moves by itself, so identical frames are skipped.
      const draw = frame.render && (dirty || rendered < 3);
      if (draw) {
        advance(frame.time);
        rendered += 1;
        worldStats.drawCalls = gl.info.render.calls;
        worldStats.triangles = gl.info.render.triangles;
        worldStats.geometries = gl.info.memory.geometries;
        worldStats.textures = gl.info.memory.textures;
        worldStats.programs = gl.info.programs?.length ?? 0;
        worldStats.frames += 1;
        if (frame.dt > 0) {
          worldStats.frameMs += (frame.dt * 1000 - worldStats.frameMs) * 0.1;
          worldStats.fps = 1000 / Math.max(1, worldStats.frameMs);
          if (preference === 'auto' && rendered > 90 && !frame.reducedMotion) {
            slowTime += frame.dt * 1000;
            slowFrames += 1;
            if (slowFrames >= SLOW_WINDOW) {
              const lower = LOWER[quality];
              if (lower && slowTime / slowFrames > SLOW_FRAME_MS) setQuality(lower);
              slowTime = 0;
              slowFrames = 0;
            }
          }
        }
      }
      // Where a logged action sticks, for the page's peel-and-stick flight (viewport px).
      const sticking = rig.life.sticking;
      stickingPoint.valid = sticking.valid && frame.locked;
      stickingPoint.x = frame.originX + sticking.x;
      stickingPoint.y = frame.originY + sticking.y;
      worldStats.dpr = gl.getPixelRatio();
      worldStats.growth = rig.shown.growth;
      worldStats.scale = rig.placement?.scale ?? 0;
      // Ready means "a frame is on screen" (or there is nothing to draw on this page).
      if (!reported && (draw || !frame.render)) {
        reported = true;
        setStatus('ready');
        popWorld();
      }
    });

    return () => {
      stop();
      stopPulses();
      stopTaps();
      stickingPoint.valid = false;
      window.clearTimeout(lostTimer);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [advance, camera, gl, onFail, rig]);

  useEffect(() => () => rig.dispose(), [rig]);

  return <primitive object={rig.root} />;
}

/**
 * The WebGL half of the world, loaded lazily. One transparent, antialiased canvas with
 * no tone mapping; the tracker drives it (`frameloop="never"`), so the canvas renders in
 * the same task that measured the DOM and never while nothing is visible.
 */
export default function WorldScene({ onFail }: { onFail: () => void }) {
  const quality = useWorldStore((state) => state.quality);
  const [deviceDpr, setDeviceDpr] = useState(() => window.devicePixelRatio || 1);

  // The ratio changes without a resize when a window moves to another monitor.
  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${deviceDpr}dppx)`);
    const update = () => setDeviceDpr(window.devicePixelRatio || 1);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [deviceDpr]);

  return (
    <Canvas
      orthographic
      flat
      frameloop="never"
      dpr={Math.min(deviceDpr, QUALITY[quality].dpr)}
      resize={{ scroll: false, debounce: 0 }}
      gl={{ antialias: true, alpha: true, stencil: false, powerPreference: 'high-performance' }}
      camera={{ manual: true, near: 1, far: 8000, position: [0, 0, 4000] }}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <Grove onFail={onFail} />
    </Canvas>
  );
}
