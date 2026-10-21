# Inferno — Design Worklist: Mechanics and Floor Content

Last updated: 2026-10-20

Everything we've discussed about puzzle mechanics and floor content, in one place, so you can work through it at your own pace. Items marked **decision** need an answer from you before I can build them. Details live in [game-design.md](game-design.md) §7a and §17–18.

> **Status (2026-10-20):** most of this list was worked through in the floor-design session (PR #9), with its answers recorded in [floors/DESIGN.md](../floors/DESIGN.md):
> - The 27-floor campaign is built and verified by the solver.
> - Turn cycles, hidden traps, every brainstormed mechanic except roadblock "behaviours" beyond watchers and patrols, the plank and the hourglass are implemented.
> - The 7 blocks-and-plates choices stand.
>
> **Confirmed 2026-10-20:** all six decisions from that session (jump rule, revealed traps, crowd mechanics, turn order, planks and the weight stone, 27 floors). Minimum players will change with tuning. The client now disables Jump when it would fail.
>
> **Still open:** tune minimum players against real traffic; look and feel (§6), including **unifying the map's art style with the rest of the interface**.

---

## 1. Design goal (the yardstick for every floor)

- **Collective puzzle solving.** Every move is a crowd vote, so floors must make the right move *not obvious* (ADR-0017).
- Democracy filters out **visible** danger: a crowd rarely votes into lava it can see. Difficulty has to come from:
  - **unseen information**: darkness, unexplored areas, hidden traps;
  - **non-local or delayed consequences**: a lever here changes something over there, or later;
  - **route ambiguity**: two plausible paths split the vote;
  - **irreversible choices**: using up a key, filling the wrong lava tile with a block;
  - **time pressure from turn cycles**: patrols and gates that move every turn.
- The world is **turn-based**: nothing moves unless the crowd takes a turn. There's no real-time dexterity.

---

## 2. Mechanics already built (available for floors today)

| Mechanic | Key rules |
|---|---|
| Walls, floor, lava, start | Lava kills; death resets the floor (doors stay open, items kept, puzzle elements reset) |
| Stairs up / down | Up → next floor's start. Down → previous floor's stairs-up tile (step off and back on to climb again) |
| Pits | Drop the hero to a lower floor at a landing spot you choose |
| Jump | One tile in the facing direction; can't clear walls, blocking objects or blocks |
| Turn in place | Moving into something blocked turns the hero and uses the turn (there is no separate turn action) |
| Wait | Pass a turn; the world advances |
| Levers + doors | One-way pull; a door opened by a lever stays open forever, including through deaths |
| Locked doors + keys | A key opens the matching lock and is used up (not returned on reset) |
| Items | Picked up with Interact while facing them; hidden in darkness until lit |
| Torch | Places a light on the faced tile; returned and its light removed if the hero dies on that floor |
| Signs | Interact shows the text to everyone (2 s overlay + event log) — clues, riddles, red herrings |
| Darkness | Per floor: `viewport`, `torchlight`, or `line_of_sight`, with a radius per floor; light sources are objects; round light pools; nothing remembered |
| Explored map | Shared by everyone; counts what's been on screen (on dark floors, only what was lit); kept through deaths |
| Push blocks | Push one at a time (no chains); can't jump over them; a block pushed into lava or a pit fills it; blocks reset on death |
| Pressure plates | Pressed by the hero, a block, or a weight stone; can control several doors or other mechanics; a door never closes on someone |
| Weight stone | Placed on a faced plate; Interact picks it up again; reusable; returned if the hero dies |

### Decision: blocks and plates choices (already merged — confirm or change)
1. Blocks **can't be pushed onto stairs** (so a block can't seal the way out).
2. After a death, **plate-held doors start closed** and follow their plates; lever-opened doors stay open.
3. A door controlled by **both a lever and a plate ignores the plate** once the lever is pulled.
4. A **filled block** (in lava or a pit) is plain floor; it doesn't count as "in the doorway".
5. Plates on a floor the hero has left **aren't re-checked until the hero returns**. A door held open by standing on a plate stays open while away and closes on the first turn back.
6. A filled tile stays filled until a death; a **second block** pushed onto it just moves there.
7. Clients can see whether a door is lever-locked or plate-held (and by which plates), whether a plate is pressed and holds a stone, and whether a block has filled a tile.

---

## 3. Mechanics that need your decisions

### Turn-cycle elements (platforms, gates, patrolling roadblocks)
Designed for v1, not built yet. **Decisions:**
1. **Turn order:** does the hero act first and the world move second, or the other way round?
2. **Platforms:** does a platform carry the hero standing on it?
3. **Patrols:** does a patrol walking into the hero kill it, the same as the hero walking into a patrol?
4. **Getting past a roadblock:** roadblocks are "enemies" you get past with a puzzle, not combat. What's the puzzle? Ideas to react to:
   - **Timing:** wait for a gap in the patrol (needs Wait);
   - **Blocking:** push a block into its path, which changes the route;
   - **Item:** give it an item (it lets you pass);
   - **Switch:** a lever or plate that stops or reroutes it;
   - **Light:** it only moves in darkness, or freezes when lit.

### Hidden traps (under exploration)
E.g. a floor tile that crumbles when stepped on. **Decisions:**
1. **On death:** does a crumbled tile come back (like other puzzle elements)?
2. **Once discovered:** does a trap stay visibly marked, or rely on the crowd's memory?
3. **Hints:** a subtle hint (a faint crack) or none at all?
4. **Softlocks:** design rule that a reset must restore the trap, or another route must exist.

(Technical note: the server will never send undiscovered traps to players.)

---

## 4. Mechanics brainstormed but not scheduled

Pick any to promote to "next". Each one needs its rules written down first.

| Idea | How it works | Why it's interesting for a voting crowd |
|---|---|---|
| Ice / slide tiles | The hero slides until something stops it | Easy to see, hard to route |
| Crumbling floors | Each tile can be stepped on once | Route planning; a mistake can't be undone |
| Teleporter pairs | Step on one, appear at its partner | Mapping puzzle; which pad links to which? |
| Toggle levers / lights-out | A lever toggles several doors; pulling again undoes it | Hard to predict; the crowd argues about order |
| One-way doors | Passable in one direction only | Commits the crowd to a route |
| Roadblock behaviours | Statue that moves only when you face away; guard that copies your moves | Each enemy's rule has to be worked out |
| Beams and mirrors | Interact rotates mirrors to aim a beam at a target | Long chains of cause and effect |
| Cross-floor links | A lever on floor 5 opens a door on floor 3 | Rewards the shared map and memory; uses backtracking |
| More items: plank | Bridges one lava tile ahead | Alternative to a push block |
| More items: hourglass | Freezes turn cycles for 3 turns | Strategic resource with turn cycles |

---

## 5. Floor content work

### Floor patterns to design with
- **Split paths:** two routes that look equally good, to divide the vote.
- **Red herrings:** a useless lever, or a sign that misleads.
- **Delayed consequences:** a lever opens one door and quietly closes another far away.
- **Unseen danger:** dark floors, unexplored rooms, (later) hidden traps.
- **Backtracking:** an item needed on floor 4 lies on floor 2 (stairs down are always available).
- **Brutal sections, on purpose:** pits that drop a floor, only where you want high stakes.

### Per-floor settings you choose
- **Minimum players:** early floors need just 1–2, then it ramps up. What curve?
- **Reveal mode and radius:** viewport, torchlight or line of sight.
- **Size:** the camera shows 9 × 13 tiles; floors can be much larger (the 25 × 31 test floor works).
- **Pit landing spots** and where stairs sit.
- **Which new controls and items unlock** on this floor (from the original design).

### Floor-level decisions
1. **How many floors at launch?** The game is finite and ends at the last floor ("game over", then the site stays up read-only).
2. **Difficulty curve:** which mechanics are introduced on which floor? (E.g. floor 1 levers, floor 2 darkness, floor 3 blocks...)
3. **Tutorial floor?** Signs explaining controls on floor 1?
4. **Theme per floor:** Dante's circles? The UI already numbers floors in Roman numerals.

### How to author a floor
- Each floor is a folder in `floors/`: `grid.txt` (ASCII grid) plus `floor.json` (id, index, minimum players, reveal, and a legend for each special character). See `floors/README.md` for every object kind and its settings.
- Check your work with `pnpm --filter @inferno/tools solve`: it validates every floor and prints the shortest route and how many steps have a deadly option.
- The two current floors are prototype ports for testing, not launch content.
- **Optional tool:** I can build a visual floor preview or editor if hand-editing ASCII gets tedious. **Decision:** want one?

---

## 6. Look and feel (from your first playtest)

The current look is a starting point ("engraved manuscript": an old-print display font, hatched stone, ink outlines, an ember accent). Note anything you'd like changed while you play:
- colours, fonts, density;
- how objects and the hero are drawn;
- control layout on your phone;
- what the record and chat show.

**Decided (October 2026):**

- **Interface:** the Manuscript look (engraved umber and parchment, gilt rules, IM Fell display
  over Alegreya Sans). The Obsidian and Brimstone directions were tried and set aside.
- **Art direction:** the map art is to be redrawn in the style of Gustave Doré's engravings for
  the Inferno: ink linework, cross-hatched shadow, sepia and bone, with fire and ember the only
  strong colours. It stays drawn in code (vector), so it scales and needs no asset pipeline.
- **Enemies are themed by circle** (Cerberus in Gluttony, centaurs by Phlegethon, hooked demons
  in the Malebolge, serpents among the thieves, and so on), so each circle looks distinct.
- **First step:** one floor's worth of art (walls, floor, lava, the hero, one enemy, a sign, a
  door, a lever) shown side by side with the current look, before redrawing the rest.
- **Done:** the sample was approved and the whole map is now drawn engraved (the classic
  drawings are gone). The lab's dev drawer has an **Art sheet** showing every terrain, thing,
  state and creature.
