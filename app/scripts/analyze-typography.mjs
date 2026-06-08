import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC = join(import.meta.dirname, '../src');
const exts = new Set(['.tsx', '.ts', '.jsx', '.js']);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules') walk(p, files);
    } else if (exts.has(extname(name))) files.push(p);
  }
  return files;
}

const files = walk(SRC);
const sizeCounts = {};
const weightCounts = {};
const pairCounts = {};
const rolePatterns = [
  { role: 'sectionTitle', re: /sectionTitle|sectionHeader|section_title/i },
  { role: 'screenTitle', re: /screenTitle|tabScreenTitle|heroTitle|modalTitle|dialogTitle|ctTitle/i },
  { role: 'cardTitle', re: /cardTitle|cardName|teCardName|eventListTitle|pastCardTitle/i },
  { role: 'rowLabel', re: /rowLabel|rowText|profileName|fieldLabel|label:/i },
  { role: 'body', re: /cardBody|bodyText|infoText|notifMessage|rowSub|profileEmail|subtitle|footerText/i },
  { role: 'caption', re: /caption|meta|time|badge|chip|pill|navText|scopeNote|digestSub/i },
  { role: 'button', re: /BtnText|buttonText|createBtn|submit|acceptBtn|declineBtn|retryText|primaryText|secondaryText/i },
  { role: 'emptyState', re: /emptyTitle|emptySubtitle|emptyState/i },
  { role: 'header', re: /AppHeader|title:|headerTitle|welcomeTitle/i },
];

const roleUsage = {};

function extractStyleBlock(content, styleName) {
  const re = new RegExp(`${styleName}:\\s*\\{([^}]+)\\}`, 'g');
  const blocks = [];
  let m;
  while ((m = re.exec(content))) blocks.push(m[1]);
  return blocks;
}

function parseProps(block) {
  const size = block.match(/fontSize:\s*(\d+)/)?.[1];
  const weight = block.match(/fontWeight:\s*['"]?(\w+)/)?.[1];
  return { size, weight };
}

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const rel = file.replace(/\\/g, '/').split('/src/')[1];

  // Inline style objects
  const inlineRe = /\{[^}]*fontSize:\s*\d+[^}]*\}/g;
  let m;
  while ((m = inlineRe.exec(content))) {
    const block = m[0];
    const { size, weight } = parseProps(block);
    if (size) {
      sizeCounts[size] = (sizeCounts[size] || 0) + 1;
      const w = weight || '(none)';
      pairCounts[`${size}/${w}`] = (pairCounts[`${size}/${w}`] || 0) + 1;
      if (weight) weightCounts[weight] = (weightCounts[weight] || 0) + 1;
    }
  }

  // StyleSheet named styles
  const styleSheetRe = /(\w+):\s*\{([^}]+)\}/g;
  while ((m = styleSheetRe.exec(content))) {
    const styleName = m[1];
    const block = m[2];
    if (!block.includes('fontSize')) continue;
    const { size, weight } = parseProps(block);
    if (!size) continue;
    sizeCounts[size] = (sizeCounts[size] || 0) + 1;
    const w = weight || '(none)';
    pairCounts[`${size}/${w}`] = (pairCounts[`${size}/${w}`] || 0) + 1;
    if (weight) weightCounts[weight] = (weightCounts[weight] || 0) + 1;

    for (const { role, re } of rolePatterns) {
      if (re.test(styleName)) {
        if (!roleUsage[role]) roleUsage[role] = {};
        const key = `${size}/${w}`;
        if (!roleUsage[role][key]) roleUsage[role][key] = [];
        roleUsage[role][key].push(`${rel} → ${styleName}`);
      }
    }
  }
}

console.log('=== FONT SIZE FREQUENCY ===');
Object.entries(sizeCounts).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([s, c]) => console.log(`${s}px: ${c}`));

console.log('\n=== FONT WEIGHT FREQUENCY ===');
Object.entries(weightCounts).sort((a, b) => b[1] - a[1]).forEach(([w, c]) => console.log(`${w}: ${c}`));

console.log('\n=== TOP SIZE/WEIGHT PAIRS ===');
Object.entries(pairCounts).sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([p, c]) => console.log(`${p}: ${c}`));

console.log('\n=== SEMANTIC ROLE CONFLICTS ===');
for (const [role, variants] of Object.entries(roleUsage)) {
  const keys = Object.keys(variants);
  if (keys.length > 1) {
    console.log(`\n${role} (${keys.length} variants):`);
    for (const [k, locs] of Object.entries(variants)) {
      console.log(`  ${k} — ${locs.slice(0, 3).join(', ')}${locs.length > 3 ? ` +${locs.length - 3} more` : ''}`);
    }
  }
}
