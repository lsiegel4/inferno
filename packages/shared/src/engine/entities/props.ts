/** Small helpers for reading legend props, which arrive as unknown JSON. */
import type { FloorDef, PlacedEntity } from "../../floor.js";
import { REMOTE_SEPARATOR } from "../context.js";

export function stringProp(props: Record<string, unknown>, key: string): string | undefined {
  const v = props[key];
  return typeof v === "string" ? v : undefined;
}

export function stringListProp(props: Record<string, unknown>, key: string): string[] {
  const v = props[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function numberProp(props: Record<string, unknown>, key: string, fallback: number): number {
  const v = props[key];
  return typeof v === "number" ? v : fallback;
}

/**
 * Check a `targets` list: present, and every id names an entity on this floor. With
 * `allowRemote`, "floorId/entityId" may name an entity on another floor (latching sources only).
 */
export function validateTargets(
  what: string,
  e: PlacedEntity,
  floor: FloorDef,
  all: ReadonlyMap<string, FloorDef>,
  allowRemote: boolean,
): string[] {
  const targets = stringListProp(e.props, "targets");
  if (targets.length === 0) return [`${what} "${e.id}" has no targets`];
  const ids = new Set(floor.entities.map((x) => x.id));
  const problems: string[] = [];
  for (const t of targets) {
    const sep = t.indexOf(REMOTE_SEPARATOR);
    if (sep < 0) {
      if (!ids.has(t)) problems.push(`${what} "${e.id}" targets unknown "${t}"`);
      continue;
    }
    const other = all.get(t.slice(0, sep));
    if (!allowRemote) problems.push(`${what} "${e.id}" cannot target another floor ("${t}")`);
    else if (!other || !other.entities.some((x) => x.id === t.slice(sep + 1))) {
      problems.push(`${what} "${e.id}" targets unknown "${t}"`);
    }
  }
  return problems;
}
