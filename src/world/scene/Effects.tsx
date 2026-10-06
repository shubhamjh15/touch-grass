'use client';

import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Post-processing of the high tier, in one merged effect pass plus ambient occlusion:
 *
 *   - N8AO at half resolution: grounds the tree, the bushes and the rocks on the lawn
 *     and gives the crown its depth;
 *   - bloom with a high threshold: only the sun, the moon, water glints and pulse
 *     flashes glow;
 *   - the same neutral tone mapping the other tiers get from the renderer, so a tier
 *     change never changes the colours;
 *   - a light vignette.
 *
 * The composer owns the frame while it is mounted, so it is mounted only for stages that
 * paint their own sky (a clear, bare stage is drawn straight to the canvas).
 */
export function Effects({ ao }: { ao: boolean }) {
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <N8AO
        enabled={ao}
        halfRes
        quality="performance"
        aoRadius={0.9}
        distanceFalloff={1.4}
        intensity={2.4}
        color="#123a3a"
      />
      <Bloom
        mipmapBlur
        intensity={0.5}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.18}
        radius={0.7}
      />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.3} darkness={0.4} />
    </EffectComposer>
  );
}
