/** Small helpers for reading legend props, which arrive as unknown JSON. */
export function stringProp(props: Record<string, unknown>, key: string): string | undefined {
  const v = props[key];
  return typeof v === "string" ? v : undefined;
}

export function stringListProp(props: Record<string, unknown>, key: string): string[] {
  const v = props[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
