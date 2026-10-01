// scripts/pdf-check.mjs
//
// Reads what a published PDF actually says: the text a reader sees and the
// URLs its links open. The site build scans HTML for retired facts, but a PDF
// is a binary it cannot read, which is how a stale checklist (old LinkedIn
// slug, "Cairo · Remote & open to relocation") stayed live after the HTML
// sources were fixed.
//
// Used by:
//   scripts/build-checklist.mjs  — validates the PDF it just rendered
//   scripts/build.mjs            — validates every PDF in dist/ before deploy

import { readFile } from 'node:fs/promises';
import { CONTACT } from './site-facts.mjs';

// Facts the public brand has retired. Each rule runs on the visible text and
// on every link target.
export const PDF_RETIRED = [
  { label: 'old LinkedIn slug', rx: /ahmed-farid-b46a5221b/i },
  { label: 'personal Gmail', rx: /ahmedfareed2025@gmail\.com|@gmail\.com/i },
  { label: 'relocation line', rx: /open to relocat/i },
  // Cairo is fine for past roles and the university; these are the forms that
  // state it as where he is now.
  { label: 'Cairo as current location', rx: /Cairo\s*·\s*Remote|Cairo-based|based in Cairo|Cairo,\s*Egypt\s*·\s*Open/i },
  { label: 'tel: link', rx: /\btel:/i },
];

// Any phone-number shape: 9+ digits in one run of digits, spaces, dots,
// dashes or brackets (dates and metrics never get there).
const PHONE = /\+?\(?\d[\d\s().-]{7,}\d/g;

export async function inspectPdf(fileOrBuffer) {
  const data = new Uint8Array(typeof fileOrBuffer === 'string' ? await readFile(fileOrBuffer) : fileOrBuffer);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  const pages = [];
  const uris = new Set();
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = '';
    const lines = [];
    for (const item of content.items) {
      line += item.str;
      if (item.hasEOL) { lines.push(line); line = ''; }
    }
    if (line) lines.push(line);
    pages.push(lines.join('\n'));
    for (const a of await page.getAnnotations()) {
      if (a.subtype === 'Link' && (a.url || a.unsafeUrl)) uris.add(a.url || a.unsafeUrl);
    }
  }
  await doc.destroy();
  return { pages: pages.length, text: pages.join('\n\f\n'), pageTexts: pages, uris: [...uris] };
}

// Problems with a PDF's public content. `requireUris` lists URL prefixes at
// least one link must start with; `requireText` lists strings the visible
// text must contain.
export function pdfProblems({ text, uris }, { requireUris = [], requireText = [] } = {}) {
  const problems = [];
  const haystacks = [['text', text], ...uris.map((u) => ['link', u])];
  for (const { label, rx } of PDF_RETIRED) {
    for (const [where, s] of haystacks) {
      const m = s.match(rx);
      if (m) problems.push(`${label} in ${where}: "${m[0]}"`);
    }
  }
  const phones = (text.match(PHONE) || []).filter((m) => m.replace(/\D/g, '').length >= 9);
  for (const p of phones) problems.push(`phone-number shape in text: "${p.trim()}"`);
  for (const u of requireUris) if (!uris.some((x) => x.startsWith(u))) problems.push(`no link to ${u}`);
  for (const t of requireText) if (!text.includes(t)) problems.push(`text lacks "${t}"`);
  return problems;
}

// What every public PDF must link to, at minimum.
export const PDF_REQUIRED_URIS = [CONTACT.linkedin, 'https://iamahmedfarid.com'];

// Text comparison that ignores layout: two renders of the same source with
// different line breaks still compare equal.
export const textFingerprint = (text) => text.replace(/\s+/g, '');
