/** A field-specific record contract violation. */
export class RecordValidationError extends Error {
  readonly field: string;
  readonly rule: string;

  constructor(field: string, rule: string) {
    super(`${field}: ${rule}`);
    this.name = "RecordValidationError";
    this.field = field;
    this.rule = rule;
  }
}
