import { HANDLE_PATTERN } from "@inferno/shared";

const ADJECTIVES = [
  "ashen",
  "brave",
  "cinder",
  "ember",
  "flint",
  "gilded",
  "hollow",
  "molten",
  "quiet",
  "rusty",
  "scorched",
  "smoky",
  "swift",
  "tawny",
  "wary",
];
const NOUNS = [
  "badger",
  "beetle",
  "fox",
  "heron",
  "lantern",
  "moth",
  "newt",
  "otter",
  "owl",
  "raven",
  "salamander",
  "stoat",
  "toad",
  "wren",
  "yak",
];

export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle);
}

/** A random default handle like "ember_otter_42" (always matches HANDLE_PATTERN). */
export function randomHandle(rng: () => number = Math.random): string {
  const pick = (list: string[]) => list[Math.floor(rng() * list.length)]!;
  return `${pick(ADJECTIVES)}_${pick(NOUNS)}_${Math.floor(rng() * 100)}`;
}
