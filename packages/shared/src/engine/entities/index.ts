import { registerEntityType, registerItemType } from "../registry.js";
import { altar, vigil } from "./altar.js";
import { beam, mirror, receiver } from "./beam.js";
import { block } from "./block.js";
import { crumble } from "./crumble.js";
import { door } from "./door.js";
import { echo } from "./echo.js";
import { item } from "./item.js";
import { lever } from "./lever.js";
import { light, torch } from "./light.js";
import { lockedDoor } from "./locked-door.js";
import { oneway } from "./oneway.js";
import { patrol } from "./patrol.js";
import { pit } from "./pit.js";
import { plate, weight } from "./plate.js";
import { platform } from "./platform.js";
import { portal } from "./portal.js";
import { sign } from "./sign.js";
import { statue } from "./statue.js";
import { toggleSwitch } from "./switch.js";
import { bridge, hourglass, plank } from "./tools-items.js";
import { crack, trap } from "./trap.js";
import { vent } from "./vent.js";

/** Every built-in mechanic, registered once. Adding a mechanic = one module + one line here. */
for (const t of [
  lever,
  door,
  lockedDoor,
  item,
  sign,
  pit,
  light,
  block,
  plate,
  platform,
  vent,
  patrol,
  statue,
  echo,
  trap,
  crack,
  crumble,
  portal,
  toggleSwitch,
  oneway,
  bridge,
  beam,
  mirror,
  receiver,
  altar,
  vigil,
]) {
  registerEntityType(t);
}
for (const t of [torch, plank, hourglass, weight]) registerItemType(t);
