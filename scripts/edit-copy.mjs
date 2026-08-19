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

// ── Case studies: two new entries, plus ordering ─────────────────────────────
// Two projects that belong in "Selected work" but post-date the export, and one
// ordering change: Ezhal moves to the end (it is the only case with no shipped
// apps yet, so it reads as the weakest card and shouldn't sit mid-list).
//
// Unlike every other edit in this file, these are done with a `transform`
// rather than an exact-string anchor. Reordering an array and renumbering its
// entries is not an insert — expressing it as string surgery over nine large
// objects would need an anchor per case per locale, and any one of them
// drifting would corrupt the array. The transform re-derives the whole array
// from its current contents, so it converges to the same result no matter how
// many times it runs.

// Language-independent fields. Names, tech and URLs are never translated —
// exactly how the existing nine cases treat them.
const NEW_CASES = {
  proven: {
    name: 'Proven Group',
    shotSrc: '/proven.jpg',
    stack: ['Vanilla JS', 'No build step', 'Bilingual ES/EN', 'GitHub Pages'],
    openUrl: 'https://provengroup.es/',
    hrefs: ['https://provengroup.es/', 'https://provengroup.es/portfolio.html', 'https://provengroup.es/equipo.html'],
  },
  ibdaa: {
    name: 'Ibdaa Course',
    shotSrc: '/ibdaa.jpg',
    stack: ['Laravel 13', 'Next.js 16', 'PostgreSQL 17', 'Nx + pnpm', 'Tailwind v4'],
    openUrl: 'https://alpha.ibdaacourse.com/ar',
    hrefs: ['https://alpha.ibdaacourse.com/ar', 'https://alpha.ibdaacourse.com/en'],
  },
};

// Per-locale prose. `impact` entries are either { v, l } (plain string) or
// { pre, em, l } (a JSX fragment with the second half emphasised) — the two
// shapes the existing cases already use.
const CASES_COPY = {
  en: {
    proven: {
      role: 'Independent Consultant · Spain',
      tag: 'Corporate site for a diversified investment & operating group — fully bilingual ES/EN, no framework, no build step.',
      labels: ['Website', 'Portfolio', 'Team'],
      problem: 'An investment and operating group raising capital across Europe and the Gulf needed a corporate presence that reads as credible to a Spanish-speaking board and to English-speaking international investors at the same time — without a CMS to maintain or a build pipeline to keep alive.',
      solution: 'Seven hand-built pages — about, vision and goals, portfolio, external investments, team and contact — where every line of copy exists twice in the markup, once in Spanish and once in English. One toggle in the header swaps the entire site instantly: no reload, no route change, no translation service. Both languages ship inside the HTML, so search engines index both.',
      impact: [
        { pre: '7', em: 'pages', l: 'Bilingual ES/EN' },
        { v: 'Instant', l: 'Language swap, no reload' },
        { v: '0 build', l: 'Static, no framework' },
      ],
      highlights: [
        'Every string ships as a paired ES/EN node — both indexable',
        'Language choice persisted across pages and visits',
        'Static hosting on a custom domain, near-zero running cost',
      ],
    },
    ibdaa: {
      role: 'Senior Software Engineer · Arabic-first LMS',
      tag: 'Arabic-first learning platform — a Laravel 13 API and a Next.js 16 app in one Nx monorepo, delivered with full handover.',
      labels: ['Arabic', 'English'],
      note: 'Alpha — “Ibdaa Course” is a working title, pending the client’s launch brand',
      problem: 'Arabic training providers run on platforms designed English-first with RTL bolted on afterwards — so the student experience, the certificate and the admin panel all read like a translation of something else.',
      solution: 'Built Arabic-first instead: locale-prefixed /ar and /en routes over one Next.js 16 App Router app with RTL as the default direction, backed by a Laravel 13 API split into thirteen feature modules — courses, lectures, enrolments, payments, exams, certificates with public verification, reviews, discussions, favourites and reporting. Delivered with deployment, UAT and handover docs so the client can run and extend it without me.',
      impact: [
        { pre: '174', em: 'tests', l: '616 API assertions' },
        { v: '13 modules', l: '74 API routes' },
        { v: 'Arabic-first', l: 'RTL by default' },
      ],
      highlights: [
        'Nx + pnpm monorepo — Laravel 13 (PHP 8.5) + Next.js 16',
        'Certificates verifiable publicly by code',
        'Two production images: FrankenPHP + Next.js standalone',
      ],
    },
  },
  ar: {
    proven: {
      role: 'مستشار مستقل · إسبانيا',
      tag: 'موقع مؤسسي لمجموعة استثمار وتشغيل متنوّعة — ثنائي اللغة بالكامل إسباني/إنجليزي، بلا إطار عمل وبلا خطوة بناء.',
      labels: ['الموقع', 'المحفظة', 'الفريق'],
      problem: 'احتاجت مجموعة استثمار وتشغيل تجمع رأس المال في أوروبا والخليج حضورًا مؤسسيًا يبدو موثوقًا أمام مجلس إدارة يتحدّث الإسبانية ومستثمرين دوليين يتحدّثون الإنجليزية في آنٍ واحد — دون نظام إدارة محتوى يحتاج صيانة ولا خطّ بناء يحتاج متابعة.',
      solution: 'سبع صفحات مبنية يدويًا — من نحن، الرؤية والأهداف، المحفظة، الاستثمارات الخارجية، الفريق، والتواصل — حيث يوجد كل سطر من النصّ مرّتين داخل الصفحة: مرّة بالإسبانية ومرّة بالإنجليزية. زرّ واحد في الأعلى يبدّل الموقع كلّه فورًا: بلا إعادة تحميل، وبلا تغيير مسار، وبلا خدمة ترجمة. اللغتان تُشحنان داخل الـHTML، فتفهرس محرّكات البحث كلتيهما.',
      impact: [
        { pre: '٧', em: 'صفحات', l: 'ثنائية اللغة إسباني/إنجليزي' },
        { v: 'فوري', l: 'تبديل اللغة دون إعادة تحميل' },
        { v: 'بلا بناء', l: 'ثابت وبلا إطار عمل' },
      ],
      highlights: [
        'كل نصّ يُشحن كعقدتين إسبانية/إنجليزية — كلتاهما قابلة للفهرسة',
        'اختيار اللغة يبقى محفوظًا بين الصفحات والزيارات',
        'استضافة ثابتة على نطاق مخصّص بتكلفة تشغيل تكاد تكون صفرًا',
      ],
    },
    ibdaa: {
      role: 'مهندس برمجيات أول · منصّة تعلّم عربية أولًا',
      tag: 'منصّة تعلّم عربية أولًا — واجهة برمجية Laravel 13 وتطبيق Next.js 16 داخل مستودع Nx واحد، مُسلَّمة بتوثيق تسليم كامل.',
      labels: ['العربية', 'الإنجليزية'],
      note: 'نسخة تجريبية — «إبداع كورس» اسم عمل مؤقّت بانتظار هوية العميل عند الإطلاق',
      problem: 'تعمل جهات التدريب العربية على منصّات مُصمّمة بالإنجليزية أولًا ثم أُضيف إليها دعم الاتجاه من اليمين لاحقًا — فتبدو تجربة الطالب والشهادة ولوحة الإدارة كأنها ترجمة لشيء آخر.',
      solution: 'بُنيت بالعربية أولًا بدلًا من ذلك: مسارات /ar و/en داخل تطبيق Next.js 16 واحد باتجاه من اليمين إلى اليسار افتراضيًا، خلفها واجهة برمجية Laravel 13 مقسّمة إلى ثلاث عشرة وحدة — الدورات والمحاضرات والتسجيل والمدفوعات والاختبارات والشهادات مع تحقّق عام، والتقييمات والنقاشات والمفضّلة والتقارير. سُلّمت مع وثائق النشر والاختبار والتسليم ليتمكّن العميل من تشغيلها وتطويرها دوني.',
      impact: [
        { pre: '١٧٤', em: 'اختبارًا', l: '٦١٦ تحقّقًا في الواجهة البرمجية' },
        { v: '١٣ وحدة', l: '٧٤ مسارًا برمجيًا' },
        { v: 'العربية أولًا', l: 'اتجاه RTL افتراضيًا' },
      ],
      highlights: [
        'مستودع Nx + pnpm — ‏Laravel 13 (PHP 8.5) وNext.js 16',
        'شهادات قابلة للتحقّق علنًا برمز',
        'صورتا إنتاج: FrankenPHP وNext.js standalone',
      ],
    },
  },
  de: {
    proven: {
      role: 'Unabhängiger Berater · Spanien',
      tag: 'Unternehmenswebsite für eine diversifizierte Investment- und Betreibergruppe — vollständig zweisprachig ES/EN, ohne Framework, ohne Build-Schritt.',
      labels: ['Website', 'Portfolio', 'Team'],
      problem: 'Eine Investment- und Betreibergruppe, die in Europa und am Golf Kapital einwirbt, brauchte einen Auftritt, der zugleich vor einem spanischsprachigen Board und vor englischsprachigen internationalen Investoren glaubwürdig wirkt — ohne CMS zu pflegen und ohne Build-Pipeline am Leben zu halten.',
      solution: 'Sieben handgebaute Seiten — Über uns, Vision und Ziele, Portfolio, externe Investments, Team und Kontakt — in denen jede Textzeile zweimal im Markup steht: einmal auf Spanisch, einmal auf Englisch. Ein Schalter im Header tauscht die gesamte Website sofort: kein Reload, kein Routenwechsel, kein Übersetzungsdienst. Beide Sprachen stehen im HTML, also indexieren Suchmaschinen beide.',
      impact: [
        { pre: '7', em: 'Seiten', l: 'Zweisprachig ES/EN' },
        { v: 'Sofort', l: 'Sprachwechsel ohne Reload' },
        { v: '0 Build', l: 'Statisch, ohne Framework' },
      ],
      highlights: [
        'Jeder String als ES/EN-Paar im Markup — beide indexierbar',
        'Sprachwahl bleibt über Seiten und Besuche hinweg erhalten',
        'Statisches Hosting auf eigener Domain, nahezu ohne laufende Kosten',
      ],
    },
    ibdaa: {
      role: 'Senior Software Engineer · Arabisch-first-LMS',
      tag: 'Arabisch-first-Lernplattform — eine Laravel-13-API und eine Next.js-16-App in einem Nx-Monorepo, mit vollständiger Übergabe geliefert.',
      labels: ['Arabisch', 'Englisch'],
      note: 'Alpha — „Ibdaa Course“ ist ein Arbeitstitel bis zum Launch-Branding des Kunden',
      problem: 'Arabische Bildungsanbieter arbeiten mit Plattformen, die englisch-first entworfen und erst nachträglich um RTL ergänzt wurden — Lernerlebnis, Zertifikat und Adminbereich lesen sich deshalb wie die Übersetzung von etwas anderem.',
      solution: 'Stattdessen arabisch-first gebaut: Locale-präfixierte /ar- und /en-Routen in einer Next.js-16-App-Router-Anwendung mit RTL als Standardrichtung, dahinter eine Laravel-13-API in dreizehn Feature-Modulen — Kurse, Lektionen, Einschreibungen, Zahlungen, Prüfungen, Zertifikate mit öffentlicher Verifikation, Bewertungen, Diskussionen, Favoriten und Reporting. Ausgeliefert mit Deployment-, UAT- und Übergabedokumentation, damit der Kunde sie ohne mich betreiben und erweitern kann.',
      impact: [
        { pre: '174', em: 'Tests', l: '616 API-Assertions' },
        { v: '13 Module', l: '74 API-Routen' },
        { v: 'Arabisch-first', l: 'RTL als Standard' },
      ],
      highlights: [
        'Nx-+-pnpm-Monorepo — Laravel 13 (PHP 8.5) + Next.js 16',
        'Zertifikate öffentlich per Code verifizierbar',
        'Zwei Produktions-Images: FrankenPHP + Next.js standalone',
      ],
    },
  },
  es: {
    proven: {
      role: 'Consultor independiente · España',
      tag: 'Sitio corporativo para un grupo diversificado de inversión y operación — totalmente bilingüe ES/EN, sin framework y sin paso de compilación.',
      labels: ['Sitio web', 'Portfolio', 'Equipo'],
      problem: 'Un grupo de inversión y operación que capta capital en Europa y el Golfo necesitaba una presencia corporativa creíble a la vez para un consejo hispanohablante y para inversores internacionales anglófonos — sin un CMS que mantener ni una pipeline de compilación que vigilar.',
      solution: 'Siete páginas hechas a mano — nosotros, visión y objetivos, portfolio, inversiones externas, equipo y contacto — donde cada línea de texto existe dos veces en el marcado: una en español y otra en inglés. Un botón en la cabecera cambia todo el sitio al instante: sin recarga, sin cambio de ruta y sin servicio de traducción. Ambos idiomas viajan dentro del HTML, así que los buscadores indexan los dos.',
      impact: [
        { pre: '7', em: 'páginas', l: 'Bilingüe ES/EN' },
        { v: 'Instantáneo', l: 'Cambio de idioma sin recarga' },
        { v: '0 build', l: 'Estático, sin framework' },
      ],
      highlights: [
        'Cada cadena viaja como par ES/EN — ambas indexables',
        'La elección de idioma se conserva entre páginas y visitas',
        'Alojamiento estático en dominio propio, coste casi nulo',
      ],
    },
    ibdaa: {
      role: 'Ingeniero de Software Sénior · LMS en árabe',
      tag: 'Plataforma de aprendizaje pensada primero en árabe — una API Laravel 13 y una app Next.js 16 en un monorepo Nx, entregada con handover completo.',
      labels: ['Árabe', 'Inglés'],
      note: 'Alpha — «Ibdaa Course» es un nombre de trabajo, pendiente de la marca de lanzamiento del cliente',
      problem: 'Los proveedores de formación en árabe trabajan con plataformas diseñadas primero en inglés y con el RTL añadido después — así que la experiencia del alumno, el certificado y el panel de administración se leen como la traducción de otra cosa.',
      solution: 'Se construyó al revés, primero en árabe: rutas /ar y /en con prefijo de idioma sobre una única app Next.js 16 con App Router y RTL como dirección por defecto, respaldada por una API Laravel 13 dividida en trece módulos — cursos, lecciones, matrículas, pagos, exámenes, certificados con verificación pública, reseñas, debates, favoritos e informes. Entregada con documentación de despliegue, UAT y handover para que el cliente pueda operarla y ampliarla sin mí.',
      impact: [
        { pre: '174', em: 'tests', l: '616 aserciones de API' },
        { v: '13 módulos', l: '74 rutas de API' },
        { v: 'Árabe primero', l: 'RTL por defecto' },
      ],
      highlights: [
        'Monorepo Nx + pnpm — Laravel 13 (PHP 8.5) + Next.js 16',
        'Certificados verificables públicamente por código',
        'Dos imágenes de producción: FrankenPHP + Next.js standalone',
      ],
    },
  },
  fr: {
    proven: {
      role: 'Consultant indépendant · Espagne',
      tag: 'Site corporate pour un groupe diversifié d’investissement et d’exploitation — entièrement bilingue ES/EN, sans framework ni étape de build.',
      labels: ['Site web', 'Portfolio', 'Équipe'],
      problem: 'Un groupe d’investissement et d’exploitation qui lève des fonds en Europe et dans le Golfe avait besoin d’une présence corporate crédible à la fois pour un conseil hispanophone et pour des investisseurs internationaux anglophones — sans CMS à maintenir ni pipeline de build à surveiller.',
      solution: 'Sept pages construites à la main — à propos, vision et objectifs, portfolio, investissements externes, équipe et contact — où chaque ligne de texte existe deux fois dans le markup : une fois en espagnol, une fois en anglais. Un bouton dans l’en-tête bascule tout le site instantanément : sans rechargement, sans changement de route, sans service de traduction. Les deux langues sont dans le HTML, donc les moteurs indexent les deux.',
      impact: [
        { pre: '7', em: 'pages', l: 'Bilingue ES/EN' },
        { v: 'Instantané', l: 'Changement de langue sans rechargement' },
        { v: '0 build', l: 'Statique, sans framework' },
      ],
      highlights: [
        'Chaque chaîne est un couple ES/EN dans le markup — les deux indexables',
        'Le choix de langue est conservé d’une page et d’une visite à l’autre',
        'Hébergement statique sur domaine propre, coût de fonctionnement quasi nul',
      ],
    },
    ibdaa: {
      role: 'Ingénieur logiciel senior · LMS pensé en arabe d’abord',
      tag: 'Plateforme d’apprentissage pensée en arabe d’abord — une API Laravel 13 et une app Next.js 16 dans un monorepo Nx, livrée avec une passation complète.',
      labels: ['Arabe', 'Anglais'],
      note: 'Alpha — « Ibdaa Course » est un nom de travail, en attente de la marque de lancement du client',
      problem: 'Les organismes de formation arabophones utilisent des plateformes conçues d’abord en anglais, le RTL étant ajouté après coup — l’expérience de l’apprenant, le certificat et l’admin se lisent alors comme la traduction d’autre chose.',
      solution: 'Construite dans l’autre sens, en arabe d’abord : des routes /ar et /en préfixées par la locale sur une seule app Next.js 16 (App Router) avec le RTL comme direction par défaut, adossée à une API Laravel 13 découpée en treize modules — cours, leçons, inscriptions, paiements, examens, certificats vérifiables publiquement, avis, discussions, favoris et reporting. Livrée avec la documentation de déploiement, d’UAT et de passation pour que le client l’exploite et la fasse évoluer sans moi.',
      impact: [
        { pre: '174', em: 'tests', l: '616 assertions d’API' },
        { v: '13 modules', l: '74 routes d’API' },
        { v: 'Arabe d’abord', l: 'RTL par défaut' },
      ],
      highlights: [
        'Monorepo Nx + pnpm — Laravel 13 (PHP 8.5) + Next.js 16',
        'Certificats vérifiables publiquement par code',
        'Deux images de production : FrankenPHP + Next.js standalone',
      ],
    },
  },
};

// Render one case object, matching the formatting of the nine already in the
// export exactly (2-space object indent, 4-space keys, trailing commas). `n` is
// emitted as a placeholder — renumbering is a separate pass, so it stays correct
// no matter where the entry ends up in the array.
const q = (s) => JSON.stringify(String(s));

function caseObject(key, loc) {
  const base = NEW_CASES[key];
  const c = CASES_COPY[loc][key];
  const impact = c.impact
    .map((i) =>
      i.em
        ? `      { v: <>${jsxText(i.pre)} <em>${jsxText(i.em)}</em></>, l: ${q(i.l)} },\n`
        : `      { v: ${q(i.v)}, l: ${q(i.l)} },\n`
    )
    .join('');

  return (
    '\n  {\n' +
    '    n: "00",\n' +
    `    name: ${q(base.name)},\n` +
    `    role: ${q(c.role)},\n` +
    `    shotSrc: ${q(base.shotSrc)},\n` +
    `    tag: ${q(c.tag)},\n` +
    `    stack: [${base.stack.map(q).join(', ')}],\n` +
    `    openUrl: ${q(base.openUrl)},\n` +
    '    links: [\n' +
    base.hrefs.map((h, i) => `      { label: ${q(c.labels[i])}, href: ${q(h)} },\n`).join('') +
    '    ],\n' +
    (c.note ? `    note: ${q(c.note)},\n` : '') +
    `    problem: ${q(c.problem)},\n` +
    `    solution: ${q(c.solution)},\n` +
    '    impact: [\n' +
    impact +
    '    ],\n' +
    '    highlights: [\n' +
    c.highlights.map((h) => `      ${q(h)},\n`).join('') +
    '    ],'
  );
}

// The array is delimited by literals that are identical in all five exports
// (verified): it opens with `const cases = [\n  {\n` and closes with
// `\n  },\n];`, and top-level entries are separated by `\n  },\n  {\n`. Nested
// objects are indented deeper, so no inner text can be mistaken for a
// separator — the entry count comes out at 9 in every locale.
const CASES_OPEN = 'const cases = [';
const CASES_CLOSE = '\n  },\n];';
const CASE_SEP = '\n  },';

function rewriteCases(loc) {
  return (text) => {
    const a = text.indexOf(CASES_OPEN);
    if (a < 0) return null;
    const b = text.indexOf(CASES_CLOSE, a);
    if (b < 0) return null;

    const bodyStart = a + CASES_OPEN.length;
    const bodyEnd = b + CASE_SEP.length;
    const parts = text.slice(bodyStart, bodyEnd).split(CASE_SEP);
    if (parts.pop() !== '') return null; // body must end on a separator
    let entries = parts;
    if (!entries.length) return null;

    // 1. Append the two new cases, once.
    for (const key of ['proven', 'ibdaa']) {
      const marker = `shotSrc: ${q(NEW_CASES[key].shotSrc)}`;
      if (!entries.some((e) => e.includes(marker))) entries.push(caseObject(key, loc));
    }

    // 2. Ezhal last — it is the only case with nothing shipped to the stores
    //    yet, so it reads as the weakest card and shouldn't sit mid-list.
    const isEzhal = (e) => e.includes('name: "Ezhal"');
    entries = [...entries.filter((e) => !isEzhal(e)), ...entries.filter(isEzhal)];

    // 3. Renumber in final order. Case numbers are Western digits in every
    //    locale (only the `impact` values are localised to Arabic-Indic).
    entries = entries.map((e, i) =>
      e.replace(/\n    n: "\d+",/, `\n    n: "${String(i + 1).padStart(2, '0')}",`)
    );

    return text.slice(0, bodyStart) + entries.join(CASE_SEP) + CASE_SEP + text.slice(bodyEnd);
  };
}

const CASE_EDITS = ['en', 'ar', 'de', 'es', 'fr'].map((loc) => ({
  file: loc === 'en' ? 'index.html' : `index.${loc}.html`,
  label: `case studies: Proven + Ibdaa, Ezhal last (${loc})`,
  // Transform edits find their asset by this substring instead of by `old`.
  anchor: CASES_OPEN,
  transform: rewriteCases(loc),
}));

// ── Pricing: "from" on the two large tiers ───────────────────────────────────
// A hard number is a filter, and filters are for when there are more leads than
// you can take. There aren't yet — so `$9,000` was closing conversations that
// should have opened. Deleting the prices outright would be worse: the tiers are
// what make the page read as productized rather than as another freelancer
// asking you to enquire. So the numbers stay and one word goes in front of the
// two big ones, which keeps the anchor and the filter while leaving room to
// quote a Dubai or US engagement higher than a first-time client.
//
// The entry tier (Architecture Clinic) deliberately keeps its exact price: it is
// the cheap, concrete offer that earns the first click, and a range there would
// only add friction to the one number people are willing to act on.
const FROM_WORD = {
  en: 'from',
  ar: 'ابتداءً من',
  de: 'ab',
  es: 'desde',
  fr: 'à partir de',
};

// Rendered inside `.price-amount`, which is a very large display number — hence
// the sub-em sizing and the lift, so the qualifier reads as a prefix instead of
// competing with the figure. Inline style rather than a new class: the export's
// CSS lives in its own style blocks, and this file only ever edits the JSX.
// `marginInlineEnd` (not `marginRight`) so it sits on the correct side in RTL.
const FROM_SPAN =
  '<span style={{fontSize:"0.42em",fontWeight:400,letterSpacing:"0.02em",opacity:0.6,' +
  'marginInlineEnd:"0.32em",verticalAlign:"0.28em"}}>{t.from}</span>';

// The two tiers that get a range, keyed by the price string in each locale.
// Anchored on the price line PLUS the note line that follows it, so the insert
// between them consumes its own anchor.
const RANGED_TIERS = {
  en: ['"$9,000"', '"$3,500"'],
  ar: ['"$٩٬٠٠٠"', '"$٣٬٥٠٠"'],
  de: ['"9.000 $"', '"3.500 $"'],
  es: ['"$9,000"', '"$3,500"'],
  fr: ['"9 000 $"', '"3 500 $"'],
};

// Add-on prices are already small, uniform text, so the qualifier goes straight
// into the string rather than through a sized span.
const ADDON_PRICES = {
  en: ['"$6,000"', '"$4,500"', '"$4,000"'],
  ar: ['"$٦٬٠٠٠"', '"$٤٬٥٠٠"', '"$٤٬٠٠٠"'],
  de: ['"6.000 $"', '"4.500 $"', '"4.000 $"'],
  es: ['"$6,000"', '"$4,500"', '"$4,000"'],
  fr: ['"6 000 $"', '"4 500 $"', '"4 000 $"'],
};

const PRICING_EDITS = ['en', 'ar', 'de', 'es', 'fr'].flatMap((loc) => {
  const file = loc === 'en' ? 'index.html' : `index.${loc}.html`;
  const word = FROM_WORD[loc];
  // Arabic pins the amount to `dir="ltr"` because a bare "$١٬٢٠٠" would otherwise
  // render with the currency mark on the wrong side. Once an Arabic word leads
  // the line that override becomes wrong — it would drag the prefix to the left
  // of the figure. `dir="auto"` gets both cases right: it takes direction from
  // the first strong character, so a numbers-only amount still resolves to LTR.
  const amountOld =
    loc === 'ar'
      ? '<div className="price-amount" dir="ltr">{t.price}</div>'
      : '<div className="price-amount">{t.price}</div>';
  const amountNew =
    loc === 'ar'
      ? '<div className="price-amount" dir="auto">{t.from ? ' + FROM_SPAN + ' : null}{t.price}</div>'
      : '<div className="price-amount">{t.from ? ' + FROM_SPAN + ' : null}{t.price}</div>';

  return [
    {
      file,
      label: `pricing: render "from" prefix (${loc})`,
      appliedMarker: '{t.from ? <span',
      old: amountOld,
      new: amountNew,
    },
    // Same `dir` reasoning as the amount, for the add-on prices.
    ...(loc === 'ar'
      ? [{
          file,
          label: `pricing: add-on price direction (ar)`,
          appliedMarker: '<span className="addon-price" dir="auto">',
          old: '<span className="addon-price" dir="ltr">{a.price}</span>',
          new: '<span className="addon-price" dir="auto">{a.price}</span>',
        }]
      : []),
    ...RANGED_TIERS[loc].map((price, i) => ({
      file,
      label: `pricing: "${word}" on tier ${i + 1} (${loc})`,
      // Keyed on the price, which is unique per tier within the file — the
      // marker has to be too, or a changed export could make the second tier
      // report "already applied" off the back of the first one's insert.
      appliedMarker: `      price: ${price},\n      from: `,
      expect: 1,
      // `price` then `note` on consecutive lines; inserting between them means
      // the anchor cannot match again on a re-run.
      old: `      price: ${price},\n      note: `,
      new: `      price: ${price},\n      from: ${JSON.stringify(word)},\n      note: `,
    })),
    ...ADDON_PRICES[loc].map((price, i) => ({
      file,
      label: `pricing: "${word}" on add-on ${i + 1} (${loc})`,
      appliedMarker: `price: "${word} ${price.slice(1, -1)}"`,
      old: `price: ${price} }`,
      new: `price: "${word} ${price.slice(1, -1)}" }`,
    })),
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

  // ── Case studies: Proven Group + Ibdaa Course, and Ezhal moved last ───────
  ...CASE_EDITS,

  // ── Pricing: "from" on the two large tiers and the add-ons ────────────────
  ...PRICING_EDITS,
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

  // ── Transform edits ──────────────────────────────────────────────────────
  // For structural rewrites (reordering an array, renumbering its entries) an
  // exact-string anchor is the wrong tool: there is no single "old" to match.
  // A transform gets the whole asset and returns the rewritten text, and is
  // required to be idempotent — so "already applied" is simply "the transform
  // changed nothing", which needs no appliedMarker to detect.
  if (edit.transform) {
    let hit = null;
    for (const [id, asset] of Object.entries(obj)) {
      let text;
      try { text = decode(asset); } catch { continue; }
      if (text.includes(edit.anchor)) { hit = { id, asset, text }; break; }
    }
    if (!hit) {
      console.error(`✗ ${edit.label}: anchor not found in ${edit.file} (export may have changed)`);
      failures++;
      continue;
    }
    let updated;
    try { updated = edit.transform(hit.text); } catch (e) {
      console.error(`✗ ${edit.label}: transform threw in ${edit.file} — ${e.message}`);
      failures++;
      continue;
    }
    if (updated == null) {
      console.error(`✗ ${edit.label}: transform could not parse ${edit.file} (export may have changed)`);
      failures++;
      continue;
    }
    if (updated === hit.text) {
      console.log(`= ${edit.label}: already applied in ${edit.file}`);
      continue;
    }
    if (CHECK) {
      console.log(`✓ ${edit.label}: would rewrite ${edit.file} (asset ${hit.id.slice(0, 8)})`);
      continue;
    }
    // Idempotency is a hard requirement, not a hope: re-running the transform
    // on its own output must be a no-op. Verified here so a regression fails at
    // write time instead of silently duplicating cases on the next deploy.
    if (edit.transform(updated) !== updated) {
      console.error(`✗ ${edit.label}: transform is not idempotent — refusing to write ${edit.file}`);
      failures++;
      continue;
    }
    obj[hit.id] = { ...hit.asset, data: encode(hit.asset, updated) };
    lines[index] = JSON.stringify(obj);
    writeFileSync(edit.file, lines.join('\n'), 'utf8');
    console.log(`✓ ${edit.label}: applied to ${edit.file} (asset ${hit.id.slice(0, 8)})`);
    applied++;
    continue;
  }

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
