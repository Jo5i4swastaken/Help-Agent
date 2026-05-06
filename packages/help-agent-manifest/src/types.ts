/**
 * @file Capability Manifest TypeScript types.
 *
 * The manifest is "the contract between the Onboarding Agent and the Runtime
 * Help-Agent. It is industry-agnostic — the same schema describes a salon
 * booking app, a heavy equipment inventory system, or an invoicing tool."
 * (HELP_AGENT_PLAN.md, Section 1)
 *
 * Manifests are loaded once at session start and treated as immutable
 * grounding for the runtime agent, so all collection/object fields are
 * declared `readonly`.
 */

/**
 * Pinned manifest schema version.
 *
 * Any breaking change to the manifest contract requires a major bump and a
 * coordinated release across onboarding + runtime.
 */
export type ManifestSchemaVersion = '1.0';

/**
 * Verb classifying a manifest action.
 *
 * Drawn from the Section 1 spec. `"other"` is the catch-all for actions that
 * do not fit a CRUD-style verb (e.g., "send reminder").
 */
export type ManifestActionVerb =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'list'
  | 'export'
  | 'import'
  | 'other';

/**
 * Field type on an entity.
 *
 * Either a primitive scalar, or a `ref:<entityId>` reference to another entity
 * defined in the same manifest (e.g., `"ref:client"`). The `<entityId>` must
 * match the lowercase snake-case identifier pattern used by entity IDs.
 */
export type ManifestFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'datetime'
  | 'date'
  | 'url'
  | 'email'
  | `ref:${string}`;

/**
 * App-level metadata.
 *
 * Identifies which customer app this manifest describes. Used by the runtime
 * service to load the matching manifest at session start and to populate
 * `manifestRef` on escalation tickets.
 */
export interface ManifestApp {
  /** Stable identifier for the customer app (e.g., `"salon-pro"`). */
  readonly id: string;
  /** Human-friendly name displayed to end users. */
  readonly name: string;
  /** App version string (typically semver). */
  readonly version: string;
  /** Optional domain tag for grouping (e.g., `"salon-booking"`). */
  readonly domain?: string;
}

/**
 * A user role known to the app, with its permission scopes.
 *
 * Permission strings follow the convention: `"*"` grants all, `"<entity>.*"`
 * grants all verbs on an entity, `"<entity>.<verb>"` grants a single verb.
 */
export interface ManifestRole {
  /** Snake-case identifier (e.g., `"front_desk"`). */
  readonly id: string;
  /** Human-friendly role label. */
  readonly label: string;
  /** Permission scopes granted to this role. */
  readonly permissions: readonly string[];
}

/**
 * A field on an entity.
 *
 * Field types are scalar primitives or `ref:<entityId>` references to other
 * entities in this manifest.
 */
export interface ManifestField {
  /** Snake-case identifier (e.g., `"starts_at"`). */
  readonly id: string;
  /** Human-friendly field label. */
  readonly label: string;
  /** Scalar primitive or `ref:<entityId>` reference. */
  readonly type: ManifestFieldType;
  /** Whether the field is required when creating/updating the entity. */
  readonly required?: boolean;
}

/**
 * A domain entity the app manages (e.g., Booking, Invoice, Client).
 */
export interface ManifestEntity {
  /** Snake-case identifier (e.g., `"booking"`). */
  readonly id: string;
  /** Singular human label (e.g., `"Booking"`). */
  readonly label: string;
  /** Plural human label (e.g., `"Bookings"`). */
  readonly labelPlural: string;
  /** Alternative terms users might use (e.g., `["appointment", "reservation"]`). */
  readonly synonyms?: readonly string[];
  /** Fields on the entity that the agent should understand. */
  readonly fields?: readonly ManifestField[];
}

/**
 * A discrete user action the app exposes.
 *
 * Each action is grounded by a verb, a target entity, a route, and the roles
 * required to perform it. The runtime agent matches user intent to an action
 * via `manifest.find_action(query, currentRoute, userRoles)`.
 */
export interface ManifestAction {
  /** Snake-case identifier (e.g., `"create_booking"`). */
  readonly id: string;
  /** Human-friendly action label (e.g., `"Create a booking"`). */
  readonly label: string;
  /** ID of the entity this action operates on. Cross-references `entities[].id`. */
  readonly entity: string;
  /** Verb classifying the action. */
  readonly verb: ManifestActionVerb;
  /** App route where this action is performed (must start with `/`). */
  readonly route: string;
  /** Role IDs allowed to perform the action. Cross-references `roles[].id`. */
  readonly requiredRoles: readonly string[];
  /** Human-readable preconditions the agent should mention before guiding the user. */
  readonly preconditions?: readonly string[];
  /**
   * Optional free-form path with optional query and template tokens
   * (e.g., `"/bookings/new?prefill={...}"`). Template tokens are app-specific
   * and interpreted by the runtime widget.
   */
  readonly deepLink?: string;
}

/**
 * A top-level route/screen the user can navigate to.
 *
 * The widget reports the user's current `route`; the runtime agent matches it
 * against `routes[]` to localize guidance.
 */
export interface ManifestRoute {
  /** Route path (must start with `/`). Supports framework param syntax (e.g., `"/bookings/:id"`). */
  readonly path: string;
  /** Human-friendly route title. */
  readonly title: string;
  /** Short description of what this route shows or does. */
  readonly description?: string;
  /** Optional primary entity rendered on this route. Cross-references `entities[].id`. */
  readonly entity?: string;
  /** Primary action IDs available on this route. Cross-references `actions[].id`. */
  readonly primaryActions?: readonly string[];
}

/**
 * A glossary entry for domain-specific vocabulary the agent should
 * understand and use.
 */
export interface ManifestGlossaryEntry {
  /** Domain term as users say it (e.g., `"walk-in"`). */
  readonly term: string;
  /** Plain-language definition. */
  readonly definition: string;
}

/**
 * Knowledge base configuration.
 *
 * Tells the runtime service where to find the markdown KB and what indexing
 * strategy to use.
 */
export interface ManifestKbConfig {
  /** Path (relative to customer app repo root) where help markdown lives. Default `"docs/help/"`. */
  readonly docsPath: string;
  /**
   * KB index format. `"frontmatter+keyword"` is the only MVP format; the
   * enum is left open for future formats.
   */
  readonly indexFormat: 'frontmatter+keyword';
}

/**
 * Capability Manifest — the full contract.
 *
 * "The runtime agent receives the manifest at session start and uses it as
 * grounding for every response. The LLM is instructed: 'You only know about
 * the entities, actions, and routes listed in this manifest. Do not invent
 * capabilities.'" (HELP_AGENT_PLAN.md, Section 1)
 */
export interface CapabilityManifest {
  /** Pinned manifest schema version (`"1.0"`). */
  readonly schemaVersion: ManifestSchemaVersion;
  readonly app: ManifestApp;
  readonly roles: readonly ManifestRole[];
  readonly entities: readonly ManifestEntity[];
  readonly actions: readonly ManifestAction[];
  readonly routes: readonly ManifestRoute[];
  readonly glossary: readonly ManifestGlossaryEntry[];
  readonly kb: ManifestKbConfig;
}
