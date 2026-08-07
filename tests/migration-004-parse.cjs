/**
 * Real PostgreSQL syntax validation for 004_account_suspension.sql
 * using @pgsql/parser (official libpg_query WASM bindings).
 */

const fs = require('fs');
const path = require('path');
const { Parser } = require('@pgsql/parser');

const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '004_account_suspension.sql');
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
    check(`Parser returned ${result.stmts.length} statements`, result.stmts.length >= 12, `Expected >= 12, got ${result.stmts.length}`);
  } catch (err) {
    check('Full SQL parses without syntax errors', false, err.message);
  }

  // ── 2. Segment-by-segment parse (split on COMMIT) ──────────────────────────
  console.log('');
  console.log('2. Segment-by-segment parse (split on COMMIT):');
  const segments = sql.split(/\bCOMMIT\s*;/i);
  let segCount = 0;
  for (let i = 0; i < segments.length; i++) {
    const trimmed = segments[i].trim();
    if (!trimmed) continue;
    segCount++;
    try {
      parser.parseSync(trimmed);
      check(`Segment ${segCount} parses`, true);
    } catch (err) {
      check(`Segment ${segCount} parses`, false, err.message);
    }
  }

  // ── 3. Key structural elements ─────────────────────────────────────────────
  console.log('');
  console.log('3. Structural elements:');
  check('Adds account_status column', /account_status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'active'/i.test(sql));
  check('Creates account_status_audit table', /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.account_status_audit/i.test(sql));
  check('Enables RLS on audit table', /ALTER\s+TABLE\s+public\.account_status_audit\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql));
  check('Defines trigger function', /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.record_account_status_change/i.test(sql));
  check('Creates trigger', /CREATE\s+TRIGGER\s+trg_users_account_status_audit/i.test(sql));
  check('Revokes EXECUTE on trigger function', /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.record_account_status_change\(\)\s+FROM\s+PUBLIC/i.test(sql));
  check('Grant auth SELECT account_status', /GRANT\s+SELECT\s+\(account_status,\s+suspended_at,\s+suspended_reason\)\s+ON\s+public\.users\s+TO\s+authenticated/i.test(sql));
  check('Revoke auth UPDATE account_status', /REVOKE\s+UPDATE\s+\(account_status,\s+suspended_at,\s+suspended_reason,\s+suspended_by\)\s+ON\s+public\.users\s+FROM\s+authenticated/i.test(sql));
  check('Has verification block', /VERIFICATION\s+004:\s+ALL\s+CHECKS\s+PASSED/i.test(sql));
  check('Transactional BEGIN/COMMIT', /\bBEGIN\s*;/i.test(sql) && /\bCOMMIT\s*;/i.test(sql));

  // ── 4. Safety invariants ───────────────────────────────────────────────────
  console.log('');
  console.log('4. Safety invariants:');
  check('No DELETE on users', !/\bDELETE\s+FROM\s+public\.users/i.test(sql), 'Must not delete users');
  check('No DROP TABLE users', !/\bDROP\s+TABLE\s+(IF\s+EXISTS\s+)?public\.users/i.test(sql), 'Must not drop users');
  check('account_status not used as role', !/role\s+TEXT\s+DEFAULT\s+'suspended'/i.test(sql), 'Must not default role to suspended');

  console.log('');
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('='.repeat(60));
  if (failed > 0) process.exit(1);
})();
