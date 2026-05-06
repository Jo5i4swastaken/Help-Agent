/**
 * Context snapshot types — Section 3.1 of HELP_AGENT_PLAN.md.
 *
 * The widget captures a {@link ContextSnapshot} on every message and sends it
 * to the Help-Agent Service. The service redacts the snapshot before storing
 * or forwarding it (Section 6).
 *
 * Widget capture invariants (Section 3.1):
 * - `recentEvents` MUST be capped at 50 items (most-recent-wins).
 * - No raw form field values: only field names and validation error keys.
 * - No full URLs with query params unless explicitly allowlisted.
 * - The widget reports the user's role(s) so the service-side agent can
 *   filter actions by `requiredRoles` from the Capability Manifest.
 *
 * Server-side redaction invariants (Section 6):
 * - Strip emails, phone numbers, tokens/keys, and authorization headers.
 * - Freeform user text stored/transmitted only with consent.
 * - No full stack traces by default — only `stackHash` / `sentryEventId`.
 */

/**
 * A `nav` event records a route change inside the host app.
 *
 * - `name` is the logical screen / route name (e.g. `"BookingsNew"`),
 *   not a raw URL with query params.
 * - `at` is an ISO-8601 UTC timestamp.
 */
export interface RecentNavEvent {
  readonly type: 'nav';
  readonly name: string;
  readonly at: string;
}

/**
 * A `click` event records the user activating a known interactive element.
 *
 * - `name` is the logical element name (e.g. `"SaveButton"`), never the
 *   raw label of a free-text field's value.
 * - `at` is an ISO-8601 UTC timestamp.
 */
export interface RecentClickEvent {
  readonly type: 'click';
  readonly name: string;
  readonly at: string;
}

/**
 * HTTP methods we record in {@link RecentHttpErrorEvent}. Constrained to a
 * small enum because the runtime agent only reasons about CRUD-shaped calls.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * An `http_error` event records a non-2xx response observed by the host app.
 *
 * - `endpoint` SHOULD be the route template (e.g. `/api/bookings`), never a
 *   full URL with query params unless the path itself is allowlisted.
 * - `status` is the numeric HTTP status code.
 * - `at` is an ISO-8601 UTC timestamp.
 */
export interface RecentHttpErrorEvent {
  readonly type: 'http_error';
  readonly method: HttpMethod;
  readonly endpoint: string;
  readonly status: number;
  readonly at: string;
}

/**
 * A `validation_error` event records a client-side form validation failure.
 *
 * Per Section 3.1 ("no raw form field values; only field names and
 * validation error keys"):
 * - `field` is the field id / name from the schema, never the user's input.
 * - `rule` is the validation rule key (e.g. `"required"`, `"max_length"`),
 *   never the raw error message that may embed user input.
 * - `at` is an ISO-8601 UTC timestamp.
 */
export interface RecentValidationErrorEvent {
  readonly type: 'validation_error';
  readonly field: string;
  readonly rule: string;
  readonly at: string;
}

/**
 * Discriminated union of recent UI/network events captured by the widget.
 *
 * The widget keeps a rolling window of at most 50 events
 * (see {@link ContextSnapshot.recentEvents}).
 */
export type RecentEvent =
  | RecentNavEvent
  | RecentClickEvent
  | RecentHttpErrorEvent
  | RecentValidationErrorEvent;

/**
 * Normalized error description (Section 3.1).
 *
 * Per Section 6, the widget MUST NOT transmit full stack traces by default;
 * `stackHash` / `sentryEventId` are the references the service uses to
 * cross-look-up the original error in the customer's error reporting system.
 */
export interface NormalizedError {
  /** Short human-readable error message (already stripped of PII). */
  readonly message: string;
  /** Stable error code, e.g. `"HTTP_403"`, `"VALIDATION_FAILED"`. */
  readonly code?: string;
  /** Server-issued request id, used to correlate with backend logs. */
  readonly requestId?: string;
  /** Hash of the originating stack trace; never the raw stack. */
  readonly stackHash?: string;
  /** Sentry event id for cross-system lookup, when available. */
  readonly sentryEventId?: string;
}

/**
 * Context snapshot sent with every {@link import('./http.js').MessageRequest}.
 *
 * Matches Section 3.1 exactly. The `route` field is matched against the
 * Capability Manifest's `routes[]` to localize guidance.
 */
export interface ContextSnapshot {
  /** Session id (UUID v4 string). One session per widget mount. */
  readonly sessionId: string;
  /** ISO-8601 UTC timestamp the snapshot was captured at. */
  readonly timestamp: string;
  /**
   * Current route in the host app, matched against the manifest's
   * `routes[].path`. Should be the route template (e.g. `/bookings/new`),
   * not a full URL.
   */
  readonly route: string;
  /** Host app identity (used for logs and the ticket payload). */
  readonly app: {
    readonly name: string;
    readonly version: string;
    readonly buildSha?: string;
  };
  /**
   * End-user identity. `roles` is reported by the widget so the agent can
   * filter actions by `requiredRoles` from the Capability Manifest.
   */
  readonly user: {
    readonly id: string;
    readonly locale: string;
    readonly tz: string;
    readonly roles: readonly string[];
  };
  /** Workspace / tenant scope. Drives manifest selection on the service. */
  readonly workspace: {
    readonly id: string;
  };
  /** Currently-selected entity, if any (e.g. the booking being edited). */
  readonly selected?: {
    readonly entityType: string;
    readonly entityId: string;
  };
  /**
   * Rolling window of recent UI / network events.
   *
   * **Invariant:** the widget MUST cap this at 50 items (most-recent-wins).
   */
  readonly recentEvents: readonly RecentEvent[];
  /** Last normalized error observed in the host app, if any. */
  readonly lastError?: NormalizedError;
}
