/**
 * @file Re-export of the JSON Schema as a typed constant.
 *
 * The JSON Schema lives at the package root (`schema.json`) so it can also be
 * served standalone (see the `./schema.json` export in package.json). Here we
 * import it as a module so consumers can register it with their own ajv
 * instance if desired.
 */

import schema from '../schema.json' with { type: 'json' };

/**
 * The Capability Manifest JSON Schema (Draft 2020-12).
 *
 * `$id`: `https://help-agent.dev/schemas/capability-manifest/1.0.json`
 */
export const manifestJsonSchema = schema;
