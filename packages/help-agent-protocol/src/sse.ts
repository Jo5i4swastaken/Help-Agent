/**
 * SSE event protocol for `GET /v1/help/stream` — Section 3.3 of
 * HELP_AGENT_PLAN.md.
 *
 * The widget opens an `EventSource` at
 * `GET /v1/help/stream?sessionId=...&runId=...` after a successful
 * `POST /v1/help/message`. The service streams the agent's run as a
 * sequence of named events, ending with a single `done` frame.
 *
 * Wire format per the SSE spec:
 * ```
 * event: <name>
 * data: <json>
 *
 * ```
 * (each frame terminated by a blank line).
 *
 * This module provides:
 * - The {@link SseEvent} discriminated union of every event the service
 *   may emit, with `event` as the discriminator.
 * - {@link formatSseFrame} — the canonical serializer used by the service.
 * - {@link parseSseFrame} — a best-effort parser used by tests and any
 *   client that decodes frames without an `EventSource` polyfill.
 */

import type { EscalateConsent } from './http.js';

/**
 * Assistant text chunk (Section 3.3).
 *
 * Emitted as the agent streams its reply. The widget appends `data.text`
 * to the current assistant turn. There may be many `message` events per
 * run; concatenation order matches arrival order.
 */
export interface SseMessageEvent {
  readonly event: 'message';
  readonly data: {
    readonly text: string;
  };
}

/**
 * Tool-call transparency event (Section 3.3, optional for UI transparency).
 *
 * Emitted when the agent invokes one of its server-side tools (e.g.
 * `manifest.find_action`, `kb.search`). Purely informational — the widget
 * may render a "thinking…" affordance, but no client logic depends on it.
 *
 * - `name`: tool id (matches the tool registry on the service).
 * - `args`: optional sanitized argument echo (no secrets, no PII).
 * - `status`: lifecycle marker — `started` / `completed` / `failed`.
 */
export interface SseToolCallEvent {
  readonly event: 'tool_call';
  readonly data: {
    readonly name: string;
    readonly args?: Record<string, unknown>;
    readonly status?: 'started' | 'completed' | 'failed';
  };
}

/**
 * Consent prompt event (Section 3.3).
 *
 * The agent has determined it cannot proceed without explicit user consent
 * (e.g. before escalating). The widget MUST render a consent prompt and,
 * upon user confirmation, call `POST /v1/help/escalate` with the matching
 * {@link EscalateConsent} flags set.
 *
 * - `reason`: short user-visible explanation.
 * - `consentId`: opaque id correlating this prompt with the eventual
 *   escalate request (echoed back in service logs).
 * - `required`: which {@link EscalateConsent} flags must be `true`
 *   for the agent to proceed.
 */
export interface SseNeedsConsentEvent {
  readonly event: 'needs_consent';
  readonly data: {
    readonly reason: string;
    readonly consentId: string;
    readonly required: ReadonlyArray<keyof EscalateConsent>;
  };
}

/**
 * Deep-link suggestion event (Section 3.3).
 *
 * The agent is suggesting in-app navigation to one of the routes from the
 * Capability Manifest. The widget renders this as a clickable affordance.
 *
 * - `route`: matches a `routes[].path` entry in the manifest.
 * - `actionId`: optional manifest action id this link satisfies.
 * - `prefill`: optional query-param key/value pairs to seed the form.
 *   Values are strings only; the widget URL-encodes them.
 */
export interface SseDeepLinkEvent {
  readonly event: 'deep_link';
  readonly data: {
    readonly route: string;
    readonly actionId?: string;
    readonly prefill?: Record<string, string>;
  };
}

/**
 * Terminal event for a run (Section 3.3).
 *
 * Always the last event in a successful or failed stream. After this
 * frame the service closes the SSE connection.
 *
 * - `ok`: `true` if the run completed successfully.
 * - `runId`: echoed back for client-side bookkeeping.
 * - `error`: populated when `ok === false`.
 */
export interface SseDoneEvent {
  readonly event: 'done';
  readonly data: {
    readonly ok: boolean;
    readonly runId?: string;
    readonly error?: {
      readonly message: string;
      readonly code?: string;
    };
  };
}

/**
 * Discriminated union of every SSE frame the Help-Agent Service emits on
 * `GET /v1/help/stream`. Discriminator: `event`.
 */
export type SseEvent =
  | SseMessageEvent
  | SseToolCallEvent
  | SseNeedsConsentEvent
  | SseDeepLinkEvent
  | SseDoneEvent;

/**
 * Set of valid SSE event names. Used by {@link parseSseFrame} to reject
 * unknown frames without resorting to `as`.
 */
const SSE_EVENT_NAMES = new Set<SseEvent['event']>([
  'message',
  'tool_call',
  'needs_consent',
  'deep_link',
  'done',
]);

/**
 * Serialize an {@link SseEvent} to the canonical wire format.
 *
 * Output is exactly:
 * ```
 * event: <name>\ndata: <json>\n\n
 * ```
 *
 * This is the single source of truth for service implementations — Hono,
 * Express, Fastify, etc. should all funnel writes through this helper to
 * guarantee byte-identical framing across hosts.
 */
export function formatSseFrame(evt: SseEvent): string {
  const data = JSON.stringify(evt.data);
  return `event: ${evt.event}\ndata: ${data}\n\n`;
}

/**
 * Best-effort parser for a single SSE frame. Returns `null` on any of:
 * - missing `event:` line
 * - missing `data:` line
 * - unknown event name
 * - malformed JSON in `data`
 *
 * Intentionally simple: no streaming buffer, no support for multi-line
 * `data:` accumulation (which the wire format we emit never produces).
 * Sufficient for tests and for clients that decode whole frames.
 */
export function parseSseFrame(raw: string): SseEvent | null {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }

  // Strip a trailing blank-line terminator so split() doesn't yield "".
  const trimmed = raw.replace(/\n+$/, '');
  const lines = trimmed.split('\n');

  let eventName: string | null = null;
  let dataPayload: string | null = null;

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      // Concatenate per SSE spec; in practice we emit single-line data.
      const chunk = line.slice('data:'.length).trim();
      dataPayload = dataPayload === null ? chunk : `${dataPayload}\n${chunk}`;
    }
  }

  if (eventName === null || dataPayload === null) {
    return null;
  }
  if (!isKnownEventName(eventName)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(dataPayload);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  // The service is the only writer of these frames and `formatSseFrame` is
  // the single serializer, so the structural shape is trusted at this
  // boundary. We perform the discriminator-narrowing cast explicitly.
  return { event: eventName, data: parsed } as SseEvent;
}

function isKnownEventName(name: string): name is SseEvent['event'] {
  return SSE_EVENT_NAMES.has(name as SseEvent['event']);
}
