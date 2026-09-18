# Canonical Migration Evidence

This directory contains schemas and sanitized, versioned evidence for the Lumora canonical migration program. Wave 0 does not place raw database dumps, credentials, patient content, staff content, or unredacted logs in Git.

## Rules

- Runtime artifacts belong under `audit/canonical/runtime/` and are ignored by Git.
- Encrypted backups and restore working files stay in restricted storage outside the repository.
- Committed evidence contains aggregates, hashes, versions, object names, gate outcomes, and redacted connection metadata only.
- Names use `wave0-<artifact>-<UTC timestamp>.json`; immutable evidence is addressed by SHA-256.
- Every PASS records its source artifact hashes. Missing, stale, unexplained, or malformed evidence fails closed.
- Technical and data-owner approvals are recorded by reference, never inferred from a successful command.
- PMS is the sole migration owner. Website-generated clients may mirror schema definitions but cannot migrate or write control-plane records.

The production DDL checkpoint is `W0-PROD-DDL-GATE`. It remains blocked until every prerequisite named in the Wave 0 runbook has independently passed.
