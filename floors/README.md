# Floors

Handmade floor files (data, not code). Each floor is a folder containing:

- `grid.txt`: the ASCII grid. Fixed terrain characters: `#` wall, `.` floor, `L` lava, `S` start, `U` stairs up, `D` stairs down. Any other character must be defined in the legend.
- `floor.json`: metadata: `id`, `index` (floor order, starting at 1), `minimumPlayers`, and `legend`, mapping each extra grid character to an entity `{ "id", "kind", ...props }`.

Entity kinds and their props:

| Kind          | Props                                                        | Notes                                               |
| ------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| `lever`       | `targets`: entity ids                                        | Interact to pull (one-way); switches targets on     |
| `door`        | —                                                            | Opens when a target of a lever; stays open on reset |
| `locked_door` | `lock`: name                                                 | Opened by using a key whose `opens` matches         |
| `item`        | `item`: `key` \| `torch` \| `weight`; keys also need `opens` | Picked up with Interact                             |
| `sign`        | `text`                                                       | Interact shows the text                             |
| `pit`         | `landing`: `{ floor, x, y }`                                 | Drops the hero to a lower floor                     |

Each legend character may appear once in the grid. Validate and solve every floor with `pnpm --filter @inferno/tools solve`.

The two current floors are ports of the prototype, used for testing; they are not launch content.
