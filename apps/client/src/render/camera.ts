import { cameraOrigin, VIEW_HEIGHT, VIEW_WIDTH } from "@inferno/shared";

/**
 * Where the 9 × 13 view starts, in tiles. It follows the hero like the server's camera window,
 * but a floor smaller than the view is centred in it instead of hugging the top-left corner.
 */
export function viewOrigin(
  hero: { x: number; y: number },
  floor: { width: number; height: number },
): { x: number; y: number } {
  const o = cameraOrigin(hero, floor);
  return {
    x: floor.width < VIEW_WIDTH ? (floor.width - VIEW_WIDTH) / 2 : o.x,
    y: floor.height < VIEW_HEIGHT ? (floor.height - VIEW_HEIGHT) / 2 : o.y,
  };
}
