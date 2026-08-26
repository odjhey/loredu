#!/usr/bin/env node
// check-docs.mjs — structural gate for the docs corpus. Zero dependencies; runs
// under `bun docs/scripts/check-docs.mjs` or `node docs/scripts/check-docs.mjs`.
//
// Enforces what docs/README.md and ADR 0014 say the corpus must look like:
//   1. frontmatter carries name, description, type
//   2. `name` values are unique (they are stable identifiers)
//   3. `status`, when present, is in the vocabulary
//   4. relative links resolve, and #anchors match a heading in the target
//   5. every doc is reachable — some other doc links to it
//
// Usage: check-docs.mjs [--json]
// Exit code: 0 clean, 1 problems found.

import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(DOCS_ROOT, '..')
const REQUIRED = ['name', 'description', 'type']
const STATUS_VOCABULARY = ['draft', 'current', 'superseded', 'archived']
// Corpus entry points: readers arrive here from AGENTS.md and the README, so
// nothing inside docs/ has to link them.
const ROOTS = ['README.md', 'INDEX.md']

const json = process.argv.includes('--json')
const problems = []
const fail = (file, rule, message) => problems.push({ file, rule, message })

function* mdFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) yield* mdFiles(p)
    else if (entry.endsWith('.md')) yield p
  }
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return null
  const end = text.indexOf('\n---', 4)
  if (end === -1) return null
  const fm = {}
  for (const line of text.slice(4, end).split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*): (.*)$/)
    if (!m) continue
    let [, key, value] = m
    value = value.trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    fm[key] = value
  }
  return fm
}

// GitHub-style heading slug, enough for the anchors this corpus uses.
const slugify = (heading) =>
  heading
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

const headingSlugs = (text) => {
  const slugs = new Set()
  let fenced = false
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced
    if (fenced) continue
    const m = line.match(/^#{1,6}\s+(.*)$/)
    if (m) slugs.add(slugify(m[1]))
  }
  return slugs
}

const files = [...mdFiles(DOCS_ROOT)].sort()
const docs = new Map() // absolute path -> { rel, text, fm }
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  docs.set(file, { rel: relative(REPO_ROOT, file), text, fm: parseFrontmatter(text) })
}

// --- frontmatter, names, status
const names = new Map()
for (const [, doc] of docs) {
  if (!doc.fm) {
    fail(doc.rel, 'frontmatter', 'no YAML frontmatter block')
    continue
  }
  for (const key of REQUIRED) {
    if (!doc.fm[key]) fail(doc.rel, 'frontmatter', `missing required field \`${key}\``)
  }
  if (doc.fm.updated_at) {
    fail(doc.rel, 'frontmatter', '`updated_at` is not part of the schema — last-changed time comes from git (ADR 0014)')
  }
  if (doc.fm.status && !STATUS_VOCABULARY.includes(doc.fm.status)) {
    fail(doc.rel, 'status', `\`${doc.fm.status}\` is not in the vocabulary (${STATUS_VOCABULARY.join(', ')}) — absent means agreed and in force`)
  }
  if (doc.fm.name) {
    if (names.has(doc.fm.name)) {
      fail(doc.rel, 'name', `duplicate \`name: ${doc.fm.name}\` — also used by ${names.get(doc.fm.name)}`)
    } else {
      names.set(doc.fm.name, doc.rel)
    }
  }
}

// --- links, anchors, and who links to whom
const linkedTo = new Set()
for (const [file, doc] of docs) {
  let fenced = false
  for (const rawLine of doc.text.split('\n')) {
    if (rawLine.startsWith('```')) { fenced = !fenced; continue }
    if (fenced) continue
    for (const m of rawLine.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const link = m[1]
      if (/^(https?:|mailto:|tel:)/.test(link)) continue
      const [path, anchor] = link.split('#')
      const target = path ? resolve(dirname(file), path) : file
      let exists = true
      try { statSync(target) } catch { exists = false }
      if (!exists) {
        fail(doc.rel, 'link', `\`${link}\` does not resolve`)
        continue
      }
      if (path) linkedTo.add(target)
      if (anchor && target.endsWith('.md')) {
        const text = docs.get(target)?.text ?? readFileSync(target, 'utf8')
        if (!headingSlugs(text).has(anchor)) {
          fail(doc.rel, 'anchor', `\`${link}\` — no heading in the target matches \`#${anchor}\``)
        }
      }
    }
  }
}

// Links from outside docs/ (AGENTS.md and friends) also count as reachability.
for (const entry of readdirSync(REPO_ROOT)) {
  if (!entry.endsWith('.md')) continue
  const p = join(REPO_ROOT, entry)
  if (lstatSync(p).isSymbolicLink()) continue // harness symlinks to AGENTS.md
  for (const m of readFileSync(p, 'utf8').matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const [path] = m[1].split('#')
    if (!path || /^(https?:|mailto:)/.test(path)) continue
    try { linkedTo.add(resolve(REPO_ROOT, path)) } catch {}
  }
}

for (const [file, doc] of docs) {
  if (ROOTS.includes(relative(DOCS_ROOT, file))) continue
  if (!linkedTo.has(file)) {
    fail(doc.rel, 'orphan', 'no other doc links to it — add it to its directory index and docs/INDEX.md')
  }
}

// --- report
if (json) {
  console.log(JSON.stringify({ checked: docs.size, problems }, null, 2))
} else {
  for (const p of problems) console.error(`${p.file}: [${p.rule}] ${p.message}`)
  const summary = problems.length
    ? `\n${problems.length} problem(s) in ${new Set(problems.map((p) => p.file)).size} file(s); ${docs.size} docs checked`
    : `\n${docs.size} docs checked, no problems`
  console.error(summary)
}
process.exit(problems.length ? 1 : 0)
