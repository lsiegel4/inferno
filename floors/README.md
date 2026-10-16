# Floors

Handmade floor files (data, not code). Each floor is a folder containing:

- `grid.txt`: the ASCII grid. Fixed terrain characters: `#` wall, `.` floor, `L` lava, `I` ice, `S` start, `U` stairs up, `D` stairs down. Any other character must be defined in the legend.
- `floor.json`: metadata: `id`, `index` (floor order, starting at 1), `name` (optional display name), `minimumPlayers`, `legend` (mapping each extra grid character to an entity `{ "id", "kind", ...props }`), an optional `reveal`, and an optional `carry` (item ids the crowd must still hold when it leaves, because a later floor needs them; the solver checks it).

Legend entries may also set:

- `"on": "L"` (or `"I"`, `"."`): the terrain under the entity. A ferry floats `on` lava; a plate can sit `on` ice. Default `.`.
- `"many": true`: the character may appear any number of times; each copy is its own entity with id `<id>-<x>-<y>`. Without it, a character appears once.

`reveal` controls darkness (default `{ "mode": "viewport" }`, the whole floor is visible):

| Mode            | Example                                    | Revealed tiles                                               |
| --------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `viewport`      | `{ "mode": "viewport" }`                   | Everything                                                   |
| `torchlight`    | `{ "mode": "torchlight", "radius": 3 }`    | Within `radius` of the hero or a light source                |
| `line_of_sight` | `{ "mode": "line_of_sight", "radius": 5 }` | Like torchlight, but walls and blocking entities block sight |

Distances are Euclidean (`dx² + dy² ≤ radius²`). Items in darkness are hidden until lit; firing beams light their own path.

## Turn order

The hero acts first; then the world moves (ferries, the echo, patrols, statues, fire vents, in that order); then plates, doors and beams settle. An action with no effect still uses the turn, and the world still moves.

## Entity kinds

| Kind          | Props                                                                             | Notes                                                                                                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lever`       | `targets`                                                                         | Interact to pull (one-way); switches targets on for good. Targets may be on other floors: `"floorId/entityId"`                                                                                                         |
| `switch`      | `targets`                                                                         | Interact flips it; holds its targets on while on, like a plate. Resets on death                                                                                                                                        |
| `door`        | optional `need`, `parity`, `inverted`                                             | Lever: opens for good. Plate/switch/receiver: open while held. `need: n`: n holders at once. `parity`: open while an odd number hold it. `inverted`: starts open, sources close it. Never closes on the hero or a body |
| `block`       | —                                                                                 | Pushed one tile (no chains, not onto stairs); slides on ice; fills lava or a hole it is pushed into; can't be jumped over; returns to its start on death                                                               |
| `plate`       | `targets`                                                                         | Walkable; pressed by the hero, a body (block, statue, patrol, echo) or a weight stone                                                                                                                                  |
| `locked_door` | `lock`                                                                            | Opened by using a key whose `opens` matches; the key is used up                                                                                                                                                        |
| `item`        | `item`: `key` \| `torch` \| `weight` \| `plank` \| `hourglass`; keys need `opens` | Picked up with Interact                                                                                                                                                                                                |
| `sign`        | `text`                                                                            | Interact shows the text                                                                                                                                                                                                |
| `pit`         | `landing`: `{ floor, x, y }`                                                      | Drops the hero to a lower floor                                                                                                                                                                                        |
| `light`       | optional `radius`                                                                 | Light source for darkness; does not block                                                                                                                                                                              |
| `platform`    | `dir`, needs `"on": "L"`                                                          | A ferry: moves one tile per turn over lava, turning back at the shore; carries the hero                                                                                                                                |
| `vent`        | `period` (≥ 2), `burn` (raised steps per cycle), `phase`                          | Fire on a rhythm: ending a turn on a raised vent kills. Clients see `up` and `next`                                                                                                                                    |
| `patrol`      | `route`: U/D/L/R/W steps, looping                                                 | Kills on contact either way; can't be jumped over; waits when blocked; a body. Clients see only `next`                                                                                                                 |
| `statue`      | —                                                                                 | Watcher: frozen and pushable while lit and in front of the hero; otherwise steps toward the hero each turn and kills on reaching it. A body                                                                            |
| `echo`        | —                                                                                 | The Shade of Dissent: performs the crowd's runner-up vote each turn; still when the crowd agrees. A body; dissolves in hazards and re-forms at its start                                                               |
| `trap`        | optional `effect`: `burn` \| `fall` (+ `landing`), `hint`                         | Hidden until sprung; then stays revealed through deaths. With `hint` it looks exactly like a `crack`                                                                                                                   |
| `crack`       | —                                                                                 | Harmless decoration, and cover for hinted traps                                                                                                                                                                        |
| `crumble`     | —                                                                                 | Collapses into a deadly hole when the hero steps off. Whole again after a death                                                                                                                                        |
| `portal`      | `to`: another portal's id                                                         | Moves the hero to the partner (no chains). Clients aren't told where it leads                                                                                                                                          |
| `oneway`      | `dir`                                                                             | Can be entered only travelling in `dir`                                                                                                                                                                                |
| `beam`        | `dir`, optional `off`                                                             | Fires a beam that burns the hero (and dissolves the echo) at the end of a turn; stopped by anything solid, turned by mirrors. Sources switch it off (with `off`: on)                                                   |
| `mirror`      | `slant`: `/` or `\`                                                               | Interact turns it                                                                                                                                                                                                      |
| `receiver`    | `targets`, optional `latch`                                                       | Holds its targets on while a beam strikes it; with `latch`, the first strike is for good                                                                                                                               |
| `altar`       | `targets`, `threshold` (default 0.75)                                             | Interact works only if that share of the votes agreed on it; then switches targets on for good                                                                                                                         |
| `vigil`       | `targets`, `turns` (default 5)                                                    | Stand on it and Wait `turns` turns in a row; then switches targets on for good                                                                                                                                         |

Using a torch while facing an open tile places a light there. Using a plank while facing lava or a hole bridges it. Both are returned, and the light or bridge removed, if the hero dies on that floor. A weight stone is put on the plate the hero faces or stands on; Interact picks it up again. An hourglass freezes the floor's world (everything but the echo) for three turns.

## Tools

| Command                                                        | What it does                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm --filter @inferno/tools solve`                           | Validate every floor, play them in order and print each shortest route      |
| `node tools/dist/solve-floors.js floors --only 12 --softlocks` | One floor, from a fresh start, checking every reachable state for softlocks |
| `node tools/dist/reach.js floors 12`                           | Show which tiles the hero can reach (for floors that can't be finished)     |
| `pnpm --filter @inferno/tools export-solutions`                | Write the solver routes for the floor lab (cached per floor)                |
| `pnpm --filter @inferno/client playtest`                       | The floor lab: play any floor with a simulated crowd                        |

See [DESIGN.md](DESIGN.md) for the campaign, the difficulty curve and the design decisions.
