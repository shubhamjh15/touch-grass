'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { QUALITY } from '../config';
import { useWorldStore } from '../store';
import { live, setColor } from './live';
import { useDispose } from './sceneStore';

/** Half-size of the square the shadow map covers: the island and the whole crown. */
const SHADOW_REACH = 5.6;
const LIGHT_DISTANCE = 16;

/**
 * One key light (the sun, or the moon at night) and a hemisphere fill, both driven by
 * the hour. Shadows are a tier decision: the medium and high tiers cast one PCF shadow
 * map sized to the island; the low tier draws a soft blob under the crown instead.
 */
export function Lights() {
  const quality = useWorldStore((state) => state.quality);
  const tier = QUALITY[quality];
  const gl = useThree((state) => state.gl);
  const beat = useRef({ frame: 0, hour: Number.NaN, growth: Number.NaN });
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.HemisphereLight>(null);
  const blob = useRef<THREE.Mesh>(null);
  const disc = useMemo(() => new THREE.CircleGeometry(1, 28), []);
  const blobMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uStrength: { value: 0.3 } },
        vertexShader: /* glsl */ `
          varying vec2 vPoint;
          void main() {
            vPoint = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uStrength;
          varying vec2 vPoint;
          void main() {
            float shade = smoothstep(1.0, 0.25, length(vPoint));
            gl_FragColor = vec4(0.05, 0.16, 0.12, shade * uStrength);
          }
        `,
      }),
    [],
  );
  useDispose(disc);
  useDispose(blobMaterial);

  // A new map size needs a new map: three only allocates it once.
  useEffect(() => {
    const light = key.current;
    if (!light) return;
    light.shadow.map?.dispose();
    light.shadow.map = null;
    light.shadow.needsUpdate = true;
    beat.current.frame = 0;
  }, [tier.shadowMap]);

  // The shadow pass draws the whole tree a second time. Nothing in it moves but the
  // wind, so it is redrawn on change (growth, the hour, a pulse) and otherwise only
  // every few frames: a soft shadow that sways at 20 Hz cannot be told from one at 60.
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  useFrame(() => {
    const { atmosphere, mood, tree } = live;
    const pace = beat.current;
    const changed =
      live.growth !== pace.growth ||
      live.hour !== pace.hour ||
      live.shake > 0 ||
      live.channels.hop !== 0 ||
      live.channels.dip !== 0;
    if (changed || pace.frame % tier.shadowEvery === 0) gl.shadowMap.needsUpdate = true;
    pace.frame += 1;
    pace.growth = live.growth;
    pace.hour = live.hour;
    const light = key.current;
    if (light) {
      const [x, y, z] = atmosphere.lightDir;
      light.position.set(x * LIGHT_DISTANCE, y * LIGHT_DISTANCE + 1.5, z * LIGHT_DISTANCE);
      light.target.position.set(0, 1.5, 0);
      light.target.updateMatrixWorld();
      setColor(light.color, atmosphere.lightColor);
      light.intensity = atmosphere.lightIntensity * mood.light;
      light.shadow.intensity = atmosphere.shadow;
    }
    const hemisphere = fill.current;
    if (hemisphere) {
      setColor(hemisphere.color, atmosphere.skyFill);
      // The bounce from below is much weaker than the sky: undersides fall into shade,
      // which is what gives the crown and the rocks their volume.
      setColor(hemisphere.groundColor, atmosphere.groundFill).multiplyScalar(0.5);
      hemisphere.intensity = atmosphere.fillIntensity * (0.9 + 0.1 * mood.light);
      // A resting island sits under a cooler sky.
      hemisphere.color.lerp(COOL, mood.cold * 0.35);
    }
    const shade = blob.current;
    if (shade) {
      const reach = Math.max(0.35, tree.halfWidth * 0.95);
      shade.position.set(tree.x + 0.15, tree.y + 0.05, tree.z + 0.1);
      shade.scale.set(reach, reach, 1);
      (blobMaterial.uniforms.uStrength as THREE.IUniform<number>).value = 0.34 * atmosphere.shadow;
    }
  });

  const shadows = tier.shadowMap > 0;
  return (
    <>
      <hemisphereLight ref={fill} />
      <directionalLight
        ref={key}
        castShadow={shadows}
        shadow-mapSize={[tier.shadowMap || 512, tier.shadowMap || 512]}
        shadow-camera-left={-SHADOW_REACH}
        shadow-camera-right={SHADOW_REACH}
        shadow-camera-top={SHADOW_REACH + 1.5}
        shadow-camera-bottom={-SHADOW_REACH}
        shadow-camera-near={2}
        shadow-camera-far={34}
        shadow-bias={-0.0006}
        shadow-normalBias={0.035}
        shadow-radius={2.6}
      />
      {!shadows && (
        <mesh
          ref={blob}
          geometry={disc}
          material={blobMaterial}
          rotation-x={-Math.PI / 2}
          renderOrder={1}
        />
      )}
    </>
  );
}

const COOL = new THREE.Color('#b8c6e8');
