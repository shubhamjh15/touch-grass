import * as THREE from 'three';
import { hexToRgb } from '../color';
import {
  EMISSIVE_FROM,
  INK,
  ISLAND,
  PAPER,
  SHADING,
  STICKER,
  TONE,
  TONE_COUNT,
  type StickerSpec,
} from '../config';
import { SLOT_COUNT } from '../props/slots';

/**
 * The paint system of the Grove: one small shader family that makes a 3D model read
 * as a printed, die-cut sticker (design bible 5.2).
 *
 * Every solid is drawn in up to five ordered passes ("layers of paper"):
 *
 *   shadow   the silhouette swollen by ink + margin + kiss-cut line, shifted down-right, ink
 *   keyline  the same swollen silhouette, unshifted, ink (the kiss-cut hairline)
 *   white    the silhouette swollen by ink + margin, sticker white, never graded
 *   fill     the surface itself: base tone, a halftone band, shade tone, one oval of gloss
 *   ink      the silhouette swollen by the ink width, back faces only, depth-tested
 *
 * The first three ignore depth and are drawn first, for all solids, so they add up to
 * one union: a single white margin and a single hard shadow around tree + island that
 * re-cut themselves every frame as the crown sways. "Swollen" is an offset surface:
 * each vertex moves along its hull vector in view space. The camera is orthographic in
 * CSS-pixel units, so the offset is a constant number of pixels at any scale, and under
 * an orthographic projection the outline of an offset surface is exactly the outline
 * dilated by that distance. It all rasterises as geometry: MSAA keeps every edge crisp
 * and no extra render target is needed.
 *
 * Colours are sRGB-encoded and written straight to the canvas (no tone mapping, no
 * colour-space pass, no light maths on colours), so an ungraded fill equals its CSS
 * hex to the bit.
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
uniform vec3 uSun;
uniform vec4 uCastPlane;

attribute vec3 aHull;
attribute vec3 aNormal;
attribute vec3 aSway;
attribute vec3 aTone;
attribute float aPart;

#ifdef USE_PROPS
  // Props share one mesh. Each vertex names two "slots": a moving part of its prop (blades,
  // a lid, an eye) and the prop itself. A slot is (scale, lift, roll, stretch) about a pivot.
  uniform vec4 uSlot[${SLOT_COUNT}];
  attribute vec4 aProp;
  attribute vec4 aBase;

  vec3 slotTurn(vec3 v, vec4 pose) {
    float c = cos(pose.z);
    float s = sin(pose.z);
    return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z);
  }

  vec3 slotMove(vec3 q, vec3 pivot, vec4 pose) {
    vec3 rel = q - pivot;
    rel.y *= 1.0 + pose.w;
    return pivot + slotTurn(rel, pose) * pose.x + vec3(0.0, pose.y, 0.0);
  }
#endif

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
  // Thirst: the tips hang (about 14 degrees at the outermost twig) and the crown sinks a little.
  o.y -= uDroop * (0.42 * sw.y * sw.y + 0.07 * sw.x);
  return o;
}

void main() {
  vec3 p = position;
  vec3 hull = aHull;
  vec3 shading = aHull;
  #ifdef USE_NORMAL
    shading = aNormal;
  #endif
  float alive = 1.0;
  vec3 sway = groveSway(aSway);

  #ifdef USE_PROPS
    vec4 inner = uSlot[int(aProp.w + 0.5)];
    vec4 outer = uSlot[int(aBase.w + 0.5)];
    p = slotMove(slotMove(p, aProp.xyz, inner), aBase.xyz, outer);
    hull = slotTurn(slotTurn(hull, inner), outer);
    shading = slotTurn(slotTurn(shading, inner), outer);
    // A hidden or arriving part takes its outline with it.
    alive = clamp(inner.x * outer.x * 3.0, 0.0, 1.0);
  #endif

  #ifdef USE_INSTANCING
    mat3 basis = mat3(instanceMatrix);
    vec3 scale2 = max(vec3(dot(basis[0], basis[0]), dot(basis[1], basis[1]), dot(basis[2], basis[2])), vec3(1e-8));
    // A part that is just popping in grows its outline with it instead of starting as a dot.
    alive = clamp(sqrt(scale2.x) * uGroveScale / 7.0, 0.0, 1.0);
    // Normals of a non-uniformly scaled instance need the inverse transpose.
    hull = basis * (hull / scale2);
    shading = basis * (shading / scale2);
    p = (instanceMatrix * vec4(p, 1.0)).xyz;
    vec3 centre = instanceMatrix[3].xyz + sway;
  #endif

  p += sway;

  #ifdef CAST
    // Planar projection along the sun onto the lawn: a hard, flat sundial shadow.
    #ifndef CAST_ISLAND
      p += uCastPlane.xyz;
    #endif
    float t = max(p.y - uCastPlane.w, 0.0) / uSun.y;
    p -= uSun * t;
    p.y = uCastPlane.w;
  #endif

  vec4 mv = modelViewMatrix * vec4(p, 1.0);

  vec3 hullView = mat3(modelViewMatrix) * hull;
  float hullLength = length(hullView);
  hullView = hullLength > 1e-9 ? hullView / hullLength : vec3(0.0);
  mv.xyz += hullView * (length(aHull) * uExpand * alive);
  mv.xy += uShift;

  #if defined(USE_INSTANCING) && !defined(CAST)
    // Squash each instance towards the depth of its centre: clumps then overlap like
    // stacked paper discs (each keeps its whole outline) instead of intersecting spheres.
    float centreZ = (modelViewMatrix * vec4(centre, 1.0)).z;
    mv.z = centreZ + (mv.z - centreZ) * uFlatten;
  #endif
  mv.z -= uDepthBias;

  gl_Position = projectionMatrix * mv;
  vView = mv.xyz;
  vNormal = mat3(modelViewMatrix) * shading;
  vTone = vec3(aTone.xy + aPart, aTone.z);
  vSticker = mv.xy - uGroveOrigin.xy;
  vLocal = p;
}
`;

const DOTS = /* glsl */ `
uniform float uDotPitch;
uniform vec2 uDotTurn;
varying vec2 vSticker;

// Printed dots, 1 inside a dot. The screen is anchored to the sticker, so it travels
// with the subject instead of swimming over it; its pitch is constant in pixels.
float printedDots(float radius) {
  vec2 q = vec2(
    uDotTurn.x * vSticker.x - uDotTurn.y * vSticker.y,
    uDotTurn.y * vSticker.x + uDotTurn.x * vSticker.y
  ) / uDotPitch;
  float d = length(fract(q) - 0.5);
  float soft = length(fwidth(q)) * 0.6 + 1e-4;
  return 1.0 - smoothstep(radius - soft, radius + soft, d);
}
`;

const FLAT_FRAGMENT = /* glsl */ `
uniform vec3 uFlat;
void main() {
  gl_FragColor = vec4(uFlat, 1.0);
}
`;

const DOT_RADIUS = (SHADING.dotRadiusPx / SHADING.dotPitchPx).toFixed(4);

const FILL_FRAGMENT = /* glsl */ `
uniform vec3 uBase[${TONE_COUNT}];
uniform vec3 uShade[${TONE_COUNT}];
uniform vec3 uHighlight[${TONE_COUNT}];
uniform vec3 uGrade;
uniform vec3 uLight;
uniform vec2 uLight2;
uniform float uGloss;
uniform float uFlash;
uniform vec4 uDecal;
${DOTS}
varying vec3 vView;
varying vec3 vNormal;
varying vec3 vTone;
varying vec3 vLocal;

void main() {
  int toneA = int(vTone.x + 0.5);
  int toneB = int(vTone.y + 0.5);
  vec3 base = mix(uBase[toneA], uBase[toneB], vTone.z);
  vec3 shade = mix(uShade[toneA], uShade[toneB], vTone.z);

  #ifdef SHADE_FACET
    // Loose bits keep flat facets: the face normal from screen-space derivatives.
    vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
  #else
    vec3 n = normalize(vNormal);
  #endif

  // Four printed steps, one lamp: base, a band of shade-coloured dots, shade, gloss.
  float ndl = dot(n, uLight);
  float edge = fwidth(ndl) * 0.7 + 1e-4;
  #ifdef USE_HALFTONE
    float lit = smoothstep(${SHADING.base.toFixed(3)} - edge, ${SHADING.base.toFixed(3)} + edge, ndl);
    float banded = smoothstep(${SHADING.shade.toFixed(3)} - edge, ${SHADING.shade.toFixed(3)} + edge, ndl);
    float paint = mix(banded * (1.0 - printedDots(${DOT_RADIUS})), 1.0, lit);
  #else
    float paint = smoothstep(${SHADING.hardEdge.toFixed(3)} - edge, ${SHADING.hardEdge.toFixed(3)} + edge, ndl);
  #endif
  vec3 color = mix(shade, base, paint);

  #ifdef USE_DECAL
    // Low tier stand-in for the sundial shadow: a flat patch of the lawn's shade tone.
    if (toneA == ${TONE.grassPatch} || toneA == ${TONE.grassTop}) {
      float d = length(vLocal.xz - uDecal.xy);
      float soft = fwidth(d) + 1e-4;
      color = mix(color, shade, (1.0 - smoothstep(uDecal.z - soft, uDecal.z + soft, d)) * uDecal.w);
    }
  #endif

  #ifdef USE_GLOSS
    // One hard oval towards the lamp, bent round the bubble like a real reflection.
    vec2 g = n.xy - uLight2 * ${SHADING.glossAt.toFixed(3)};
    float along = dot(g, vec2(-uLight2.y, uLight2.x));
    float across = dot(g, uLight2) + ${SHADING.glossBend.toFixed(3)} * along * along;
    float oval = along * along / ${(SHADING.glossLength ** 2).toFixed(5)}
      + across * across / ${(SHADING.glossWidth ** 2).toFixed(5)};
    float rim = fwidth(oval) + 1e-4;
    float gloss = (1.0 - smoothstep(1.0 - rim, 1.0 + rim, oval)) * step(0.0, n.z);
    #ifdef GLOSS_BY_MIX
      // A merged mesh marks its glossy parts in the tone mix, which it does not otherwise use.
      gloss *= step(0.5, vTone.z);
    #else
      gloss *= uGloss;
    #endif
    color = mix(color, mix(uHighlight[toneA], uHighlight[toneB], vTone.z), gloss);
  #endif

  // A pulse washes the foliage towards its highlight tone for a moment (new growth).
  float foliage = step(${TONE.canopyA}.0 - 0.5, vTone.x) * step(vTone.x, ${TONE.petal}.0 + 0.5);
  color = mix(color, mix(uHighlight[toneA], uHighlight[toneB], vTone.z), uFlash * foliage);

  // Lit glass, fireflies and sparks are emissive: the time of day never tints them.
  gl_FragColor = vec4(toneA >= ${EMISSIVE_FROM} ? color : color * uGrade, 1.0);
}
`;

const EMBLEM_FRAGMENT = /* glsl */ `
uniform vec3 uBase[${TONE_COUNT}];
uniform vec3 uShade[${TONE_COUNT}];
uniform vec3 uGrade;
uniform float uRings;
uniform vec4 uEmblem;
varying vec3 vLocal;
varying vec3 vTone;

void main() {
  // Growth rings: 1 to 5 concentric ink rings on a paper oval, one per milestone of days.
  vec2 p = (vLocal.xy - uEmblem.xy) / uEmblem.zw;
  float r = length(p) / 0.84;
  float t = r * (uRings + 0.4);
  float soft = fwidth(t) + 1e-4;
  float ring = 1.0 - smoothstep(0.17 - soft, 0.17 + soft, abs(fract(t + 0.5) - 0.5));
  ring *= step(0.5, t) * step(t, uRings + 0.3);
  float dot = fwidth(r) + 1e-4;
  float core = 1.0 - smoothstep(0.13 - dot, 0.13 + dot, r);
  int tone = int(vTone.x + 0.5);
  gl_FragColor = vec4(mix(uBase[tone], uShade[tone], max(ring, core)) * uGrade, 1.0);
}
`;

const CAST_FRAGMENT = /* glsl */ `
uniform vec3 uShade[${TONE_COUNT}];
uniform vec3 uGrade;
uniform vec4 uCoast;
uniform float uCast;
${DOTS}
varying vec3 vLocal;

void main() {
  // Clipped to the lawn: the shadow never spills onto the die-cut margin.
  float angle = atan(vLocal.z, vLocal.x);
  float rim = ${ISLAND.radius.toFixed(2)} * (1.0 + uCoast.x * sin(2.0 * angle + uCoast.y)
    + uCoast.z * sin(3.0 * angle + uCoast.w)) - 0.12;
  if (length(vLocal.xz) > rim) discard;
  // At dusk the shadow is not faded, it is printed away: dots shrink until none are left.
  if (uCast < 0.999 && printedDots(0.72 * sqrt(uCast)) < 0.5) discard;
  gl_FragColor = vec4(uShade[${TONE.grassTop}] * uGrade, 1.0);
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
  uBase: Uniform<Float32Array>;
  uShade: Uniform<Float32Array>;
  uHighlight: Uniform<Float32Array>;
  uGrade: Uniform<THREE.Vector3>;
  uLight: Uniform<THREE.Vector3>;
  uLight2: Uniform<THREE.Vector2>;
  uDotPitch: Uniform<number>;
  uDotTurn: Uniform<THREE.Vector2>;
  uGloss: Uniform<number>;
  /** 0..1 wash of the highlight tone over the foliage (pulses). */
  uFlash: Uniform<number>;
  /** Poses of the prop slots: scale, lift, roll, stretch. */
  uSlot: Uniform<Float32Array>;
  uDecal: Uniform<THREE.Vector4>;
  uRings: Uniform<number>;
  uEmblem: Uniform<THREE.Vector4>;
  /** Towards the sun, in the island's rest frame. */
  uSun: Uniform<THREE.Vector3>;
  /** xyz: offset from tree space to island space; w: height of the lawn plane. */
  uCastPlane: Uniform<THREE.Vector4>;
  /** Rim of the lawn: a1, p1, a2, p2 of the island model. */
  uCoast: Uniform<THREE.Vector4>;
  uCast: Uniform<number>;
}

export function createSharedUniforms(): SharedUniforms {
  const lamp = new THREE.Vector3(...SHADING.lamp).normalize();
  return {
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector4(0.8, 0, 0.6, 1) },
    uDroop: { value: 0 },
    uGroveScale: { value: 1 },
    uGroveOrigin: { value: new THREE.Vector3() },
    uBase: { value: new Float32Array(TONE_COUNT * 3) },
    uShade: { value: new Float32Array(TONE_COUNT * 3) },
    uHighlight: { value: new Float32Array(TONE_COUNT * 3) },
    uGrade: { value: new THREE.Vector3(1, 1, 1) },
    uLight: { value: lamp },
    uLight2: { value: new THREE.Vector2(lamp.x, lamp.y).normalize() },
    uDotPitch: { value: SHADING.dotPitchPx },
    uDotTurn: { value: new THREE.Vector2(Math.cos(SHADING.dotAngle), Math.sin(SHADING.dotAngle)) },
    uGloss: { value: 1 },
    uFlash: { value: 0 },
    uSlot: { value: createSlotPoses() },
    uDecal: { value: new THREE.Vector4(0, 0, 0, 0) },
    uRings: { value: 1 },
    uEmblem: { value: new THREE.Vector4(0, 0, 1, 1) },
    uSun: { value: new THREE.Vector3(0, 1, 0) },
    uCastPlane: { value: new THREE.Vector4(0, 0, 0, 0.03) },
    uCoast: { value: new THREE.Vector4(0, 0, 0, 0) },
    uCast: { value: 1 },
  };
}

/** Every slot at rest: full size, no lift, no roll, no stretch. */
export function createSlotPoses(): Float32Array {
  const poses = new Float32Array(SLOT_COUNT * 4);
  for (let slot = 0; slot < SLOT_COUNT; slot += 1) poses[slot * 4] = 1;
  return poses;
}

export type ShadeMode = 'smooth' | 'facet' | 'emblem';

export interface LayerOptions {
  shade: ShadeMode;
  /** The geometry carries its own shading normals (`aNormal`) instead of using the hull. */
  normals?: boolean;
  gloss?: boolean;
  halftone?: boolean;
  /** 1 keeps real depth; below 1 squashes instances towards their centre depth. */
  flatten?: number;
  /** Share of the full ink width this solid's outline gets (props 0.75, loose bits finer). 0 = none. */
  ink?: number;
  /** Outline in CSS pixels at any stage size (loose bits). Overrides the `ink` share. */
  inkPx?: number;
  /** The mesh carries prop slots (`aProp`, `aBase`): parts that arrive, wiggle, spin or blink. */
  props?: boolean;
  /** Gloss only where the tone mix is 1 (a merged mesh with some glossy parts). */
  glossByMix?: boolean;
  /** Whether the solid joins the union passes (white margin and shadow). */
  sticker?: boolean;
  /** Kiss-cut hairline around the margin (off on the low tier). */
  keyline?: boolean;
  decal?: boolean;
  /** Draw order of the fill among fills. The lawn goes first so the sundial shadow can land on it. */
  fillOrder?: number;
}

/** The pass materials of one solid, in draw order. */
export interface Layer {
  options: Required<LayerOptions>;
  fill: THREE.ShaderMaterial;
  ink: THREE.ShaderMaterial | null;
  shadow: THREE.ShaderMaterial | null;
  keyline: THREE.ShaderMaterial | null;
  white: THREE.ShaderMaterial | null;
}

export const PASS_ORDER = { shadow: -30, keyline: -20, white: -10, fill: 0, ink: 1 } as const;
/** Between the lawn's fill and every other fill. */
export const ORDER = { lawn: -1, cast: -0.5, ticks: -0.25 } as const;
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
    normals: false,
    gloss: false,
    halftone: true,
    flatten: 1,
    ink: 1,
    inkPx: 0,
    props: false,
    glossByMix: false,
    sticker: true,
    keyline: true,
    decal: false,
    fillOrder: PASS_ORDER.fill,
    ...input,
  };
  const defines: Record<string, string> = {};
  if (options.shade === 'facet') defines.SHADE_FACET = '';
  if (options.normals) defines.USE_NORMAL = '';
  if (options.gloss) defines.USE_GLOSS = '';
  if (options.halftone) defines.USE_HALFTONE = '';
  if (options.decal) defines.USE_DECAL = '';
  if (options.glossByMix) defines.GLOSS_BY_MIX = '';
  // The vertex stage of every pass must move the same way, or the outline leaves its fill.
  const moving: Record<string, string> = options.props ? { USE_PROPS: '' } : {};
  Object.assign(defines, moving);

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
      defines: { ...moving },
      toneMapped: false,
      // Union passes paint the whole swollen solid, whichever way its faces point.
      side: union ? THREE.DoubleSide : THREE.BackSide,
      depthTest: !union,
      depthWrite: !union,
    });

  const ink = options.ink > 0 || options.inkPx > 0 ? flat(inkColor, false) : null;
  // Keeps a solid's own outline from z-fighting its fill where the two nearly touch.
  if (ink) (ink.uniforms.uDepthBias as Uniform<number>).value = 0.6;

  return {
    options,
    fill,
    ink,
    shadow: options.sticker ? flat(inkColor, true) : null,
    keyline: options.sticker && options.keyline ? flat(inkColor, true) : null,
    white: options.sticker ? flat(paperColor, true) : null,
  };
}

/** The sundial shadow of a tree solid: its geometry, flattened onto the lawn along the sun. */
export function createCastMaterial(
  shared: SharedUniforms,
  /** `island`: the geometry is already in island space (props), not tree space. */
  space: 'tree' | 'island' = 'tree',
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: CAST_FRAGMENT,
    uniforms: passUniforms(shared, 1),
    defines: space === 'island' ? { CAST: '', CAST_ISLAND: '', USE_PROPS: '' } : { CAST: '' },
    toneMapped: false,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * Sets the pixel widths of a layer's passes. `lift` (0..1) is how far the sticker is
 * peeled off the page while it is carried between stages: the shadow lengthens.
 */
export function weighLayer(layer: Layer, spec: StickerSpec, lift = 0, shadowScale = 1): void {
  const set = (material: THREE.ShaderMaterial | null, expand: number, shift = 0) => {
    if (!material) return;
    (material.uniforms.uExpand as Uniform<number>).value = expand;
    (material.uniforms.uShift as Uniform<THREE.Vector2>).value.set(shift, -shift);
  };
  const ink = layer.options.inkPx > 0 ? layer.options.inkPx : spec.ink * layer.options.ink;
  const margin = ink + spec.margin;
  const outer = margin + spec.keyline;
  set(layer.ink, ink);
  set(layer.white, margin);
  set(layer.keyline, outer);
  set(layer.shadow, outer, spec.shadow * (1 + (STICKER.carriedShadow - 1) * lift) * shadowScale);
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
