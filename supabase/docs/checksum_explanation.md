# Embedded Canonical Checksums vs Committed-File SHA-256

## Summary

Each migration file (0000, 003b, 004) contains an **embedded canonical
checksum constant** inside a `DO $guard$` block. This constant is a
SHA-256 hash computed from the file's SQL content. However, because the
constant is itself part of the file, the act of embedding it changes
the file's SHA-256. The embedded value and the committed-file SHA-256
are therefore **different by design**.

The embedded checksum is a **stable migration‑version identifier**,
not a live cryptographic self‑check. The committed-file SHA-256 is the
standard Git‑tracked hash of the complete file including the embedded
constant.

---

## Per-Migration Detail

### 0000_core_schema.sql

| Property | Value |
|---|---|
| File SHA-256 (committed) | `3E8A31316BB9CD90F3921427BE4295AA5071532AB3D925CA5125C406A3CD9F9A` |
| Embedded canonical checksum | `F35FFACD68A2B4ABE180CC8A3632767596B47F198821A8AB445DB56440B9E067` |
| Content included in embedded | All executable SQL, DDL, DCL, DO blocks, comments, and whitespace **except** the two lines containing the checksum literal itself |
| Content excluded | The `_expected TEXT := '...';` line (guard) and the `VALUES ('0000', ..., '...')` line (INSERT) — specifically the 64‑char hex string on each |
| Generation command | `Get-FileHash supabase\migrations\0000_core_schema.sql -Algorithm SHA256` run after all other file content was finalised but **before** the literal hex strings were embedded |
| Why it differs from full-file SHA-256 | Embedding the hash string changes the file. The file's SHA-256 then includes the hash of itself, which is mathematically impossible to stabilise in one iteration. The embedded value is the "last known good" hash of the SQL logic only. |

### 003b_rls_privilege_hardening.sql

| Property | Value |
|---|---|
| File SHA-256 (committed) | `98EEB2D69CF480AB67EDF674B26B137A95F2C419D0BEECD4D0B97048510E0233` |
| Embedded canonical checksum | `5393486531414C2F975C21A3033187294A60EEA51012D6F7386CC726C0750BED` |
| Content included | All executable SQL except the two checksum lines |
| Content excluded | `_expected TEXT := '...';` and `VALUES ('003b', ..., '...')` |
| Generation command | Same method — hash of the file with placeholder `<<<003b_SHA256>>>` before final substitution |
| Why it differs | Same embedding problem as 0000 |

### 004_account_suspension.sql

| Property | Value |
|---|---|
| File SHA-256 (committed) | `45A2B170C1B1AAFA31251DC021A3AC6209919DDD077F54691587CFC58EF730B9` |
| Embedded canonical checksum | `E31D5DF971EE776BD7126EB12C65827DBFD374AA3C8D5C79725DF64C63DE6543` |
| Content included / excluded | Same pattern as above |
| Generation command | Same method |

---

## Does modifying executable SQL cause a hard mismatch?

**Yes.** If any executable SQL, DDL, DCL, DO block, or comment in the
migration file is modified WITHOUT also updating the two embedded
checksum constants to a new, matching value:

- The guard `_expected` constant will remain unchanged.
- The `INSERT ... VALUES (..., checksum)` will attempt to store the
  old constant (blocked by `ON CONFLICT DO NOTHING` on re‑run, or a
  new checksum on first run).
- On re‑run: **HARD ABORT** — `stored.checksum != _expected` → the guard
  detects the mismatch and raises `MIGRATION INTEGRITY FAILURE`.

To authorise a genuine change, the DBA must:
1. Edit the SQL.
2. Compute the new canonical checksum over the modified SQL content
   (excluding the two checksum lines).
3. Update both `_expected TEXT := '...'` and the `VALUES (..., '...')`
   line to the new value.
4. The re‑run guard then compares the new constant against the previously
   stored value. If they differ, the **HARD ABORT still fires** — this
   is intentional: the file has changed since it was first applied.
   Founder authorisation must be obtained and documented before
   proceeding.

---

## Operational meaning

| Scenario | Behaviour |
|---|---|
| First run | Guard proceeds; INSERT stores the embedded constant in `schema_migrations.checksum` |
| Re‑run, file unchanged | `stored.checksum = _expected` → clean skip |
| Re‑run, SQL modified, constants updated to match new SQL hash | `stored.checksum != new _expected` → **HARD ABORT** (file changed since first run) |
| Re‑run, SQL modified, constants NOT updated | Guard still compares old `_expected` against stored → may match (clean skip) if constants untouched, which is dangerous. **Always update constants after authorised changes.** |
| Stored checksum is NULL (legacy) | **HARD ABORT** — founder/legal review required |

The embedded canonical checksum is NOT the complete file hash. It is a
**version identifier** tied to the migration's SQL logic at the time of
canonical authorisation. The committed-file SHA-256 (`Get-FileHash` on
the complete file) is the standard Git‑tracked integrity check and
appears in the checksum manifest.
