// Generates a small name-only SVG per mini-bar flavor into public/images/mini/.
// Run: node scripts/gen-flavor-images.mjs   (source of names: src/data/flavors.json)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const flavors = JSON.parse(readFileSync(join(root, 'src/data/flavors.json'), 'utf8'));
const outDir = join(root, 'public/images/mini');
mkdirSync(outDir, { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const palette = (collections) =>
  collections.includes('c-dark')
    ? { bg: '#3b2218', fg: '#f5e6d8' }
    : collections.includes('c-milk')
      ? { bg: '#a8714a', fg: '#ffffff' }
      : { bg: '#d2ab82', fg: '#2b1a10' };

const wrap = (text, max) =>
  text.split(' ').reduce((lines, word) => {
    const last = lines[lines.length - 1];
    return last !== undefined && `${last} ${word}`.length <= max
      ? [...lines.slice(0, -1), `${last} ${word}`]
      : [...lines, word];
  }, []);

for (const { name, collections } of flavors) {
  const { bg, fg } = palette(collections);
  const lines = wrap(name, 11);
  const size = lines.length > 3 ? 20 : 26;
  const lineHeight = size * 1.25;
  const startY = 100 - ((lines.length - 1) * lineHeight) / 2;
  const text = lines
    .map((l, i) => `<text x="100" y="${startY + i * lineHeight}" dominant-baseline="middle">${escapeXml(l)}</text>`)
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="${escapeXml(name)}">` +
    `<rect x="4" y="4" width="192" height="192" rx="18" fill="${bg}" stroke="${fg}" stroke-opacity="0.35" stroke-width="2"/>` +
    `<g fill="${fg}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="700" text-anchor="middle">${text}</g></svg>\n`;
  writeFileSync(join(outDir, `${slug(name)}.svg`), svg);
}
console.log(`wrote ${flavors.length} images to ${outDir}`);
