#!/usr/bin/env node
// check-catalog.mjs — behavioral-catalog integrity. Zero dependencies; runs
// under `bun docs/scripts/check-catalog.mjs` or node.
//
// The catalog in docs/v0.x/execution/first-user-journey.md is authoritative.
// Every T-number in it must be in exactly one of two states (ADR 0012, 0015):
//
//   implemented — claimed by an executable test under tests/ via `@covers T01`
//   deferred    — listed in docs/v0.x/execution/catalog-status.json with a milestone
//
// Never both. Never neither. Nothing may claim a T-number the catalog does not
// define, and a test that claims coverage must actually assert something — a
// green suite must never mean "a placeholder file exists".
//
// Usage: check-catalog.mjs [--json]
// Exit code: 0 clean, 1 problems found.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CATALOG = join(REPO_ROOT, 'docs/v0.x/execution/first-user-journey.md')
const STATUS = join(REPO_ROOT, 'docs/v0.x/execution/catalog-status.json')
const TESTS = join(REPO_ROOT, 'tests')

const json = process.argv.includes('--json')
const problems = []
const fail = (rule, message) => problems.push({ rule, message })

// --- the catalog: T-ids are the first cell of a table row
const catalog = new Map() // id -> group heading
{
  let group = '(ungrouped)'
  for (const line of readFileSync(CATALOG, 'utf8').split('\n')) {
    const h = line.match(/^#{2,4}\s+(.*)$/)
    if (h) group = h[1].trim()
    const row = line.match(/^\|\s*(T\d+)\s*\|/)
    if (row) {
      if (catalog.has(row[1])) fail('catalog', `${row[1]} appears twice in the catalog`)
      catalog.set(row[1], group)
    }
  }
}
if (catalog.size === 0) fail('catalog', `no T-numbers found in ${relative(REPO_ROOT, CATALOG)} — the parser or the doc changed shape`)

// --- deferred, from the status file
const deferred = new Map() // id -> entry
if (!existsSync(STATUS)) {
  fail('status', `${relative(REPO_ROOT, STATUS)} is missing`)
} else {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(STATUS, 'utf8'))
  } catch (err) {
    fail('status', `${relative(REPO_ROOT, STATUS)} is not valid JSON: ${err.message}`)
  }
  for (const [id, entry] of Object.entries(parsed?.deferred ?? {})) {
    if (!entry?.milestone) fail('status', `${id} is deferred without a \`milestone\``)
    if (!entry?.reason) fail('status', `${id} is deferred without a \`reason\``)
    deferred.set(id, entry)
  }
}

// --- implemented, from executable tests
function* testFiles(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) yield* testFiles(p)
    else if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) yield p
  }
}

const implemented = new Map() // id -> [files]
for (const file of testFiles(TESTS)) {
  const rel = relative(REPO_ROOT, file)
  const text = readFileSync(file, 'utf8')
  const claimed = new Set()
  for (const m of text.matchAll(/@covers\s+(T\d+(?:\s*,\s*T\d+)*)/g)) {
    for (const id of m[1].split(',').map((s) => s.trim())) claimed.add(id)
  }
  if (claimed.size === 0) continue
  // A claim has to be backed by a real, running assertion.
  if (!/\bexpect\s*\(/.test(text)) {
    fail('placeholder', `${rel} claims ${[...claimed].join(', ')} but contains no assertion`)
  }
  if (/\b(test|it|describe)\s*\.\s*(skip|todo)\b/.test(text)) {
    fail('placeholder', `${rel} claims ${[...claimed].join(', ')} but uses \`.skip\`/\`.todo\` — a skipped test covers nothing`)
  }
  for (const id of claimed) {
    if (!implemented.has(id)) implemented.set(id, [])
    implemented.get(id).push(rel)
  }
}

// --- exact accounting
for (const id of catalog.keys()) {
  const impl = implemented.has(id)
  const defer = deferred.has(id)
  if (impl && defer) {
    fail('double-counted', `${id} is both claimed by ${implemented.get(id).join(', ')} and deferred in the status file — pick one`)
  }
  if (!impl && !defer) {
    fail('unaccounted', `${id} (${catalog.get(id)}) is neither claimed by a test nor deferred in the status file`)
  }
}
for (const id of implemented.keys()) {
  if (!catalog.has(id)) fail('unknown', `${id} is claimed by ${implemented.get(id).join(', ')} but the catalog does not define it`)
}
for (const id of deferred.keys()) {
  if (!catalog.has(id)) fail('unknown', `${id} is deferred in the status file but the catalog does not define it`)
}

// --- report
const summary = {
  catalog: catalog.size,
  implemented: [...implemented.keys()].sort().length,
  deferred: [...deferred.keys()].filter((id) => catalog.has(id)).length,
  problems,
}
if (json) {
  console.log(JSON.stringify({ ...summary, implementedIds: [...implemented.keys()].sort() }, null, 2))
} else {
  for (const p of problems) console.error(`[${p.rule}] ${p.message}`)
  console.error(
    `\ncatalog ${summary.catalog} = implemented ${summary.implemented} + deferred ${summary.deferred}` +
      (problems.length ? `\n${problems.length} problem(s)` : ' — accounted for'),
  )
}
process.exit(problems.length ? 1 : 0)
