# Inferno: campaign design

Twenty-seven floors, one per circle (and ditch, and round) of Dante's Inferno, in his order: the
Gate to Judecca. Each floor introduces at most one or two mechanics and then combines them with
everything before. The floor lab (`pnpm --filter @inferno/client playtest`) plays them all.

## The yardstick

A crowd filters out visible danger: a hundred people rarely vote into lava they can see. So no
floor relies on visible danger alone. Difficulty comes from:

- **Unseen information**: darkness (`torchlight`, `line_of_sight`), hidden and hinted traps, portals
  that do not say where they lead, wiring (`targets`) that clients are never sent.
- **Non-local and delayed consequences**: levers, switches and receivers far from their doors;
  lights-out doors; watchers that move when you look away; cross-floor levers.
- **Route ambiguity**: identical cracks, three lying signs with one honest, decoy portals.
- **Irreversible choices within an attempt**: one-way drops, crumbling ledges, keys, planks, a
  block pushed into a corner. Death is the only undo, and on late floors a death is expensive.
- **Time pressure**: ferries, fire vents and rolling fire waves, patrols, an hourglass.
- **Mechanics that a big crowd makes harder, not easier**:
  - the **echo** performs the _runner-up_ vote, so the crowd must split its vote on purpose, and
    the hero and echo can never move the same way on the same turn;
  - **altars** work only if a share of the crowd (66% to 90%) votes as one;
  - **vigils** need the crowd to vote Wait many turns in a row.

  With one player none of these is hard; with a hundred, every troll and every distracted voter
  is noise the crowd has to beat.

## Decisions

Answers to the open questions in the design notes. All of these are implemented and tested.

**Turn cycles**

1. Turn order: the hero acts first, then the world moves (ferries carry the hero first, then the
   echo, patrols, statues, fire vents), then plates, doors and beams settle.
2. Ferries (`platform`) carry the hero standing on them.
3. A patrol walking into the hero kills, the same as the hero walking into a patrol. Patrols, and
   all enemies, cannot be jumped over.
4. Getting past roadblocks, each its own rule to work out:
   - **timing**: patrols telegraph only their next step, and wait when blocked;
   - **blocking**: a pushed block pins a patrol in place;
   - **switches**: levers and plates stop beams;
   - **light and gaze**: watchers (`statue`) freeze while lit and in front of the hero, and are
     pushable then;
   - **the crowd itself**: the echo can hold a plate or pull a lever the hero cannot reach.
   - The hourglass freezes everything but the echo for three turns.

**Hidden traps**

1. On death a sprung trap is not restored: it stays sprung and _revealed_ (it is still deadly).
   Everything else on the floor resets.
2. Once discovered, a trap stays visibly marked for good, so the crowd learns a floor by dying on it.
3. Hints: per trap. `hint: true` shows a crack that is pixel-identical to a harmless `crack`;
   without it there is no hint at all. Pushed blocks, statues and the echo spring traps too, so a
   crowd can test the ground.
4. Softlocks: every floor must stay finishable from every reachable state. Where that needs it,
   a floor has a lava pocket so the crowd can always choose to die and reset. The solver checks
   this (`--softlocks`) on every floor small enough to explore.

**Blocks and plates**: the seven merged choices stand. Since then:

- the weight stone can also be set down on the plate the hero _stands_ on (plates are walkable,
  so a crowd could rarely turn to face one);
- statues, patrols and the echo are bodies: they press plates and hold doors open.

**Items**: a plank laid over lava or a hole lasts until a death, which returns it (like a torch).
A permanent plank turned one wrong placement into a game-ending softlock.

**Floor-level**

1. Floors at launch: 27.
2. Difficulty curve: see the table.
3. Tutorial: floor I teaches moving, signs, levers and lava with three signs; floor II teaches
   jumping and waiting.
4. Theme: Dante's circles, in order. "Stairs up" (`U`) is drawn as a stairwell sinking deeper;
   pits throw you back to an earlier circle. Every floor has a sign in Dante's voice that is also
   its manual (or, on the fraud floors, a lie).

**Minimum players** ramp from 1 to 20: early floors are playable alone; crowd mechanics arrive
when a crowd is required (the echo needs at least three voters to split 2 to 1). A minimum above
the live audience pauses the game, so these are a starting point to tune against real traffic.

## The campaign

Turns are the solver's shortest route for a perfectly coordinated crowd. "Deadly" counts the
steps on that route where some available move kills (or drops a floor); "split" counts turns that
need a deliberate runner-up vote. A real crowd takes many times longer and dies often.

| #     | Floor                            | Min | New                                                                   | Turns | Deadly | Split |
| ----- | -------------------------------- | --- | --------------------------------------------------------------------- | ----: | -----: | ----: |
| I     | The Gate                         | 1   | moving, signs, levers, lava                                           |    16 |      3 |       |
| II    | Vestibule of the Uncommitted     | 1   | jumping, the vigil (Wait)                                             |    22 |     11 |       |
| III   | Acheron                          | 1   | ferries; a lever there opens a door here                              |    26 |      6 |       |
| IV    | Limbo                            | 2   | darkness, torches, keys; two identical gates                          |    27 |     12 |       |
| V     | The Tempest of Lust              | 2   | ice                                                                   |    19 |      4 |       |
| VI    | Gluttony                         | 2   | patrols (Cerberus), timing                                            |    29 |      8 |       |
| VII   | The Hoarders and the Wasters     | 3   | push blocks, plates, two at once, the stone                           |    28 |      7 |       |
| VIII  | The Marsh of Styx                | 3   | hinted traps among identical cracks                                   |    30 |     13 |       |
| IX    | The Gates of Dis                 | 4   | watchers                                                              |    23 |      9 |       |
| X     | The Burning Tombs                | 4   | fire vents on two rhythms                                             |    36 |     13 |       |
| XI    | Phlegethon                       | 5   | beams, mirrors, receivers; centaur patrols                            |    33 |      7 |       |
| XII   | The Wood of the Suicides         | 5   | line of sight; switches; lights-out; hidden traps                     |    95 |      1 |       |
| XIII  | The Burning Sands                | 6   | rolling fire waves; the hourglass                                     |    50 |     33 |       |
| XIV   | Geryon's Cliff                   | 6   | one-way drops, crumbling ledges, a lying sign                         |    48 |      2 |       |
| XV    | Malebolge: Panderers, Flatterers | 8   | marching demons; a three-sign logic puzzle                            |    51 |      8 |       |
| XVI   | Malebolge: the Simoniacs         | 8   | holes back to XV, false floors, planks                                |    35 |     15 |       |
| XVII  | Malebolge: the Sorcerers         | 8   | hidden portal network, one-way decoys                                 |    44 |      3 |       |
| XVIII | Malebolge: the Boiling Pitch     | 10  | demons circling a dark lake; a lying niche                            |    44 |     26 |       |
| XIX   | Malebolge: the Hypocrites        | 10  | a lights-out cloister with one solution                               |    39 |      7 |       |
| XX    | Malebolge: the Thieves           | 10  | serpents sweeping a dark pit, keys, portals                           |    34 |      2 |       |
| XXI   | Malebolge: the False Counsellors | 12  | mirror rooms in the dark                                              |    42 |     18 |       |
| XXII  | Malebolge: the Sowers of Discord | 12  | **the echo**                                                          |    29 |      7 |    19 |
| XXIII | Malebolge: the Falsifiers        | 12  | the echo freed, held, and kept during a vigil                         |    58 |     19 |    19 |
| XXIV  | The Well of the Giants           | 15  | **altars** (66/80/90%); a 199-tile spiral                             |   138 |     21 |       |
| XXV   | Cocytus: Caina and Antenora      | 15  | dark ice; watchers timed onto plates; echo ice                        |    55 |      9 |    18 |
| XXVI  | Cocytus: Ptolomea                | 18  | hidden traps blind; beams shared with the echo                        |     ? |      ? |     ? |
| XXVII | Cocytus: Judecca                 | 20  | everything: five fire lanes, dark ice, mirrors, watchers, a 90% altar |   191 |    136 |       |

## Design rules learned the hard way

- **Facing**: the hero turns only by bumping something. A tile you must face to jump, use an item
  on, or interact with needs a run-up tile or a wall to bump. Never put a hidden trap on the first
  tile after a corner (the crowd cannot turn to jump it).
- **Fire at corners**: two adjacent same-rhythm vents at a corner can never be crossed (you cannot
  jump around a corner). Stagger them one beat apart, the second _behind_ the first.
- **Doors held by two things**: a door that needs two plates closes the moment either holder leaves.
  The hero's plate must be next to the door, so the hero steps from the plate into the doorway.
- **The echo and doors**: the hero and the echo cannot walk through a one-tile door together (they
  never move the same way on the same turn). Give them separate routes, or latch the door.
- **Watchers do not wait**: they move from turn one, wherever the hero is. Lock a watcher in until
  the hero arrives, and release it with a switch, not a lever: a lever stays pulled after a death,
  so every later attempt would start with the watcher already loose.
- **Search size**: the solver explores every state. Two free bodies (hero and echo, or two
  watchers) in an open room multiply; keep those areas small and corridor-shaped, and split long
  floors into sections joined by one-way tiles.
