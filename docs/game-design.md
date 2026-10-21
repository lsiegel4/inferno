# Inferno — Game Design Document

Status: Draft v4 · Last updated: 2026-10-20

Related: [API contracts](api-contracts.md) · [ADRs](adr/)

---

## 1. Vision

Inferno is a cooperative dungeon game inspired by *Twitch Plays Pokémon*. There is **exactly one copy of the game running globally**. Players do not create games — they join the one in progress and help (or hinder) a single shared hero.

The core experience is **collective puzzle solving**: every hero move is decided by a crowd vote, and later floors add enough complexity that the right decision is not immediately obvious. Communication (chat), discussion, and coordination are the game.

> Revised 2026-10-04. The original pitch centred on concurrent button presses colliding (two players pressing "up" walking the hero into lava). Prototyping showed that free-for-all input ("anarchy") is unsatisfying and unplayable at scale, so the game is now democracy-only ([ADR-0017](adr/0017-democracy-only-input.md)).

- **Finite, handmade** floors of increasing difficulty: a **27-floor campaign**, one per circle (and ditch, and round) of Dante's Inferno, from the Gate to Judecca ([floors/DESIGN.md](../floors/DESIGN.md)).
- Each floor requires a **minimum number of active players** to be playable.
- When the final floor is beaten: **game over**. The site remains online in a **read-only** state.

## 2. The hero and controls

- **One shared hero**, moved by the votes of all logged-in active players.
- **Top-down, 2D grid** view.
- Base controls:

| Control | Behavior |
|---|---|
| Up / Down / Left / Right | Move one tile. Moving into a wall/blocked tile turns the hero to face that direction instead (this still consumes a turn). |
| Jump | Hop over exactly one tile in the facing direction, and **only over lava or a hole the crowd can see** (a pit, a sprung trap, a collapsed ledge). Walls, enemies, blocks, beams, vents, plain floor and unsprung traps cannot be jumped, so a jump never gives a hidden trap away. Landing on a hazard kills the hero. |
| Interact (Action) | Interact with the tile the hero faces (items lying on the floor block movement and are picked up this way) (lever, door, push block, roadblock enemy, etc.). The button label changes to match the context (e.g. "Open", "Push"). |
| Use | Opens the inventory menu; the player picks an item, sending `use(itemId)`. Items act on the faced tile (a weight stone can also be set down on the plate underfoot). |
| Wait | Do nothing for one turn; the world still advances (moving elements step forward). |

- Floor designers may **unlock new controls and items** per floor.
- There is **no turn-in-place action** (deferred). Facing changes only by moving or by bumping a blocked tile.
- **Mobile (portrait only) is required.** Desktop also supports keyboard bindings.

## 3. Turn-based world

- **One hero action = one turn.** Moving entities (patrolling enemies, very slow moving platforms) advance once per turn.
- **No actions → no turns → the world is frozen.**
- There is no real-time dexterity challenge. Difficulty comes from puzzles, turn-based timing (e.g. patrol patterns), and crowd coordination.

## 4. Input resolution — democracy

All actions are **intents**, validated against the current state when applied (see [ADR-0002](adr/0002-intent-based-action-validation.md)).

- **Every hero turn is decided by vote** ([ADR-0017](adr/0017-democracy-only-input.md)).
- Each logged-in active user may cast **one vote per tick**, and **cannot change it**.
- Vote options are the distinct actions (each direction, Jump, Interact, and each `use(itemId)` is a separate option).
- **A tick opens when the first vote arrives** (nothing ticks while everyone is thinking). It lasts at least 1 second and at most 3 seconds from that first vote: it ends at 3 s, or as soon as every active player has voted (but never before 1 s).
- The winning option is applied as the turn. **A tick with zero votes produces no turn.**
- **Ties** are broken by random selection among the tied options (never stall play).
- **Invalid votes are counted.** If an action that is invalid at tally time wins (e.g. `use` of an item no longer held), the turn is consumed with no effect.
- The live vote tally and tick countdown are shown to everyone.
- **The crowd's split is part of the turn.** Each turn records the winner's share of the votes and the runner-up action (`crowd`), because some mechanics depend on it: the **echo** performs the runner-up vote, an **altar** works only if enough of the crowd agreed, a **vigil** needs many Waits in a row ([ADR-0020](adr/0020-crowd-aware-mechanics.md)).

## 5. Activity and pausing

### 5.1 Definitions

- **Online:** has the app open (connection heartbeat).
- **Active:** logged in **and** has performed a qualifying activity in the last **W = 60 seconds**.
  - Qualifying activity: **votes, Ready presses.**
  - **Chat does not count.**
- **Spectator:** a derived label (not a separate mode) for anyone online but not active, including anonymous viewers. Shown in the UI, e.g. "12 playing · 30 watching".

### 5.2 Minimum players and pause rules

- Each floor has a **designer-set fixed minimum** active-player count. Early floors require only **1–2 players**; the minimum ramps up on later floors.
- Revisiting a lower floor uses **that floor's own minimum**. Stairs display the destination floor's minimum.
- **Hysteresis:**
  - **Unpause** immediately when active count ≥ minimum.
  - **Pause** only after active count has been below the minimum for **G = 10 seconds**.
- **Ready button:** shown only while paused. Pressing it counts as activity, so an online player can mark themselves active without a game action. Merely being online never counts.
- The game **starts paused** until enough players are active. Active players must also be **connected** (closing the tab stops counting at once). **Pausing mid-tick discards** the votes cast so far. Spectators shown = connections minus active players.

### 5.3 Pause screen

- "Need X more players" counter + **Ready** button
- **Share** button (copy link, native share sheet on mobile, QR code)
- **Chat** remains usable
- **Ad slot** — non-blocking; never covers controls or chat

## 6. Floors and progression

- Floors are **handmade** and **finite**.
- A floor is completed by **reaching the stairs up**. The hero arrives at the **start point of the next floor**.
- **Stairs back down** to previous floors are always available (voluntary backtracking, e.g. to fetch a forgotten item). Taking them, the hero arrives **on the previous floor's stairs-up tile**; climbing again requires stepping off and back on.
- Designers may place **pits** that drop the hero to a lower floor; the **landing spot is set by the designer** per pit.
- **Leaving a floor** (stairs down or pit) **preserves that floor's puzzle state**.
- Climbing to a floor whose minimum isn't met will pause the game (intended).

## 7. Hazards, enemies, death

### 7.1 Hazards and enemies

- **Environmental hazards** (lava, spikes, etc.) kill the hero.
- **No combat.** "Enemies" are **roadblocks** that require solving a puzzle to get past.
  - They may be **static** or **patrolling** (moving once per turn).
  - Contact with an enemy **can kill** the hero.

### 7.2 Death → floor reset

On death the hero returns to the floor's start point, facing up, and the floor resets as follows:

| Element | On death |
|---|---|
| Opened doors | Stay open (and the levers that opened them stay pulled) |
| Items in inventory (including ones picked up on this floor) | Kept |
| Items **used** on this floor | Returned to inventory — **except a key used on a door that stays open** (the key is not returned). A weight stone on a plate returns to the inventory and the plate releases; a torch's light is removed. |
| Puzzle elements (blocks, levers, etc.) | Reset — blocks return to their start tiles and lava/pits they filled revert |
| Solved/cleared roadblock enemies | Stay cleared |
| Unsolved roadblock enemies | Return to starting positions |
| Sprung traps | **Stay sprung and revealed** (still deadly), so the crowd learns a floor by dying on it |
| Planks laid on this floor | Removed; the plank returns to the inventory |
| Switches and the doors they hold | Reset |

**Design rule:** a floor reset must never leave a puzzle requiring a consumed item that cannot be recovered (enforced by floor design, backed by the "used items return" rule).

## 7a. Puzzle mechanics (v1)

The rules engine treats each mechanic as a self-contained entity type ([ADR-0019](adr/0019-entity-type-rules-engine.md)). **The exact rules and floor-file settings for every kind are in [floors/README.md](../floors/README.md)**; design rules learned while building the campaign are in [floors/DESIGN.md](../floors/DESIGN.md). Summary:

| Group | Mechanics |
|---|---|
| Terrain | walls, floor, lava, **ice** (`I`: the hero and blocks slide), stairs up/down, start |
| Doors and wiring | lever (latches for good; may target other floors), switch (toggle; resets on death), door (`need`, lights-out `parity`, `inverted`; never closes on the hero or a body), locked door + key, pressure plate, receiver (lit by a beam) |
| Moving world (turn cycles) | ferry (`platform`, carries the hero over lava), fire vents (rhythms, rolling fire waves), patrols (telegraph their next step; kill on contact; wait when blocked), watchers (`statue`: frozen and pushable while lit and in front of the hero, otherwise step toward the hero) |
| The crowd itself | **echo** (the Shade of Dissent: performs the runner-up vote), **altar** (works only if 66–90% voted as one), **vigil** (Wait N turns in a row) |
| Hidden information | darkness (viewport / torchlight / line of sight), hidden traps (optionally hinted, indistinguishable from harmless cracks), crumbling ledges, portals (destination not shown), one-way tiles |
| Beams | emitters, mirrors (Interact turns them), receivers; beams burn and give light |
| Items | key, torch, weight stone, **plank** (bridges lava or a hole; returned on death), **hourglass** (freezes the world for three steps, except the echo) |
| Bodies | blocks (pushed one at a time, fill lava and holes, not onto stairs), watchers, patrols and the echo press plates and hold doors |

**Turn order:** the hero acts first; then the world moves (ferries carry the hero first, then the echo, patrols, watchers, fire vents); then plates, doors and beams settle.

## 8. Inventory

- The inventory belongs to the **hero** (shared by everyone).
- **No size limit.**
- Item use goes through the normal vote (`use(itemId)` is a vote option).

## 9. UI / UX

### 9.1 Layout (mobile portrait)

- **Top:** game map (Canvas).
- **Bottom:** always-visible D-pad + **Jump** + **Interact** buttons; **Use** opens an item menu; **Wait** sits in the action column with Jump, Interact and Use.
- **Chat** and **event log** in tabs or a pull-up sheet.
- Header: floor number, "X playing · Y watching", minimum for floor.
- Under the map: live vote tally and tick countdown.
- Landscape is **not** supported for now.
- **Follow camera (v1):** the map shows a 9 × 13 tile window centred on the hero (clamped at floor edges); everyone shares the same camera.
- **Explored floor map (v1):** a Map button opens a full-floor view showing only explored areas (terrain, objects, and the hero once discovered); unexplored areas stay dark. The explored map is **shared** (tracked by the server, the same for everyone, and saved with the game). A tile is explored once it has appeared in the camera window — on dark floors, once it has been lit. It is **kept through deaths** and floor resets; objects on it show their current state.
- **Share:** copy link and the device's native share sheet (no QR code for now).

### 9.2 Desktop

Same layout, plus keyboard bindings for all controls.

### 9.3 Event log

- Shows **hero turns only** (the applied action), **without player names**.
- Players do **not** receive private "your press was chosen" feedback.

### 9.4 Sharing

- A plain share link to the game. No referral tracking and no preview card for now.

## 10. Data and logs

| Data | Retention | Notes |
|---|---|---|
| Hero turn log | Forever | Event-sourced game history; **contains no user IDs** (see ADR-0009, ADR-0012) |
| Every vote | Forever | Batched one item per tick; tied to an internal user ID |
| Chat | **3 days** | Not shown after game over |
| Snapshots | Rolling (count TBD) | For crash recovery |

## 11. Identity and moderation

- **Watching** requires no login. **Chatting and acting** require **Google sign-in**.
- Sessions: opaque server-side token in an HttpOnly cookie, 30-day sliding expiry with no absolute cap; users may stay logged in on several devices ([ADR-0018](adr/0018-sessions-opaque-token-httponly-cookie.md)).
- Active players are counted **per account**, with **one live session per account** (a new connection demotes the old one to spectator).
- **Handles:** user picks one, default is a random name. 3–20 characters, letters/numbers/underscore, unique, profanity-filtered. The Google name is never shown.
- **Chat moderation:** profanity filter; rate limit **1 message per 2 seconds**, **200 characters max**.

## 12. Monetization

- Ads via a **generic ad-slot component**; start with **AdSense or no ads** at launch; switch networks once traffic exists.
- Placements: **pause screen** (non-blocking) and a **banner on the sign-in screen**.
- **Never during play.**

## 13. Privacy

- Store only the Google `sub` (stable account ID) mapped to an internal user ID, and the handle. **No email** stored. Minimal/truncated IP logging.
- Account deletion: remove the internal ID ↔ Google `sub`/handle mapping. Presses and chat remain but become anonymous.
- Requires a privacy policy and a cookie-consent banner for ads (GDPR/CCPA). *Not legal advice — verify.*

## 14. Bandwidth

No hard per-user target (see [ADR-0016](adr/0016-bandwidth-approach.md)). Estimate ≈ 0.25 KB/s per user excluding chat (at most ~1 turn per tick plus a tally update per second). Protocol is built from day one with deltas, one message per turn, and batched presence. A CloudWatch alarm fires at **> 0.75 KB/s per user** or **> 50 concurrent users** to trigger review.

## 15. Tunable values

| Name | Value |
|---|---|
| Activity window W | 60 s |
| Pause grace period G | 10 s |
| Vote tick | min 1 s, max 3 s; ends early when every active player has voted |
| Votes per user | 1 per tick, not changeable |
| Chat rate limit | 1 msg / 2 s, 200 chars |
| Chat retention | 3 days |

## 16. Known future problems

- **Chat at scale** ([ADR-0015](adr/0015-chat-at-scale-known-problem.md)).
- **Fan-out at tens of thousands of users** — gateway/fan-out tier split ([ADR-0001](adr/0001-single-authoritative-game-process.md)).

## 17. Open items (not yet decided)

1. **Profanity filter** library/service.
2. **Jump availability in the game client.** The floor lab disables Jump when it would fail (`canJump`); the multiplayer client still offers it and an impossible jump uses the turn with no effect. Decide whether the client should compute this.
3. **Minimum players per floor** ramp from 1 to 20 across the campaign: a starting point to tune against real traffic.

## 18. Under exploration (not decided)

Ideas raised during prototyping. None of these are approved.

- **Off-screen levers.** Not seeing which door a lever opens is acceptable.
- **Further puzzle mechanics** after v1 (see §7a).
