/**
 * Real PostgreSQL syntax validation for 003b_rls_privilege_hardening.sql
 * using @pgsql/parser (official libpg_query WASM bindings).
 *
 * Guards against regressions like the bare RAISE NOTICE outside a DO block
 * (fixed 2026-08-06) that made the production migration un-runnable in the
 * Supabase SQL Editor.
 */

const fs = require('fs');
const path = require('path');
const { Parser } = require('@pgsql/parser');

const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '003b_rls_privilege_hardening.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log(`File: ${sqlPath}`);
console.log(`Lines: ${sql.split('\n').length}`);
console.log(`Size: ${sql.length} chars`);
console.log('');

let passed = 0;
let failed = 0;

function check(label, ok, detail) {
  if (ok) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label} — ${detail || ''}`);
    failed++;
  }
}

(async () => {
  const parser = new Parser(16);
  await parser.loadParser();
  console.log(`PostgreSQL parser loaded (version 16)`);
  console.log('');

  // ── 1. Full-file parse ──────────────────────────────────────────────────────
  console.log('1. Full-file parse with official PostgreSQL parser:');
  try {
    const result = parser.parseSync(sql);
    check('Full SQL parses without syntax errors', true);
    check(`Parser returned ${result.stmts.length} statements`, result.stmts.length > 40, `Expected > 40, got ${result.stmts.length}`);
  } catch (err) {
    check('Full SQL parses without syntax errors', false, err.message);
  }

  // ── 2. No bare RAISE outside DO blocks ────────────────────────────────────
  console.log('');
  console.log('2. No bare RAISE statements outside DO blocks:');
  const lines = sql.split(/\r?\n/);
  let inDollar = false;
  let dollarName = '';
  let bareRaises = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match any DO block with named or anonymous dollar quotes
    // e.g. DO $$, DO $struct$, DO $guard$, DO $adv_supa_admin$
    const doMatch = line.match(/^\s*DO\s*\$([a-zA-Z_]*)\$/);
    if (doMatch) { inDollar = true; dollarName = doMatch[1]; continue; }
    // Match end of named dollar-quoted block: END $name$;
    if (inDollar && dollarName) {
      const endMatch = line.match(new RegExp('\\$' + dollarName + '\\$\\s*;$'));
      if (endMatch) { inDollar = false; dollarName = ''; continue; }
    }
    // Match end of anonymous dollar-quoted block: $$;
    if (inDollar && !dollarName && /\$\$\s*;$/.test(line)) { inDollar = false; continue; }
    if (!inDollar && /^\s*RAISE\s/i.test(line)) bareRaises.push((i + 1) + ': ' + line.trim());
  }
  check('No bare RAISE statements', bareRaises.length === 0, bareRaises.join(' | '));

  // ── 3. Structural elements ─────────────────────────────────────────────────
  console.log('');
  console.log('3. Structural elements:');
  check('BEGIN transaction', /\bBEGIN\s*;/i.test(sql));
  check('COMMIT transaction', /\bCOMMIT\s*;/i.test(sql));
  check('Section 11 verification present', /POST-MIGRATION\s+VERIFICATION/i.test(sql));
  check('Default privilege narrowing (service_role=arwd)', /service_role=arwd/i.test(sql));
  check('Sequence default narrowing (service_role=rU)', /service_role=rU/i.test(sql));

  console.log('');
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
})();
