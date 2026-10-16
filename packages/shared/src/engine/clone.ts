/**
 * Fast copies of engine data, which is plain JSON (numbers, strings, booleans, null, arrays and
 * plain objects). structuredClone is several times slower and dominated the solver's run time.
 */
import type { InventoryItem, RuntimeEntity } from "./types.js";

export function cloneJson<T>(v: T): T {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(cloneJson) as T;
  const out: Record<string, unknown> = {};
  for (const k in v) out[k] = cloneJson((v as Record<string, unknown>)[k]);
  return out as T;
}

/** Copy an entity. `props` (from the floor file) never change, so they are shared. */
export function cloneEntity(e: RuntimeEntity): RuntimeEntity {
  return { id: e.id, kind: e.kind, x: e.x, y: e.y, props: e.props, state: cloneJson(e.state) };
}

export function cloneItem(i: InventoryItem): InventoryItem {
  return { id: i.id, type: i.type, props: i.props };
}
