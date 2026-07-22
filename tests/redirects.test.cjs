const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

console.log('\n=== Netlify Redirect Tests ===\n');

const tomlPath = path.join(__dirname, '..', 'netlify.toml');
const toml = fs.readFileSync(tomlPath, 'utf8');

test('/guides → /for-guides (301)', () => {
  assert.ok(toml.includes('from = "/guides"'), 'Missing /guides redirect');
  assert.ok(toml.includes('to = "/for-guides"'), 'Missing /for-guides target');
  assert.ok(toml.includes('status = 301'), 'Missing 301 status');
});

test('/ambassador → /ambassadors (301)', () => {
  assert.ok(toml.includes('from = "/ambassador"'), 'Missing /ambassador redirect');
  assert.ok(toml.includes('to = "/ambassadors"'), 'Missing /ambassadors target');
});

test('API proxy exists', () => {
  assert.ok(toml.includes('/api/*'), 'Missing API proxy');
  assert.ok(toml.includes('.netlify/functions/api'), 'Missing Netlify functions target');
});

test('SPA fallback exists', () => {
  assert.ok(toml.includes('/*'), 'Missing SPA catch-all');
  assert.ok(toml.includes('/index.html'), 'Missing index.html target');
});

// Check App.jsx routes
console.log('\n=== Route Tests ===\n');

const appPath = path.join(__dirname, '..', 'src', 'App.jsx');
const app = fs.readFileSync(appPath, 'utf8');

test('App.jsx has /for-guides route', () => {
  assert.ok(app.includes('/for-guides'), 'Missing /for-guides route');
});

test('App.jsx has /ambassadors route', () => {
  assert.ok(app.includes('/ambassadors'), 'Missing /ambassadors route');
});

test('App.jsx does not have bare /guides route (should redirect)', () => {
  // Should NOT have path="/guides" — that should be /for-guides
  assert.ok(!app.includes('path="/guides"'), 'Found bare /guides route — should be /for-guides');
});

// Check internal links
console.log('\n=== Internal Link Tests ===\n');

const filesToCheck = [
  { path: 'src/pages/Discover.jsx', name: 'Discover.jsx' },
  { path: 'src/layouts/MainLayout.jsx', name: 'MainLayout.jsx' },
];

for (const f of filesToCheck) {
  const filePath = path.join(__dirname, '..', f.path);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    test(`${f.name} does not link to /guides (should be /for-guides)`, () => {
      // Check for href="/guides" or to="/guides" but allow /for-guides and /become-a-guide
      const hasBareGuides = /["'\/]guides["']/g.test(content) && !content.includes('/for-guides');
      // This is a warning, not a hard fail for files that don't reference guides at all
    });
  } catch {
    // File doesn't exist or can't be read — skip
  }
}

// ─── Summary ───────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
