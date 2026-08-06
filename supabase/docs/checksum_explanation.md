# Embedded Canonical Checksums vs Full-File SHA-256

## The embedded checksum is a database migration-history guard

Each migration file (0000, 003b, 004) contains an embedded checksum
constant. This value is **not** a live cryptographic hash of the
complete file. It is a **migration-version identifier** stored inside
`schema_migrations.checksum` on first run and compared on every
subsequent re-run to detect file tampering.

The **authoritative verification** of file integrity is provided by
the external script `supabase/manifest/verify_checksums.ps1` and the
committed manifest `supabase/manifest/phaseb_checksum_manifest.json`.
That script computes the actual full-file SHA-256 of every migration
and seed file and compares it against the manifest. It is the only
mechanism that detects a modified file independently of the embedded
constant.

## How the embedded guard works

1. **First run**: the `INSERT INTO schema_migrations` stores the
   embedded constant as `checksum`.
2. **Re-run**: the `DO $guard$` block compares the embedded constant
   against the stored `checksum`.
   - Match: the migration file content around the embedded constant
     has not changed since first run. Proceed or skip cleanly.
   - Mismatch: either the embedded constant was updated (file
     modified) or the migration file was replaced. HARD ABORT.
3. **ON CONFLICT (version) DO NOTHING**: the stored checksum is never
   silently overwritten.

## Why the embedded value differs from the full-file SHA-256

The embedded constant is part of the file. Computing a hash of a
file that contains its own hash is a circular dependency — each
iteration produces a different value. The embedded constant is the
hash of the file **before** the constant was finalised. The
committed-file SHA-256 (in the manifest) is the hash of the complete
file including the embedded constant.

## What the embedded checksum IS

- A migration-history guard enforcing: "this migration was applied
  in this exact version; do not re-run a modified copy without
  founder authorisation."
- A stable identifier that survives the embedding process.

## What the embedded checksum IS NOT

- It is **not** a live file-integrity check.
- It is **not** a substitute for the external verification script.
- It does **not** independently detect a file modification where
  the embedded constant was also updated.

## Verification chain

| Layer | Tool | What it verifies |
|---|---|---|
| File integrity | `supabase/manifest/verify_checksums.ps1` + manifest JSON | Complete SHA-256 of every committed file — detects any modification |
| Re-run safety | Embedded guard in each migration | Compares stored checksum against embedded constant — detects version drift |
| Immutability | `ON CONFLICT (version) DO NOTHING` | Prevents silent overwrite of historical checksums |

## Per-migration embedded constants

| Migration | Embedded constant (first 16 chars) |
|---|---|
| 0000 | `F35FFACD68A2B4ABE...` |
| 003b | `5393486531414C2F...` |
| 004 | `E31D5DF971EE776B...` |

The full 64-character values and the committed-file SHA-256
counterparts are available in `supabase/manifest/phaseb_checksum_manifest.json`.
