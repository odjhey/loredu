# Loredu

Loredu is an embedded operational knowledge kernel — a utility for our own products to build on, not a standalone product. Activities append what they learn as immutable, provenance-carrying records; claims declare identity keys so knowledge about the same fact meets instead of piling up.

The kernel is strictly mechanical: it detects — duplicates, conflicts, divergence, staleness — deterministically, and never judges. Humans and agents make the judgments, and every judgment is itself a record. It is reactive: mechanical feedback and explicit health let writers correct the store in the same session ([product architecture](docs/architecture/product-architecture.md)). Derived views are bounded and stamped with the basis they were computed from, so consumers can cache them, detect staleness, and reproduce them exactly.

Vocabulary, namespacing, writers, and surfaces belong to consumers; Loredu owns the consistent record, detection, resolution, and disclosure semantics underneath — machine-readable at every boundary.

The project is implementing its v0.x contracts milestone by milestone. M0, M1, and the [complete M1.5 application and CLI](packages/cli/README.md) provide record mutation, reads, pagination, and the bounded rendered command surface. M2-R now adds deterministic reconciliation primitives, richer Claim feedback, and overlap-aware health inside the kernel; public Current Knowledge/projections and M3 Working Lore remain staged in the [implementation plan](docs/v0.x/execution/implementation-plan.md).

Start with [`docs/README.md`](docs/README.md) and [`docs/v0.x/README.md`](docs/v0.x/README.md).
