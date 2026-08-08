// scripts/edit-copy.mjs
//
// Applies targeted copy edits to the Claude-design exports.
//
// Why this exists: the exports keep their component source inside a single
// `<script type="__bundler/manifest">` line — a JSON map of
// asset-id → { mime, compressed, data(base64) } — so the copy is not editable
// with a plain find-and-replace on the HTML. This script decompresses the
// asset that holds the JSX, applies exact-match replacements, recompresses it,
// and writes the export back.
//
// Usage:  node scripts/edit-copy.mjs [--check]
//   --check  report whether each edit's OLD or NEW text is present, change nothing
//
// IMPORTANT: Claude design remains the source of truth. Edits made here are
// overwritten the next time the site is re-exported. Mirror any change here in
// Claude design (see docs/COPY-POSITIONING.md) so it survives a re-export.

import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const CHECK = process.argv.includes('--check');

// ── Lead-magnet card ────────────────────────────────────────────────────────
// The checklist deploys to /checklist.html but nothing linked to it, so it was
// unreachable. This inserts a card at the top of the Connect section's
// `channels` array in every locale. Shared icon: a checklist glyph drawn to
// match the existing 22×22 / currentColor cards.
const LM_ICON =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<path d="M2.8 5.9l1.3-1.3 1.4 1.4 2.8-2.8 1.3 1.3-4.1 4.1zM11 4h10v2H11z' +
  'M2.8 12.9l1.3-1.3 1.4 1.4 2.8-2.8 1.3 1.3-4.1 4.1zM11 11h10v2H11z' +
  'M2.8 19.9l1.3-1.3 1.4 1.4 2.8-2.8 1.3 1.3-4.1 4.1zM11 18h10v2H11z"/></svg>';

// Unique in every export (LinkedIn is always the first channel and brand names
// are never translated), so one anchor works across all five locales.
const LM_ANCHOR = 'const channels = [\n    {\n      name: "LinkedIn",';

function leadMagnetCard({ name, handle, desc }) {
  return (
    'const channels = [\n' +
    '    {\n' +
    `      name: ${JSON.stringify(name)},\n` +
    `      handle: ${JSON.stringify(handle)},\n` +
    '      href: "/checklist.html",\n' +
    `      desc: ${JSON.stringify(desc)},\n` +
    '      icon: (\n' +
    `        ${LM_ICON}\n` +
    '      ),\n' +
    '    },\n' +
    '    {\n' +
    '      name: "LinkedIn",'
  );
}

// Each edit is an exact string match, so a failed match is loud rather than
// silently rewriting the wrong thing.
const EDITS = [
  {
    file: 'index.html',
    label: 'hero-sub (en)',
    old:
      '<p className="hero-sub">\n' +
      '            Cairo-based software engineer, open to relocation — five years building\n' +
      '            multi-tenant SaaS, real-time auction platforms, AI-assisted tools, and\n' +
      '            mobile apps shipped to production across the Gulf, the US, and the UK.\n' +
      '            Laravel, Next.js, FastAPI, Flutter.\n' +
      '          </p>',
    new:
      '<p className="hero-sub">\n' +
      '            Cairo-based senior engineer specializing in real-time, multi-tenant SaaS —\n' +
      '            live bidding, role-based tenants, and the mobile apps that run on top.\n' +
      '            Five years shipping to production across the Gulf, the US, and the UK.\n' +
      '            Laravel, Next.js, FastAPI, Flutter. Open to relocation.\n' +
      '          </p>',
  },
  {
    file: 'index.ar.html',
    label: 'hero-sub (ar)',
    old:
      '<p className="hero-sub">\n' +
      '            مهندس برمجيات مقيم في القاهرة، مستعدّ للانتقال — خمس سنوات في بناء منصّات\n' +
      '            SaaS متعدّدة المستأجرين، ومنصّات مزادات فورية، وأدوات مدعومة بالذكاء الاصطناعي،\n' +
      '            وتطبيقات جوّال أُطلقت في الإنتاج عبر الخليج والولايات المتحدة والمملكة المتحدة.\n' +
      '            Laravel وNext.js وFastAPI وFlutter.\n' +
      '          </p>',
    new:
      '<p className="hero-sub">\n' +
      '            مهندس برمجيات أول مقيم في القاهرة، متخصّص في منصّات SaaS متعدّدة المستأجرين\n' +
      '            والفورية — مزادات مباشرة، وصلاحيات حسب الدور، وتطبيقات الجوّال التي تعمل فوقها.\n' +
      '            خمس سنوات من الإطلاق في الإنتاج عبر الخليج والولايات المتحدة والمملكة المتحدة.\n' +
      '            Laravel وNext.js وFastAPI وFlutter. مستعدّ للانتقال.\n' +
      '          </p>',
  },
  {
    file: 'index.de.html',
    label: 'hero-sub (de)',
    old:
      '<p className="hero-sub">\n' +
      '            Softwareentwickler mit Sitz in Kairo, umzugsbereit — fünf Jahre Erfahrung im\n' +
      '            Aufbau von Multi-Tenant-SaaS, Echtzeit-Auktionsplattformen, KI-gestützten\n' +
      '            Tools und mobilen Apps, die im Golfraum, in den USA und in Großbritannien\n' +
      '            in Produktion gegangen sind. Laravel, Next.js, FastAPI, Flutter.\n' +
      '          </p>',
    new:
      '<p className="hero-sub">\n' +
      '            Senior-Softwareentwickler mit Sitz in Kairo, spezialisiert auf Echtzeit- und\n' +
      '            Multi-Tenant-SaaS — Live-Gebote, rollenbasierte Mandanten und die mobilen\n' +
      '            Apps, die darauf laufen. Fünf Jahre in Produktion im Golfraum, in den USA\n' +
      '            und in Großbritannien. Laravel, Next.js, FastAPI, Flutter. Umzugsbereit.\n' +
      '          </p>',
  },
  {
    file: 'index.es.html',
    label: 'hero-sub (es)',
    old:
      '<p className="hero-sub">\n' +
      '            Ingeniero de software afincado en El Cairo, abierto a reubicación — cinco años\n' +
      '            construyendo SaaS multi-tenant, plataformas de subastas en tiempo real,\n' +
      '            herramientas asistidas por IA y apps móviles llevadas a producción en el\n' +
      '            Golfo, EE. UU. y el Reino Unido. Laravel, Next.js, FastAPI, Flutter.\n' +
      '          </p>',
    new:
      '<p className="hero-sub">\n' +
      '            Ingeniero senior afincado en El Cairo, especializado en SaaS multi-tenant y en\n' +
      '            tiempo real — subastas en vivo, acceso por rol y las apps móviles que corren\n' +
      '            encima. Cinco años llevando sistemas a producción en el Golfo, EE. UU. y el\n' +
      '            Reino Unido. Laravel, Next.js, FastAPI, Flutter. Abierto a reubicación.\n' +
      '          </p>',
  },
  {
    file: 'index.fr.html',
    label: 'hero-sub (fr)',
    old:
      '<p className="hero-sub">\n' +
      "            Ingénieur logiciel basé au Caire, ouvert à la mobilité — cinq ans à construire\n" +
      "            des SaaS multi-tenant, des plateformes d'enchères en temps réel, des outils\n" +
      '            assistés par IA et des applications mobiles livrées en production dans le Golfe,\n' +
      '            aux États-Unis et au Royaume-Uni. Laravel, Next.js, FastAPI, Flutter.\n' +
      '          </p>',
    new:
      '<p className="hero-sub">\n' +
      '            Ingénieur senior basé au Caire, spécialisé dans les SaaS multi-tenant et temps\n' +
      "            réel — enchères en direct, accès par rôle et les applications mobiles qui\n" +
      '            tournent dessus. Cinq ans de mise en production dans le Golfe, aux États-Unis\n' +
      '            et au Royaume-Uni. Laravel, Next.js, FastAPI, Flutter. Ouvert à la mobilité.\n' +
      '          </p>',
  },

  // ── Lead-magnet card in the Connect section (all locales) ────────────────
  {
    file: 'index.html',
    label: 'lead-magnet card (en)',
    old: LM_ANCHOR,
    new: leadMagnetCard({
      name: 'Free checklist',
      handle: 'Multi-Tenant SaaS Architecture',
      desc: "The decisions you can't cheaply undo. Free PDF.",
    }),
  },
  {
    file: 'index.ar.html',
    label: 'lead-magnet card (ar)',
    old: LM_ANCHOR,
    new: leadMagnetCard({
      name: 'قائمة مجانية',
      handle: 'معمارية SaaS متعدّدة المستأجرين',
      desc: 'القرارات التي يصعب التراجع عنها لاحقًا. ملف PDF مجاني.',
    }),
  },
  {
    file: 'index.de.html',
    label: 'lead-magnet card (de)',
    old: LM_ANCHOR,
    new: leadMagnetCard({
      name: 'Kostenlose Checkliste',
      handle: 'Multi-Tenant-SaaS-Architektur',
      desc: 'Die Entscheidungen, die man nicht günstig rückgängig macht. Gratis-PDF.',
    }),
  },
  {
    file: 'index.es.html',
    label: 'lead-magnet card (es)',
    old: LM_ANCHOR,
    new: leadMagnetCard({
      name: 'Checklist gratuita',
      handle: 'Arquitectura SaaS multi-tenant',
      desc: 'Las decisiones que no puedes deshacer barato. PDF gratis.',
    }),
  },
  {
    file: 'index.fr.html',
    label: 'lead-magnet card (fr)',
    old: LM_ANCHOR,
    new: leadMagnetCard({
      name: 'Checklist gratuite',
      handle: 'Architecture SaaS multi-tenant',
      desc: "Les décisions qu'on ne peut pas défaire à bas coût. PDF gratuit.",
    }),
  },
];

// Locate the `__bundler/manifest` line: a single-line JSON object mapping
// asset-id → { mime, compressed, data }.
function findManifestLine(lines) {
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim();
    if (s.length < 200 || s[0] !== '{') continue;
    let obj;
    try { obj = JSON.parse(s); } catch { continue; }
    const first = Object.values(obj)[0];
    if (!first || typeof first !== 'object' || !('data' in first)) continue;
    return { index: i, obj };
  }
  return null;
}

function decode(asset) {
  let buf = Buffer.from(asset.data, 'base64');
  if (asset.compressed) buf = zlib.gunzipSync(buf);
  return buf.toString('utf8');
}

function encode(asset, text) {
  let buf = Buffer.from(text, 'utf8');
  if (asset.compressed) buf = zlib.gzipSync(buf, { level: 9 });
  return buf.toString('base64');
}

let failures = 0;
let applied = 0;

for (const edit of EDITS) {
  const raw = readFileSync(edit.file, 'utf8');
  const lines = raw.split('\n');
  const found = findManifestLine(lines);
  if (!found) {
    console.error(`✗ ${edit.label}: no bundler manifest found in ${edit.file}`);
    failures++;
    continue;
  }

  const { index, obj } = found;
  let target = null;
  for (const [id, asset] of Object.entries(obj)) {
    let text;
    try { text = decode(asset); } catch { continue; }
    if (text.includes(edit.old)) { target = { id, asset, text }; break; }
    if (text.includes(edit.new)) { target = { id, asset, text, already: true }; break; }
  }

  if (!target) {
    console.error(`✗ ${edit.label}: OLD text not found in ${edit.file} (export may have changed — re-run the probe)`);
    failures++;
    continue;
  }
  if (target.already) {
    console.log(`= ${edit.label}: already applied in ${edit.file}`);
    continue;
  }
  if (CHECK) {
    console.log(`✓ ${edit.label}: OLD text present in ${edit.file} (asset ${target.id.slice(0, 8)}) — would apply`);
    continue;
  }

  const occurrences = target.text.split(edit.old).length - 1;
  if (occurrences !== 1) {
    console.error(`✗ ${edit.label}: expected exactly 1 match, found ${occurrences} — refusing to edit`);
    failures++;
    continue;
  }

  const updated = target.text.replace(edit.old, edit.new);
  obj[target.id] = { ...target.asset, data: encode(target.asset, updated) };
  lines[index] = JSON.stringify(obj);
  writeFileSync(edit.file, lines.join('\n'), 'utf8');
  console.log(`✓ ${edit.label}: applied to ${edit.file} (asset ${target.id.slice(0, 8)})`);
  applied++;
}

console.log(`\n${CHECK ? 'check' : 'apply'} complete — ${applied} edited, ${failures} failed`);
process.exit(failures ? 1 : 0);
