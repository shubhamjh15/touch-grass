import { clamp } from '@/lib/math';
import { STICKER } from './config';

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
 */
export interface SubjectFrame {
  halfWidth: number;
  top: number;
  bottom: number;
}

export interface Placement {
  /** Origin of the Grove in camera units (CSS px, centre of the canvas = 0, y up). */
  x: number;
  y: number;
  /** CSS pixels per world unit. */
  scale: number;
  /** 0..1 multiplier for ink, sticker border and shadow widths. */
  weight: number;
  /** The same origin in canvas CSS pixels (y down), for DOM overlays. */
  left: number;
  top: number;
}

export interface FitInput {
  box: Box;
  canvas: { width: number; height: number };
  frame: SubjectFrame;
  /** Share of the box the framed subject may fill, 0..1. */
  fit: number;
  /** 0 = vertically centred in the box, 1 = base on the bottom edge. */
  anchor: number;
}

/** Line weight multiplier for a subject drawn at `scale` px per world unit. */
export function stickerWeight(scale: number): number {
  return clamp(scale / STICKER.fullWeightScale, STICKER.minWeight, 1);
}

/** Pixels the sticker adds around the painted subject: outline, die-cut margin, hard shadow. */
export function stickerMargins(weight: number): { side: number; shadow: number } {
  return {
    side: (STICKER.inkPx + STICKER.borderPx + STICKER.keylinePx) * weight,
    shadow: STICKER.shadowPx * weight,
  };
}

/**
 * Places the subject inside a stage box, like `object-fit: contain` with an anchor:
 * horizontally centred, scaled so the frame plus its sticker margins fits inside
 * `fit` times the box in both dimensions.
 */
export function fitSubject({ box, canvas, frame, fit, anchor }: FitInput): Placement {
  const availableW = Math.max(1, box.width * fit);
  const availableH = Math.max(1, box.height * fit);
  const frameW = frame.halfWidth * 2;
  const frameH = frame.top + frame.bottom;

  // The margins are in pixels, so the scale depends on them and they on the scale.
  // One refinement from the margin-free estimate is stable and exact enough.
  const estimate = Math.min(availableW / frameW, availableH / frameH);
  const weight = stickerWeight(estimate);
  const { side, shadow } = stickerMargins(weight);
  const scale = Math.max(
    0.01,
    Math.min(
      (availableW - 2 * side - 2 * shadow) / frameW,
      (availableH - 2 * side - shadow) / frameH,
    ),
  );

  const left = box.x + box.width / 2;
  const centred = box.y + box.height / 2 + ((frame.top - frame.bottom) * scale - shadow) / 2;
  const grounded = box.y + box.height - side - shadow - frame.bottom * scale;
  const top = centred + (grounded - centred) * clamp(anchor, 0, 1);

  return {
    x: left - canvas.width / 2,
    y: canvas.height / 2 - top,
    scale,
    weight,
    left,
    top,
  };
}

export function boxesIntersect(a: Box, canvas: { width: number; height: number }, margin = 0) {
  return (
    a.x < canvas.width + margin &&
    a.x + a.width > -margin &&
    a.y < canvas.height + margin &&
    a.y + a.height > -margin
  );
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

export function springAtRest(spring: Spring): boolean {
  return spring.x === 0 && spring.v === 0;
}
