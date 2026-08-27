export type LoreduErrorCode =
  | "VALIDATION_FAILED"
  | "REFERENCE_CHECK_FAILED"
  | "DUPLICATE_RECORD_ID"
  | "RANDOM_SOURCE_FAILED"
  | "CLOCK_FAILED"
  | "STORE_APPEND_FAILED";
export type LoreduIssueCode =
  | "REQUIRED"
  | "TYPE"
  | "FORMAT"
  | "RANGE"
  | "UNKNOWN_FIELD"
  | "RESERVED_FIELD"
  | "DUPLICATE"
  | "UNKNOWN_SCHEMA"
  | "REFERENCE_NOT_FOUND"
  | "REFERENCE_KIND_MISMATCH";
export interface LoreduIssue {
  readonly code: LoreduIssueCode;
  readonly path: string;
  readonly message: string;
}
export class LoreduError extends Error {
  constructor(
    readonly code: LoreduErrorCode,
    message: string,
    readonly issues: readonly LoreduIssue[] = [],
  ) {
    super(message);
    this.name = "LoreduError";
  }
}
