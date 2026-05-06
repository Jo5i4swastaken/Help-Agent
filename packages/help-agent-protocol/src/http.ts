/**
 * HTTP request / response shapes for the widget <-> Help-Agent Service
 * contract — Sections 2, 3.2, 3.4, and 3.5 of HELP_AGENT_PLAN.md.
 *
 * Endpoints:
 * - `POST /v1/help/message`   — send a user message, returns a run id
 * - `GET  /v1/help/stream`    — SSE stream of agent events (see `sse.ts`)
 * - `POST /v1/help/escalate`  — package run into a ticket / email / WA
 * - `POST /v1/tickets`        — service -> dashboard ticket creation
 */

import type { ContextSnapshot } from './context.js';

/**
 * Session mode (Section 2).
 *
 * - `authenticated`: widget includes end-user auth token; service derives
 *   user/workspace and loads the matching Capability Manifest.
 * - `anonymous`: service issues an ephemeral `sessionId`, loads a default
 *   manifest, and limits escalation
 *   (see `policy.check_escalation` in Section 4.D).
 */
export type SessionMode = 'authenticated' | 'anonymous';

/**
 * Body of `POST /v1/help/message` (Section 3.2).
 *
 * The `context` snapshot is typed at-source; the service is responsible for
 * redacting it before storage / forwarding (Section 6).
 */
export interface MessageRequest {
  /** Session id (UUID v4). Same id is used for the SSE stream. */
  readonly sessionId: string;
  /** The user's chat message text. */
  readonly message: string;
  /** Live page context captured by the widget at send time. */
  readonly context: ContextSnapshot;
  /** Authenticated vs anonymous (limits escalation if anonymous). */
  readonly mode: SessionMode;
  /** Client metadata used for compatibility / debugging. */
  readonly client: {
    readonly widgetVersion: string;
  };
}

/**
 * Non-streaming acknowledgement of `POST /v1/help/message` (Section 3.2).
 *
 * Once the client has the `runId` it opens the SSE stream at
 * `GET /v1/help/stream?sessionId=...&runId=...`.
 */
export interface MessageAck {
  readonly ok: true;
  readonly runId: string;
}

/**
 * Consent flags collected by the widget before escalating (Section 3.4).
 *
 * Each flag MUST be explicitly set by the user; defaults are not implied.
 * - `includeTranscript`: attach the conversation transcript to the ticket.
 * - `includeContext`: attach the (redacted) {@link ContextSnapshot}.
 * - `includeDiagnostics`: attach diagnostic refs (request id, sentry id).
 * - `notifyWhatsApp`: send the optional Twilio WhatsApp notification
 *   (only honored when severity rules and config allow — Section 4.C).
 */
export interface EscalateConsent {
  readonly includeTranscript: boolean;
  readonly includeContext: boolean;
  readonly includeDiagnostics: boolean;
  readonly notifyWhatsApp: boolean;
}

/**
 * Body of `POST /v1/help/escalate` (Section 3.4).
 */
export interface EscalateRequest {
  readonly sessionId: string;
  readonly runId: string;
  readonly consent: EscalateConsent;
  /** Optional freeform note from the user. Only stored with consent. */
  readonly userNote?: string;
}

/**
 * Response of `POST /v1/help/escalate` (Section 3.4).
 *
 * `whatsAppId` is only populated when the user opted into
 * {@link EscalateConsent.notifyWhatsApp} AND severity rules + service
 * configuration permit a WhatsApp notification (Section 4.C).
 */
export interface EscalateResponse {
  readonly ticketId: string;
  readonly emailId: string;
  readonly whatsAppId?: string;
}

/**
 * Severity assigned to a ticket by the service (Section 3.5).
 */
export type TicketSeverity = 'high' | 'medium' | 'low';

/**
 * Coarse category bucket assigned to a ticket (Section 3.5).
 */
export type TicketCategory = 'how_to' | 'bug' | 'permissions' | 'billing' | 'outage' | 'other';

/**
 * Reference back to a Capability Manifest entry — cross-cutting type used
 * in tickets (Section 3.5) and SSE deep-link events (Section 3.3).
 *
 * - `appId` matches the manifest's `app.id`.
 * - `version` matches the manifest's `app.version` at run time.
 * - `actionId` is the manifest action the agent matched, when available.
 *
 * TODO: once `@help-agent/manifest` exports a canonical `ManifestRef` /
 * action id type, re-export it from here instead of duplicating it.
 */
export interface ManifestRef {
  readonly appId: string;
  readonly version: string;
  readonly actionId?: string;
}

/**
 * Body of `POST /v1/tickets` (Section 3.5) — service -> dashboard.
 *
 * `contextSnapshot` is typed as the full {@link ContextSnapshot}; the
 * service is responsible for redaction (Section 6) before sending.
 * The shape on the wire is the same — this type does not enforce
 * "redacted-ness" structurally.
 */
export interface TicketRequest {
  /** Short human-readable title (e.g. `"Cannot save booking (HTTP 403)"`). */
  readonly title: string;
  readonly severity: TicketSeverity;
  readonly category: TicketCategory;
  readonly requester: {
    readonly userId: string;
    readonly workspaceId: string;
  };
  /**
   * Two-track summary: one for the end user (in their words) and one for
   * the engineer triaging the ticket.
   */
  readonly summary: {
    readonly userFacing: string;
    readonly technical: string;
  };
  /** Manifest entry that grounds this ticket (auto-filled by the agent). */
  readonly manifestRef: ManifestRef;
  /** Best-effort repro steps inferred by the agent. */
  readonly reproSteps: readonly string[];
  /** The (redacted) live page context at the moment of escalation. */
  readonly contextSnapshot: ContextSnapshot;
  /** External error system references for cross-lookup. */
  readonly errorRefs?: {
    readonly requestId?: string;
    readonly sentryEventId?: string;
  };
  /** Steps the user / agent already attempted, if any. */
  readonly stepsTried?: readonly string[];
  /** Full conversation transcript, only when consented. */
  readonly conversationTranscript?: string;
}

/**
 * Response of `POST /v1/tickets` (Section 3.5).
 */
export interface TicketResponse {
  readonly ticketId: string;
}

/**
 * Endpoint path constants — single source of truth for the widget, the
 * service, and any tests / mocks. Kept as a `const` object so consumers
 * can do `ENDPOINTS.message` without stringly-typed drift.
 */
export const ENDPOINTS = {
  message: '/v1/help/message',
  stream: '/v1/help/stream',
  escalate: '/v1/help/escalate',
  tickets: '/v1/tickets',
} as const;

/** Type of the {@link ENDPOINTS} constant, for consumers that need it. */
export type Endpoints = typeof ENDPOINTS;
