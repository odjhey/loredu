import source from "../../../docs/v0.x/execution/agent-skill.md" with { type: "text" };

function stripFrontmatter(value: string): string {
  if (!value.startsWith("---\n")) throw new Error("embedded agent skill has no YAML frontmatter");
  const closing = value.indexOf("\n---\n", 4);
  if (closing < 0) throw new Error("embedded agent skill has unterminated YAML frontmatter");
  return value.slice(closing + "\n---\n".length);
}

/** Build-time embedded guide bytes, with only docs frontmatter removed. */
export const EMBEDDED_AGENT_SKILL = stripFrontmatter(source);
