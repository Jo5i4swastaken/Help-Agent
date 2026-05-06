# @help-agent/protocol

Shared TypeScript types for the Help-Agent widget <-> service contract.
This package is the single source of truth for the request/response shapes
of the widget HTTP API and the SSE event union streamed back to the widget.

It contains **no runtime logic** beyond two SSE frame helpers
(`formatSseFrame`, `parseSseFrame`) and the `ENDPOINTS` path constants.
Everything else is `export type`.

See [`HELP_AGENT_PLAN.md`](../../HELP_AGENT_PLAN.md), specifically
**Section 2 (Runtime Interfaces)** and **Section 3 (Data Contracts)**.

## Install

```sh
pnpm add @help-agent/protocol
```

This package is `type: "module"` (ESM only). Relative imports inside the
package use `.js` extensions per Node's NodeNext resolution.

## Endpoints

| Method | Path                | Request type                  | Response type            | Spec        |
| ------ | ------------------- | ----------------------------- | ------------------------ | ----------- |
| POST   | `/v1/help/message`  | `MessageRequest`              | `MessageAck`             | Section 3.2 |
| GET    | `/v1/help/stream`   | _query_: `sessionId`, `runId` | SSE stream of `SseEvent` | Section 3.3 |
| POST   | `/v1/help/escalate` | `EscalateRequest`             | `EscalateResponse`       | Section 3.4 |
| POST   | `/v1/tickets`       | `TicketRequest`               | `TicketResponse`         | Section 3.5 |

The path strings are also exported as a const object:

```ts
import { ENDPOINTS } from '@help-agent/protocol';

ENDPOINTS.message; // '/v1/help/message'
ENDPOINTS.stream; // '/v1/help/stream'
ENDPOINTS.escalate; // '/v1/help/escalate'
ENDPOINTS.tickets; // '/v1/tickets'
```

## SSE events

Stream: `GET /v1/help/stream?sessionId=...&runId=...`. The `event` field
discriminates the union.

| Event           | Data shape                                                   | When emitted                                                |
| --------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| `message`       | `{ text: string }`                                           | Streaming an assistant text chunk.                          |
| `tool_call`     | `{ name, args?, status? }`                                   | Optional UI-transparency frame when the agent calls a tool. |
| `needs_consent` | `{ reason, consentId, required: (keyof EscalateConsent)[] }` | Agent cannot proceed without explicit user consent.         |
| `deep_link`     | `{ route, actionId?, prefill? }`                             | Suggested in-app navigation grounded in the manifest.       |
| `done`          | `{ ok: boolean, runId?, error? }`                            | Terminal frame for the run; service then closes the stream. |

The wire format for every frame is:

```
event: <name>
data: <json>

```

Use `formatSseFrame(evt)` on the service side to guarantee byte-identical
framing. Use `parseSseFrame(raw)` on the client / in tests to decode a
single frame back to a typed `SseEvent`.

`parseSseFrame(formatSseFrame(x))` round-trips for every union variant.

## Example: typing a message handler (Hono / Express shape)

```ts
import type { MessageRequest, MessageAck } from '@help-agent/protocol';
import { ENDPOINTS, formatSseFrame } from '@help-agent/protocol';

// Hono
app.post(ENDPOINTS.message, async (c) => {
  const body = await c.req.json<MessageRequest>();
  const runId = await sessions.startRun(body);
  const ack: MessageAck = { ok: true, runId };
  return c.json(ack);
});

// Express
app.post(ENDPOINTS.message, async (req: Request<unknown, MessageAck, MessageRequest>, res) => {
  const runId = await sessions.startRun(req.body);
  res.json({ ok: true, runId });
});

// SSE handler — same `formatSseFrame` on either framework
app.get(ENDPOINTS.stream, (c) => {
  // ...for each event from the agent run:
  //   write(formatSseFrame({ event: 'message', data: { text } }));
  // ...and finally:
  //   write(formatSseFrame({ event: 'done', data: { ok: true } }));
});
```

## Notes on the contract

- All types are `readonly` — request/response objects are treated as
  immutable on both sides.
- Optional fields use `?` and respect `exactOptionalPropertyTypes` so they
  must be omitted, not set to `undefined`.
- `ContextSnapshot` is shaped at the source; the **service** is responsible
  for redaction (Section 6) before storing or forwarding it. This package
  does not enforce "redacted-ness" structurally.
- Adding a field is non-breaking; removing one is. Be conservative.

## Cross-references

- [`HELP_AGENT_PLAN.md` Section 2 — Runtime Interfaces](../../HELP_AGENT_PLAN.md#section-2-runtime-interfaces)
- [`HELP_AGENT_PLAN.md` Section 3 — Data Contracts](../../HELP_AGENT_PLAN.md#section-3-data-contracts)
- [`HELP_AGENT_PLAN.md` Section 6 — Safety, Privacy, and Compliance](../../HELP_AGENT_PLAN.md#section-6-safety-privacy-and-compliance)
- [`@help-agent/manifest`](../help-agent-manifest) — Capability Manifest types.
