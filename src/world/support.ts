import type { WorldPreference, WorldQuality } from './contract';

/** What this device can do, probed once before the 3D chunk is requested. */
export interface WorldSupport {
  /** three.js r163+ needs WebGL 2; a WebGL 1-only device gets the illustrated tree. */
  webgl2: boolean;
  webgl1: boolean;
  /** A software rasteriser (no GPU): 3D works but must stay on the lowest tier. */
  software: boolean;
}

const NO_SUPPORT: WorldSupport = { webgl2: false, webgl1: false, software: false };

export function detectSupport(): WorldSupport {
  if (typeof document === 'undefined') return NO_SUPPORT;
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    const gl = gl2 ?? document.createElement('canvas').getContext('webgl');
    if (!gl) return NO_SUPPORT;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '',
    );
    // The probe context is thrown away at once: browsers cap live contexts per page.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return {
      webgl2: Boolean(gl2),
      webgl1: true,
      software: /swiftshader|llvmpipe|software|basic render/i.test(renderer),
    };
  } catch {
    return NO_SUPPORT;
  }
}

interface DeviceHints {
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

/** Quality tier for `auto`: conservative on phones and weak machines, generous on desktops. */
export function autoQuality(support: WorldSupport): WorldQuality {
  if (support.software) return 'low';
  const hints = navigator as Navigator & DeviceHints;
  const cores = hints.hardwareConcurrency ?? 4;
  const memory = hints.deviceMemory ?? 4;
  if (cores <= 2 || memory <= 2) return 'low';
  const phone = window.matchMedia('(pointer: coarse)').matches;
  if (phone || cores <= 4 || memory <= 4) return 'medium';
  return 'high';
}

export function resolveQuality(preference: WorldPreference, support: WorldSupport): WorldQuality {
  return preference === 'auto' || preference === 'off' ? autoQuality(support) : preference;
}
