/**
 * Mask shapes attached to clips / effects for compositing (Stage 4).
 */

import { createId, type Id } from "../util/id.js";
import type { Keyframe } from "./keyframe.js";

export type MaskId = Id<"Mask">;

export type MaskShapeKind = "rect" | "ellipse" | "bezier";

export interface BezierPoint {
  readonly x: number;
  readonly y: number;
  readonly inX: number;
  readonly inY: number;
  readonly outX: number;
  readonly outY: number;
}

export interface MaskShape {
  readonly id: MaskId;
  readonly kind: MaskShapeKind;
  readonly inverted: boolean;
  /** Feather in pixels. */
  readonly feather: number;
  /** Expansion in pixels (can be negative). */
  readonly expansion: number;
  readonly opacity: number;
  /** Normalized 0..1 rect for rect/ellipse. */
  readonly bounds: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** Bezier path in normalized coords when kind === "bezier". */
  readonly points: readonly BezierPoint[];
  readonly featherKeys?: readonly Keyframe<number>[];
  readonly opacityKeys?: readonly Keyframe<number>[];
}

export function createRectMask(
  bounds: MaskShape["bounds"] = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
): MaskShape {
  return {
    id: createId<"Mask">(),
    kind: "rect",
    inverted: false,
    feather: 0,
    expansion: 0,
    opacity: 1,
    bounds,
    points: [],
  };
}

export function createEllipseMask(
  bounds: MaskShape["bounds"] = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
): MaskShape {
  return { ...createRectMask(bounds), id: createId<"Mask">(), kind: "ellipse" };
}

export function createBezierMask(points: readonly BezierPoint[]): MaskShape {
  return {
    id: createId<"Mask">(),
    kind: "bezier",
    inverted: false,
    feather: 4,
    expansion: 0,
    opacity: 1,
    bounds: { x: 0, y: 0, w: 1, h: 1 },
    points,
  };
}

/** Expand/contract mask bounds by expansion (pixels → normalized via refSize). */
function expandedBounds(mask: MaskShape, refSize = 1080): MaskShape["bounds"] {
  const grow = mask.expansion / refSize;
  return {
    x: mask.bounds.x - grow,
    y: mask.bounds.y - grow,
    w: mask.bounds.w + grow * 2,
    h: mask.bounds.h + grow * 2,
  };
}

/** Soft coverage 0..1 in normalized space (feather + expansion). */
export function maskCoverage(mask: MaskShape, x: number, y: number, refSize = 1080): number {
  const b = expandedBounds(mask, refSize);
  let dist: number;
  if (mask.kind === "ellipse") {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const rx = Math.max(1e-6, b.w / 2);
    const ry = Math.max(1e-6, b.h / 2);
    const r = Math.hypot((x - cx) / rx, (y - cy) / ry);
    dist = (1 - r) * Math.min(rx, ry);
  } else if (mask.kind === "bezier") {
    const inside = pointInPolygon(
      x,
      y,
      mask.points.map((p) => [p.x, p.y] as const),
    );
    dist = inside ? 1 / refSize : -1 / refSize;
  } else {
    const dx = x < b.x ? b.x - x : x > b.x + b.w ? x - (b.x + b.w) : 0;
    const dy = y < b.y ? b.y - y : y > b.y + b.h ? y - (b.y + b.h) : 0;
    if (dx === 0 && dy === 0) {
      dist = Math.min(x - b.x, b.x + b.w - x, y - b.y, b.y + b.h - y);
    } else {
      dist = -Math.hypot(dx, dy);
    }
  }
  const featherNorm = Math.max(mask.feather, 0) / refSize;
  let alpha: number;
  if (featherNorm <= 1e-8) alpha = dist >= 0 ? 1 : 0;
  else alpha = Math.min(1, Math.max(0, 0.5 + dist / (2 * featherNorm)));
  if (mask.inverted) alpha = 1 - alpha;
  return alpha * mask.opacity;
}

/** Point-in-mask test in normalized space (for CPU mask preview). */
export function pointInMask(mask: MaskShape, x: number, y: number): boolean {
  return maskCoverage(mask, x, y) >= 0.5;
}

function pointInPolygon(x: number, y: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]![0];
    const yi = poly[i]![1];
    const xj = poly[j]![0];
    const yj = poly[j]![1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
