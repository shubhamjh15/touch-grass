import * as THREE from 'three';
import { hexToRgb } from '../color';
import { INK, PAPER, SHADING, STICKER, TONE, TONE_COUNT } from '../config';

/**
 * The paint system of the Grove: one small shader family that makes a 3D model read
 * as a printed, die-cut sticker.
 *
 * Every solid is drawn in up to five ordered passes ("layers of paper"):
 *
 *   shadow   the silhouette swollen by ink + die-cut margin + keyline, shifted down-right, ink
 *   keyline  the same swollen silhouette, unshifted, ink (a hairline around the white)
 *   white    the silhouette swollen by ink + die-cut margin, paper white
 *   fill     the surface itself: flat tones, a halftone band, a glossy highlight
 *   ink      the silhouette swollen by the ink width, back faces only, depth-tested
 *
 * The first three ignore depth and are drawn first, for all solids, so they add up to
 * one union: a single white border and a single hard shadow around tree + island,
 * exactly like three stacked SVG copies of a silhouette. "Swollen" is an offset surface:
 * each vertex moves along its hull vector in view space. The camera is orthographic in
 * CSS-pixel units, so the offset is a constant number of pixels at any scale, and under
 * an orthographic projection the outline of an offset surface is exactly the outline
 * dilated by that distance. It all rasterises as geometry: MSAA keeps every edge crisp
 * and no extra render target is needed.
 *
 * Colours are sRGB-encoded and written straight to the canvas (no tone mapping, no
 * colour-space pass), so an ungraded fill equals its CSS hex to the bit.
 */

const VERTEX = /* glsl */ `
uniform float uTime;
uniform vec4 uWind;
uniform float uDroop;
uniform float uExpand;
uniform vec2 uShift;
uniform float uFlatten;
uniform float uDepthBias;
uniform float uGroveScale;
uniform vec3 uGroveOrigin;

attribute vec3 aHull;
attribute vec3 aSway;
attribute vec3 aTone;
attribute float aPart;

varying vec3 vView;
varying vec3 vNormal;
varying vec3 vTone;
varying vec2 vSticker;
varying vec3 vLocal;

// Rigid per-branch motion: it depends only on the sway weights and time, never on the
// vertex position, so a twig and the clump riding it move together.
vec3 groveSway(vec3 sw) {
  float phase = sw.z * 6.2832;
  float gust = 0.6 + 0.4 * sin(uTime * 0.31 + 1.0) * sin(uTime * 0.17 + 2.1);
  float lean = sin(uTime * 0.9) + 0.4 * sin(uTime * 2.1 + 1.3);
  vec3 o = uWind.xyz * (0.1 * lean * sw.x);
  o += vec3(
    sin(uTime * 1.7 + phase),
    0.5 * sin(uTime * 2.3 + phase * 1.3),
    cos(uTime * 1.9 + phase * 0.7)
  ) * (0.045 * sw.y);
  o *= uWind.w * gust;
  o.y -= uDroop * (0.4 * sw.y * sw.y + 0.05 * sw.x);
  return o;
}

void main() {
  vec3 p = position;
  vec3 hull = aHull;
  float alive = 1.0;
  vec3 sway = groveSway(aSway);

  #ifdef USE_INSTANCING
    mat3 basis = mat3(instanceMatrix);
    vec3 scale2 = vec3(dot(basis[0], basis[0]), dot(basis[1], basis[1]), dot(basis[2], basis[2]));
    // A part that is just popping in grows its outline with it instead of starting as a dot.
    alive = clamp(sqrt(scale2.x) * uGroveScale / 7.0, 0.0, 1.0);
    // Normals of a non-uniformly scaled instance need the inverse transpose.
    hull = basis * (hull / max(scale2, vec3(1e-8)));
    p = (instanceMatrix * vec4(p, 1.0)).xyz;
    vec3 centre = instanceMatrix[3].xyz + sway;
  #endif

  p += sway;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);

  vec3 hullView = mat3(modelViewMatrix) * hull;
  float hullLength = length(hullView);
  hullView = hullLength > 1e-9 ? hullView / hullLength : vec3(0.0);
  mv.xyz += hullView * (length(aHull) * uExpand * alive);
  mv.xy += uShift;

  #ifdef USE_INSTANCING
    // Squash each instance towards the depth of its centre: clumps then overlap like
    // stacked paper discs (each keeps its whole outline) instead of intersecting spheres.
    float centreZ = (modelViewMatrix * vec4(centre, 1.0)).z;
    mv.z = centreZ + (mv.z - centreZ) * uFlatten;
  #endif
  mv.z -= uDepthBias;

  gl_Position = projectionMatrix * mv;
  vView = mv.xyz;
  vNormal = hullView;
  vTone = vec3(aTone.xy + aPart, aTone.z);
  vSticker = (mv.xy - uGroveOrigin.xy) / uGroveScale;
  vLocal = p;
}
`;

const FLAT_FRAGMENT = /* glsl */ `
uniform vec3 uFlat;
void main() {
  gl_FragColor = vec4(uFlat, 1.0);
}
`;

const FILL_FRAGMENT = /* glsl */ `
uniform vec3 uLit[${TONE_COUNT}];
uniform vec3 uShade[${TONE_COUNT}];
uniform vec3 uHighlight[${TONE_COUNT}];
uniform vec3 uGradeLit;
uniform vec3 uGradeShade;
uniform vec3 uLight;
uniform vec2 uLight2;
uniform vec2 uBands;
uniform float uDotPitch;
uniform vec2 uDotTurn;
uniform float uGloss;
uniform vec4 uDecal;

varying vec3 vView;
varying vec3 vNormal;
varying vec3 vTone;
varying vec2 vSticker;
varying vec3 vLocal;

// Printed dots: 1 where the lit tone shows, 0 where the shade tone shows.
// The screen is fixed to the sticker, so it scales and travels with the subject.
float halftone(float amount) {
  if (amount >= 1.0) return 1.0;
  if (amount <= 0.0) return 0.0;
  vec2 q = vec2(
    uDotTurn.x * vSticker.x - uDotTurn.y * vSticker.y,
    uDotTurn.y * vSticker.x + uDotTurn.x * vSticker.y
  ) / uDotPitch;
  float d = length(fract(q) - 0.5);
  float radius = 0.76 * sqrt(1.0 - amount);
  float soft = length(fwidth(q)) * 0.6 + 1e-4;
  return smoothstep(radius - soft, radius + soft, d);
}

void main() {
  int toneA = int(vTone.x + 0.5);
  int toneB = int(vTone.y + 0.5);
  vec3 lit = mix(uLit[toneA], uLit[toneB], vTone.z);
  vec3 shade = mix(uShade[toneA], uShade[toneB], vTone.z);
  float amount;
  float gloss = 0.0;

  #if defined(SHADE_CRESCENT)
    // The mockup's bubble: a lit disc pushed towards the light, a dotted rim, a bean of gloss.
    vec3 n = normalize(vNormal);
    float full = length(n.xy - uLight2 * ${SHADING.crescentShade.toFixed(3)}) - 1.0;
    float band = length(n.xy - uLight2 * ${SHADING.crescentBand.toFixed(3)}) - 1.0;
    amount = band <= 0.0 ? 1.0 : (full >= 0.0 ? 0.0 : -full / (band - full));
    vec2 g = n.xy - uLight2 * ${SHADING.glossAt.toFixed(3)};
    float along = dot(g, vec2(-uLight2.y, uLight2.x));
    float across = dot(g, uLight2) + ${SHADING.glossBend.toFixed(3)} * along * along;
    float bean = along * along / ${(SHADING.glossLength ** 2).toFixed(5)}
      + across * across / ${(SHADING.glossWidth ** 2).toFixed(5)};
    float edge = fwidth(bean) + 1e-4;
    gloss = (1.0 - smoothstep(1.0 - edge, 1.0 + edge, bean)) * uGloss * step(0.0, n.z);
  #elif defined(SHADE_SMOOTH)
    amount = clamp((dot(normalize(vNormal), uLight) - uBands.x) / (uBands.y - uBands.x), 0.0, 1.0);
  #else
    // Flat facets: the face normal from screen-space derivatives, so low-poly stays low-poly.
    vec3 face = normalize(cross(dFdx(vView), dFdy(vView)));
    amount = clamp((dot(face, uLight) - uBands.x) / (uBands.y - uBands.x), 0.0, 1.0);
  #endif

  vec3 color = mix(shade * uGradeShade, lit * uGradeLit, halftone(amount));

  #ifdef USE_DECAL
    // Hard-edged contact shadow of the crown, printed on the grass only.
    if (toneA == ${TONE.grassPatch} || toneA == ${TONE.grassTop}) {
      float d = length(vLocal.xz - uDecal.xy);
      float soft = fwidth(d) + 1e-4;
      float inside = 1.0 - smoothstep(uDecal.z - soft, uDecal.z + soft, d);
      color = mix(color, shade * uGradeLit, inside * uDecal.w);
    }
  #endif

  color = mix(color, mix(uHighlight[toneA], uHighlight[toneB], vTone.z) * uGradeLit, gloss);
  gl_FragColor = vec4(color, 1.0);
}
`;

const EMBLEM_FRAGMENT = /* glsl */ `
uniform vec3 uLit[${TONE_COUNT}];
uniform vec3 uShade[${TONE_COUNT}];
uniform vec3 uGradeLit;
uniform float uRings;
varying vec3 vLocal;
varying vec3 vTone;
uniform vec4 uEmblem;

void main() {
  // Growth rings: one more for every stretch of days the user has shown up.
  vec2 p = (vLocal.xy - uEmblem.xy) / uEmblem.zw;
  float r = length(p);
  float wave = abs(fract(r * uRings - 0.25) - 0.5);
  float soft = fwidth(r * uRings) + 1e-4;
  float line = 1.0 - smoothstep(0.2 - soft, 0.2 + soft, wave);
  float core = 1.0 - smoothstep(0.14, 0.14 + fwidth(r) + 1e-4, r);
  int tone = int(vTone.x + 0.5);
  vec3 color = mix(uLit[tone], uShade[tone], max(line * step(r, 0.82), core));
  gl_FragColor = vec4(color * uGradeLit, 1.0);
}
`;

type Uniform<T> = { value: T };

/** Uniforms every material of the Grove shares by reference: update once, all passes follow. */
export interface SharedUniforms {
  [name: string]: Uniform<unknown>;
  uTime: Uniform<number>;
  uWind: Uniform<THREE.Vector4>;
  uDroop: Uniform<number>;
  uGroveScale: Uniform<number>;
  uGroveOrigin: Uniform<THREE.Vector3>;
  uLit: Uniform<Float32Array>;
  uShade: Uniform<Float32Array>;
  uHighlight: Uniform<Float32Array>;
  uGradeLit: Uniform<THREE.Vector3>;
  uGradeShade: Uniform<THREE.Vector3>;
  uLight: Uniform<THREE.Vector3>;
  uLight2: Uniform<THREE.Vector2>;
  uBands: Uniform<THREE.Vector2>;
  uDotPitch: Uniform<number>;
  uDotTurn: Uniform<THREE.Vector2>;
  uGloss: Uniform<number>;
  uDecal: Uniform<THREE.Vector4>;
  uRings: Uniform<number>;
  uEmblem: Uniform<THREE.Vector4>;
}

export function createSharedUniforms(): SharedUniforms {
  return {
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector4(0.8, 0, 0.6, 1) },
    uDroop: { value: 0 },
    uGroveScale: { value: 1 },
    uGroveOrigin: { value: new THREE.Vector3() },
    uLit: { value: new Float32Array(TONE_COUNT * 3) },
    uShade: { value: new Float32Array(TONE_COUNT * 3) },
    uHighlight: { value: new Float32Array(TONE_COUNT * 3) },
    uGradeLit: { value: new THREE.Vector3(1, 1, 1) },
    uGradeShade: { value: new THREE.Vector3(1, 1, 1) },
    uLight: { value: new THREE.Vector3(-0.5, 0.6, 0.6).normalize() },
    uLight2: { value: new THREE.Vector2(-0.64, 0.77) },
    uBands: { value: new THREE.Vector2(SHADING.shade, SHADING.lit) },
    uDotPitch: { value: SHADING.dotPitch },
    uDotTurn: { value: new THREE.Vector2(Math.cos(SHADING.dotAngle), Math.sin(SHADING.dotAngle)) },
    uGloss: { value: 1 },
    uDecal: { value: new THREE.Vector4(0, 0, 0, 0) },
    uRings: { value: 2 },
    uEmblem: { value: new THREE.Vector4(0, 0, 1, 1) },
  };
}

export type ShadeMode = 'facet' | 'crescent' | 'smooth' | 'emblem';

export interface LayerOptions {
  shade: ShadeMode;
  /** 1 keeps real depth; below 1 squashes instances towards their centre depth. */
  flatten?: number;
  /** Share of the full ink width this solid's outline gets (small parts are finer). */
  ink?: number;
  /** Whether the solid joins the union passes (white margin, keyline, shadow). */
  sticker?: boolean;
  decal?: boolean;
}

/** The pass materials of one solid, in draw order. */
export interface Layer {
  options: Required<LayerOptions>;
  fill: THREE.ShaderMaterial;
  ink: THREE.ShaderMaterial;
  shadow: THREE.ShaderMaterial | null;
  keyline: THREE.ShaderMaterial | null;
  white: THREE.ShaderMaterial | null;
}

export const PASS_ORDER = { shadow: -30, keyline: -20, white: -10, fill: 0, ink: 1 } as const;
export type PassName = keyof typeof PASS_ORDER;

const inkColor = new THREE.Vector3(...hexToRgb(INK));
const paperColor = new THREE.Vector3(...hexToRgb(PAPER));

function passUniforms(shared: SharedUniforms, flatten: number, flat?: THREE.Vector3) {
  return {
    ...shared,
    uExpand: { value: 0 },
    uShift: { value: new THREE.Vector2() },
    uFlatten: { value: flatten },
    uDepthBias: { value: 0 },
    ...(flat ? { uFlat: { value: flat } } : {}),
  };
}

export function createLayer(shared: SharedUniforms, input: LayerOptions): Layer {
  const options: Required<LayerOptions> = {
    flatten: 1,
    ink: 1,
    sticker: true,
    decal: false,
    ...input,
  };
  const defines: Record<string, string> = {};
  if (options.shade === 'crescent') defines.SHADE_CRESCENT = '';
  if (options.shade === 'smooth') defines.SHADE_SMOOTH = '';
  if (options.decal) defines.USE_DECAL = '';

  const fill = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: options.shade === 'emblem' ? EMBLEM_FRAGMENT : FILL_FRAGMENT,
    uniforms: passUniforms(shared, options.flatten),
    defines,
    toneMapped: false,
  });

  const flat = (color: THREE.Vector3, union: boolean) =>
    new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FLAT_FRAGMENT,
      uniforms: passUniforms(shared, options.flatten, color),
      toneMapped: false,
      // Union passes paint the whole swollen solid, whichever way its faces point.
      side: union ? THREE.DoubleSide : THREE.BackSide,
      depthTest: !union,
      depthWrite: !union,
    });

  const ink = flat(inkColor, false);
  // Keeps a solid's own outline from z-fighting its fill where the two nearly touch.
  (ink.uniforms.uDepthBias as Uniform<number>).value = 0.6;

  return {
    options,
    fill,
    ink,
    shadow: options.sticker ? flat(inkColor, true) : null,
    keyline: options.sticker ? flat(inkColor, true) : null,
    white: options.sticker ? flat(paperColor, true) : null,
  };
}

/** Sets the pixel widths of a layer's passes for the current sticker weight (0..1). */
export function weighLayer(layer: Layer, weight: number): void {
  const set = (material: THREE.ShaderMaterial | null, expand: number, shift = 0) => {
    if (!material) return;
    (material.uniforms.uExpand as Uniform<number>).value = expand;
    (material.uniforms.uShift as Uniform<THREE.Vector2>).value.set(shift, -shift);
  };
  const ink = STICKER.inkPx * layer.options.ink * weight;
  const margin = ink + STICKER.borderPx * weight;
  const outer = margin + STICKER.keylinePx * Math.max(weight, 0.7);
  set(layer.ink, ink);
  set(layer.white, margin);
  set(layer.keyline, outer);
  set(layer.shadow, outer, STICKER.shadowPx * weight);
}

export function disposeLayer(layer: Layer): void {
  for (const material of [layer.fill, layer.ink, layer.shadow, layer.keyline, layer.white]) {
    material?.dispose();
  }
}

export function layerPasses(layer: Layer): Array<[PassName, THREE.ShaderMaterial]> {
  const passes: Array<[PassName, THREE.ShaderMaterial | null]> = [
    ['shadow', layer.shadow],
    ['keyline', layer.keyline],
    ['white', layer.white],
    ['fill', layer.fill],
    ['ink', layer.ink],
  ];
  return passes.filter((pass): pass is [PassName, THREE.ShaderMaterial] => pass[1] !== null);
}
