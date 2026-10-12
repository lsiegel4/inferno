# Inferno

A cooperative dungeon game inspired by Twitch Plays Pokémon. One global game, one shared hero, and every move is decided by a crowd vote.

## Repo layout

| Path              | Contents                                                                 |
| ----------------- | ------------------------------------------------------------------------ |
| `packages/shared` | Protocol types, rules engine, floor format (shared by client and server) |
| `apps/server`     | Game process: single writer, WebSocket and REST                          |
| `apps/client`     | React + Canvas frontend                                                  |
| `infra`           | AWS infrastructure (CDK)                                                 |
| `floors`          | Handmade floor files                                                     |
| `tools`           | Floor solver/validator, bot and load harness                             |

## Development

Requires Node 22 (see `.nvmrc`) and pnpm via Corepack:

```sh
nvm use
corepack enable
pnpm install
```

| Command                              | What it does                                      |
| ------------------------------------ | ------------------------------------------------- |
| `pnpm build`                         | Build every package (shared first)                |
| `pnpm test`                          | Run all tests (Vitest)                            |
| `pnpm typecheck`                     | Type-check every package                          |
| `pnpm lint`                          | ESLint                                            |
| `pnpm format` / `pnpm format:check`  | Prettier                                          |
| `pnpm --filter @inferno/client dev`  | Run the client dev server                         |
| `pnpm --filter @inferno/tools solve` | Validate every floor and print its shortest route |

### Game server

`pnpm --filter @inferno/server dev` builds and runs the server on port 3000, loading variables from a `.env` file in the repo root if one exists (git-ignored). Environment variables:

| Variable           | Default                 | Purpose                                                                                     |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID` | (unset)                 | Google OAuth client id for sign-in. Unset: sign-in is disabled and everyone is a spectator. |
| `ALLOWED_ORIGIN`   | `http://localhost:5173` | The game's origin; WebSocket upgrades and POST/PUT/DELETE from other origins are rejected.  |
| `PORT`             | `3000`                  | HTTP and WebSocket port.                                                                    |
| `FLOORS_DIR`       | `../../floors`          | Floor files to load.                                                                        |

Packages that import `@inferno/shared` use its built output, so run `pnpm build` before `pnpm typecheck` or `pnpm test` on a fresh checkout.
