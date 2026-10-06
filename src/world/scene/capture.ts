import * as THREE from 'three';
import { FOV, viewFor, type View } from '../camera';
import type { CaptureOptions } from '../store';
import { live } from './live';

/**
 * Renders a picture of the world for share cards: the hero framing at rest (front view,
 * no orbit), at the size asked for, whatever stage the world is on right now.
 *
 * It draws straight to the canvas at the capture size, reads the pixels in the same
 * task (`toBlob` copies the bitmap when it is called) and puts the size back before the
 * browser paints, so nothing flickers on the page.
 */
const view: View = { targetX: 0, targetY: 0, targetZ: 0, distance: 10, pitch: 0.2, span: 1 };
const size = new THREE.Vector2();

export function captureScene(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  options: CaptureOptions,
): Promise<Blob | null> {
  const width = Math.round(Math.min(4096, Math.max(16, options.width ?? 1080)));
  const height = Math.round(Math.min(4096, Math.max(16, options.height ?? 1080)));
  const { tree } = live;
  viewFor(
    {
      mode: 'hero',
      aspect: width / height,
      fit: 0.86,
      anchor: 0,
      growth: live.growth,
      treeTop: tree.top,
      treeHalfWidth: tree.halfWidth,
      treeX: tree.x,
      treeZ: tree.z,
    },
    view,
  );
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.5, 420);
  const flat = Math.cos(view.pitch) * view.distance;
  camera.position.set(
    view.targetX,
    view.targetY + Math.sin(view.pitch) * view.distance,
    view.targetZ + flat,
  );
  camera.lookAt(view.targetX, view.targetY, view.targetZ);
  camera.updateMatrixWorld();

  gl.getSize(size);
  const ratio = gl.getPixelRatio();
  const toneMapping = gl.toneMapping;
  const autoClear = gl.autoClear;
  const target = gl.getRenderTarget();
  return new Promise((resolve) => {
    try {
      gl.setPixelRatio(1);
      gl.setSize(width, height, false);
      gl.toneMapping = THREE.NeutralToneMapping;
      gl.autoClear = true;
      gl.setRenderTarget(null);
      gl.render(scene, camera);
      gl.domElement.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    } finally {
      gl.setPixelRatio(ratio);
      gl.setSize(size.x, size.y, false);
      gl.toneMapping = toneMapping;
      gl.autoClear = autoClear;
      gl.setRenderTarget(target);
    }
  });
}
