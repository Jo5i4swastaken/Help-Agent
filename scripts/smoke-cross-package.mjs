/**
 * Smoke-test: peer-package consumers can import both manifest and protocol
 * types/values from their built dist outputs, and round-trip an SSE event.
 *
 * Run from the repo root: `node scripts/smoke-cross-package.mjs`
 */

import assert from 'node:assert/strict';

import {
  validateManifest,
  isManifest,
  manifestJsonSchema,
} from '../packages/help-agent-manifest/dist/index.js';

import {
  ENDPOINTS,
  formatSseFrame,
  parseSseFrame,
} from '../packages/help-agent-protocol/dist/index.js';

// 1. Manifest: Section 1 example validates.
const sectionOneManifest = {
  schemaVersion: '1.0',
  app: { id: 'salon-pro', name: 'Salon Pro', version: '2.4.0', domain: 'salon-booking' },
  roles: [
    { id: 'owner', label: 'Owner', permissions: ['*'] },
    { id: 'front_desk', label: 'Front Desk', permissions: ['bookings.*', 'clients.*'] },
  ],
  entities: [
    {
      id: 'booking',
      label: 'Booking',
      labelPlural: 'Bookings',
      synonyms: ['appointment'],
      fields: [
        { id: 'client_id', label: 'Client', type: 'ref:client', required: true },
        { id: 'starts_at', label: 'Start time', type: 'datetime', required: true },
      ],
    },
  ],
  actions: [
    {
      id: 'create_booking',
      label: 'Create a booking',
      entity: 'booking',
      verb: 'create',
      route: '/bookings/new',
      requiredRoles: ['owner', 'front_desk'],
      preconditions: ['At least one Client and one Service must exist'],
      deepLink: '/bookings/new?prefill={...}',
    },
  ],
  routes: [
    {
      path: '/bookings',
      title: 'Bookings',
      description: 'Calendar view of all bookings',
      entity: 'booking',
      primaryActions: ['create_booking'],
    },
  ],
  glossary: [{ term: 'walk-in', definition: 'A client booking with no advance appointment' }],
  kb: { docsPath: 'docs/help/', indexFormat: 'frontmatter+keyword' },
};

const result = validateManifest(sectionOneManifest);
assert.equal(
  result.valid,
  true,
  `manifest should validate; errors: ${JSON.stringify(result.errors ?? [])}`,
);
assert.equal(isManifest(sectionOneManifest), true);
assert.equal(manifestJsonSchema.$id, 'https://help-agent.dev/schemas/capability-manifest/1.0.json');

// 2. Protocol: endpoint constants and SSE round-trip.
assert.equal(ENDPOINTS.message, '/v1/help/message');
assert.equal(ENDPOINTS.stream, '/v1/help/stream');
assert.equal(ENDPOINTS.escalate, '/v1/help/escalate');
assert.equal(ENDPOINTS.tickets, '/v1/tickets');

const variants = [
  { event: 'message', data: { text: 'hello' } },
  { event: 'tool_call', data: { name: 'manifest.find_action', status: 'started' } },
  {
    event: 'needs_consent',
    data: { reason: 'transcript', consentId: 'c1', required: ['includeTranscript'] },
  },
  { event: 'deep_link', data: { route: '/bookings/new', actionId: 'create_booking' } },
  { event: 'done', data: { ok: true, runId: 'r1' } },
];
for (const evt of variants) {
  const frame = formatSseFrame(evt);
  const parsed = parseSseFrame(frame);
  assert.deepEqual(parsed, evt, `SSE round-trip failed for ${evt.event}`);
}

console.log('smoke: cross-package imports OK; manifest validates; SSE round-trip OK');
