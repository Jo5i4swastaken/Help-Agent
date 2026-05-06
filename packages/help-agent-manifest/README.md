# @help-agent/manifest

The Capability Manifest is the contract between the build-time **Onboarding Agent** and the runtime **Help-Agent Service**. This package owns the source of truth: a JSON Schema (Draft 2020-12), hand-written TypeScript types, and a precompiled `validateManifest()` helper. Every other package in the system imports from here.

See [`HELP_AGENT_PLAN.md`](../../HELP_AGENT_PLAN.md), Section 1, for the design rationale and worked example.

## Install

```sh
pnpm add @help-agent/manifest
```

## Quickstart

```ts
import { validateManifest, type CapabilityManifest } from '@help-agent/manifest';

const json: unknown = JSON.parse(await readFile('help-agent.config.json', 'utf8'));

const result = validateManifest(json);
if (result.valid) {
  const manifest: CapabilityManifest = result.manifest;
  console.log(`Loaded manifest for ${manifest.app.name} v${manifest.app.version}`);
} else {
  for (const err of result.errors) {
    console.error(`${err.path || '<root>'} (${err.keyword}): ${err.message}`);
  }
  process.exit(1);
}
```

A minimal valid manifest:

```json
{
  "schemaVersion": "1.0",
  "app": { "id": "demo", "name": "Demo", "version": "0.1.0" },
  "roles": [{ "id": "owner", "label": "Owner", "permissions": ["*"] }],
  "entities": [{ "id": "widget", "label": "Widget", "labelPlural": "Widgets" }],
  "actions": [
    {
      "id": "create_widget",
      "label": "Create a widget",
      "entity": "widget",
      "verb": "create",
      "route": "/widgets/new",
      "requiredRoles": ["owner"]
    }
  ],
  "routes": [{ "path": "/widgets", "title": "Widgets" }],
  "glossary": [],
  "kb": { "docsPath": "docs/help/", "indexFormat": "frontmatter+keyword" }
}
```

## Schema reference

| Field           | Type                      | Required | Description                                                                                             |
| --------------- | ------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `schemaVersion` | `"1.0"` (literal)         | Y        | Pinned manifest schema version. See "schemaVersion" below.                                              |
| `app`           | `ManifestApp`             | Y        | App identity: `id`, `name`, `version`, optional `domain`.                                               |
| `roles`         | `ManifestRole[]`          | Y        | User roles and their permission scopes.                                                                 |
| `entities`      | `ManifestEntity[]`        | Y        | Domain entities the app manages, with optional `fields[]` and `synonyms[]`.                             |
| `actions`       | `ManifestAction[]`        | Y        | Discrete user actions (verb + entity + route + required roles), with optional preconditions/deepLink.   |
| `routes`        | `ManifestRoute[]`         | Y        | Top-level routes/screens. The runtime matches the widget's current route against these.                 |
| `glossary`      | `ManifestGlossaryEntry[]` | Y        | Domain vocabulary the agent should understand.                                                          |
| `kb`            | `ManifestKbConfig`        | Y        | Knowledge base config: `docsPath` (default `"docs/help/"`) and `indexFormat` (`"frontmatter+keyword"`). |

### IDs and field types

- All IDs (`role.id`, `entity.id`, `action.id`, `field.id`) match `^[a-z][a-z0-9_]*$` — lowercase, snake_case.
- Field `type` is one of `string | number | boolean | datetime | date | url | email`, OR a `ref:<entityId>` reference (e.g., `"ref:client"`). The `<entityId>` portion follows the same lowercase pattern, so `"ref:Client"` is rejected.
- Action `verb` is one of `create | read | update | delete | list | export | import | other`.
- Cross-references (`action.entity`, `action.requiredRoles`, `route.entity`, `route.primaryActions`) are typed as IDs but not enforced at the schema level — validate referential integrity in your own loader if you need it.
- `additionalProperties: false` is set on every object: unknown fields fail validation. This is intentional — manifests are generated, not hand-written, so unexpected keys are almost always bugs.

## `schemaVersion`

The `schemaVersion` field is pinned to the literal string `"1.0"`. The validator rejects any other value (including `"1.0.0"`).

**Bumping policy.** Any breaking change to the manifest contract — adding a required field, narrowing an enum, changing the meaning of an existing field — requires a major bump (e.g., `"1.0"` → `"2.0"`) and a coordinated release across the Onboarding Agent and the runtime Help-Agent Service. Both must understand the new version before either ships it. Backwards-compatible additions (new optional fields, new enum members on action `verb` or `kb.indexFormat`) MAY be made without a major bump, but should still ship the validator update first.

The runtime service should refuse to load a manifest whose `schemaVersion` it does not recognize, rather than attempting a partial load.

## See also

- [`HELP_AGENT_PLAN.md`](../../HELP_AGENT_PLAN.md), Section 1 — manifest design and worked example
- [`HELP_AGENT_PLAN.md`](../../HELP_AGENT_PLAN.md), Section 0 — how the Onboarding Agent generates this manifest
- [`HELP_AGENT_PLAN.md`](../../HELP_AGENT_PLAN.md), Section 6 — what the manifest must NOT contain (no source code, structural metadata only)
