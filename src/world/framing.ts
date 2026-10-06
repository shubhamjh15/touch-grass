import { clamp, clamp01, lerp } from '@/lib/math';
import { CAMERA, STICKER, type StickerSpec } from './config';

/**
 * Pure placement maths: how a DOM rectangle becomes a position and a scale for the
 * Grove. Kept free of the DOM and of three.js so it can be unit-tested and shared by
 * the tracker (main bundle) and the scene (lazy chunk).
 */

/** A rectangle in CSS pixels, relative to the top-left corner of the canvas. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The virtual box that is framed, in world units as seen by the camera: the subject
 * spans `halfWidth` either side of its origin, `top` above it and `bottom` below it.
 * `lawn` is the half-width of the island alone, which is what `fit` measures.
 */
export interface SubjectFrame {
  halfWidth: number;
  lawn: number;
  top: number;
  bottom: number;
}

export interface Placement {
  /** Origin of the Grove in camera units (CSS px, centre of the canvas = 0, y up). */
  x: number;
  y: number;
  /** CSS pixels per world unit. */
  scale: number;
  /** Line weights of the sticker for this box. */
  sticker: StickerSpec;
  /** The same origin in canvas CSS pixels (y down), for DOM overlays. */
  left: number;
  top: number;
}

export interface FitInput {
  box: Box;
  canvas: { width: number; height: number };
  frame: SubjectFrame;
  /** Share of the box width the lawn takes, 0..1. */
  fit: number;
  /** 0 = vertically centred in the box, 1 = base on the bottom edge. */
  anchor: number;
  /** Pixels at the top of the box kept free for page chrome. */
  chrome?: number;
}

/**
 * Line weights for a stage whose short side is `shortSide` pixels: three steps that
 * match the UI border family, cross-faded around each threshold so a sticker flying
 * between a thumbnail and a hero stage changes weight smoothly.
 */
export function stickerSpec(shortSide: number): StickerSpec {
  const { steps, blend, keyline } = STICKER;
  let ink: number = steps[0].ink;
  let margin: number = steps[0].margin;
  let shadow: number = steps[0].shadow;
  for (let i = 1; i < steps.length; i += 1) {
    const edge = (steps[i - 1] as (typeof steps)[number]).below;
    const next = steps[i] as (typeof steps)[number];
    const t = clamp01((shortSide - (edge - blend / 2)) / blend);
    ink = lerp(ink, next.ink, t);
    margin = lerp(margin, next.margin, t);
    shadow = lerp(shadow, next.shadow, t);
  }
  return { ink, margin, keyline, shadow };
}

/** Pixels the sticker adds outside the painted subject on every side. */
export function stickerReach(spec: StickerSpec): number {
  return spec.ink + spec.margin + spec.keyline;
}

/**
 * Places the subject inside a stage box: horizontally centred, the lawn `fit` times as
 * wide as the box, and never so large that the whole sticker (subject, margins, shadow
 * and a little headroom) would leave the box in either dimension.
 */
export function fitSubject({ box, canvas, frame, fit, anchor, chrome = 0 }: FitInput): Placement {
  const sticker = stickerSpec(Math.min(box.width, box.height));
  const reach = stickerReach(sticker);
  const height = Math.max(1, box.height - chrome);
  const scale = Math.max(
    0.01,
    Math.min(
      (box.width * clamp(fit, 0.05, 1)) / (2 * frame.lawn),
      (box.width - 2 * reach - 2 * sticker.shadow) / (2 * frame.halfWidth),
      (height - 2 * reach - sticker.shadow) / ((frame.top + frame.bottom) * CAMERA.headroom),
    ),
  );

  const left = box.x + box.width / 2;
  const middle = box.y + chrome + height / 2;
  const centred = middle + ((frame.top - frame.bottom) * scale - sticker.shadow) / 2;
  const grounded = box.y + box.height - reach - sticker.shadow - frame.bottom * scale;
  const top = lerp(centred, grounded, clamp01(anchor));

  return {
    x: left - canvas.width / 2,
    y: canvas.height / 2 - top,
    scale,
    sticker,
    left,
    top,
  };
}

/** One axis of a damped spring that rests at 0. */
export interface Spring {
  x: number;
  v: number;
}

/**
 * Advances a spring towards 0 by `dt` seconds with the closed-form solution, so it is
 * stable and frame-rate independent at any `dt`. `zeta` below 1 overshoots.
 */
export function stepSpring(spring: Spring, dt: number, omega: number, zeta: number): void {
  if (dt <= 0) return;
  const { x, v } = spring;
  if (zeta >= 1) {
    const decay = Math.exp(-omega * dt);
    const a = v + omega * x;
    spring.x = (x + a * dt) * decay;
    spring.v = (v - omega * a * dt) * decay;
  } else {
    const damped = omega * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * omega * dt);
    const b = (v + zeta * omega * x) / damped;
    const cos = Math.cos(damped * dt);
    const sin = Math.sin(damped * dt);
    spring.x = decay * (x * cos + b * sin);
    spring.v =
      decay * ((b * damped - zeta * omega * x) * cos - (zeta * omega * b + x * damped) * sin);
  }
  if (Math.abs(spring.x) < 1e-4 && Math.abs(spring.v) < 1e-3) {
    spring.x = 0;
    spring.v = 0;
  }
}
