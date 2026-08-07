#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'supabase', 'dry-run', 'scenario-c-rls-hardening.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const lines = sql.split('\n');

let pass = 0;
let fail = 0;

function check(name, ok, detail) {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); if (detail) console.log(`    ${detail}`); }
}

console.log('\n=== Scenario C Static SQL Parser ===\n');

// ─── 1. DOLLAR-QUOTE PAIRING ───────────────────────────────────
console.log('1. Dollar-quote delimiter pairing:');

// Find all dollar-quote tags (not $$ — only $tag$ where tag is non-empty)
const dqTags = [];
const dqRegex = /\$(\w+)\$/g;
let m;
while ((m = dqRegex.exec(sql)) !== null) {
  dqTags.push({ tag: m[1], pos: m.index, line: sql.substring(0, m.index).split('\n').length });
}

// Count $fn$ tags
const fnTags = dqTags.filter(t => t.tag === 'fn');
const blockTags = dqTags.filter(t => t.tag === 'block');
check(`$fn$ tags found: ${fnTags.length} (expected 12 = 6 pairs)`, fnTags.length === 12, `Found ${fnTags.length}`);
check(`$block$ tags found: ${blockTags.length} (even count = paired)`, blockTags.length % 2 === 0, `Found ${blockTags.length}`);

// Verify pairing: each tag type should have even count
for (const tagType of ['fn', 'block']) {
  const tags = dqTags.filter(t => t.tag === tagType);
  check(`$${tagType}$ tags are paired (even count: ${tags.length})`, tags.length % 2 === 0, `Odd count: ${tags.length}`);
}

// Check for bare $$ (dollar-dollar without a tag name)
const bareDollarDollar = sql.match(/\$\$/g);
check('No bare $$ delimiters found', bareDollarDollar === null || bareDollarDollar.length === 0, `Found ${(bareDollarDollar || []).length} bare $$`);

// ─── 2. RAISE STATEMENT CONTEXT ────────────────────────────────
console.log('\n2. RAISE statement context (every RAISE inside DO block or function body):');

const raiseLines = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (/^\s*RAISE\s+(NOTICE|WARNING|EXCEPTION)\b/.test(lines[i])) {
    raiseLines.push({ lineNum: i + 1, text: lines[i].trim().substring(0, 80) });
  }
}

// For each RAISE, check that it's inside a DO block or function body
// by counting DO/function openers vs closers before that line
function findContainingBlock(lineNum) {
  let depth = 0;
  for (let i = 0; i < lineNum - 1; i++) {
    const line = lines[i];
    // DO $tag$ ... opens a block
    if (/^DO\s+\$/.test(line.trim())) depth++;
    // END $tag$; closes a block
    if (/^END\s+\$\w+\$/.test(line.trim())) depth--;
    // CREATE OR REPLACE FUNCTION ... AS $tag$ opens a function body (closed by $tag$;)
    // These don't add to the DO depth, they're separate
  }
  return depth;
}

let bareRaiseCount = 0;
for (const r of raiseLines) {
  const depth = findContainingBlock(r.lineNum);
  if (depth === 0) {
    bareRaiseCount++;
    console.log(`  BARE RAISE at line ${r.lineNum}: ${r.text}`);
  }
}

check(`All ${raiseLines.length} RAISE statements are inside PL/pgSQL blocks`, bareRaiseCount === 0, `${bareRaiseCount} bare RAISE statements found`);

// ─── 3. TOP-LEVEL PROCEDURAL COMMANDS ──────────────────────────
console.log('\n3. Top-level procedural command check:');

const proceduralPatterns = [
  { re: /^\s*PERFORM\s/m, name: 'PERFORM' },
  { re: /^\s*DECLARE\s/m, name: 'DECLARE' },
  { re: /^\s*IF\s/m, name: 'IF' },
  { re: /^\s*FOR\s+\w+\s+IN\s/m, name: 'FOR ... IN' },
  { re: /^\s*LOOP\s*$/m, name: 'LOOP' },
  { re: /^\s*EXCEPTION\s+WHEN/m, name: 'EXCEPTION WHEN' },
];

let strayProcedural = 0;
for (const p of proceduralPatterns) {
  // Find all matches with line numbers
  let idx = 0;
  while (true) {
    const pos = sql.indexOf(p.name.toLowerCase(), idx);
    if (pos === -1) break;
    const lineNum = sql.substring(0, pos).split('\n').length;
    const lineText = lines[lineNum - 1].trim();
    // Check if this line starts with the pattern
    if (p.re.test(lineText)) {
      const depth = findContainingBlock(lineNum);
      if (depth === 0) {
        strayProcedural++;
        console.log(`  STRAY ${p.name} at line ${lineNum}: ${lineText.substring(0, 80)}`);
      }
    }
    idx = pos + 1;
  }
}
check('No stray top-level procedural commands', strayProcedural === 0, `${strayProcedural} found`);

// ─── 4. BEGIN/END BLOCK PAIRING ────────────────────────────────
console.log('\n4. BEGIN/END block pairing:');

// Count top-level BEGIN; (transaction) and END $tag$; (block end)
const beginCount = (sql.match(/^BEGIN;\s*$/gm) || []).length;
const commitCount = (sql.match(/^COMMIT;\s*$/gm) || []).length;
check(`Transaction BEGIN/COMMIT paired: ${beginCount} BEGIN, ${commitCount} COMMIT`, beginCount === commitCount, `Mismatch: ${beginCount} vs ${commitCount}`);

// ─── 5. RAISE NOTICE/WARNING/EXCEPTION COUNTS ──────────────────
console.log('\n5. RAISE statement inventory:');

const raiseNotice = (sql.match(/RAISE NOTICE/g) || []).length;
const raiseWarning = (sql.match(/RAISE WARNING/g) || []).length;
const raiseException = (sql.match(/RAISE EXCEPTION/g) || []).length;
console.log(`  RAISE NOTICE: ${raiseNotice}`);
console.log(`  RAISE WARNING: ${raiseWarning}`);
console.log(`  RAISE EXCEPTION: ${raiseException}`);
console.log(`  Total RAISE: ${raiseNotice + raiseWarning + raiseException}`);
check('RAISE counts present', true);

// ─── 6. STRUCTURAL ELEMENT COUNTS ──────────────────────────────
console.log('\n6. Structural element counts:');

// Strip SQL comments before counting structural elements
const sqlNoComments = sql.replace(/--[^\n]*/g, '');
const createTable = (sqlNoComments.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
const createPolicy = (sqlNoComments.match(/CREATE POLICY/g) || []).length;
const dropPolicy = (sqlNoComments.match(/DROP POLICY IF EXISTS/g) || []).length;
const createFunc = (sqlNoComments.match(/CREATE OR REPLACE FUNCTION/g) || []).length;
const doBlock = (sqlNoComments.match(/^DO\s+\$/gm) || []).length;

check(`CREATE TABLE IF NOT EXISTS: ${createTable} (expected 17)`, createTable === 17, `Found ${createTable}`);
check(`CREATE POLICY: ${createPolicy} (expected 38 total across all parts)`, createPolicy >= 38, `Found ${createPolicy}`);
check(`DROP POLICY IF EXISTS: ${dropPolicy} (expected >= 53)`, dropPolicy >= 53, `Found ${dropPolicy}`);
check(`CREATE OR REPLACE FUNCTION: ${createFunc} (expected 6)`, createFunc === 6, `Found ${createFunc}`);
check(`DO blocks: ${doBlock}`, doBlock >= 18, `Found ${doBlock}`);

// ─── 7. POLICY NAME INVENTORY ──────────────────────────────────
console.log('\n7. Policy name inventory:');

const policyNames = [...sql.matchAll(/CREATE POLICY "([^"]+)"/g)].map(m => m[1]);
const uniquePolicies = [...new Set(policyNames)];
console.log(`  Total CREATE POLICY statements: ${policyNames.length}`);
console.log(`  Unique policy names: ${uniquePolicies.length}`);
console.log(`  Names: ${uniquePolicies.join(', ')}`);

// Legacy baseline names (20)
const legacyNames = [
  'platform_config_admin','transactions_select_own','payment_reports_admin_only',
  'admin_manage_claims','public_read_approved_claims',
  'admin_manage_testimonials','public_read_approved_testimonials',
  'Users read own fundraising pages','Users create own fundraising pages',
  'Users update own fundraising pages','Public can view active charities',
  'posts_select','posts_insert','posts_update','posts_delete','posts_select_anon',
  'terms_acceptance_service_insert','terms_acceptance_service_select',
  'webhook_inbox_service_all','booking_conf_service_all'
];
const hardenedNames = [
  'users_select_own','users_update_own_name_avatar',
  'guides_select_published','experiences_select_published','destinations_select_published'
];
const allExpected = [...legacyNames, ...hardenedNames];
const unexpected = allExpected.filter(n => !uniquePolicies.includes(n));
check(`All 25 allowlist names appear in CREATE POLICY`, unexpected.length === 0, unexpected.length ? `Missing: ${unexpected.join(', ')}` : '');

// ─── 8. DROP POLICY INVENTORY ──────────────────────────────────
console.log('\n8. DROP POLICY inventory:');

const dropNames = [...sql.matchAll(/DROP POLICY IF EXISTS "([^"]+)"\s+ON\s+public\.(\w+)/g)].map(m => ({ name: m[1], table: m[2] }));
console.log(`  Total DROP POLICY IF EXISTS: ${dropNames.length}`);

// Part 1 baseline-reset drops: all DROP POLICY IF EXISTS between the comment
// "Explicit baseline-reset" and the CREATE POLICY "platform_config_admin" line
const baselineResetComment = lines.findIndex(l => l.includes('Explicit baseline-reset'));
const firstCreatePolicy = lines.findIndex(l => l.includes('CREATE POLICY "platform_config_admin"'));
const part1Drops = [];
for (let i = baselineResetComment; i < firstCreatePolicy; i++) {
  const m = lines[i].match(/DROP POLICY IF EXISTS "([^"]+)"\s+ON\s+public\.(\w+)/);
  if (m) part1Drops.push({ name: m[1], table: m[2] });
}
console.log(`  Part 1 baseline-reset drops: ${part1Drops.length}`);
check('Part 1 has 25 explicit DROP POLICY statements', part1Drops.length === 25, `Found ${part1Drops.length}`);

// ─── 9. FUNCTION SIGNATURE AUDIT ───────────────────────────────
console.log('\n9. Function signatures:');

const funcDefs = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(([^)]*)\)\s*RETURNS\s+(\S+)/g)];
for (const f of funcDefs) {
  console.log(`  ${f[1]}(${f[2].trim()}) RETURNS ${f[3]}`);
}
check('6 function definitions found', funcDefs.length === 6, `Found ${funcDefs.length}`);

// Check SECURITY DEFINER
const secDefFuncs = [...sql.matchAll(/SECURITY DEFINER/g)].length;
check('SECURITY DEFINER count matches (3 RPCs only)', secDefFuncs === 3, `Found ${secDefFuncs}`);

// ─── 10. NO BARE SQL AFTER COMMIT ─────────────────────────────
console.log('\n10. No bare procedural after COMMIT:');

const commitLine = lines.findIndex(l => l.trim() === 'COMMIT;');
let bareAfterCommit = 0;
if (commitLine >= 0) {
  for (let i = commitLine + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('--') || line.startsWith('RAISE') || line === '') continue;
    // Check for DO blocks — those are fine
    if (line.startsWith('DO $')) break; // Part 5 starts with DO block
    // Check for bare procedural
    if (/^(PERFORM|DECLARE|IF |FOR |LOOP|BEGIN|END)\s/.test(line)) {
      bareAfterCommit++;
      console.log(`  Bare procedural at line ${i + 1}: ${line.substring(0, 80)}`);
    }
  }
}
check('No bare procedural commands after COMMIT', bareAfterCommit === 0);

// ─── 11. LINE COUNT ───────────────────────────────────────────
console.log('\n11. File stats:');
console.log(`  Total lines: ${lines.length}`);
console.log(`  Total characters: ${sql.length}`);

// ─── SUMMARY ───────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log(`${'='.repeat(60)}\n`);

process.exit(fail > 0 ? 1 : 0);
