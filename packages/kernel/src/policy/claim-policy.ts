import { type ClaimKey, claimKeyOf } from "../domain/claim-key";
import type { Claim, ClaimDraft } from "../domain/records";

export type ClaimSemantics = "exclusive" | "coexisting";
export type MechanicalAdvisory = Readonly<{ code: string; message: string }>;

export interface ClaimPolicy {
  readonly version: string;
  identity(claim: ClaimDraft | Claim): ClaimKey;
  semantics(claim: ClaimDraft | Claim | ClaimKey): ClaimSemantics;
  advisories(claim: ClaimDraft | Claim): readonly MechanicalAdvisory[];
}

const NO_ADVISORIES: readonly MechanicalAdvisory[] = Object.freeze([]);

/** Deterministic baseline policy: declared identity, exclusive values, no custom advisories. */
export const DEFAULT_CLAIM_POLICY: ClaimPolicy = Object.freeze({
  version: "loredu.claim-policy/default-v1",
  identity: claimKeyOf,
  semantics: () => "exclusive",
  advisories: () => NO_ADVISORIES,
});
