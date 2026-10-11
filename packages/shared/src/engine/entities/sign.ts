import type { EntityType } from "../registry.js";
import { stringProp } from "./props.js";

/** Sign: blocks movement; Interact shows its text to everyone (overlay + event log). */
export const sign: EntityType = {
  kind: "sign",
  blocksMove: () => true,
  onInteract(ctx, e) {
    ctx.emit({ type: "sign_read", entityId: e.id, text: stringProp(e.props, "text") ?? "" });
    return true;
  },
  validate: (e) => (stringProp(e.props, "text") ? [] : [`sign "${e.id}" has no text`]),
};
