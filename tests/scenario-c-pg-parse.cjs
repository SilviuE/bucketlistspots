/**
 * Real PostgreSQL syntax validation using @pgsql/parser.
 * This is the OFFICIAL PostgreSQL parser (libpg_query WASM bindings).
 * If this passes, the SQL WILL parse in any real PostgreSQL instance.
 */

const fs = require('fs');
const path = require('path');
const { Parser } = require('@pgsql/parser');

const sqlPath = path.join(__dirname, '..', 'supabase', 'dry-run', 'scenario-c-rls-hardening.sql');
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

function pgParse(parser, sqlText) {
  return parser.parseSync(sqlText);
}

(async () => {
  const parser = new Parser(16);
  await parser.loadParser();
  console.log(`PostgreSQL parser loaded (version 16)`);
  console.log('');

  // ── 1. Full-file parse ──────────────────────────────────────────────────────
  console.log('1. Full-file parse with official PostgreSQL parser:');
  try {
    const result = pgParse(parser, sql);
    check('Full SQL parses without syntax errors', true);
    check(`Parser returned ${result.stmts.length} statements`, result.stmts.length > 100, `Expected > 100, got ${result.stmts.length}`);
  } catch (err) {
    check('Full SQL parses without syntax errors', false, err.message);
  }

  // ── 2. Segment-by-segment parse (split on COMMIT) ──────────────────────────
  console.log('');
  console.log('2. Segment-by-segment parse (split on COMMIT):');
  const segments = sql.split(/\bCOMMIT\s*;/i);
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const nonComment = trimmed.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!nonComment) continue;

    const hasBegin = /\bBEGIN\b/i.test(trimmed);
    const hasSQL = /\b(CREATE|ALTER|DROP|INSERT|SELECT|DO|GRANT|REVOKE|SET|UPDATE|DELETE)\b/i.test(nonComment);

    if (hasSQL) {
      try {
        const toParse = hasBegin ? trimmed : `BEGIN;\n${trimmed}`;
        pgParse(parser, toParse);
        check(`Segment ${i + 1} parses OK (${trimmed.split('\n').length} lines)`, true);
      } catch (err) {
        try {
          pgParse(parser, trimmed);
          check(`Segment ${i + 1} parses OK (raw)`, true);
        } catch (err2) {
          const firstLine = trimmed.split('\n')[0].substring(0, 80);
          check(`Segment ${i + 1} parses OK`, false, `First line: "${firstLine}" — ${err2.message.substring(0, 120)}`);
        }
      }
    }
  }

  // ── 3. Parse each individual DO block ──────────────────────────────────────
  console.log('');
  console.log('3. Individual DO block parsing:');
  const doBlocks = [];
  const doRegex = /\bDO\s+\$block\$([\s\S]*?)END\s+\$block\$/gi;
  let match;
  while ((match = doRegex.exec(sql)) !== null) {
    doBlocks.push({ index: match.index, content: match[0] });
  }
  console.log(`  Found ${doBlocks.length} DO $block$ blocks`);

  let allDoBlocksOk = true;
  for (const block of doBlocks) {
    try {
      pgParse(parser, block.content);
    } catch (err) {
      try {
        pgParse(parser, `BEGIN;\n${block.content}\nCOMMIT;`);
      } catch (err2) {
        check(`DO block at offset ${block.index}`, false, err2.message.substring(0, 100));
        allDoBlocksOk = false;
      }
    }
  }
  if (allDoBlocksOk) {
    check(`All ${doBlocks.length} DO $block$ blocks parse OK`, true);
  }

  // ── 4. Parse each CREATE FUNCTION ──────────────────────────────────────────
  console.log('');
  console.log('4. CREATE FUNCTION parsing:');
  const fnRegex = /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b[\s\S]*?\bEND\b[\s\S]*?\$fn\$/gi;
  const functions = [];
  while ((match = fnRegex.exec(sql)) !== null) {
    functions.push({ index: match.index, content: match[0] });
  }
  console.log(`  Found ${functions.length} function definitions`);

  let allFnsOk = true;
  for (const fn of functions) {
    try {
      pgParse(parser, fn.content);
    } catch (err) {
      const preview = fn.content.substring(0, 100).replace(/\n/g, ' ');
      check(`Function at offset ${fn.index}: "${preview}..."`, false, err.message.substring(0, 120));
      allFnsOk = false;
    }
  }
  if (allFnsOk) {
    check(`All ${functions.length} CREATE FUNCTION statements parse OK`, true);
  }

  // ── 5. Parse CREATE POLICY statements ──────────────────────────────────────
  console.log('');
  console.log('5. CREATE POLICY parsing:');
  const policyRegex = /\bCREATE\s+POLICY\b[^;]+;/gi;
  const policies = [];
  while ((match = policyRegex.exec(sql)) !== null) {
    policies.push({ index: match.index, content: match[0] });
  }
  console.log(`  Found ${policies.length} CREATE POLICY statements`);

  let allPoliciesOk = true;
  for (const pol of policies) {
    try {
      pgParse(parser, pol.content);
    } catch (err) {
      check(`Policy at offset ${pol.index}`, false, err.message.substring(0, 120));
      allPoliciesOk = false;
    }
  }
  if (allPoliciesOk) {
    check(`All ${policies.length} CREATE POLICY statements parse OK`, true);
  }

  // ── 6. Parse GRANT/REVOKE statements ──────────────────────────────────────
  // Skip lines inside DO blocks (regex can't tell comment/code from real GRANT)
  console.log('');
  console.log('6. GRANT/REVOKE parsing (top-level only, skip inside DO blocks):');
  const lines6 = sql.split('\n');
  let insideDo = false;
  const grants6 = [];
  for (let li = 0; li < lines6.length; li++) {
    const line = lines6[li];
    if (/\bDO\s+\$block\$/.test(line)) insideDo = true;
    if (/\bEND\s+\$block\$/.test(line)) { insideDo = false; continue; }
    if (insideDo) continue;
    if (/^\s*--/.test(line)) continue; // skip comments
    if (/\b(?:GRANT|REVOKE)\b/.test(line) && /;/.test(line)) {
      grants6.push({ line: li + 1, content: line.trim() });
    }
  }
  console.log(`  Found ${grants6.length} top-level GRANT/REVOKE statements`);

  let allGrantsOk = true;
  for (const grant of grants6) {
    try {
      pgParse(parser, grant.content);
    } catch (err) {
      check(`GRANT/REVOKE at line ${grant.line}`, false, `"${grant.content.substring(0, 60)}" — ${err.message.substring(0, 100)}`);
      allGrantsOk = false;
    }
  }
  if (allGrantsOk) {
    check(`All ${grants6.length} top-level GRANT/REVOKE statements parse OK`, true);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('');
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
})();
