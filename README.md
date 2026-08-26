# Loredu

Loredu is an embedded operational knowledge kernel — a utility our own products build on, not a standalone product. Activities append what they learn as immutable, provenance-carrying records; claims declare identity keys so knowledge about the same fact meets instead of piling up.

The kernel is strictly mechanical: it detects — duplicates, conflicts, divergence, staleness — deterministically, and never judges. Humans and agents make the judgments, and every judgment is itself a record. It is reactive: each interaction answers with the resulting knowledge health and deterministic next actions, so writers correct the store in the same session. Derived views are bounded and stamped with the basis they were computed from, so consumers can cache them, detect staleness, and reproduce them exactly.

Vocabulary, namespacing, writers, and surfaces belong to consumers; Loredu owns the consistent record, detection, resolution, and disclosure semantics underneath — machine-readable at every boundary.

The project is currently defining its v0.x application contracts before committing to CLI, runtime, model, crawler, or storage-provider surfaces.

Start with [`docs/README.md`](docs/README.md) and [`docs/v0.x/README.md`](docs/v0.x/README.md).
