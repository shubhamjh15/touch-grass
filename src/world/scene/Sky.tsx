'use client';

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mulberry32 } from '@/lib/rng';
import { QUALITY } from '../config';
import { useWorldStore } from '../store';
import { puffGeometry } from './geometry';
import { live, setColor, shared } from './live';
import { toyMaterial } from './materials';
import { useDispose } from './sceneStore';

/**
 * Everything above and around the island: the painted sky, the sun or the moon, stars
 * and a ring of far, chunky clouds (with a low bank of them under the island, which is
 * what makes it read as floating). All of it follows `live.atmosphere`, so it changes
 * with the hour without a single React render.
 */

const SKY_RADIUS = 150;
/** Clouds stay beyond the farthest the camera ever stands, so none can pass through it. */
const CLOUD_RING = 46;

function skyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uHaze: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uOrb: { value: new THREE.Vector3(0, 1, 0) },
      uNight: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uHaze;
      uniform vec3 uGlow;
      uniform vec3 uOrb;
      uniform float uNight;
      varying vec3 vDir;
      void main() {
        vec3 dir = normalize(vDir);
        float up = dir.y;
        // The camera looks a little down, so most of the frame is near the horizon: the
        // gradient is spent there, and the zenith colour is reached well below straight up.
        // At night the whole of it is brought inside the frame: deep indigo at the top
        // edge, a luminous band behind the island, deeper again in the haze under it.
        vec3 colour = mix(
          uHorizon,
          uZenith,
          smoothstep(mix(-0.04, -0.2, uNight), mix(0.42, 0.05, uNight), up)
        );
        colour = mix(
          colour,
          uHaze,
          smoothstep(mix(0.02, -0.2, uNight), mix(-0.3, -0.52, uNight), up)
        );
        float band = up + 0.2;
        colour += uGlow * exp(-band * band * 70.0) * 0.2 * uNight;
        float near = max(dot(dir, uOrb), 0.0);
        colour += uGlow * (pow(near, 5.0) * 0.28 + pow(near, 48.0) * 0.5);
        gl_FragColor = vec4(colour, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function orbMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    // Additive and in the opaque pass on purpose: drawn right after the sky and before
    // the island, so the island covers it without a depth test.
    transparent: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uColour: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uMoon: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform vec3 uGlow;
      uniform float uMoon;
      varying vec2 vUv;
      void main() {
        float r = length(vUv);
        float disc = smoothstep(0.34, 0.32, r);
        // The moon is a crescent: the same disc with a bite out of its upper right.
        float bite = smoothstep(0.3, 0.28, length(vUv - vec2(0.13, 0.09)));
        float body = disc * (1.0 - bite * uMoon * 0.93);
        float halo = pow(max(0.0, 1.0 - r), 3.0) * mix(0.55, 0.32, uMoon);
        vec3 colour = uColour * body * mix(2.4, 1.7, uMoon) + uGlow * halo;
        gl_FragColor = vec4(colour, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function starGeometry(count: number): THREE.BufferGeometry {
  const random = mulberry32(20261006);
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    // The island floats, so there is sky under its horizon too: the band the camera sees
    // (it looks a little down) is where most of the stars are.
    const y = -0.34 + random() ** 1.5 * 1.3;
    const angle = random() * Math.PI * 2;
    const flat = Math.sqrt(Math.max(0, 1 - y * y));
    positions[i * 3] = Math.cos(angle) * flat * (SKY_RADIUS - 8);
    positions[i * 3 + 1] = y * (SKY_RADIUS - 8);
    positions[i * 3 + 2] = Math.sin(angle) * flat * (SKY_RADIUS - 8);
    const bright = 0.5 + random() * 0.5;
    const warm = random() < 0.25;
    colours[i * 3] = bright;
    colours[i * 3 + 1] = bright * (warm ? 0.9 : 0.96);
    colours[i * 3 + 2] = bright * (warm ? 0.62 : 1);
    // A few stars are large; all of them twinkle at their own pace.
    seeds[i * 2] = 0.55 + random() ** 4 * 1.6;
    seeds[i * 2 + 1] = random() * 6.283;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aTint', new THREE.BufferAttribute(colours, 3));
  geometry.setAttribute('aStar', new THREE.BufferAttribute(seeds, 2));
  return geometry;
}

/** Stars that glow: a bright core in a soft halo, added to the sky, twinkling slowly. */
function starsMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: { uTime: shared.uTime, uShow: { value: 0 }, uSize: { value: 7 } },
    vertexShader: /* glsl */ `
      attribute vec3 aTint;
      attribute vec2 aStar;
      uniform float uTime;
      uniform float uShow;
      uniform float uSize;
      varying vec3 vColour;
      void main() {
        float twinkle = 0.72 + 0.28 * sin(uTime * (0.7 + aStar.x) + aStar.y);
        // Fainter down in the luminous band, where the sky itself is bright.
        float low = smoothstep(-0.32, -0.08, normalize(position).y);
        vColour = aTint * uShow * twinkle * mix(0.35, 1.0, low);
        gl_PointSize = uSize * aStar.x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColour;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = smoothstep(0.34, 0.0, d);
        float halo = smoothstep(1.0, 0.0, d);
        gl_FragColor = vec4(vColour * (core * 1.5 + halo * halo * 0.4), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

interface CloudSpec {
  angle: number;
  height: number;
  radius: number;
  size: number;
  lobes: number;
}

function cloudSpecs(count: number): CloudSpec[] {
  const random = mulberry32(77);
  const specs: CloudSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    const high = i % 3 !== 2;
    specs.push({
      angle: (i / count) * Math.PI * 2 + random() * 0.5,
      // Two in three ride high behind the crown; the rest lie in a bank under the island.
      height: high ? 1 + random() * 13 : -15 - random() * 7,
      radius: CLOUD_RING + random() * 14,
      size: high ? 3.4 + random() * 2.6 : 5 + random() * 3,
      lobes: 4 + Math.floor(random() * 3),
    });
  }
  return specs;
}

const dummy = new THREE.Object3D();

export function Sky({ painted }: { painted: boolean }) {
  const quality = useWorldStore((state) => state.quality);
  const tier = QUALITY[quality];
  const dome = useMemo(() => new THREE.SphereGeometry(SKY_RADIUS, 24, 16), []);
  const sky = useMemo(() => skyMaterial(), []);
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const orb = useMemo(() => orbMaterial(), []);
  const stars = useMemo(() => starGeometry(900), []);
  const starMaterial = useMemo(() => starsMaterial(), []);
  const puff = useMemo(() => puffGeometry(2, 9, 0.3), []);
  const cloudMaterial = useMemo(
    () =>
      toyMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.5, fog: false }),
    [],
  );
  useDispose(dome);
  useDispose(sky);
  useDispose(plane);
  useDispose(orb);
  useDispose(stars);
  useDispose(starMaterial);
  useDispose(puff);
  useDispose(cloudMaterial);

  const specs = useMemo(() => cloudSpecs(tier.clouds * 2), [tier.clouds]);
  const lobes = useMemo(() => specs.reduce((sum, spec) => sum + spec.lobes, 0), [specs]);
  const clouds = useRef<THREE.InstancedMesh>(null);
  const cloudRing = useRef<THREE.Group>(null);
  const orbMesh = useRef<THREE.Mesh>(null);
  const starPoints = useRef<THREE.Points>(null);

  useLayoutEffect(() => {
    const mesh = clouds.current;
    if (!mesh) return;
    const random = mulberry32(9);
    let index = 0;
    for (const spec of specs) {
      const cx = Math.cos(spec.angle) * spec.radius;
      const cz = Math.sin(spec.angle) * spec.radius;
      for (let lobe = 0; lobe < spec.lobes; lobe += 1) {
        // Lobes line up along the ring, biggest in the middle, flat underneath.
        const along = (lobe - (spec.lobes - 1) / 2) / spec.lobes;
        const size = spec.size * (1 - Math.abs(along) * 1.1) * (0.8 + random() * 0.4);
        dummy.position.set(
          cx - Math.sin(spec.angle) * along * spec.size * 3.2,
          spec.height + size * 0.35 + random() * 0.5,
          cz + Math.cos(spec.angle) * along * spec.size * 3.2,
        );
        dummy.rotation.set(random() * 3, random() * 3, 0);
        dummy.scale.set(size * 1.25, size * 0.8, size * 1.1);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
  }, [specs]);

  useFrame((state) => {
    const { atmosphere } = live;
    if (painted) {
      const uniforms = sky.uniforms as Record<string, THREE.IUniform>;
      setColor(uniforms.uZenith?.value as THREE.Color, atmosphere.zenith);
      setColor(uniforms.uHorizon?.value as THREE.Color, atmosphere.horizon);
      setColor(uniforms.uHaze?.value as THREE.Color, atmosphere.haze);
      setColor(uniforms.uGlow?.value as THREE.Color, atmosphere.glow);
      (uniforms.uOrb?.value as THREE.Vector3).set(...atmosphere.orbDir);
      (uniforms.uNight as THREE.IUniform<number>).value = atmosphere.night;
      const disc = orbMesh.current;
      if (disc) {
        const size = atmosphere.moon > 0.5 ? 34 : 30;
        disc.position.set(...atmosphere.orbDir).multiplyScalar(SKY_RADIUS - 12);
        disc.quaternion.copy(state.camera.quaternion);
        disc.scale.setScalar(size);
        const orbUniforms = orb.uniforms as Record<string, THREE.IUniform>;
        setColor(orbUniforms.uColour?.value as THREE.Color, atmosphere.orbColor);
        setColor(orbUniforms.uGlow?.value as THREE.Color, atmosphere.glow);
        (orbUniforms.uMoon as THREE.IUniform<number>).value = atmosphere.moon;
      }
      const starUniforms = starMaterial.uniforms as Record<string, THREE.IUniform<number>>;
      if (starUniforms.uShow) starUniforms.uShow.value = atmosphere.night;
      // Sized in device pixels, so a star is as large on a dense screen as on a plain one.
      if (starUniforms.uSize) starUniforms.uSize.value = 5.5 * state.gl.getPixelRatio();
      if (starPoints.current) starPoints.current.visible = atmosphere.night > 0.02;
    }
    // Clouds take the colour of the hour and drift round the island, very slowly.
    setColor(cloudMaterial.color, atmosphere.cloud).multiplyScalar(0.62);
    setColor(cloudMaterial.emissive, atmosphere.cloud);
    cloudMaterial.emissiveIntensity = 0.58 - 0.22 * atmosphere.night;
    if (cloudRing.current && !live.reduced) cloudRing.current.rotation.y = live.time * 0.006;
  });

  return (
    <group>
      {painted && (
        <>
          <mesh geometry={dome} material={sky} renderOrder={-20} frustumCulled={false} />
          <mesh
            ref={orbMesh}
            geometry={plane}
            material={orb}
            renderOrder={-18}
            frustumCulled={false}
          />
          <points
            ref={starPoints}
            geometry={stars}
            material={starMaterial}
            renderOrder={-19}
            frustumCulled={false}
          />
        </>
      )}
      {painted && (
        <group ref={cloudRing}>
          <instancedMesh ref={clouds} args={[puff, cloudMaterial, lobes]} frustumCulled={false} />
        </group>
      )}
    </group>
  );
}
