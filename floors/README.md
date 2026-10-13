# Floors

Handmade floor files (data, not code). Each floor is a folder containing:

- `grid.txt`: the ASCII grid. Fixed terrain characters: `#` wall, `.` floor, `L` lava, `S` start, `U` stairs up, `D` stairs down. Any other character must be defined in the legend.
- `floor.json`: metadata: `id`, `index` (floor order, starting at 1), `minimumPlayers`, `legend` (mapping each extra grid character to an entity `{ "id", "kind", ...props }`), and an optional `reveal`.

`reveal` controls darkness (default `{ "mode": "viewport" }`, the whole floor is visible):

| Mode            | Example                                    | Revealed tiles                                               |
| --------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `viewport`      | `{ "mode": "viewport" }`                   | Everything                                                   |
| `torchlight`    | `{ "mode": "torchlight", "radius": 3 }`    | Within `radius` of the hero or a light source                |
| `line_of_sight` | `{ "mode": "line_of_sight", "radius": 5 }` | Like torchlight, but walls and blocking entities block sight |

Distances are Euclidean (`dx² + dy² ≤ radius²`). Items in darkness are hidden until lit. Preview the modes with `pnpm --filter @inferno/tools previews`.

Entity kinds and their props:

| Kind          | Props                                                        | Notes                                                                                                                                                      |
| ------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lever`       | `targets`: entity ids                                        | Interact to pull (one-way); switches targets on                                                                                                            |
| `door`        | —                                                            | Lever: opens for good (stays open on reset). Plate: open only while the plate is pressed, never closing on the hero or a block                             |
| `block`       | —                                                            | Pushed one tile by moving into it (no chains, not onto stairs); can't be jumped over; fills lava or a pit it is pushed into; returns to its start on death |
| `plate`       | `targets`: entity ids                                        | Walkable; pressed by the hero, a block, or a weight stone; switches targets on while pressed, off when released                                            |
| `locked_door` | `lock`: name                                                 | Opened by using a key whose `opens` matches                                                                                                                |
| `item`        | `item`: `key` \| `torch` \| `weight`; keys also need `opens` | Picked up with Interact                                                                                                                                    |
| `sign`        | `text`                                                       | Interact shows the text                                                                                                                                    |
| `pit`         | `landing`: `{ floor, x, y }`                                 | Drops the hero to a lower floor                                                                                                                            |
| `light`       | optional `radius` (defaults to the floor's radius)           | Light source for darkness; does not block                                                                                                                  |

Using a torch while facing an open tile places a light there; the torch is returned and the light removed if the hero dies on that floor.

Using a weight stone while facing an empty plate places it there (pressing the plate); Interact while facing the plate picks it back up. A stone left on a plate returns to the inventory if the hero dies on that floor.

Each legend character may appear once in the grid. Validate and solve every floor with `pnpm --filter @inferno/tools solve`.

The two current floors are ports of the prototype, used for testing; they are not launch content.
