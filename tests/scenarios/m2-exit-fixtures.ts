export type ScenarioPolicy = "default" | "coexisting";

export function scenarioCapabilities(instant: string, ordinal: number, policy?: ScenarioPolicy) {
  return Object.freeze({
    instant: Date.parse(instant),
    entropy: ordinal.toString(16).padStart(20, "0"),
    ...(policy === undefined ? {} : { policy }),
  });
}

export function persistedTypeForDerived(
  relation: "duplicate" | "corroboration" | "support" | "conflict" | "temporal-succession",
): "duplicates" | "supports" | "contradicts" | "supersedes" {
  if (relation === "duplicate") return "duplicates";
  if (relation === "conflict") return "contradicts";
  if (relation === "temporal-succession") return "supersedes";
  return "supports";
}
