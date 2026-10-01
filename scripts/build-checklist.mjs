// scripts/build-checklist.mjs
//
// Renders the lead magnet's canonical source,
//   lead-magnet/multi-tenant-saas-architecture-checklist.html
// into the PDF the site serves at /multi-tenant-saas-checklist.pdf (repo root,
// deployed by copyStaticAssets) and its copy in lead-magnet/.
//
//   npm run checklist:build
//
// Never replace the PDF by hand: the deployed binary drifted once (old LinkedIn
// slug, "Cairo · Remote & open to relocation") while the source was already
// correct. The site build re-renders the source and fails the deploy if the
// committed PDF no longer matches it (scripts/build.mjs, assertPublicPdfs).

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { CONTACT, LOCATION_LABEL } from './site-facts.mjs';
import { inspectPdf, pdfProblems, PDF_REQUIRED_URIS } from './pdf-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CHECKLIST_SRC = path.join(ROOT, 'lead-magnet', 'multi-tenant-saas-architecture-checklist.html');
export const CHECKLIST_PDF = 'multi-tenant-saas-checklist.pdf';
const OUTS = [path.join(ROOT, CHECKLIST_PDF), path.join(ROOT, 'lead-magnet', CHECKLIST_PDF)];

// The checklist's links and footer must carry the canonical facts.
export const CHECKLIST_REQUIRED_URIS = [...PDF_REQUIRED_URIS, CONTACT.calendly, `mailto:${CONTACT.email}`];
export const CHECKLIST_REQUIRED_TEXT = ['Ahmed Farid', 'Senior Software Engineer', LOCATION_LABEL, CONTACT.email];

// Render the source to a PDF buffer. Only local files load (the source uses
// system fonts and no remote assets), so two renders of the same source in
// two places produce the same text.
export async function renderChecklist(browser) {
  const page = await browser.newPage();
  try {
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().startsWith('file:') || r.url().startsWith('data:') ? r.continue() : r.abort()));
    await page.emulateMediaType('print');
    await page.goto(pathToFileURL(CHECKLIST_SRC).href, { waitUntil: 'load' });
    // 10mm on every side, as the original render had (the source has no
    // @page rule, so without this the text runs to the paper edge).
    const margin = { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' };
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, margin }));
  } finally {
    await page.close();
  }
}

async function main() {
  // The "Book a call" CTA books directly, so it must be the canonical Calendly
  // link, not a copy of it that can drift.
  const src = await readFile(CHECKLIST_SRC, 'utf8');
  const cta = (src.match(/<a href="([^"]+)">Book a [^<]*<\/a>/) || [])[1];
  if (cta !== CONTACT.calendly) {
    console.error(`✗ checklist "Book a call" links to ${cta || '(nothing)'}; expected CONTACT.calendly (${CONTACT.calendly}).`);
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  let pdf;
  try { pdf = await renderChecklist(browser); } finally { await browser.close(); }

  // Validate the PDF itself — its visible text and its link targets — before
  // anything is written.
  const info = await inspectPdf(pdf);
  const problems = pdfProblems(info, { requireUris: CHECKLIST_REQUIRED_URIS, requireText: CHECKLIST_REQUIRED_TEXT });
  if (problems.length) {
    console.error('✗ rendered checklist PDF failed validation:\n' + problems.map((p) => `   ${p}`).join('\n'));
    process.exit(1);
  }
  for (const out of OUTS) await writeFile(out, pdf);
  const footer = info.pageTexts.at(-1).split('\n').map((l) => l.trim()).filter((l) => l.startsWith('©')).pop();
  console.log(`✓ wrote ${OUTS.map((o) => path.relative(ROOT, o)).join(' + ')} (${info.pages} pages, ${(pdf.length / 1024).toFixed(0)} KB)`);
  console.log(`  footer: ${footer}`);
  console.log(`  links:  ${info.uris.join('  ')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
