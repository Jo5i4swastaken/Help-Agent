/**
 * @file Manifest validator.
 *
 * Compiles the Capability Manifest JSON Schema (Draft 2020-12) once at module
 * load and exposes a single `validateManifest()` function plus an
 * `isManifest()` type guard. Callers MUST NOT recompile the validator per
 * call — the compiled function is cached at module scope.
 */

import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsImport, { type FormatsPlugin } from 'ajv-formats';

import { manifestJsonSchema } from './schema.js';
import type { CapabilityManifest } from './types.js';

/**
 * A single ajv error, surfaced in a more ergonomic shape than the raw
 * `ErrorObject` so callers don't depend on ajv's types.
 */
export interface ValidationError {
  /**
   * JSON-pointer-ish path to the offending value (e.g.,
   * `"/entities/0/id"`). Empty string when the error is at the root.
   */
  path: string;
  /** Short human-readable error message. */
  message: string;
  /** The ajv keyword that failed (e.g., `"pattern"`, `"enum"`, `"const"`). */
  keyword: string;
}

/**
 * Result of a successful validation. `manifest` is narrowed to
 * `CapabilityManifest` so callers get full type information without an
 * additional cast.
 */
export interface ValidateOk {
  valid: true;
  manifest: CapabilityManifest;
}

/**
 * Result of a failed validation. `errors` is non-empty.
 */
export interface ValidateErr {
  valid: false;
  errors: ValidationError[];
}

export type ValidateResult = ValidateOk | ValidateErr;

// ---------------------------------------------------------------------------
// Compile the validator once at module load.
// ---------------------------------------------------------------------------

// ajv-formats' default export survives NodeNext interop as either the function
// or `{ default: fn }` depending on bundler/runtime. Resolve it once and cast
// to the callable plugin signature.
const addFormats: FormatsPlugin =
  (addFormatsImport as unknown as { default?: FormatsPlugin }).default ??
  (addFormatsImport as unknown as FormatsPlugin);

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
});
addFormats(ajv, ['email', 'date-time', 'uri']);

const validator: ValidateFunction<CapabilityManifest> =
  ajv.compile<CapabilityManifest>(manifestJsonSchema);

function formatError(err: ErrorObject): ValidationError {
  // ajv's instancePath is already JSON-pointer style (e.g., "/entities/0/id").
  // We surface it verbatim; an empty string represents the document root.
  return {
    path: err.instancePath,
    message: err.message ?? 'validation failed',
    keyword: err.keyword,
  };
}

/**
 * Validate an unknown input against the Capability Manifest schema.
 *
 * Returns a discriminated union so callers can narrow on `result.valid`:
 *
 * ```ts
 * const result = validateManifest(json);
 * if (result.valid) {
 *   // result.manifest is CapabilityManifest
 * } else {
 *   // result.errors is ValidationError[]
 * }
 * ```
 */
export function validateManifest(input: unknown): ValidateResult {
  if (validator(input)) {
    return { valid: true, manifest: input };
  }
  const errors = (validator.errors ?? []).map(formatError);
  return { valid: false, errors };
}

/**
 * Type guard form of `validateManifest`. Discards error details; use
 * `validateManifest` directly when callers need to surface them.
 */
export function isManifest(input: unknown): input is CapabilityManifest {
  return validator(input) === true;
}
