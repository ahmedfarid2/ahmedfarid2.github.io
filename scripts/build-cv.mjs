// scripts/build-cv.mjs
//
// Renders cv/cv.html to Ahmed-Farid-CV.pdf at the repo root (the file the site
// links to as /Ahmed-Farid-CV.pdf; copyStaticAssets deploys root files).
//
//   npm run cv:build
//
// Fails instead of writing if the CV no longer fits on one A4 page, or if it
// carries a contact detail the public brand has retired.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { CONTACT, LOCATION_LABEL } from './site-facts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'cv', 'cv.html');
const OUT = path.join(ROOT, 'Ahmed-Farid-CV.pdf');

const html = await readFile(SRC, 'utf8');
const body = html.replace(/<!--[\s\S]*?-->/g, '');

// The CV must carry the canonical contact facts…
const required = [CONTACT.email, CONTACT.linkedin, CONTACT.github, LOCATION_LABEL];
const missing = required.filter((s) => !body.includes(s));
// …and none of the retired ones (personal Gmail, phone numbers, Cairo base,
// relocation line).
const retired = [/gmail\.com/i, /tel:/i, /relocat/i, /ahmed-farid-b46a5221b/i, /Cairo, Egypt\s*·\s*Open/i];
const found = retired.filter((rx) => rx.test(body)).map(String);
if (missing.length || found.length) {
  console.error('✗ cv/cv.html is out of line with the public facts:');
  missing.forEach((s) => console.error(`   missing: ${s}`));
  found.forEach((s) => console.error(`   retired: ${s}`));
  process.exit(1);
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
try {
  const page = await browser.newPage();
  // Lay the page out at the printable A4 width (210mm minus the @page side
  // margins) in print media, and compare its height with the printable
  // height. Chrome's PDF is compressed, so counting pages in the bytes is not
  // reliable; measuring the layout is.
  const MM = 96 / 25.4;
  const PRINT_W = Math.floor((210 - 26) * MM), PRINT_H = Math.floor((297 - 21) * MM);
  await page.setViewport({ width: PRINT_W, height: PRINT_H });
  await page.emulateMediaType('print');
  await page.goto(pathToFileURL(SRC).href, { waitUntil: 'load' });
  const { used, wide, text } = await page.evaluate(() => ({
    used: Math.ceil(document.body.scrollHeight),
    // Lines that must not wrap (contact, dates) must not overflow either: a
    // different font set can widen them without changing the height.
    wide: [...document.querySelectorAll('body *')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).whiteSpace === 'nowrap')
      .map((e) => (e.textContent || '').trim().slice(0, 40)),
    text: document.body.innerText,
  }));
  if (used > PRINT_H) {
    console.error(`✗ CV is ${used}px tall; one A4 page holds ${PRINT_H}px. Tighten cv/cv.html.`);
    process.exit(1);
  }
  if (wide.length) {
    console.error(`✗ CV text overflows its line: ${wide.join(' | ')}. Shorten it or reduce the font.`);
    process.exit(1);
  }
  // Any phone-number shape in the rendered text (9+ digits in one run of
  // digits, spaces, dots, dashes, brackets) — no phone is published.
  const phone = (text.match(/\+?\(?\d[\d\s().-]{7,}\d/g) || []).filter((m) => m.replace(/\D/g, '').length >= 9);
  if (phone.length) {
    console.error(`✗ CV shows what looks like a phone number: ${phone.join(', ')}`);
    process.exit(1);
  }
  const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  await writeFile(OUT, pdf);
  console.log(`✓ wrote ${path.relative(ROOT, OUT)} (1 page: ${used}/${PRINT_H}px used, ${(pdf.length / 1024).toFixed(0)} KB)`);
} finally {
  await browser.close();
}
