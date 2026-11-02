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

/** Point-in-rect test in normalized space (for CPU mask preview). */
export function pointInMask(mask: MaskShape, x: number, y: number): boolean {
  let inside = false;
  if (mask.kind === "rect") {
    inside =
      x >= mask.bounds.x &&
      x <= mask.bounds.x + mask.bounds.w &&
      y >= mask.bounds.y &&
      y <= mask.bounds.y + mask.bounds.h;
  } else if (mask.kind === "ellipse") {
    const cx = mask.bounds.x + mask.bounds.w / 2;
    const cy = mask.bounds.y + mask.bounds.h / 2;
    const rx = mask.bounds.w / 2;
    const ry = mask.bounds.h / 2;
    if (rx <= 0 || ry <= 0) inside = false;
    else {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      inside = nx * nx + ny * ny <= 1;
    }
  } else {
    // Bezier: use polygon fill of anchor points (approximation).
    inside = pointInPolygon(
      x,
      y,
      mask.points.map((p) => [p.x, p.y] as const),
    );
  }
  return mask.inverted ? !inside : inside;
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
