#!/usr/bin/env node
// find-docs.mjs — query Loredu docs by frontmatter. Zero dependencies; runs under
// either `bun docs/scripts/find-docs.mjs` or `node docs/scripts/find-docs.mjs` (Node 18+).
//
// Usage:
//   node docs/scripts/find-docs.mjs                        # list current docs (stale/archived hidden)
//   node docs/scripts/find-docs.mjs --type contract        # filter by type
//   node docs/scripts/find-docs.mjs --tag v0.x --tag agents # AND-filter by tags
//   node docs/scripts/find-docs.mjs --name records_contract # exact name lookup
//   node docs/scripts/find-docs.mjs working lore           # free-text terms (name+description+tags)
//   node docs/scripts/find-docs.mjs --all                  # include stale/archived docs
//   node docs/scripts/find-docs.mjs --stale                # ONLY archived/superseded or past stale_after
//   node docs/scripts/find-docs.mjs --status archived      # filter by explicit status (implies --all)
//   node docs/scripts/find-docs.mjs --json                 # JSON output for tooling
//
// Default excludes stale docs (status archived/superseded, or stale_after in the
// past) so day-to-day queries only surface trustworthy content.
// Exit code: 0 if matches found, 1 if none.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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
    if (!m) continue // skip nested/list continuation lines (e.g. sources)
    let [, key, value] = m
    value = value.trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"')
    if (value.startsWith('[') && value.endsWith(']')) {
      fm[key] = value.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)
    } else {
      fm[key] = value
    }
  }
  return fm
}

// --- parse args
const args = process.argv.slice(2)
const filters = { type: [], tag: [], status: [], name: [] }
const terms = []
let stale = false
let all = false
let json = false
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--stale') stale = true
  else if (a === '--all') all = true
  else if (a === '--json') json = true
  else if (a === '--help' || a === '-h') {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'))
    process.exit(0)
  } else if (a.startsWith('--')) {
    const key = a.slice(2)
    if (!(key in filters)) { console.error(`unknown flag: ${a}`); process.exit(2) }
    filters[key].push(args[++i])
  } else terms.push(a.toLowerCase())
}

// --- collect + filter
const today = new Date().toISOString().slice(0, 10)
const docs = []
for (const file of mdFiles(DOCS_ROOT)) {
  const fm = parseFrontmatter(readFileSync(file, 'utf8'))
  if (!fm || !fm.name) continue
  const rel = relative(DOCS_ROOT, file)
  const tags = fm.tags ?? []
  const isStale =
    fm.status === 'archived' || fm.status === 'superseded' ||
    (fm.stale_after && fm.stale_after.slice(0, 10) < today)

  if (stale && !isStale) continue
  // default: hide stale docs unless --stale/--all or an explicit --status filter asks for them
  if (!stale && !all && !filters.status.length && isStale) continue
  if (filters.type.length && !filters.type.includes(fm.type)) continue
  if (filters.status.length && !filters.status.includes(fm.status)) continue
  if (filters.name.length && !filters.name.includes(fm.name)) continue
  if (filters.tag.length && !filters.tag.every((t) => tags.includes(t))) continue
  if (terms.length) {
    const haystack = `${fm.name} ${fm.description ?? ''} ${tags.join(' ')}`.toLowerCase()
    if (!terms.every((t) => haystack.includes(t))) continue
  }
  docs.push({ path: rel, ...fm, stale: isStale })
}

docs.sort((a, b) => a.path.localeCompare(b.path))

// --- output
if (json) {
  console.log(JSON.stringify(docs, null, 2))
} else {
  for (const d of docs) {
    const flags = d.stale ? ' [STALE]' : ''
    console.log(`${d.path}${flags}`)
    console.log(`  ${d.type ?? '?'} · ${d.name}${d.tags?.length ? ' · ' + d.tags.join(', ') : ''}`)
    console.log(`  ${d.description ?? ''}`)
  }
  console.error(`\n${docs.length} doc(s)`)
}
process.exit(docs.length ? 0 : 1)
