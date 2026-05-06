/**
 * `@help-agent/protocol` — shared TypeScript types for the widget <-> service
 * HTTP + SSE contract. Runtime surface is intentionally minimal: only the
 * SSE frame helpers ({@link formatSseFrame}, {@link parseSseFrame}) and the
 * {@link ENDPOINTS} path constants. Everything else is type-only.
 *
 * See `HELP_AGENT_PLAN.md` Sections 2 and 3 for the canonical contract.
 */

// Context snapshot (Section 3.1)
export type {
  ContextSnapshot,
  RecentEvent,
  RecentNavEvent,
  RecentClickEvent,
  RecentHttpErrorEvent,
  RecentValidationErrorEvent,
  HttpMethod,
  NormalizedError,
} from './context.js';

// HTTP request / response shapes (Sections 2, 3.2, 3.4, 3.5)
export type {
  SessionMode,
  MessageRequest,
  MessageAck,
  EscalateConsent,
  EscalateRequest,
  EscalateResponse,
  TicketSeverity,
  TicketCategory,
  ManifestRef,
  TicketRequest,
  TicketResponse,
  Endpoints,
} from './http.js';

export { ENDPOINTS } from './http.js';

// SSE event protocol (Section 3.3)
export type {
  SseEvent,
  SseMessageEvent,
  SseToolCallEvent,
  SseNeedsConsentEvent,
  SseDeepLinkEvent,
  SseDoneEvent,
} from './sse.js';

export { formatSseFrame, parseSseFrame } from './sse.js';
