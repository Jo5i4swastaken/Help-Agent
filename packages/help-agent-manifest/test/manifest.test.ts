/**
 * @file Tests for `validateManifest` covering happy-path + boundary cases.
 *
 * Uses Node's built-in `node:test` runner (no extra deps). Fixtures are
 * inlined so failures are easy to read in isolation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateManifest } from '../src/index.js';

/**
 * The Section 1 example manifest, copied verbatim from HELP_AGENT_PLAN.md.
 * Used as the canonical happy-path fixture and as a base for negative tests.
 */
function makeValidManifest(): unknown {
  return {
    schemaVersion: '1.0',
    app: {
      id: 'customer-app-id',
      name: 'Salon Pro',
      version: '2.4.0',
      domain: 'salon-booking',
    },
    roles: [
      { id: 'owner', label: 'Owner', permissions: ['*'] },
      { id: 'front_desk', label: 'Front Desk', permissions: ['bookings.*', 'clients.*'] },
      { id: 'stylist', label: 'Stylist', permissions: ['bookings.read', 'bookings.update_own'] },
    ],
    entities: [
      {
        id: 'booking',
        label: 'Booking',
        labelPlural: 'Bookings',
        synonyms: ['appointment', 'reservation'],
        fields: [
          { id: 'client_id', label: 'Client', type: 'ref:client', required: true },
          { id: 'service_id', label: 'Service', type: 'ref:service', required: true },
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
    glossary: [
      { term: 'walk-in', definition: 'A client booking with no advance appointment' },
      { term: 'no-show', definition: 'Booking where the client did not arrive' },
    ],
    kb: {
      docsPath: 'docs/help/',
      indexFormat: 'frontmatter+keyword',
    },
  };
}

test('Section 1 example manifest validates', () => {
  const result = validateManifest(makeValidManifest());
  assert.equal(result.valid, true, JSON.stringify(result, null, 2));
  if (result.valid) {
    assert.equal(result.manifest.app.name, 'Salon Pro');
    assert.equal(result.manifest.entities[0]?.id, 'booking');
  }
});

test("schemaVersion is pinned to '1.0' (0.9 fails)", () => {
  const m = makeValidManifest() as { schemaVersion: string };
  m.schemaVersion = '0.9';
  const result = validateManifest(m);
  assert.equal(result.valid, false);
  if (!result.valid) {
    const found = result.errors.some((e) => e.path === '/schemaVersion' && e.keyword === 'const');
    assert.ok(
      found,
      `expected const failure on /schemaVersion, got ${JSON.stringify(result.errors)}`,
    );
  }
});

test('unknown top-level field fails (additionalProperties: false)', () => {
  const m = makeValidManifest() as Record<string, unknown>;
  m['bogus'] = 'nope';
  const result = validateManifest(m);
  assert.equal(result.valid, false);
  if (!result.valid) {
    const found = result.errors.some((e) => e.keyword === 'additionalProperties');
    assert.ok(found, `expected additionalProperties failure, got ${JSON.stringify(result.errors)}`);
  }
});

test("entity id 'Booking' (capital) fails the lowercase pattern", () => {
  const m = makeValidManifest() as { entities: { id: string }[] };
  m.entities[0]!.id = 'Booking';
  const result = validateManifest(m);
  assert.equal(result.valid, false);
  if (!result.valid) {
    const found = result.errors.some((e) => e.path === '/entities/0/id' && e.keyword === 'pattern');
    assert.ok(
      found,
      `expected pattern failure on /entities/0/id, got ${JSON.stringify(result.errors)}`,
    );
  }
});

test("action verb 'destroy' fails the enum", () => {
  const m = makeValidManifest() as { actions: { verb: string }[] };
  m.actions[0]!.verb = 'destroy';
  const result = validateManifest(m);
  assert.equal(result.valid, false);
  if (!result.valid) {
    const found = result.errors.some((e) => e.path === '/actions/0/verb' && e.keyword === 'enum');
    assert.ok(
      found,
      `expected enum failure on /actions/0/verb, got ${JSON.stringify(result.errors)}`,
    );
  }
});

test("field type 'ref:client' validates; 'ref:Client' fails", () => {
  const ok = makeValidManifest() as { entities: { fields: { type: string }[] }[] };
  ok.entities[0]!.fields[0]!.type = 'ref:client';
  assert.equal(validateManifest(ok).valid, true);

  const bad = makeValidManifest() as { entities: { fields: { type: string }[] }[] };
  bad.entities[0]!.fields[0]!.type = 'ref:Client';
  const result = validateManifest(bad);
  assert.equal(result.valid, false);
  if (!result.valid) {
    const found = result.errors.some((e) => e.path === '/entities/0/fields/0/type');
    assert.ok(
      found,
      `expected failure on /entities/0/fields/0/type, got ${JSON.stringify(result.errors)}`,
    );
  }
});
