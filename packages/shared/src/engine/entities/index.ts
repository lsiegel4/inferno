import { registerEntityType, registerItemType } from "../registry.js";
import { block } from "./block.js";
import { door } from "./door.js";
import { item } from "./item.js";
import { lever } from "./lever.js";
import { light, torch } from "./light.js";
import { lockedDoor } from "./locked-door.js";
import { pit } from "./pit.js";
import { plate } from "./plate.js";
import { sign } from "./sign.js";

/** Every built-in mechanic, registered once. Adding a mechanic = one module + one line here. */
for (const t of [lever, door, lockedDoor, item, sign, pit, light, block, plate]) {
  registerEntityType(t);
}
for (const t of [torch]) registerItemType(t);
