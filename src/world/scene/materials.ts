import * as THREE from 'three';
import { shared } from './live';

/**
 * The "soft toy" material family: three's stock Lambert material (so everything is lit,
 * shadowed and tone-mapped by code three maintains) with a few small patches spliced in
 * through `onBeforeCompile`:
 *
 *   - wind in the vertex shader, one function of world position shared by wood, puffs,
 *     leaves, grass and bushes, so a swaying tree never tears apart;
 *   - a base-to-tip gradient for blades and leaves (`aTip` attribute, 0 at the base);
 *   - the mood grade: greens go straw-yellow when the tree is thirsty and grey-blue when
 *     it is dormant;
 *   - a soft rim, which reads as fuzz on foliage;
 *   - the flash that pulses wash over the crown.
 */

export type Sway = 'none' | 'tree' | 'leaf' | 'grass';

export interface ToyOptions {
  sway?: Sway;
  /** Greens follow vitality. */
  mood?: boolean;
  /** Pulses flash it. */
  flash?: boolean;
  /** Strength of the rim light, 0 = none. */
  rim?: number;
  /** Multiplier of the colour at the base of a blade or leaf (needs the `aTip` attribute). */
  baseShade?: number;
  /** Multiplier of the colour at its tip. */
  tipShade?: number;
  /**
   * Darken under the crown from the shared blob (`uCrown`) instead of the shadow map:
   * for the thousands of small things on the lawn, whose every fragment would otherwise
   * pay for a filtered shadow lookup. Meshes that use it should not `receiveShadow`.
   */
  crownShade?: boolean;
  /**
   * Shade both faces by the surface they stand on rather than by their own facing: thin
   * double-sided blades would otherwise go dark whenever their back is turned.
   */
  uplit?: boolean;
}

const HEAD = /* glsl */ `
uniform float uTime;
uniform vec4 uWind;
uniform vec4 uTree;
uniform vec4 uRipple;
uniform float uDroop;
uniform float uShake;
#ifdef TOY_LIT
  uniform vec4 uLamp;
  varying float vLamp;
#endif
#ifdef TOY_CROWN
  uniform vec4 uCrown;
  varying float vCrown;
#endif
#ifdef TOY_TIP
  attribute float aTip;
  varying float vTip;
#endif

// The whole tree leans as one: the push grows with the square of the height above its
// foot and a little with the reach from the trunk.
vec3 toyTreeSway(vec3 p) {
  float h = clamp((p.y - uTree.y) / max(uTree.w, 0.001), 0.0, 1.4);
  float reach = distance(p.xz, uTree.xz);
  float gust = sin(uTime * 0.9 + p.x * 0.35 + p.z * 0.3) * 0.6
    + sin(uTime * 2.1 + p.x * 0.9 + 1.7) * 0.25
    + sin(uTime * 3.7 + p.z * 1.7 + p.y) * 0.08;
  float push = uWind.z * (h * h * 0.16 + reach * h * 0.022);
  float shake = uShake * h * sin(uTime * 34.0 + p.y * 3.0) * 0.07;
  vec2 lean = uWind.xy * (gust * push + shake);
  float bob = sin(uTime * 1.7 + p.x * 1.1 + p.z * 0.7) * uWind.z * 0.014 * reach * h;
  return vec3(lean.x, bob, lean.y);
}

vec3 toyGrassSway(vec3 p, float tip) {
  float t2 = tip * tip;
  float wave = sin(uTime * 1.6 + dot(p.xz, uWind.xy) * 1.4) * 0.6
    + sin(uTime * 3.1 + p.x * 2.3 + p.z * 1.9) * 0.3;
  vec2 lean = uWind.xy * wave * uWind.z * 0.09 * t2;
  // A tap sends one ring through the blades.
  vec2 away = p.xz - uRipple.xy;
  float d = length(away);
  float ring = sin((d - uRipple.z * 2.6) * 7.0) * exp(-abs(d - uRipple.z * 2.6) * 2.2);
  lean += normalize(away + 0.0001) * ring * uRipple.w * 0.16 * t2;
  return vec3(lean.x, -dot(lean, lean) * 1.5, lean.y);
}
`;

const PROJECT = /* glsl */ `
vec4 toyWorld = vec4(transformed, 1.0);
#ifdef USE_BATCHING
  toyWorld = batchingMatrix * toyWorld;
#endif
#ifdef USE_INSTANCING
  toyWorld = instanceMatrix * toyWorld;
#endif
toyWorld = modelMatrix * toyWorld;
#ifdef TOY_TIP
  vTip = aTip;
#endif
#ifdef TOY_LIT
  float toyLamp = 1.0 - smoothstep(0.0, 1.0, distance(toyWorld.xz, uLamp.xy) / uLamp.z);
  vLamp = uLamp.w * toyLamp * toyLamp * (1.0 - smoothstep(0.9, 2.4, toyWorld.y));
#endif
#ifdef TOY_CROWN
  vCrown = uCrown.w * (1.0 - smoothstep(0.45, 1.1, distance(toyWorld.xz, uCrown.xy) / uCrown.z));
#endif
#if defined(TOY_SWAY_TREE)
  toyWorld.xyz += toyTreeSway(toyWorld.xyz);
#elif defined(TOY_SWAY_LEAF)
  toyWorld.xyz += toyTreeSway(toyWorld.xyz);
  float toyFlutter = sin(uTime * 5.3 + toyWorld.x * 9.0 + toyWorld.z * 7.0 + toyWorld.y * 5.0);
  toyWorld.xyz += vec3(uWind.x, 0.35, uWind.y) * toyFlutter * 0.022 * aTip * (0.4 + uWind.z);
  toyWorld.y -= uDroop * aTip * 0.09;
#elif defined(TOY_SWAY_GRASS)
  toyWorld.xyz += toyGrassSway(toyWorld.xyz, aTip);
#endif
vec4 mvPosition = viewMatrix * toyWorld;
gl_Position = projectionMatrix * mvPosition;
`;

const FRAGMENT_HEAD = /* glsl */ `
uniform vec2 uMood;
uniform float uFlash;
uniform float uToyRim;
uniform float uToyBase;
uniform float uToyTipShade;
#ifdef TOY_LIT
  varying float vLamp;
#endif
#ifdef TOY_TIP
  varying float vTip;
#endif
#ifdef TOY_CROWN
  varying float vCrown;
#endif
`;

const COLOUR = /* glsl */ `
#include <color_fragment>
#ifdef TOY_TIP
  diffuseColor.rgb *= mix(uToyBase, uToyTipShade, vTip);
#endif
#ifdef TOY_MOOD
  float toyLum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(toyLum * 1.5, toyLum * 1.22, toyLum * 0.42), uMood.x * 0.62);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(toyLum * 0.9, toyLum * 0.94, toyLum * 1.02), uMood.y * 0.78);
#endif
#ifdef TOY_FLASH
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 1.0, 0.82), uFlash * 0.55);
#endif
#ifdef TOY_CROWN
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.22, 0.4, 0.56), vCrown);
#endif
`;

const NORMAL = /* glsl */ `
#include <normal_fragment_begin>
#if defined(TOY_UPLIT) && !defined(FLAT_SHADED)
  normal = normalize(vNormal);
#endif
`;

const RIM = /* glsl */ `
#ifdef TOY_RIM
  float toyRim = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.6);
  outgoingLight += diffuseColor.rgb * toyRim * uToyRim * (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + 0.25);
#endif
#ifdef TOY_LIT
  // The lantern's pool: warm light on whatever stands near it, in the thing's own colour.
  outgoingLight += (diffuseColor.rgb * 0.85 + 0.06) * vec3(1.0, 0.66, 0.3) * vLamp;
#endif
#include <opaque_fragment>
`;

export function toyMaterial(
  parameters: THREE.MeshLambertMaterialParameters,
  options: ToyOptions = {},
): THREE.MeshLambertMaterial {
  const {
    sway = 'none',
    mood = false,
    flash = false,
    rim = 0,
    baseShade,
    tipShade = 1,
    uplit = false,
    crownShade = false,
  } = options;
  const material = new THREE.MeshLambertMaterial(parameters);
  const tip = baseShade !== undefined || sway === 'leaf' || sway === 'grass';
  // The depth variant shares the vertex patch but has no use for the lantern's light.
  const defines: Record<string, string> = { TOY_LIT: '' };
  if (sway === 'tree') defines.TOY_SWAY_TREE = '';
  if (sway === 'leaf') defines.TOY_SWAY_LEAF = '';
  if (sway === 'grass') defines.TOY_SWAY_GRASS = '';
  if (tip) defines.TOY_TIP = '';
  if (mood) defines.TOY_MOOD = '';
  if (flash) defines.TOY_FLASH = '';
  if (rim > 0) defines.TOY_RIM = '';
  if (uplit) defines.TOY_UPLIT = '';
  if (crownShade) defines.TOY_CROWN = '';
  material.defines = { ...material.defines, ...defines };
  const own = {
    uToyRim: { value: rim },
    uToyBase: { value: baseShade ?? 1 },
    uToyTipShade: { value: tipShade },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, own);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${HEAD}`)
      .replace('#include <project_vertex>', PROJECT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace('#include <color_fragment>', COLOUR)
      .replace('#include <normal_fragment_begin>', NORMAL)
      .replace('#include <opaque_fragment>', RIM);
  };
  // Programs are shared by cache key: every variant of the patch needs its own.
  material.customProgramCacheKey = () => `toy:${Object.keys(defines).join(',')}`;
  return material;
}

/**
 * Depth material for swaying shadow casters: the same wind as the lit material, so a
 * shadow follows its crown instead of standing still under it.
 */
export function toyDepthMaterial(sway: Exclude<Sway, 'none' | 'grass'>): THREE.MeshDepthMaterial {
  const material = new THREE.MeshDepthMaterial();
  const defines: Record<string, string> =
    sway === 'tree' ? { TOY_SWAY_TREE: '' } : { TOY_SWAY_LEAF: '', TOY_TIP: '' };
  material.defines = { ...material.defines, ...defines };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${HEAD}`)
      .replace('#include <project_vertex>', PROJECT);
  };
  material.customProgramCacheKey = () => `toy-depth:${sway}`;
  return material;
}
