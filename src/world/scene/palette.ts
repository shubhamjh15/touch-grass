import * as THREE from 'three';
import type { Species } from '../contract';

/**
 * Colours of the 3D world. Hex values are sRGB; three converts them to its linear
 * working space when a `Color` is built from them. Greens here are the *thriving*
 * colours: thirsty and dormant are graded in the shader (`materials.ts`), so vitality
 * can ease without touching a single instance colour.
 */

const colours = (values: readonly string[]) => values.map((value) => new THREE.Color(value));

export interface SpeciesPalette {
  bark: THREE.Color;
  /** Foliage puffs: one colour per clump variant (0, 1, 2). */
  puffs: THREE.Color[];
  /** Leaf cards on the puffs. */
  leaves: THREE.Color[];
  /** Fresh growth: seed leaves and the occasional bright leaf. */
  shoot: THREE.Color;
  /** Puffs and leaf cards of a clump in bloom (cherry). */
  bloomPuffs: THREE.Color[];
  bloomLeaves: THREE.Color[];
  blossom: THREE.Color;
}

export const SPECIES_PALETTE: Record<Species, SpeciesPalette> = {
  oak: {
    bark: new THREE.Color('#b07a52'),
    puffs: colours(['#3fbf63', '#35b05a', '#4bcb6c']),
    leaves: colours(['#62de7c', '#4fd470', '#84e88c', '#3fc867', '#a9ec6a']),
    shoot: new THREE.Color('#b4f05a'),
    bloomPuffs: [],
    bloomLeaves: [],
    blossom: new THREE.Color('#ffffff'),
  },
  cherry: {
    bark: new THREE.Color('#946a5c'),
    puffs: colours(['#48c074', '#3eb36b', '#56cc80']),
    leaves: colours(['#6fe296', '#58d684', '#93efb4']),
    shoot: new THREE.Color('#b4f05a'),
    bloomPuffs: colours(['#f79ac8', '#f486bb', '#fbb0d8']),
    bloomLeaves: colours(['#fdc4e0', '#fbb0d8', '#ffdcee', '#f79ac8', '#fff3f9']),
    blossom: new THREE.Color('#fff5fa'),
  },
  pine: {
    bark: new THREE.Color('#a0704c'),
    puffs: colours(['#27a877', '#1f986b', '#30b884']),
    leaves: colours(['#45dba3', '#30c690', '#6fe6bb', '#26bd89']),
    shoot: new THREE.Color('#a7f3d0'),
    bloomPuffs: [],
    bloomLeaves: [],
    blossom: new THREE.Color('#ffffff'),
  },
};

export const MEADOW = {
  tufts: colours(['#8be276', '#77d86c', '#a3ec86', '#69cf68']),
  hanging: colours(['#3fa856', '#4cb860', '#35994d']),
  flowers: colours(['#f472b6', '#facc15', '#ffffff', '#9974f8', '#ff8a6b', '#93c5fd']),
  stem: new THREE.Color('#3fae58'),
  bushes: colours(['#2f9f58', '#3bb565', '#278c4e']),
  rocks: colours(['#ece6dc', '#d6cdc0', '#c2b9ac']),
  stones: colours(['#e9dfcb', '#dccfb6', '#f2ead9']),
};

export const WATER = {
  deep: new THREE.Color('#1b9fd0'),
  shallow: new THREE.Color('#7fe3ea'),
  foam: new THREE.Color('#ffffff'),
};

export const SEED = new THREE.Color('#c99a62');
