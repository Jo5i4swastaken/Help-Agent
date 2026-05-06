# Help-Agent

Industry-agnostic embeddable help system for web applications. Two parts:

- **Onboarding Agent (build-time CLI)** — generates a Capability Manifest + stub docs from a customer codebase.
- **Runtime Help-Agent (widget + service)** — embedded in the customer app, grounds every response in the manifest + KB + live page context.

The runtime is the same across customers; the manifest changes per customer and is auto-generated at build time. See [`HELP_AGENT_PLAN.md`](./HELP_AGENT_PLAN.md) for the full design.

## Repo layout

```
packages/
  help-agent-manifest/   Capability Manifest JSON Schema + TS types + validate()
  help-agent-protocol/   HTTP + SSE shared TS types (widget <-> service contract)
  help-agent-widget/     Widget SDK (Phase 3)
services/
  help-agent/            Backend service (Phase 2)
tools/
  help-agent-onboarding/ Build-time CLI (Phase 4)
agents/
  help-agent/            OmniAgents config + tools (Phase 5)
docs/
  help/                  Per-customer markdown KB (generated then edited)
```

Phase 1 (this commit) ships the foundation packages: `help-agent-manifest` and `help-agent-protocol`. Every other phase consumes those types.

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`corepack enable` + `corepack prepare pnpm@9.15.4 --activate`)

## Install + build

```bash
pnpm install
pnpm build
```

## Workspace scripts

| Script           | What it does                                            |
| ---------------- | ------------------------------------------------------- |
| `pnpm build`     | TypeScript project-references build across all packages |
| `pnpm typecheck` | Same as `build` (composite refs check types)            |
| `pnpm lint`      | ESLint over the workspace                               |
| `pnpm format`    | Prettier write                                          |
| `pnpm test`      | Recursive `test` script per package (skipped if absent) |

## Versioning

`schemaVersion` on the Capability Manifest is pinned to `"1.0"`. Any breaking change to the manifest contract requires a major-version bump and a coordinated release across the onboarding tool and the runtime service.
