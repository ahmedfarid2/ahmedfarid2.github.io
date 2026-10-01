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

// Facts the public brand has retired. Each rule runs on the visible text
// (whitespace-collapsed, so a phrase that wraps across a line is still
// caught), on the document properties and on every link target.
export const PDF_RETIRED = [
  { label: 'old LinkedIn slug', rx: /ahmed-farid-b46a5221b/i },
  { label: 'personal Gmail', rx: /@gmail\.com/i },
  { label: 'relocation line', rx: /open\s+to\s+relocat/i },
  // Cairo is fine for past roles and the university, so only the forms that
  // state it as where he is now are retired. A bare "Cairo, Egypt" in a
  // header would pass; the required "Dubai, United Arab Emirates" text is
  // what pins the current location.
  { label: 'Cairo as current location', rx: /Cairo\s*·\s*Remote|Cairo-based|based\s+in\s+Cairo|Cairo,\s*Egypt\s*·\s*Open/i },
  { label: 'tel: link', rx: /\btel:/i },
  { label: 'phone number in a WhatsApp link', rx: /wa\.me\/\+?\d/i },
];

// Any phone-number shape: 9+ digits in one run of digits, spaces, tabs,
// dots, dashes or brackets — on one line (dates and metrics never get there).
const PHONE = /\+?\(?\d[\d \t().-]{7,}\d/g;

export async function inspectPdf(fileOrBuffer) {
  const data = new Uint8Array(typeof fileOrBuffer === 'string' ? await readFile(fileOrBuffer) : fileOrBuffer);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  // Document properties (Title, Author, …) are public too.
  const { info } = await doc.getMetadata().catch(() => ({ info: {} }));
  const metadata = ['Title', 'Author', 'Subject', 'Keywords', 'Creator'].map((k) => info?.[k]).filter(Boolean).join(' | ');
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
  return { pages: pages.length, text: pages.join('\n\f\n'), pageTexts: pages, uris: [...uris], metadata };
}

// Problems with a PDF's public content. `requireUris` lists URLs at least
// one link must be (or sit under); `requireText` lists strings the visible
// text must contain.
export function pdfProblems({ text, uris, metadata = '' }, { requireUris = [], requireText = [] } = {}) {
  const problems = [];
  const flat = text.replace(/\s+/g, ' ');
  const haystacks = [['text', flat], ['metadata', metadata], ...uris.map((u) => ['link', u])];
  for (const { label, rx } of PDF_RETIRED) {
    for (const [where, s] of haystacks) {
      const m = s.match(rx);
      if (m) problems.push(`${label} in ${where}: "${m[0]}"`);
    }
  }
  // ISO dates and clock times are not phone numbers.
  const noDates = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ').replace(/\b\d{1,2}:\d{2}\b/g, ' ');
  const phones = (noDates.match(PHONE) || []).filter((m) => m.replace(/\D/g, '').length >= 9);
  for (const p of phones) problems.push(`phone-number shape in text: "${p.trim()}"`);
  for (const u of requireUris) if (!uris.some((x) => sameOrUnder(x, u))) problems.push(`no link to ${u}`);
  for (const t of requireText) if (!flat.includes(t)) problems.push(`text lacks "${t}"`);
  return problems;
}

// `x` is `u` itself or a path/query under it — not merely a string that
// starts with it (iamahmedfarid.com.evil.tld, /in/iamahmedfarid-x).
function sameOrUnder(x, u) {
  const base = u.replace(/\/$/, '');
  return x === base || x.startsWith(base + '/') || x.startsWith(base + '?') || x.startsWith(base + '#');
}

// What every public PDF must link to, at minimum.
export const PDF_REQUIRED_URIS = [CONTACT.linkedin, 'https://iamahmedfarid.com'];

// Text comparison that ignores layout: two renders of the same source with
// different line breaks still compare equal.
export const textFingerprint = (text) => text.replace(/\s+/g, '');
