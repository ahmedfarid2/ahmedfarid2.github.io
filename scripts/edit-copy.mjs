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
// Usage:  node scripts/edit-copy.mjs [--check] [--soft]
//   --check  report whether each edit's OLD or NEW text is present, change nothing
//   --soft   always exit 0, even if an edit fails to match (used in CI so a
//            re-export can never break the deploy — it just ships un-edited)
//
// This runs automatically in CI before the build (see .github/workflows/deploy.yml),
// so the deployed site keeps this copy even if the exports are replaced by a
// fresh Claude-design export that doesn't have it. Re-run it locally after any
// re-export to bring the committed exports back in sync:
//
//     npm run copy:apply
//
// Every edit is idempotent — already-applied text is detected and skipped — so
// running it repeatedly is safe.

import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const CHECK = process.argv.includes('--check');
const SOFT = process.argv.includes('--soft');

// Where the lead-magnet card points. This is the email-capture form: visitors
// enter an email, then Tally hands them the PDF. Change this one constant to
// repoint the card in every locale.
const LM_HREF = 'https://tally.so/r/68YlMB';

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
    `      href: ${JSON.stringify(LM_HREF)},\n` +
    `      desc: ${JSON.stringify(desc)},\n` +
    '      icon: (\n' +
    `        ${LM_ICON}\n` +
    '      ),\n' +
    '    },\n' +
    '    {\n' +
    '      name: "LinkedIn",'
  );
}

// ── "Own products" section ──────────────────────────────────────────────────
// Products Ahmed chose, built and hosts himself, as opposed to client work.
//
// Reuses existing classes only — `.writing-grid`/`.writing-card` for the link
// cards (each product is an external link) and `.case-stack`/`.chip` for the
// tech chips, since `.chip` is only styled inside `.build-card` and
// `.case-stack`. That means zero new CSS, and the section inherits hover,
// reveal and spotlight behaviour for free.
//
// The eyebrow carries no number on purpose. Section numbers are hardcoded
// strings and already inconsistent in the export (15 appears twice, 16 is
// unused), so numbering this one would either collide or force renumbering
// everything after it. The design already has unnumbered eyebrows — "Profile",
// "By the numbers", "Full toolbelt" — so this follows that established pattern
// and can sit high on the page instead of being buried at the end.
const PRODUCTS = [
  {
    cat: 'Finance ops',
    name: 'ReconcilePilot',
    href: 'https://reconcilepilot.iamahmedfarid.com',
    chips: ['Next.js 16', 'React 19', 'Supabase', 'Vercel'],
    desc:
      'Invoice ↔ bank-statement reconciliation for accountants. Upload both ' +
      'sheets and see what is paid, unpaid, double-paid or suspicious — every ' +
      'row scored for confidence with a plain-English reason.',
  },
  {
    cat: 'AI reporting',
    name: 'SheetPilot AI',
    href: 'https://sheetpilot.iamahmedfarid.com',
    chips: ['Next.js 16', 'TypeScript', 'Tailwind v4', 'Recharts'],
    desc:
      'Turns a raw CSV into a business report: interactive dashboard, ' +
      'AI-written executive summary, findings, risks and recommendations, ' +
      'exportable as PDF. Parsing runs in the browser — data never leaves it.',
  },
  {
    // Labelled a CONCEPT deliberately. Unlike the other two this is not Ahmed's
    // own product: it is an unapproved concept for a real dental clinic, so the
    // card must not imply the clinic commissioned it or signed it off.
    cat: 'Concept',
    name: 'Reform Dental',
    href: 'https://reform.iamahmedfarid.com',
    chips: ['Vanilla JS', 'No build step', 'Bilingual RTL', 'Vercel'],
    desc:
      'A homepage concept for a dental clinic, in English and Arabic. The RTL ' +
      'version carries its own type system and composition rather than a ' +
      'mirrored layout. No framework, no build step — three files and a photo.',
  },
];

// Per-locale section copy. Product names and tech chips stay in English, the
// way the existing translations already treat brand and tech tokens.
const PRODUCTS_COPY = {
  en: {
    eyebrow: 'Own products',
    title: ['Products I built ', 'and run myself.'],
    sub: 'Client work shows what I can deliver against someone else’s brief. These are the ones where I picked the problem, shipped the product, and host it on my own domain.',
    cats: ['Finance ops', 'AI reporting', 'Concept'],
    descs: [PRODUCTS[0].desc, PRODUCTS[1].desc, PRODUCTS[2].desc],
  },
  ar: {
    eyebrow: 'منتجاتي الخاصة',
    title: ['منتجات بنيتها ', 'وأُشغّلها بنفسي.'],
    sub: 'أعمال العملاء تُظهر ما أستطيع تسليمه وفق متطلبات غيري. هذه هي التي اخترت فيها المشكلة بنفسي، وأطلقت المنتج، وأستضيفه على نطاقي الخاص.',
    cats: ['عمليات مالية', 'تقارير بالذكاء الاصطناعي', 'مفهوم تصميمي'],
    descs: [
      'مطابقة الفواتير مع كشوف الحساب البنكية للمحاسبين. ارفع الملفين وشاهد ما هو مدفوع، وغير مدفوع، ومدفوع مرتين، أو مشبوه — مع درجة ثقة وسبب واضح لكل صف.',
      'يحوّل ملف CSV خامًا إلى تقرير أعمال: لوحة تفاعلية، وملخّص تنفيذي مكتوب بالذكاء الاصطناعي، ونتائج ومخاطر وتوصيات، قابل للتصدير PDF. التحليل يتم في المتصفح — البيانات لا تغادره.',
      'مفهوم لصفحة رئيسية لعيادة أسنان، بالإنجليزية والعربية. النسخة العربية لها نظامها الطباعي وتكوينها الخاص، لا مجرد انعكاس للتخطيط. بلا إطار عمل وبلا خطوة بناء — ثلاثة ملفات وصورة واحدة.',
    ],
  },
  de: {
    eyebrow: 'Eigene Produkte',
    title: ['Produkte, die ich gebaut habe ', 'und selbst betreibe.'],
    sub: 'Kundenarbeit zeigt, was ich nach fremder Vorgabe liefere. Hier habe ich das Problem selbst gewählt, das Produkt ausgeliefert und hoste es auf meiner eigenen Domain.',
    cats: ['Finanzprozesse', 'KI-Reporting', 'Konzept'],
    descs: [
      'Abgleich von Rechnungen und Kontoauszügen für Buchhalter. Beide Dateien hochladen und sehen, was bezahlt, offen, doppelt bezahlt oder auffällig ist — jede Zeile mit Konfidenzwert und verständlicher Begründung.',
      'Macht aus einer rohen CSV einen Geschäftsbericht: interaktives Dashboard, KI-geschriebene Zusammenfassung, Erkenntnisse, Risiken und Empfehlungen, als PDF exportierbar. Das Parsen läuft im Browser — die Daten verlassen ihn nie.',
      'Ein Homepage-Konzept für eine Zahnarztpraxis, auf Englisch und Arabisch. Die RTL-Fassung hat ein eigenes Typosystem und eine eigene Komposition statt eines gespiegelten Layouts. Ohne Framework, ohne Build-Schritt — drei Dateien und ein Foto.',
    ],
  },
  es: {
    eyebrow: 'Productos propios',
    title: ['Productos que construí ', 'y opero yo mismo.'],
    sub: 'El trabajo con clientes muestra lo que entrego según el encargo de otros. Estos son los que elegí yo: escogí el problema, lancé el producto y lo alojo en mi propio dominio.',
    cats: ['Operaciones financieras', 'Informes con IA', 'Concepto'],
    descs: [
      'Conciliación de facturas y extractos bancarios para contables. Sube ambos archivos y ve qué está pagado, pendiente, pagado dos veces o es sospechoso — cada fila con un nivel de confianza y un motivo en lenguaje claro.',
      'Convierte un CSV en bruto en un informe de negocio: panel interactivo, resumen ejecutivo escrito por IA, hallazgos, riesgos y recomendaciones, exportable a PDF. El análisis ocurre en el navegador — los datos nunca salen de él.',
      'Un concepto de página de inicio para una clínica dental, en inglés y árabe. La versión RTL tiene su propio sistema tipográfico y composición, no un diseño reflejado. Sin framework y sin paso de compilación: tres archivos y una fotografía.',
    ],
  },
  fr: {
    eyebrow: 'Mes propres produits',
    title: ['Des produits que j’ai construits ', 'et que j’exploite moi-même.'],
    sub: 'Le travail client montre ce que je livre selon le cahier des charges d’autrui. Ici, j’ai choisi le problème, livré le produit et je l’héberge sur mon propre domaine.',
    cats: ['Opérations financières', 'Reporting par IA', 'Concept'],
    descs: [
      'Rapprochement des factures et des relevés bancaires pour les comptables. Chargez les deux fichiers et voyez ce qui est payé, impayé, payé deux fois ou suspect — chaque ligne avec un score de confiance et une raison en clair.',
      'Transforme un CSV brut en rapport d’activité : tableau de bord interactif, synthèse rédigée par IA, constats, risques et recommandations, exportable en PDF. L’analyse tourne dans le navigateur — les données n’en sortent jamais.',
      'Un concept de page d’accueil pour un cabinet dentaire, en anglais et en arabe. La version RTL possède sa propre typographie et composition plutôt qu’une mise en page miroir. Sans framework ni étape de build — trois fichiers et une photographie.',
    ],
  },
};

// Escape text destined for JSX text nodes: `'` must not break out of the JSX,
// and a literal `{`/`}` would be read as an expression.
const jsxText = (s) =>
  String(s).replace(/'/g, '&apos;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');

// One product card. Shared so the fresh-export path (productsComponent) and the
// append-to-an-existing-section migration below cannot drift apart.
function productCard(p, cat, desc) {
  return (
    '          <a className="writing-card" href="' + p.href + '" target="_blank" rel="noreferrer">\n' +
    '            <div className="writing-card-head">\n' +
    '              <span className="writing-card-cat">' + jsxText(cat) + '</span>\n' +
    '            </div>\n' +
    '            <h3 className="writing-card-title">' + jsxText(p.name) + '</h3>\n' +
    '            <p className="writing-card-desc">' + jsxText(desc) + '</p>\n' +
    '            <div className="case-stack">\n' +
    p.chips.map((ch) => '              <span className="chip">' + jsxText(ch) + '</span>\n').join('') +
    '            </div>\n' +
    '          </a>\n'
  );
}

function productsComponent(locale) {
  const c = PRODUCTS_COPY[locale];
  const cards = PRODUCTS.map((p, i) => productCard(p, c.cats[i], c.descs[i])).join('');

  return (
    'function Products() {\n' +
    '  return (\n' +
    '    <section className="pad-y" id="products">\n' +
    '      <div className="wrap">\n' +
    '        <SectionHead_t\n' +
    '          eyebrow="' + jsxText(c.eyebrow) + '"\n' +
    '          title={<>' + jsxText(c.title[0]) + '<em>' + jsxText(c.title[1]) + '</em></>}\n' +
    '          sub="' + jsxText(c.sub) + '"\n' +
    '        />\n' +
    '        <div className="writing-grid">\n' +
    cards +
    '        </div>\n' +
    '      </div>\n' +
    '    </section>\n' +
    '  );\n' +
    '}\n\n'
  );
}

// Three exact-match inserts per locale. The anchors are structural (a function
// declaration, the window registration, the render list), not prose, so they
// are identical in every locale file.
const PRODUCT_SECTION_EDITS = ['en', 'ar', 'de', 'es', 'fr'].flatMap((loc) => {
  const file = loc === 'en' ? 'index.html' : `index.${loc}.html`;
  return [
    {
      file,
      label: `products section: component (${loc})`,
      appliedMarker: 'function Products() {',
      // The replacement deliberately re-emits the anchor: this edit prepends the
      // component above the window registration, and the `register` edit that
      // runs immediately after rewrites that same line. So the anchor is
      // consumed by the pair, not by this edit alone.
      allowRepeat: true,
      old: 'Object.assign(window, { Writing, FAQ, Connect, CTA, Footer });',
      new: productsComponent(loc) + 'Object.assign(window, { Writing, FAQ, Connect, CTA, Footer });',
    },
    {
      file,
      label: `products section: register (${loc})`,
      appliedMarker: 'Products, Writing, FAQ',
      old: 'Object.assign(window, { Writing, FAQ, Connect, CTA, Footer });',
      new: 'Object.assign(window, { Products, Writing, FAQ, Connect, CTA, Footer });',
    },
    // Migration: exports that already carry the two-card version of the section
    // predate the Reform card. The component edit above cannot add it — its
    // appliedMarker matches, so it reports "already applied" and does nothing —
    // so the third card is appended here instead. Optional, because a freshly
    // generated component already contains all three and has nothing to migrate.
    {
      file,
      label: `products section: append Reform card (${loc})`,
      optional: true,
      appliedMarker: 'Reform Dental',
      // Anchored on the last chip of the SheetPilot card plus the grid close, so
      // the anchor is consumed by its own replacement and cannot re-append.
      old:
        '              <span className="chip">Recharts</span>\n' +
        '            </div>\n' +
        '          </a>\n' +
        '        </div>\n',
      new:
        '              <span className="chip">Recharts</span>\n' +
        '            </div>\n' +
        '          </a>\n' +
        productCard(PRODUCTS[2], PRODUCTS_COPY[loc].cats[2], PRODUCTS_COPY[loc].descs[2]) +
        '        </div>\n',
    },
    {
      file,
      label: `products section: render (${loc})`,
      appliedMarker: '      <Products/>\n',
      // Anchor spans BOTH neighbours so it is consumed by its own replacement.
      // Anchoring on `<CaseStudies/>` alone would still match after the insert
      // and add a second <Products/> on every re-run.
      old: '      <CaseStudies/>\n      <WhatIBuild/>\n',
      new: '      <CaseStudies/>\n      <Products/>\n      <WhatIBuild/>\n',
    },
  ];
});

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
    // Stable across href changes — the handle text never varies.
    appliedMarker: 'Multi-Tenant SaaS Architecture',
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
    // Stable across href changes — the handle text never varies.
    appliedMarker: 'معمارية SaaS متعدّدة المستأجرين',
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
    // Stable across href changes — the handle text never varies.
    appliedMarker: 'Multi-Tenant-SaaS-Architektur',
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
    // Stable across href changes — the handle text never varies.
    appliedMarker: 'Arquitectura SaaS multi-tenant',
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
    // Stable across href changes — the handle text never varies.
    appliedMarker: 'Architecture SaaS multi-tenant',
    old: LM_ANCHOR,
    new: leadMagnetCard({
      name: 'Checklist gratuite',
      handle: 'Architecture SaaS multi-tenant',
      desc: "Les décisions qu'on ne peut pas défaire à bas coût. PDF gratuit.",
    }),
  },

  // ── Primary CTA (nav, hero, about — 3 places per locale) ────────────────
  // "Start a project" asks for a commitment the visitor isn't ready to make.
  // The actual next step is a free 30-minute scoping call (already promised in
  // the services section and FAQ), so the button now says exactly that.
  { file: 'index.html',    label: 'primary CTA (en)', expect: 3, old: 'Start a project',     new: 'Book a scoping call' },
  { file: 'index.ar.html', label: 'primary CTA (ar)', expect: 3, old: 'ابدأ مشروعًا',         new: 'احجز مكالمة استكشافية' },
  { file: 'index.de.html', label: 'primary CTA (de)', expect: 3, old: 'Projekt starten',     new: 'Scoping-Call buchen' },
  { file: 'index.es.html', label: 'primary CTA (es)', expect: 3, old: 'Empezar un proyecto', new: 'Agendar una llamada' },
  { file: 'index.fr.html', label: 'primary CTA (fr)', expect: 3, old: 'Démarrer un projet',  new: 'Réserver un appel' },

  // ── Migration: point the existing card at the capture form ───────────────
  // Exports that already carry the card link straight to /checklist.html, which
  // gives the PDF away without capturing an email. Repoint them at LM_HREF.
  // Marked optional: a freshly-inserted card already uses LM_HREF, so on a new
  // export there is nothing here to migrate.
  ...['index.html', 'index.ar.html', 'index.de.html', 'index.es.html', 'index.fr.html'].map((file) => ({
    file,
    label: `lead-magnet href → capture form (${file.split('.')[1] === 'html' ? 'en' : file.split('.')[1]})`,
    optional: true,
    old: '      href: "/checklist.html",\n',
    new: `      href: ${JSON.stringify(LM_HREF)},\n`,
  })),

  // ── RevealSite case screenshot ───────────────────────────────────────────
  // RevealSite was the only one of the nine case studies with no screenshot.
  // The cause was not a missing image: the mock only renders when the case has
  // NO `fleet`, and RevealSite is the one case that has one — so adding a
  // shotSrc alone would have changed nothing. The condition now also lets a
  // fleet case through when it actually carries a screenshot, which leaves
  // every other case's behaviour untouched.
  //
  // The image is a real file at the repo root (copied to dist/ by the build)
  // rather than an inline base64 data URI like the other eight, so the HTML
  // stays small and the browser caches it separately.
  ...['index.html', 'index.ar.html', 'index.de.html', 'index.es.html', 'index.fr.html'].flatMap((file) => {
    const loc = file === 'index.html' ? 'en' : file.split('.')[1];
    return [
      {
        file,
        label: `revealsite shot: show for fleet cases (${loc})`,
        appliedMarker: '{(c.shotSrc || !c.fleet) && c.links',
        old: '{!c.fleet && c.links && c.links.length ? (',
        new: '{(c.shotSrc || !c.fleet) && c.links && c.links.length ? (',
      },
      {
        file,
        label: `revealsite shot: src (${loc})`,
        appliedMarker: 'shotSrc: "/revealsite.jpg"',
        // Anchored on the brand name, which is never translated. The `tag`
        // beneath it is localised, so anchoring there would only match English.
        // Verified unique in all five files — the other "RevealSite" lives in
        // the brands array on a single line with different indentation.
        // Spans the following `role:` key so the anchor is consumed by its own
        // replacement — matching on the name line alone still matches after the
        // insert and would add a duplicate shotSrc on every re-run. `role` is a
        // code key, so it is identical in every locale even though its value is
        // translated.
        old: '\n    name: "RevealSite",\n    role:',
        new: '\n    name: "RevealSite",\n    shotSrc: "/revealsite.jpg",\n    role:',
      },
    ];
  }),

  // ── Proven Group on the brand wall ───────────────────────────────────────
  // provengroup.es — a bilingual (ES/EN) static site for an investment and
  // operations group, and one of the clients already named on his LinkedIn.
  // Client work, so it belongs with the other client brands rather than in the
  // "own products" section.
  //
  // No `light: true`: `.logo-img` flattens every mark with
  // `grayscale(1) brightness(0) invert(.32)`, so the black source SVG renders as
  // the same neutral grey as the rest. `light` is only for marks that are
  // already white. If the remote SVG ever 404s the build's onerror handler falls
  // back to the domain favicon.
  ...['index.html', 'index.ar.html', 'index.de.html', 'index.es.html', 'index.fr.html'].map((file) => ({
    file,
    label: `brand wall: Proven Group (${file.split('.')[1] === 'html' ? 'en' : file.split('.')[1]})`,
    appliedMarker: 'provengroup.es',
    // Brand names are never translated, so one anchor works for every locale.
    // The anchor spans the Compass Med line AND the RevealSite line that follows
    // it, so inserting between them consumes the anchor. Matching on the
    // RevealSite line alone still matches after the insert, and would append a
    // duplicate Proven entry on every re-run.
    old:
      '  { name: "Compass Med", domain: "compass-egy.com", logo: "https://www.compass-egy.com/assets/images/logos/compasslogo-wh.svg", site: "https://www.compass-egy.com/", light: true },\n' +
      '  { name: "RevealSite", domain: "revealsite.com"',
    new:
      '  { name: "Compass Med", domain: "compass-egy.com", logo: "https://www.compass-egy.com/assets/images/logos/compasslogo-wh.svg", site: "https://www.compass-egy.com/", light: true },\n' +
      '  { name: "Proven Group", domain: "provengroup.es", logo: "https://provengroup.es/assets/img/logo.svg", site: "https://provengroup.es/" },\n' +
      '  { name: "RevealSite", domain: "revealsite.com"',
  })),

  // ── "Own products" section ───────────────────────────────────────────────
  // Client work shows he can execute someone else's brief; products he chose,
  // built and hosts himself show initiative, which is what founders hire for.
  // Three inserts per locale: the component, its registration on window, and
  // the render call — see PRODUCTS_EDITS below.
  ...PRODUCT_SECTION_EDITS,
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
  // How we recognise "this edit is already in place". Defaults to the new text,
  // but an edit can supply `appliedMarker` — a stable substring that survives
  // later tweaks to the replacement (e.g. the lead-magnet card, whose href can
  // change when the capture form changes). Without that, editing the
  // replacement would make an applied edit look unapplied.
  const marker = edit.appliedMarker ?? edit.new;
  for (const [id, asset] of Object.entries(obj)) {
    let text;
    try { text = decode(asset); } catch { continue; }
    if (text.includes(edit.old)) { target = { id, asset, text }; break; }
    if (text.includes(marker)) { target = { id, asset, text, already: true }; break; }
  }

  if (!target) {
    // `optional` marks a migration edit that only applies to files still in an
    // older state. On a fresh export the newer form is produced directly, so
    // "not found" is the expected outcome, not a failure.
    if (edit.optional) {
      console.log(`· ${edit.label}: nothing to migrate in ${edit.file} (expected)`);
      continue;
    }
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

  // `expect` defaults to 1. Requiring an exact count (rather than "at least
  // one") means a changed export fails loudly instead of silently editing a
  // different number of places than intended.
  const expected = edit.expect ?? 1;
  const occurrences = target.text.split(edit.old).length - 1;
  if (occurrences !== expected) {
    console.error(`✗ ${edit.label}: expected exactly ${expected} match(es), found ${occurrences} — refusing to edit`);
    failures++;
    continue;
  }

  const updated =
    expected === 1
      ? target.text.replace(edit.old, edit.new)
      : target.text.split(edit.old).join(edit.new);

  // Idempotency guard. An insert whose replacement still contains its own
  // anchor matches again on the next run and inserts a second copy — the
  // `appliedMarker` never gets consulted, because `old` is tested first. That
  // silently duplicated a card more than once while this file was being built,
  // so it is now a hard failure at the moment of writing rather than a
  // surprise on some later run. Anchors must span enough context to be consumed
  // by their own replacement.
  if (!edit.allowRepeat && updated.includes(edit.old)) {
    console.error(
      `✗ ${edit.label}: anchor survives its own replacement — re-running would ` +
      `apply it again. Widen \`old\` to include adjacent context, or set ` +
      `allowRepeat if a later edit consumes it.`
    );
    failures++;
    continue;
  }

  obj[target.id] = { ...target.asset, data: encode(target.asset, updated) };
  lines[index] = JSON.stringify(obj);
  writeFileSync(edit.file, lines.join('\n'), 'utf8');
  console.log(`✓ ${edit.label}: applied to ${edit.file} (asset ${target.id.slice(0, 8)})`);
  applied++;
}

console.log(`\n${CHECK ? 'check' : 'apply'} complete — ${applied} edited, ${failures} failed`);

if (failures && SOFT) {
  // CI path: a failed match almost always means the exports were replaced by a
  // fresh Claude-design export whose markup moved. That should surface loudly
  // in the log, but it must not block a deploy — the site still builds, just
  // without these copy edits.
  console.warn(
    `\n⚠️  ${failures} copy edit(s) did not match — the exports were probably re-exported\n` +
    '   from Claude design. The site will deploy WITHOUT those edits. Re-run the\n' +
    '   probe and update scripts/edit-copy.mjs to match the new markup.'
  );
  process.exit(0);
}

process.exit(failures ? 1 : 0);
