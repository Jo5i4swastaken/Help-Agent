/**
 * @file Public surface of `@help-agent/manifest`.
 *
 * Consumers should import from this entry point only. Internal module layout
 * may change between minor versions.
 */

export type {
  CapabilityManifest,
  ManifestApp,
  ManifestRole,
  ManifestEntity,
  ManifestField,
  ManifestAction,
  ManifestRoute,
  ManifestGlossaryEntry,
  ManifestKbConfig,
  ManifestSchemaVersion,
  ManifestActionVerb,
  ManifestFieldType,
} from './types.js';

export { manifestJsonSchema } from './schema.js';

export {
  validateManifest,
  isManifest,
  type ValidationError,
  type ValidateOk,
  type ValidateErr,
  type ValidateResult,
} from './validate.js';
