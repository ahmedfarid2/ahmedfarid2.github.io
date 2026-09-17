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

// Where the lead-magnet card points. This is the email-capture gate: a visitor
// enters an email and is handed the PDF. It used to be a Tally form on
// tally.so; it is now a page on this domain, which keeps the visitor on the
// site, keeps the styling consistent, and means the lead does not live in a
// third party's dashboard. Change this one constant to repoint the card in
// every locale.
const LM_HREF = '/get-checklist.html';

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

// ── Two card sections: own products, and concepts/builds ────────────────────
// Both reuse existing classes only — `.writing-grid`/`.writing-card` for the
// link cards (every entry is an external link) and `.case-stack`/`.chip` for
// the tech chips, since `.chip` is only styled inside `.build-card` and
// `.case-stack`. Zero new CSS, and both sections inherit hover, reveal and
// spotlight behaviour for free.
//
// Neither eyebrow carries a number, on purpose. Section numbers are hardcoded
// strings and already inconsistent in the export (15 appears twice, 16 is
// unused), so numbering these would either collide or force renumbering
// everything after them. The design already has unnumbered eyebrows —
// "Profile", "By the numbers", "Full toolbelt" — so this follows that pattern.

// ── Section 1: own products ─────────────────────────────────────────────────
// Only the two things Ahmed chose, built and hosts himself. The section's whole
// value is that claim, so anything commissioned by someone else belongs in the
// second section below — a heading that isn't true costs more than a card gains.
const PRODUCTS = [
  {
    // First, deliberately: it is the largest of the three and the only one on
    // its own domain, so it is the strongest evidence for the section's claim.
    // It also appears as a full case study — the card is the quick link, the
    // case study is the depth, and the two sections sit far apart on the page.
    name: 'Applyni',
    href: 'https://applyni.com/ar',
    chips: ['Next.js', 'TypeScript', 'Supabase', 'Tailwind v4'],
  },
  {
    name: 'ReconcilePilot',
    href: 'https://reconcilepilot.iamahmedfarid.com',
    chips: ['Next.js 16', 'React 19', 'Supabase', 'Vercel'],
  },
  {
    name: 'SheetPilot AI',
    href: 'https://sheetpilot.iamahmedfarid.com',
    chips: ['Next.js 16', 'TypeScript', 'Tailwind v4', 'Recharts'],
  },
];

// ── Section 2: concepts, demos and smaller client builds ────────────────────
// Everything else live on iamahmedfarid.com. Each card carries a category chip
// naming what it actually is, because the difference matters:
//
//   • Reform and DIGIT are UNSOLICITED concepts — the clinics did not
//     commission them and have not signed them off. Both repos say so
//     explicitly (DIGIT ships noindex/nofollow on every route). The copy must
//     never read as paid client work.
//   • ITQAN is a concept too, but a far larger one — 22 routes.
//   • Cairo Plaza is real client work for a New Cairo developer.
//   • Ofoq is a client demo built from a written proposal.
const BUILDS = [
  {
    key: 'reform',
    name: 'Reform Dental',
    href: 'https://reform.iamahmedfarid.com',
    chips: ['Vanilla JS', 'No build step', 'Bilingual RTL', 'Vercel'],
  },
  {
    key: 'digit',
    name: 'DIGIT Dental',
    href: 'https://digitdental.iamahmedfarid.com',
    chips: ['Next.js 16', 'React 19', 'TypeScript', 'Tailwind v4'],
  },
  {
    key: 'itqan',
    name: 'ITQAN Dental',
    href: 'https://itqan.iamahmedfarid.com',
    // Not "22 routes": a chip whose first strong character is a digit gets
    // reordered inside the RTL export and renders as "routes 22". The count is
    // in the description, where it is localised properly; chips stay tech
    // tokens, which are direction-safe in every locale.
    chips: ['Next.js 16', 'App Router', 'TypeScript', 'Tailwind v4'],
  },
  {
    key: 'cairoplaza',
    name: 'Cairo Plaza',
    href: 'https://cairoplaza.iamahmedfarid.com',
    chips: ['Vanilla JS', 'No build step', 'Bilingual EN/AR', 'Vercel'],
  },
  {
    key: 'ofoq',
    name: 'Ofoq',
    href: 'https://ofoq.iamahmedfarid.com',
    chips: ['Next.js 16', 'React 19', 'TypeScript', 'Live sync'],
  },
];

// Per-locale section copy. Product names and tech chips stay in English, the
// way the existing translations already treat brand and tech tokens.
const PRODUCTS_COPY = {
  en: {
    eyebrow: 'Own products',
    title: ['Products I built ', 'and run myself.'],
    sub: 'Client work shows what I can deliver against someone else’s brief. These are the ones where I picked the problem, shipped the product, and host it on my own domain.',
    cats: ['AI career agent', 'Finance ops', 'AI reporting'],
    descs: [
      'Saudi-first job-search agent: it reads your CV, matches you to companies where your experience actually fits with a plain-language reason for each, then sends from your own Gmail — only after you approve every message.',
      'Invoice ↔ bank-statement reconciliation for accountants. Upload both sheets and see what is paid, unpaid, double-paid or suspicious — every row scored for confidence with a plain-English reason.',
      'Turns a raw CSV into a business report: interactive dashboard, AI-written executive summary, findings, risks and recommendations, exportable as PDF. Parsing runs in the browser — data never leaves it.',
    ],
  },
  ar: {
    eyebrow: 'منتجاتي الخاصة',
    title: ['منتجات بنيتها ', 'وأُشغّلها بنفسي.'],
    sub: 'أعمال العملاء تُظهر ما أستطيع تسليمه وفق متطلبات غيري. هذه هي التي اخترت فيها المشكلة بنفسي، وأطلقت المنتج، وأستضيفه على نطاقي الخاص.',
    cats: ['وكيل مهني بالذكاء الاصطناعي', 'عمليات مالية', 'تقارير بالذكاء الاصطناعي'],
    descs: [
      'وكيل بحث عن عمل، سعودي أولًا: يقرأ سيرتك، ويطابقك مع شركات تناسب خبرتك فعلًا مع سبب واضح لكل مطابقة، ثم يرسل من بريدك أنت — وفقط بعد موافقتك على كل رسالة.',
      'مطابقة الفواتير مع كشوف الحساب البنكية للمحاسبين. ارفع الملفين وشاهد ما هو مدفوع، وغير مدفوع، ومدفوع مرتين، أو مشبوه — مع درجة ثقة وسبب واضح لكل صف.',
      'يحوّل ملف CSV خامًا إلى تقرير أعمال: لوحة تفاعلية، وملخّص تنفيذي مكتوب بالذكاء الاصطناعي، ونتائج ومخاطر وتوصيات، قابل للتصدير PDF. التحليل يتم في المتصفح — البيانات لا تغادره.',
    ],
  },
  de: {
    eyebrow: 'Eigene Produkte',
    title: ['Produkte, die ich gebaut habe ', 'und selbst betreibe.'],
    sub: 'Kundenarbeit zeigt, was ich nach fremder Vorgabe liefere. Hier habe ich das Problem selbst gewählt, das Produkt ausgeliefert und hoste es auf meiner eigenen Domain.',
    cats: ['KI-Karriereagent', 'Finanzprozesse', 'KI-Reporting'],
    descs: [
      'Jobsuche-Agent, Saudi-first: liest den Lebenslauf, matcht auf Unternehmen, zu denen die Erfahrung wirklich passt, mit verständlicher Begründung je Match, und versendet dann aus dem eigenen Gmail — erst nach Freigabe jeder Nachricht.',
      'Abgleich von Rechnungen und Kontoauszügen für Buchhalter. Beide Dateien hochladen und sehen, was bezahlt, offen, doppelt bezahlt oder auffällig ist — jede Zeile mit Konfidenzwert und verständlicher Begründung.',
      'Macht aus einer rohen CSV einen Geschäftsbericht: interaktives Dashboard, KI-geschriebene Zusammenfassung, Erkenntnisse, Risiken und Empfehlungen, als PDF exportierbar. Das Parsen läuft im Browser — die Daten verlassen ihn nie.',
    ],
  },
  es: {
    eyebrow: 'Productos propios',
    title: ['Productos que construí ', 'y opero yo mismo.'],
    sub: 'El trabajo con clientes muestra lo que entrego según el encargo de otros. Estos son los que elegí yo: escogí el problema, lancé el producto y lo alojo en mi propio dominio.',
    cats: ['Agente de carrera con IA', 'Operaciones financieras', 'Informes con IA'],
    descs: [
      'Agente de búsqueda de empleo pensado para Arabia Saudí: lee tu CV, te empareja con empresas donde tu experiencia encaja de verdad con un motivo en lenguaje claro, y envía desde tu propio Gmail — solo tras aprobar cada mensaje.',
      'Conciliación de facturas y extractos bancarios para contables. Sube ambos archivos y ve qué está pagado, pendiente, pagado dos veces o es sospechoso — cada fila con un nivel de confianza y un motivo en lenguaje claro.',
      'Convierte un CSV en bruto en un informe de negocio: panel interactivo, resumen ejecutivo escrito por IA, hallazgos, riesgos y recomendaciones, exportable a PDF. El análisis ocurre en el navegador — los datos nunca salen de él.',
    ],
  },
  fr: {
    eyebrow: 'Mes propres produits',
    title: ['Des produits que j’ai construits ', 'et que j’exploite moi-même.'],
    sub: 'Le travail client montre ce que je livre selon le cahier des charges d’autrui. Ici, j’ai choisi le problème, livré le produit et je l’héberge sur mon propre domaine.',
    cats: ['Agent de carrière IA', 'Opérations financières', 'Reporting par IA'],
    descs: [
      'Agent de recherche d’emploi pensé pour l’Arabie saoudite : il lit votre CV, vous rapproche d’entreprises où votre expérience colle vraiment avec une raison en clair, puis envoie depuis votre propre Gmail — seulement après validation de chaque message.',
      'Rapprochement des factures et des relevés bancaires pour les comptables. Chargez les deux fichiers et voyez ce qui est payé, impayé, payé deux fois ou suspect — chaque ligne avec un score de confiance et une raison en clair.',
      'Transforme un CSV brut en rapport d’activité : tableau de bord interactif, synthèse rédigée par IA, constats, risques et recommandations, exportable en PDF. L’analyse tourne dans le navigateur — les données n’en sortent jamais.',
    ],
  },
};

const BUILDS_COPY = {
  en: {
    eyebrow: 'Concepts & builds',
    title: ['Concepts, demos, ', 'and recent builds.'],
    sub: 'Design concepts, client demos and smaller builds — all live on my own domain, so you can click through them instead of taking my word for it. Each one is labelled for what it actually is.',
    cats: { concept: 'Concept', client: 'Client work', demo: 'Client demo' },
    kinds: { reform: 'concept', digit: 'concept', itqan: 'concept', cairoplaza: 'client', ofoq: 'demo' },
    descs: {
      reform: 'A homepage concept for a dental clinic, in English and Arabic. The RTL version carries its own type system and composition rather than a mirrored layout. No framework, no build step — three files and a photo.',
      digit: 'An unsolicited Arabic-first concept for a Giza dental clinic, built from two design artboards. Anything the clinic has not verified — credentials, counts, case photos — is structured in the data layer but deliberately left empty rather than invented.',
      itqan: 'A full Arabic clinic site as a concept: 22 routes covering services, ten treatment pages, a doctor profile, team, articles and contact — the treatment pages generated from one typed service model. Only verified information is allowed into the data layer.',
      cairoplaza: 'A payment-plan calculator and project pages for a New Cairo real-estate developer. Bilingual English and Arabic, fully static, no backend — a sales tool their team can open on a phone in front of a buyer.',
      ofoq: 'A smart-building app proposal turned into something the owner can actually use. Book a room in the member app and it lands on the management calendar; order from the café and it reaches the kitchen board — mark it ready and the member is notified live, even in another tab.',
    },
  },
  ar: {
    eyebrow: 'مفاهيم وأعمال',
    title: ['مفاهيم وعروض تجريبية ', 'وأعمال حديثة.'],
    sub: 'مفاهيم تصميمية وعروض تجريبية لعملاء وأعمال أصغر — جميعها منشورة على نطاقي الخاص، لتتصفّحها بنفسك بدل أن تأخذ كلامي. وكلٌّ منها موسوم بما هو عليه فعلًا.',
    cats: { concept: 'مفهوم تصميمي', client: 'عمل لعميل', demo: 'عرض تجريبي لعميل' },
    kinds: { reform: 'concept', digit: 'concept', itqan: 'concept', cairoplaza: 'client', ofoq: 'demo' },
    descs: {
      reform: 'مفهوم لصفحة رئيسية لعيادة أسنان، بالإنجليزية والعربية. النسخة العربية لها نظامها الطباعي وتكوينها الخاص، لا مجرد انعكاس للتخطيط. بلا إطار عمل وبلا خطوة بناء — ثلاثة ملفات وصورة واحدة.',
      digit: 'مفهوم عربي أولًا غير مطلوب لعيادة أسنان في الجيزة، مبني من لوحتَي تصميم. وكل ما لم تؤكّده العيادة — مؤهلات وأرقام وصور حالات — مُهيكل في طبقة البيانات لكنه تُرك فارغًا عمدًا بدل اختلاقه.',
      itqan: 'موقع عيادة عربي كامل كمفهوم: ٢٢ مسارًا تشمل الخدمات، وعشر صفحات علاج، وملفّ الطبيب، والفريق، والمقالات، والتواصل — وصفحات العلاج مُولَّدة من نموذج خدمة واحد مُحدّد الأنواع. ولا يدخل طبقة البيانات إلا ما هو موثّق.',
      cairoplaza: 'حاسبة خطط سداد وصفحات مشاريع لمطوّر عقاري في القاهرة الجديدة. ثنائية اللغة إنجليزي/عربي، ثابتة بالكامل وبلا خلفية برمجية — أداة بيع يفتحها فريقهم على الهاتف أمام المشتري.',
      ofoq: 'مقترح تطبيق لمبنى ذكي تحوّل إلى شيء يستطيع المالك استخدامه فعلًا. احجز قاعة من تطبيق العضو فتظهر على تقويم الإدارة؛ واطلب من المقهى فيصل الطلب إلى شاشة المطبخ — وبمجرد وسمه جاهزًا يصل الإشعار إلى العضو مباشرة، حتى في تبويب آخر.',
    },
  },
  de: {
    eyebrow: 'Konzepte & Builds',
    title: ['Konzepte, Demos ', 'und neuere Arbeiten.'],
    sub: 'Designkonzepte, Kunden-Demos und kleinere Builds — alle live auf meiner eigenen Domain, damit Sie durchklicken können, statt mir zu glauben. Jedes ist als das gekennzeichnet, was es wirklich ist.',
    cats: { concept: 'Konzept', client: 'Kundenarbeit', demo: 'Kunden-Demo' },
    kinds: { reform: 'concept', digit: 'concept', itqan: 'concept', cairoplaza: 'client', ofoq: 'demo' },
    descs: {
      reform: 'Ein Homepage-Konzept für eine Zahnarztpraxis, auf Englisch und Arabisch. Die RTL-Fassung hat ein eigenes Typosystem und eine eigene Komposition statt eines gespiegelten Layouts. Ohne Framework, ohne Build-Schritt — drei Dateien und ein Foto.',
      digit: 'Ein unaufgefordertes, arabisch-first Konzept für eine Zahnarztpraxis in Gizeh, gebaut aus zwei Design-Artboards. Alles, was die Praxis nicht bestätigt hat — Qualifikationen, Zahlen, Fallfotos — ist in der Datenschicht strukturiert, aber bewusst leer gelassen statt erfunden.',
      itqan: 'Eine vollständige arabische Praxis-Website als Konzept: 22 Routen mit Leistungen, zehn Behandlungsseiten, Arztprofil, Team, Artikeln und Kontakt — die Behandlungsseiten aus einem typisierten Leistungsmodell generiert. In die Datenschicht darf nur Verifiziertes.',
      cairoplaza: 'Ein Zahlungsplan-Rechner und Projektseiten für einen Immobilienentwickler in New Cairo. Zweisprachig Englisch und Arabisch, vollständig statisch, ohne Backend — ein Vertriebswerkzeug, das das Team vor dem Käufer auf dem Handy öffnet.',
      ofoq: 'Ein Proposal für eine Smart-Building-App, verwandelt in etwas, das der Eigentümer wirklich benutzen kann. Ein in der Mitglieder-App gebuchter Raum landet im Management-Kalender; eine Café-Bestellung erscheint auf dem Küchenboard — als fertig markiert, wird das Mitglied live benachrichtigt, auch in einem anderen Tab.',
    },
  },
  es: {
    eyebrow: 'Conceptos y builds',
    title: ['Conceptos, demos ', 'y trabajos recientes.'],
    sub: 'Conceptos de diseño, demos para clientes y trabajos más pequeños — todos publicados en mi propio dominio, para que los recorras en vez de creerme. Cada uno está etiquetado por lo que realmente es.',
    cats: { concept: 'Concepto', client: 'Trabajo de cliente', demo: 'Demo para cliente' },
    kinds: { reform: 'concept', digit: 'concept', itqan: 'concept', cairoplaza: 'client', ofoq: 'demo' },
    descs: {
      reform: 'Un concepto de página de inicio para una clínica dental, en inglés y árabe. La versión RTL tiene su propio sistema tipográfico y composición, no un diseño reflejado. Sin framework y sin paso de compilación: tres archivos y una fotografía.',
      digit: 'Un concepto no solicitado, pensado primero en árabe, para una clínica dental de Guiza, construido a partir de dos artboards de diseño. Todo lo que la clínica no ha verificado — credenciales, cifras, fotos de casos — está estructurado en la capa de datos pero deliberadamente vacío en lugar de inventado.',
      itqan: 'Un sitio completo de clínica en árabe como concepto: 22 rutas con servicios, diez páginas de tratamiento, perfil del doctor, equipo, artículos y contacto — las páginas de tratamiento generadas desde un único modelo de servicio tipado. Solo entra información verificada en la capa de datos.',
      cairoplaza: 'Una calculadora de planes de pago y páginas de proyecto para una promotora inmobiliaria de Nuevo Cairo. Bilingüe inglés y árabe, totalmente estática y sin backend — una herramienta de venta que su equipo abre en el móvil delante del comprador.',
      ofoq: 'Una propuesta de app para un edificio inteligente convertida en algo que el propietario puede usar de verdad. Reserva una sala en la app de miembro y aparece en el calendario de gestión; pide en la cafetería y llega al tablero de cocina — márcalo como listo y el miembro recibe el aviso en vivo, incluso en otra pestaña.',
    },
  },
  fr: {
    eyebrow: 'Concepts & réalisations',
    title: ['Concepts, démos ', 'et travaux récents.'],
    sub: 'Concepts de design, démos client et réalisations plus courtes — tous en ligne sur mon propre domaine, pour que vous cliquiez plutôt que de me croire sur parole. Chacun est étiqueté pour ce qu’il est vraiment.',
    cats: { concept: 'Concept', client: 'Travail client', demo: 'Démo client' },
    kinds: { reform: 'concept', digit: 'concept', itqan: 'concept', cairoplaza: 'client', ofoq: 'demo' },
    descs: {
      reform: 'Un concept de page d’accueil pour un cabinet dentaire, en anglais et en arabe. La version RTL possède sa propre typographie et composition plutôt qu’une mise en page miroir. Sans framework ni étape de build — trois fichiers et une photographie.',
      digit: 'Un concept spontané, pensé en arabe d’abord, pour un cabinet dentaire à Gizeh, construit à partir de deux planches de design. Tout ce que le cabinet n’a pas vérifié — diplômes, chiffres, photos de cas — est structuré dans la couche de données mais laissé volontairement vide plutôt qu’inventé.',
      itqan: 'Un site de cabinet entièrement en arabe, en concept : 22 routes couvrant les services, dix pages de traitement, le profil du médecin, l’équipe, les articles et le contact — les pages de traitement générées depuis un modèle de service typé. Seule une information vérifiée entre dans la couche de données.',
      cairoplaza: 'Un simulateur de plan de paiement et des pages projet pour un promoteur immobilier du Nouveau Caire. Bilingue anglais et arabe, entièrement statique et sans backend — un outil de vente que leur équipe ouvre sur un téléphone devant l’acheteur.',
      ofoq: 'Une proposition d’application pour un bâtiment intelligent transformée en quelque chose que le propriétaire peut réellement utiliser. Réservez une salle dans l’app membre et elle apparaît au calendrier de gestion ; commandez au café et la commande arrive sur le tableau de la cuisine — passez-la en « prêt » et le membre est notifié en direct, même dans un autre onglet.',
    },
  },
};

// Escape text destined for JSX text nodes: `'` must not break out of the JSX,
// and a literal `{`/`}` would be read as an expression.
const jsxText = (s) =>
  String(s).replace(/'/g, '&apos;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');

// One card. Shared by both sections so they cannot drift apart visually.
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

// Shared shell so the two sections stay structurally identical.
function cardSection(fnName, sectionId, copy, cards) {
  return (
    'function ' + fnName + '() {\n' +
    '  return (\n' +
    '    <section className="pad-y" id="' + sectionId + '">\n' +
    '      <div className="wrap">\n' +
    '        <SectionHead_t\n' +
    '          eyebrow="' + jsxText(copy.eyebrow) + '"\n' +
    '          title={<>' + jsxText(copy.title[0]) + '<em>' + jsxText(copy.title[1]) + '</em></>}\n' +
    '          sub="' + jsxText(copy.sub) + '"\n' +
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

function productsComponent(locale) {
  const c = PRODUCTS_COPY[locale];
  const cards = PRODUCTS.map((p, i) => productCard(p, c.cats[i], c.descs[i])).join('');
  return cardSection('Products', 'products', c, cards);
}

function buildsComponent(locale) {
  const c = BUILDS_COPY[locale];
  const cards = BUILDS.map((b) => productCard(b, c.cats[c.kinds[b.key]], c.descs[b.key])).join('');
  return cardSection('Builds', 'builds', c, cards);
}

// Both sections are installed by a transform rather than by exact-string
// anchors. An earlier version of this file used anchored inserts, and each time
// the section's contents changed it needed a fresh "migration" edit to move
// exports already carrying the older shape — the Reform card was appended that
// way, and pulling it back out into its own section would have needed another.
// A transform sidesteps the whole category of problem: it regenerates both
// components from the data above every run, so whatever shape a file is
// currently in, it converges on the same output.
const SECTION_OPEN = { Products: 'function Products() {', Builds: 'function Builds() {' };
const FN_CLOSE = '\n}\n\n';
const REGISTER_TAIL = 'Writing, FAQ, Connect, CTA, Footer });';
const RENDER_ANCHOR = '      <CaseStudies/>\n';
const RENDER_TAIL = '      <WhatIBuild/>\n';

function installSections(loc) {
  return (text) => {
    let out = text;

    // 1. Components. Replace an existing one in place, otherwise insert both
    //    just above the window registration.
    for (const [fn, source] of [
      ['Products', productsComponent(loc)],
      ['Builds', buildsComponent(loc)],
    ]) {
      const open = SECTION_OPEN[fn];
      const at = out.indexOf(open);
      if (at >= 0) {
        const end = out.indexOf(FN_CLOSE, at);
        if (end < 0) return null;
        out = out.slice(0, at) + source + out.slice(end + FN_CLOSE.length);
      } else {
        const reg = out.indexOf('Object.assign(window, { ');
        if (reg < 0) return null;
        const line = out.indexOf(REGISTER_TAIL, reg);
        if (line < 0) return null;
        const start = out.lastIndexOf('Object.assign(window, { ', line);
        out = out.slice(0, start) + source + out.slice(start);
      }
    }

    // 2. Registration — normalised, so it doesn't matter which names a previous
    //    run already added.
    const regAt = out.indexOf(REGISTER_TAIL);
    if (regAt < 0) return null;
    const regStart = out.lastIndexOf('Object.assign(window, { ', regAt);
    if (regStart < 0) return null;
    out =
      out.slice(0, regStart) +
      'Object.assign(window, { Products, Builds, ' +
      REGISTER_TAIL +
      out.slice(regAt + REGISTER_TAIL.length);

    // 3. Render list — both sections sit between the case studies and
    //    "What I build", normalised the same way.
    const rAt = out.indexOf(RENDER_ANCHOR);
    if (rAt < 0) return null;
    const tailAt = out.indexOf(RENDER_TAIL, rAt);
    if (tailAt < 0) return null;
    const between = out.slice(rAt + RENDER_ANCHOR.length, tailAt);
    // Only rewrite the gap when it holds nothing but our own section calls —
    // otherwise a future export that puts something else there would lose it.
    if (/^(\s*<(Products|Builds)\/>\n)*$/.test(between)) {
      out =
        out.slice(0, rAt + RENDER_ANCHOR.length) +
        '      <Products/>\n      <Builds/>\n' +
        out.slice(tailAt);
    }

    return out;
  };
}

const PRODUCT_SECTION_EDITS = ['en', 'ar', 'de', 'es', 'fr'].map((loc) => ({
  file: loc === 'en' ? 'index.html' : `index.${loc}.html`,
  label: `sections: own products + concepts/builds (${loc})`,
  anchor: 'Object.assign(window, { ',
  transform: installSections(loc),
}));

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
  applyni: {
    name: 'Applyni',
    shotSrc: '/applyni.jpg',
    stack: ['Next.js', 'TypeScript', 'Supabase', 'Tailwind v4', 'next-intl'],
    openUrl: 'https://applyni.com/ar',
    hrefs: ['https://applyni.com/ar', 'https://applyni.com/en'],
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
    applyni: {
      role: 'Solo — product, engineering and operations',
      tag: 'Saudi-first AI career agent — reads your CV, finds companies where you actually fit, and sends from your own Gmail.',
      labels: ['Arabic', 'English'],
      problem: 'Job seekers in the Gulf blast the same CV at every opening and hear nothing back. The tools that promise to fix it mostly automate the spraying, then dress it up with invented ATS scores and match percentages that explain nothing.',
      solution: 'An agent built to do the opposite of volume. It reads your CV, matches you against Saudi companies and explains each match in words — including what it could not verify, so a weak match says so instead of hiding behind a number. It drafts the outreach, you review it, and it sends from your own Gmail on a queue with skip rules. Nothing leaves without your approval, and the spec forbids what most of this category does: never fabricate candidate information, never promise an interview, no fake ATS scores.',
      impact: [
        { pre: '21', em: 'modules', l: '54 migrations · 96 test files' },
        { v: 'Your Gmail', l: 'Send-only, you approve' },
        { v: 'Arabic-first', l: 'RTL by default, /ar' },
      ],
      highlights: [
        'Explainable matches — including what it could not verify',
        'Queued sending from your own Gmail with skip rules',
        'Append-only credit ledger · Telegram delivery notices',
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
    applyni: {
      role: 'منفردًا — المنتج والهندسة والتشغيل',
      tag: 'وكيل مهني بالذكاء الاصطناعي، سعودي أولًا — يقرأ سيرتك، ويجد الشركات التي تناسبك فعلًا، ويرسل من بريدك أنت.',
      labels: ['العربية', 'الإنجليزية'],
      problem: 'الباحثون عن عمل في الخليج يرسلون السيرة نفسها إلى كل إعلان ولا يصلهم ردّ. والأدوات التي تَعِد بحلّ ذلك تُؤتمت الرشّ العشوائي في معظمها، ثم تُلبسه درجات توافق ونِسَب مُختلَقة لا تفسّر شيئًا.',
      solution: 'وكيل بُني ليفعل عكس الكمّ. يقرأ سيرتك، ويطابقك مع شركات سعودية، ويشرح كل مطابقة بالكلمات — بما في ذلك ما لم يستطع التحقق منه، فالمطابقة الضعيفة تقول ذلك بدل أن تختبئ خلف رقم. يجهّز لك الرسائل، وأنت تراجعها، ثم تُرسل من بريدك أنت في طابور بقواعد تخطٍّ. لا شيء يخرج دون موافقتك، والمواصفة تمنع ما تفعله معظم هذه الفئة: لا اختلاق لمعلومات المرشّح، ولا وعد بمقابلة، ولا درجات ATS وهمية.',
      impact: [
        { pre: '٢١', em: 'وحدة', l: '٥٤ هجرة قاعدة بيانات · ٩٦ ملف اختبار' },
        { v: 'بريدك أنت', l: 'إرسال فقط، بموافقتك' },
        { v: 'العربية أولًا', l: 'اتجاه RTL افتراضيًا، /ar' },
      ],
      highlights: [
        'مطابقات مشروحة — بما في ذلك ما تعذّر التحقق منه',
        'إرسال في طابور من بريدك أنت مع قواعد تخطٍّ',
        'سجلّ أرصدة إضافي فقط · إشعارات تسليم على تيليجرام',
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
    applyni: {
      role: 'Allein — Produkt, Engineering und Betrieb',
      tag: 'KI-Karriereagent, Saudi-first — liest Ihren Lebenslauf, findet Unternehmen, zu denen Sie wirklich passen, und versendet aus Ihrem eigenen Gmail.',
      labels: ['Arabisch', 'Englisch'],
      problem: 'Bewerber am Golf schicken denselben Lebenslauf an jede Ausschreibung und hören nichts zurück. Die Tools, die das beheben wollen, automatisieren meist genau dieses Gießkannenprinzip — verkleidet mit erfundenen ATS-Scores und Match-Prozenten, die nichts erklären.',
      solution: 'Ein Agent, der das Gegenteil von Masse tut. Er liest den Lebenslauf, gleicht ihn mit saudischen Unternehmen ab und erklärt jede Übereinstimmung in Worten — einschließlich dessen, was er nicht verifizieren konnte, sodass eine schwache Übereinstimmung das auch sagt, statt sich hinter einer Zahl zu verstecken. Er entwirft die Ansprache, Sie prüfen sie, und versendet wird über eine Warteschlange mit Skip-Regeln aus Ihrem eigenen Gmail. Nichts geht ohne Ihre Freigabe raus, und die Spezifikation verbietet, was die meisten dieser Kategorie tun: keine erfundenen Bewerberangaben, kein Versprechen auf ein Interview, keine Fake-ATS-Scores.',
      impact: [
        { pre: '21', em: 'Module', l: '54 Migrationen · 96 Testdateien' },
        { v: 'Ihr Gmail', l: 'Nur Senden, Sie geben frei' },
        { v: 'Arabisch-first', l: 'RTL als Standard, /ar' },
      ],
      highlights: [
        'Erklärte Matches — inklusive dessen, was nicht verifizierbar war',
        'Versand aus dem eigenen Gmail über eine Queue mit Skip-Regeln',
        'Append-only-Guthabenkonto · Telegram-Zustellhinweise',
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
    applyni: {
      role: 'En solitario — producto, ingeniería y operación',
      tag: 'Agente de carrera con IA, pensado primero para Arabia Saudí — lee tu CV, encuentra empresas donde realmente encajas y envía desde tu propio Gmail.',
      labels: ['Árabe', 'Inglés'],
      problem: 'Quien busca trabajo en el Golfo manda el mismo CV a todas las ofertas y no recibe respuesta. Las herramientas que prometen arreglarlo automatizan sobre todo ese envío indiscriminado, y lo disfrazan con puntuaciones ATS inventadas y porcentajes de coincidencia que no explican nada.',
      solution: 'Un agente construido para hacer lo contrario del volumen. Lee tu CV, te compara con empresas saudíes y explica cada coincidencia con palabras — incluido lo que no ha podido verificar, de modo que una coincidencia débil lo dice en vez de esconderse tras un número. Redacta el mensaje, tú lo revisas, y se envía desde tu propio Gmail en una cola con reglas de omisión. Nada sale sin tu aprobación, y la especificación prohíbe lo que hace casi toda la categoría: nunca inventar información del candidato, nunca prometer una entrevista, ninguna puntuación ATS falsa.',
      impact: [
        { pre: '21', em: 'módulos', l: '54 migraciones · 96 archivos de test' },
        { v: 'Tu Gmail', l: 'Solo envío, tú apruebas' },
        { v: 'Árabe primero', l: 'RTL por defecto, /ar' },
      ],
      highlights: [
        'Coincidencias explicadas — incluido lo que no pudo verificar',
        'Envío en cola desde tu propio Gmail con reglas de omisión',
        'Libro de créditos solo-añadir · avisos de entrega por Telegram',
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
    applyni: {
      role: 'En solo — produit, ingénierie et exploitation',
      tag: 'Agent de carrière IA pensé d’abord pour l’Arabie saoudite — il lit votre CV, trouve les entreprises où vous correspondez vraiment, et envoie depuis votre propre Gmail.',
      labels: ['Arabe', 'Anglais'],
      problem: 'Les candidats du Golfe envoient le même CV à toutes les offres et n’obtiennent aucune réponse. Les outils censés régler cela automatisent surtout cet arrosage, puis l’habillent de scores ATS inventés et de pourcentages de correspondance qui n’expliquent rien.',
      solution: 'Un agent conçu pour faire l’inverse du volume. Il lit votre CV, vous rapproche d’entreprises saoudiennes et explique chaque correspondance avec des mots — y compris ce qu’il n’a pas pu vérifier, de sorte qu’une correspondance faible le dit au lieu de se cacher derrière un chiffre. Il rédige l’approche, vous la relisez, puis l’envoi part de votre propre Gmail dans une file avec des règles d’exclusion. Rien ne part sans votre accord, et la spécification interdit ce que fait la plupart de cette catégorie : jamais inventer d’information sur le candidat, jamais promettre un entretien, aucun score ATS factice.',
      impact: [
        { pre: '21', em: 'modules', l: '54 migrations · 96 fichiers de test' },
        { v: 'Votre Gmail', l: 'Envoi seul, vous validez' },
        { v: 'Arabe d’abord', l: 'RTL par défaut, /ar' },
      ],
      highlights: [
        'Correspondances expliquées — y compris ce qui n’a pas pu être vérifié',
        'Envoi en file depuis votre propre Gmail, avec règles d’exclusion',
        'Registre de crédits en ajout seul · avis de livraison par Telegram',
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
    (base.shotSrc ? `    shotSrc: ${q(base.shotSrc)},\n` : '') +
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

    // 1. Add each new case, or REGENERATE it if it is already there. Appending
    //    only when missing would mean a case, once applied, could never be
    //    corrected — editing its copy or adding a screenshot would be silently
    //    ignored on every subsequent run, which is exactly what happened when
    //    Applyni's shotSrc was added. Regenerating makes the data above the
    //    single source of truth, and stays idempotent because the generated
    //    text is deterministic.
    //
    //    Keyed on the name line at case-object indentation — not on shotSrc,
    //    which not every case has, and not on the bare name, which for Proven
    //    Group also appears in the brand-wall array (one line, two-space
    //    indent, so the leading newline excludes it).
    for (const key of ['proven', 'ibdaa', 'applyni']) {
      const marker = `\n    name: ${q(NEW_CASES[key].name)},\n`;
      const at = entries.findIndex((e) => e.includes(marker));
      if (at < 0) entries.push(caseObject(key, loc));
      else entries[at] = caseObject(key, loc);
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

// ── Launchpad: a three-week slice, not a four-to-eight-week one ──────────────
// The packages contradicted each other. Partner is $3,500 for 40 reserved hours
// (~$88/hr) and $6,000 for 80 (~$75/hr), while Launchpad was $9,000 for a slice
// the Services section described as taking "4–8 weeks" — 160 to 320 hours, or
// $28–56/hr. So the flagship build was quietly the cheapest way to buy his time,
// by a wide margin, and at the long end it wasn't senior money in any market.
//
// The fix is the scope, not the price. Three weeks at $9,000 lands at ~$75/hr,
// which is exactly the 80-hour block rate — the three tiers now tell one
// consistent story. Tightening the window (rather than raising the price) also
// keeps the number unchanged while there is no social proof yet, and makes
// "one slice, not the whole product" concrete: three weeks is a far easier
// commitment for a stranger to say yes to than eight.
//
// The duration appears in three places per locale — the pricing card's note
// line, the Services item (prose + tag), and a FAQ answer — and all three have
// to move together or the page argues with itself.
const WEEKS_COPY = {
  en: {
    noteOld: 'note: "fixed scope · shipped to production"',
    noteNew: 'note: "fixed scope · 3 weeks · shipped to production"',
    proseOld: 'A defined slice shipped to production in 4–8 weeks: architecture',
    proseNew: 'A defined slice shipped to production in 3 weeks: architecture',
    tagOld: 'tags: ["4–8 weeks",',
    tagNew: 'tags: ["3 weeks",',
    faqOld: 'a: "Most start as a 4–8 week scoped build — a defined slice',
    faqNew: 'a: "Most start as a 3-week scoped build — a defined slice',
  },
  ar: {
    noteOld: 'note: "نطاق ثابت · مُطلق في الإنتاج"',
    noteNew: 'note: "نطاق ثابت · ٣ أسابيع · مُطلق في الإنتاج"',
    proseOld: 'شريحة محدّدة تُطلق في الإنتاج خلال ٤–٨ أسابيع: معمارية',
    proseNew: 'شريحة محدّدة تُطلق في الإنتاج خلال ٣ أسابيع: معمارية',
    tagOld: 'tags: ["٤–٨ أسابيع",',
    tagNew: 'tags: ["٣ أسابيع",',
    faqOld: 'a: "معظمها يبدأ كبناء محدّد النطاق من ٤–٨ أسابيع — شريحة محدّدة',
    faqNew: 'a: "معظمها يبدأ كبناء محدّد النطاق من ٣ أسابيع — شريحة محدّدة',
  },
  de: {
    noteOld: 'note: "fester Umfang · in Produktion gebracht"',
    noteNew: 'note: "fester Umfang · 3 Wochen · in Produktion gebracht"',
    proseOld: 'Eine definierte Scheibe in 4–8 Wochen in Produktion gebracht: Architektur',
    proseNew: 'Eine definierte Scheibe in 3 Wochen in Produktion gebracht: Architektur',
    tagOld: 'tags: ["4–8 Wochen",',
    tagNew: 'tags: ["3 Wochen",',
    faqOld: 'a: "Die meisten beginnen als 4–8-wöchiger Festumfang-Build — eine definierte',
    faqNew: 'a: "Die meisten beginnen als 3-wöchiger Festumfang-Build — eine definierte',
  },
  es: {
    noteOld: 'note: "alcance cerrado · llevado a producción"',
    noteNew: 'note: "alcance cerrado · 3 semanas · llevado a producción"',
    proseOld: 'Un corte definido llevado a producción en 4–8 semanas: arquitectura',
    proseNew: 'Un corte definido llevado a producción en 3 semanas: arquitectura',
    tagOld: 'tags: ["4–8 semanas",',
    tagNew: 'tags: ["3 semanas",',
    faqOld: 'a: "La mayoría empieza como un proyecto acotado de 4–8 semanas — un corte definido',
    faqNew: 'a: "La mayoría empieza como un proyecto acotado de 3 semanas — un corte definido',
  },
  fr: {
    noteOld: 'note: "périmètre fixe · livré en production"',
    noteNew: 'note: "périmètre fixe · 3 semaines · livré en production"',
    proseOld: 'Une tranche définie livrée en production en 4 à 8 semaines : architecture',
    proseNew: 'Une tranche définie livrée en production en 3 semaines : architecture',
    tagOld: 'tags: ["4–8 semaines",',
    tagNew: 'tags: ["3 semaines",',
    faqOld: 'a: "La plupart commencent par un projet cadré de 4 à 8 semaines — une tranche définie',
    faqNew: 'a: "La plupart commencent par un projet cadré de 3 semaines — une tranche définie',
  },
};

const WEEKS_EDITS = ['en', 'ar', 'de', 'es', 'fr'].flatMap((loc) => {
  const file = loc === 'en' ? 'index.html' : `index.${loc}.html`;
  const c = WEEKS_COPY[loc];
  return [
    ['Launchpad card note', c.noteOld, c.noteNew],
    ['Services prose', c.proseOld, c.proseNew],
    ['Services tag', c.tagOld, c.tagNew],
    // ['FAQ answer', …] removed: that FAQ item moved to /services, so this
    // edit could never match again and would fail on every run.
  ].map(([what, old, next]) => ({
    file,
    label: `3-week slice: ${what} (${loc})`,
    // Every one of these replaces the duration in place, so the old text cannot
    // survive its own replacement and the default marker (the new text) is
    // exactly right — no appliedMarker needed.
    old,
    new: next,
  }));
});

// ── Free demo: step zero of the value ladder ────────────────────────────────
// The ladder started at $1,200, which is the right entry price but still a
// price — and with no testimonials yet, the first ask is the hardest one. This
// puts a free rung underneath it.
//
// It is not a giveaway invented for the page. Reform, DIGIT, ITQAN and Ofoq were
// all built before anyone commissioned them: the work already happens, it just
// happens speculatively and unattached to a named prospect. Formalising it costs
// nothing extra and converts far better, because now the same effort arrives
// with a booked call and a real person on the other end.
//
// The scope guards are the whole point — without them this eats every week.
// One screen, five days, two slots a month, matching the "2 slots" the header
// badge already advertises.
//
// It renders as a band ABOVE `.price-grid`, not as a fourth card: the grid is
// `repeat(3,1fr)`, so a fourth tier would break the layout at every breakpoint.
// Reuses `.price-card` (border, radius, elevation, hover, spotlight all come
// free) with a row direction, so it reads as part of the same system.
const DEMO_COPY = {
  en: {
    badge: 'Start free',
    name: 'See it before you buy it.',
    tag: 'One real screen of your product, built and deployed — free.',
    feats: [
      'One screen or one page, genuinely built — not a mockup',
      'Deployed to a live URL you can open, share and test',
      'Five business days · two slots a month',
      'No obligation — stop there and you owe nothing',
    ],
    cta: 'Book a free demo',
    note: 'The concepts above were built before anyone asked. This just books it first.',
  },
  ar: {
    badge: 'ابدأ مجانًا',
    name: 'شاهده قبل أن تدفع.',
    tag: 'شاشة حقيقية واحدة من منتجك، مبنية ومنشورة — مجانًا.',
    feats: [
      'شاشة واحدة أو صفحة واحدة، مبنية فعلًا — لا مجرد تصميم',
      'منشورة على رابط حيّ تفتحه وتشاركه وتجرّبه',
      'خمسة أيام عمل · مقعدان شهريًا',
      'بلا التزام — إن توقّفت هنا فلا شيء عليك',
    ],
    cta: 'احجز عرضًا مجانيًا',
    note: 'المفاهيم أعلاه بُنيت قبل أن يطلبها أحد. هذا فقط يحجزها أولًا.',
  },
  de: {
    badge: 'Kostenlos starten',
    name: 'Erst sehen, dann kaufen.',
    tag: 'Ein echter Screen Ihres Produkts, gebaut und deployed — kostenlos.',
    feats: [
      'Ein Screen oder eine Seite, wirklich gebaut — kein Mockup',
      'Deployed auf eine Live-URL, die Sie öffnen, teilen und testen können',
      'Fünf Werktage · zwei Plätze pro Monat',
      'Unverbindlich — wer hier aufhört, schuldet nichts',
    ],
    cta: 'Kostenlose Demo buchen',
    note: 'Die Konzepte oben entstanden, bevor jemand danach fragte. Das hier bucht es nur vorher.',
  },
  es: {
    badge: 'Empieza gratis',
    name: 'Míralo antes de comprarlo.',
    tag: 'Una pantalla real de tu producto, construida y desplegada — gratis.',
    feats: [
      'Una pantalla o una página, construida de verdad — no una maqueta',
      'Desplegada en una URL en vivo que puedes abrir, compartir y probar',
      'Cinco días hábiles · dos plazas al mes',
      'Sin compromiso — si lo dejas ahí, no debes nada',
    ],
    cta: 'Reservar una demo gratis',
    note: 'Los conceptos de arriba se construyeron antes de que nadie los pidiera. Esto solo lo reserva primero.',
  },
  fr: {
    badge: 'Commencer gratuitement',
    name: 'Voyez-le avant de l’acheter.',
    tag: 'Un écran réel de votre produit, construit et déployé — gratuitement.',
    feats: [
      'Un écran ou une page, réellement construit — pas une maquette',
      'Déployé sur une URL en ligne que vous pouvez ouvrir, partager et tester',
      'Cinq jours ouvrés · deux places par mois',
      'Sans engagement — si vous vous arrêtez là, vous ne devez rien',
    ],
    cta: 'Réserver une démo gratuite',
    note: 'Les concepts ci-dessus ont été construits avant que quiconque ne les demande. Ceci ne fait que les réserver d’abord.',
  },
};

// A form, not a calendar. A call is the wrong first ask for a free offer: it
// asks for a slot in someone's day before they have decided anything, and a
// no-show leaves nothing behind. The form captures name, email, phone and what
// they want built even from people who never book — and a phone number is worth
// more here than a calendar invite, because it is the follow-up channel that
// actually works in this market.
const DEMO_URL = '/demo.html';

function freeDemoBand(loc) {
  const c = DEMO_COPY[loc];

  return (
    '        <div className="price-card" style={{marginBottom:18,flexDirection:"row",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:32}}>\n' +
    '          <span className="price-badge">' + jsxText(c.badge) + '</span>\n' +
    '          <div style={{flex:"1 1 440px",minWidth:0}}>\n' +
    '            <h3 className="price-name">' + jsxText(c.name) + '</h3>\n' +
    '            <p className="price-tag">' + jsxText(c.tag) + '</p>\n' +
    // Two columns. `.price-feats` is a one-column grid sized for a narrow tier
    // card; stretched across this band, each row is far wider than its text, so
    // the tick and its line end up separated by a gap of dead space — very
    // visible in Arabic, where the text right-aligns away from the tick. Two
    // columns bring the two back together and use the width instead of padding
    // it. Collapses to one column below 720px.
    '            <ul className="price-feats" style={{marginTop:18,gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",columnGap:26}}>\n' +
    c.feats
      .map(
        (f) =>
          '              <li><span className="price-check" aria-hidden="true">✓</span>' +
          jsxText(f) +
          '</li>\n'
      )
      .join('') +
    '            </ul>\n' +
    '          </div>\n' +
    '          <div style={{flex:"0 1 300px"}}>\n' +
    '            <a className="btn btn-primary price-cta" style={{marginTop:0}} href="' + DEMO_URL + '">' +
    jsxText(c.cta) + ' <span className="arr">→</span></a>\n' +
    '            <p className="price-note">' + jsxText(c.note) + '</p>\n' +
    '          </div>\n' +
    '        </div>\n'
  );
}

// Installed by a transform, not an anchored insert. An insert can only ever ADD
// the band: once it is in the file the appliedMarker matches and every later
// change to the markup — a spacing fix, a reworded bullet — is silently skipped.
// That has now bitten three separate edits in this file. The transform instead
// replaces whatever currently sits between the section head and the grid with
// the freshly generated band, so the data above stays the single source of
// truth and the result converges however many times it runs.
const GRID_OPEN = '        <div className="price-grid">';
const HEAD_CLOSE = '        />\n';

function installDemoBand(loc) {
  return (text) => {
    const grid = text.indexOf(GRID_OPEN);
    if (grid < 0) return null;
    // The section head's self-closing tag is the last one before the grid;
    // everything between the two is the band (or nothing, on a fresh export).
    const head = text.lastIndexOf(HEAD_CLOSE, grid);
    if (head < 0) return null;
    const between = text.slice(head + HEAD_CLOSE.length, grid);
    // Only rewrite a gap that is empty or holds a band we generated. Anything
    // else means a future export put something there, and it must not be eaten.
    if (between !== '' && !between.includes('className="price-badge"')) return text;
    return text.slice(0, head + HEAD_CLOSE.length) + freeDemoBand(loc) + text.slice(grid);
  };
}

const DEMO_EDITS = ['en', 'ar', 'de', 'es', 'fr'].map((loc) => ({
  file: loc === 'en' ? 'index.html' : `index.${loc}.html`,
  label: `free demo band (${loc})`,
  anchor: GRID_OPEN,
  transform: installDemoBand(loc),
}));

// ── Removed: "lead with the free offer" ────────────────────────────────────
// The hero used to lead with the free demo, on the reasoning that the
// lowest-commitment offer should be the first ask. That was correct while the
// site's job was winning clients. The job is now a senior role in Dubai, so
// the hero leads with "Get in touch" instead (see HERO_CTA_EDITS).
//
// The old transform is deleted rather than disabled: left in place it fought
// the new one, rewriting the hero back to the demo on every run while the new
// edit rewrote it forward — the two never converged and `apply` never reached
// a fixed point. The free demo is still offered in the pricing section.

// ── Based in Dubai, not Cairo ───────────────────────────────────────────────
// Changes where Ahmed says HE is. It deliberately does not touch two other
// kinds of Cairo/Egypt mention, which are facts about other things:
//
//   • Past roles — `loc: "Cairo · Hybrid"` on Almentor, Arab Bank and Compass
//     Med. He genuinely worked those from Cairo; rewriting them would falsify
//     his own history. Every swap below is written so it cannot match a
//     `loc:` value.
//   • Clients — "Egypt" in the FAQ answer about where clients are based, and
//     Cairo Plaza, a New Cairo property developer. Those stay.
//
// The timezone moves with him: Cairo is GMT+2, Dubai is GMT+4. A contact card
// still claiming GMT+2 would have people calling two hours wrong.
const CITY_SWAPS = {
  en: [
    ['Cairo, Egypt 🇪🇬', 'Dubai, United Arab Emirates 🇦🇪'],
    ['Cairo 🇪🇬', 'Dubai 🇦🇪'],
    ['Cairo-based', 'Dubai-based'],
    ['from Cairo,', 'from Dubai,'],
    ['Cairo time', 'Gulf time'],
    ['Cairo, Egypt ·', 'Dubai, United Arab Emirates ·'],
    ['>Cairo · Remote · GMT+2<', '>Dubai · Remote · GMT+4<'],
  ],
  ar: [
    ['القاهرة، مصر 🇪🇬', 'دبي، الإمارات العربية المتحدة 🇦🇪'],
    ['القاهرة 🇪🇬', 'دبي 🇦🇪'],
    ['مقيم في القاهرة', 'مقيم في دبي'],
    ['من القاهرة،', 'من دبي،'],
    ['بتوقيت القاهرة', 'بتوقيت الخليج'],
    ['القاهرة، مصر ·', 'دبي، الإمارات العربية المتحدة ·'],
    ['>القاهرة · عن بُعد · GMT+2<', '>دبي · عن بُعد · GMT+4<'],
  ],
  de: [
    ['Kairo, Ägypten 🇪🇬', 'Dubai, Vereinigte Arabische Emirate 🇦🇪'],
    ['Kairo 🇪🇬', 'Dubai 🇦🇪'],
    ['mit Sitz in Kairo', 'mit Sitz in Dubai'],
    ['Mit Sitz in Kairo', 'Mit Sitz in Dubai'],
    ['aus Kairo,', 'aus Dubai,'],
    ['Kairoer Zeit', 'Golf-Zeit'],
    ['Kairo, Ägypten ·', 'Dubai, Vereinigte Arabische Emirate ·'],
    ['>Kairo · Remote · GMT+2<', '>Dubai · Remote · GMT+4<'],
  ],
  es: [
    ['El Cairo, Egipto 🇪🇬', 'Dubái, Emiratos Árabes Unidos 🇦🇪'],
    ['El Cairo 🇪🇬', 'Dubái 🇦🇪'],
    ['afincado en El Cairo', 'afincado en Dubái'],
    ['Afincado en El Cairo', 'Afincado en Dubái'],
    ['desde El Cairo,', 'desde Dubái,'],
    ['horario de El Cairo', 'horario del Golfo'],
    ['El Cairo, Egipto ·', 'Dubái, Emiratos Árabes Unidos ·'],
    ['>El Cairo · Remoto · GMT+2<', '>Dubái · Remoto · GMT+4<'],
  ],
  fr: [
    ['Le Caire, Égypte 🇪🇬', 'Dubaï, Émirats arabes unis 🇦🇪'],
    ['Le Caire 🇪🇬', 'Dubaï 🇦🇪'],
    ['basé au Caire', 'basé à Dubaï'],
    ['Basé au Caire', 'Basé à Dubaï'],
    ['depuis Le Caire,', 'depuis Dubaï,'],
    ["l'heure du Caire", "l'heure du Golfe"],
    ['Le Caire, Égypte ·', 'Dubaï, Émirats arabes unis ·'],
    ['>Le Caire · Distanciel · GMT+2<', '>Dubaï · Distanciel · GMT+4<'],
  ],
};

const CITY_EDITS = ['en', 'ar', 'de', 'es', 'fr'].map((loc) => ({
  file: loc === 'en' ? 'index.html' : `index.${loc}.html`,
  label: `based in Dubai (${loc})`,
  anchor: 'className="tag-full"',
  transform: (text) => {
    let out = text;
    for (const [from, to] of CITY_SWAPS[loc]) out = out.split(from).join(to);
    // Idempotent by construction: once applied, none of the `from` strings
    // remain, so a second run is a no-op and reports "already applied".
    return out;
  },
}));

// The `<head>` is not in the manifest — it lives in the `__bundler/template`
// line, which is what crawlers and social unfurls read before React ever runs.
// So the city has to be swapped there too, or search results keep saying Cairo
// long after the page says Dubai.
//
// The untranslated tail ("across the Gulf, US, and UK.") in the ar/de/es/fr
// meta descriptions is a separate, pre-existing defect in the same sentence —
// fixed here rather than left half-English in four languages.
// The <title> is the one string that decides whether a commercial search can
// ever reach him. "Ahmed Farid — Senior Software Engineer" only wins searches
// for his own name; adding the city makes "senior software engineer dubai"
// reachable, which is the shape of query that actually carries hiring intent.
//
// Kept at ~47 characters so Google renders it whole — the specialty keywords
// (multi-tenant SaaS, real-time platforms) live in the meta description, which
// has the room for them.
const TITLES = {
  en: ['Ahmed Farid — Senior Software Engineer', 'Ahmed Farid — Senior Software Engineer in Dubai'],
  ar: ['Ahmed Farid — مهندس برمجيات أول', 'Ahmed Farid — مهندس برمجيات أول في دبي'],
  de: ['Ahmed Farid — Senior-Softwareentwickler', 'Ahmed Farid — Senior-Softwareentwickler in Dubai'],
  es: ['Ahmed Farid — Ingeniero de Software Senior', 'Ahmed Farid — Ingeniero de Software Senior en Dubái'],
  fr: ['Ahmed Farid — Ingénieur logiciel senior', 'Ahmed Farid — Ingénieur logiciel senior à Dubaï'],
};

const HEAD_SWAPS = {
  en: [
    ['based in Cairo, open to relocation.', 'based in Dubai, open to relocation.'],
  ],
  ar: [
    ['مقيم في القاهرة، مستعدّ للانتقال.', 'مقيم في دبي، مستعدّ للانتقال.'],
    ['وتطبيقات جوّال across the Gulf, US, and UK.', 'وتطبيقات جوّال عبر الخليج والولايات المتحدة والمملكة المتحدة.'],
  ],
  de: [
    ['mit Sitz in Kairo, umzugsbereit.', 'mit Sitz in Dubai, umzugsbereit.'],
    ['mobilen Apps across the Gulf, US, and UK.', 'mobilen Apps für Kunden am Golf, in den USA und in Großbritannien.'],
  ],
  es: [
    ['afincado en El Cairo, abierto a reubicación.', 'afincado en Dubái, abierto a reubicación.'],
    ['apps móviles across the Gulf, US, and UK.', 'apps móviles para clientes del Golfo, EE. UU. y Reino Unido.'],
  ],
  fr: [
    ['basé au Caire, ouvert à la mobilité.', 'basé à Dubaï, ouvert à la mobilité.'],
    ['applications mobiles across the Gulf, US, and UK.', 'applications mobiles pour des clients du Golfe, des États-Unis et du Royaume-Uni.'],
  ],
};

// Applies to every locale: the JSON-LD Person block. Nationality stays
// Egyptian — that is a fact about him; the address is the hiring signal.
const HEAD_SWAPS_ALL = [
  ['"addressLocality": "Cairo", "addressCountry": "EG"', '"addressLocality": "Dubai", "addressCountry": "AE"'],
];

// ── Two WhatsApp numbers ────────────────────────────────────────────────────
// A Gulf client seeing only a +20 number reads "offshore, different country".
// The UAE number goes first because that is where he now is; the Egyptian one
// stays because it is the number his existing contacts already have.
//
// Only the label, handle and href change — the card's own `desc` and inline SVG
// come from whatever the locale already has, so the icon and translated copy
// are carried over rather than re-authored here.
const WA_UAE = { handle: '+971 58 556 2001', href: 'https://wa.me/971585562001' };
const WA_COPY = {
  en: { uae: 'WhatsApp · UAE', eg: 'WhatsApp · Egypt', egDesc: 'Same person, Egyptian number.' },
  ar: { uae: 'WhatsApp · الإمارات', eg: 'WhatsApp · مصر', egDesc: 'نفس الشخص، رقم مصري.' },
  de: { uae: 'WhatsApp · VAE', eg: 'WhatsApp · Ägypten', egDesc: 'Dieselbe Person, ägyptische Nummer.' },
  es: { uae: 'WhatsApp · EAU', eg: 'WhatsApp · Egipto', egDesc: 'La misma persona, número egipcio.' },
  fr: { uae: 'WhatsApp · EAU', eg: 'WhatsApp · Égypte', egDesc: 'La même personne, numéro égyptien.' },
};

function splitWhatsApp(loc) {
  const c = WA_COPY[loc];
  return (text) => {
    // Already applied: the single generic card is gone, both labelled ones are
    // present. Returning the text unchanged reports "already applied" instead
    // of failing.
    if (text.includes(`name: ${q(c.uae)}`) && text.includes(`name: ${q(c.eg)}`)) return text;

    const at = text.indexOf('name: "WhatsApp",');
    if (at < 0) return null;
    const start = text.lastIndexOf('\n    {\n', at);
    const endTok = '\n    },\n';
    const end = text.indexOf(endTok, at);
    if (start < 0 || end < 0) return null;
    const entry = text.slice(start, end + endTok.length);
    if (!entry.includes('href: "https://wa.me/')) return null;

    const uae = entry
      .replace('name: "WhatsApp",', `name: ${q(c.uae)},`)
      .replace(/handle: "[^"]*",/, `handle: ${q(WA_UAE.handle)},`)
      .replace(/href: "https:\/\/wa\.me\/[^"]*",/, `href: ${q(WA_UAE.href)},`);
    const eg = entry
      .replace('name: "WhatsApp",', `name: ${q(c.eg)},`)
      .replace(/desc: "[^"]*",/, `desc: ${q(c.egDesc)},`);

    return text.slice(0, start) + uae + eg.replace(/^\n/, '') + text.slice(end + endTok.length);
  };
}

const WHATSAPP_EDITS = ['en', 'ar', 'de', 'es', 'fr'].map((loc) => ({
  file: loc === 'en' ? 'index.html' : `index.${loc}.html`,
  label: `WhatsApp: UAE + Egypt (${loc})`,
  anchor: 'https://wa.me/',
  transform: splitWhatsApp(loc),
}));

const HEAD_EDITS = ['en', 'ar', 'de', 'es', 'fr'].map((loc) => ({
  file: loc === 'en' ? 'index.html' : `index.${loc}.html`,
  label: `head: based in Dubai (${loc})`,
  template: true,
  transform: (text) => {
    let out = text;
    for (const [from, to] of [
      ...HEAD_SWAPS[loc], ...HEAD_SWAPS_ALL,
      YEARS_HEAD[loc], RELOCATION_HEAD[loc], PERSON_URL_HEAD,
    ]) {
      out = out.split(from).join(to);
    }
    // The title appears three times — <title>, og:title, twitter:title — and
    // all three must agree, or the social unfurl says something the tab does
    // not. Anchored on the delimiter so this cannot match the new title's own
    // substring and append the city twice.
    const [oldTitle, newTitle] = TITLES[loc];
    for (const [from, to] of [
      [`<title>${oldTitle}<`, `<title>${newTitle}<`],
      [`og:title" content="${oldTitle}"`, `og:title" content="${newTitle}"`],
      [`twitter:title" content="${oldTitle}"`, `twitter:title" content="${newTitle}"`],
    ]) {
      out = out.split(from).join(to);
    }
    return out;
  },
}));

// ── OpenAI / ChatGPT Ads measurement pixel ──────────────────────────────────
// Installed on every page so the account accumulates history from now on,
// whether or not a campaign ever runs. The `debug: true` from the Ads Manager
// snippet is deliberately dropped: it logs SDK chatter to the console, and the
// people most likely to open devtools on this site are the engineers he wants
// to impress.
//
// Page views only. The one conversion worth counting — a demo request — fires
// from demo.html's success state, not from a submit handler, so it counts
// deliveries rather than attempts.
const PIXEL_ID = '9ceAHjhY9TXnV8VVdRpZEx';
const PIXEL_TAG =
  '<script>!function(w,d,s,u){if(w.oaiq)return;var q=function(){q.q.push(arguments)};' +
  'q.q=[];w.oaiq=q;var j=d.createElement(s);j.async=1;j.src=u;var f=d.getElementsByTagName(s)[0];' +
  'f.parentNode.insertBefore(j,f)}(window,document,"script","https://bzrcdn.openai.com/sdk/oaiq.min.js");' +
  `oaiq("init",{pixelId:"${PIXEL_ID}"});</script>`;

const PIXEL_EDITS = ['en', 'ar', 'de', 'es', 'fr'].map((loc) => ({
  file: loc === 'en' ? 'index.html' : `index.${loc}.html`,
  label: `head: ChatGPT Ads pixel (${loc})`,
  template: true,
  transform: (text) => {
    // Self-consuming by the pixel id: once installed the guard matches and the
    // transform is a no-op, so a second run reports "already applied".
    if (text.includes(PIXEL_ID)) return text;
    const anchor = '<meta charset="utf-8">';
    if (!text.includes(anchor)) return null;
    return text.replace(anchor, `${anchor}\n  ${PIXEL_TAG}`);
  },
}));

const LOCALES = ['en', 'ar', 'de', 'es', 'fr'];
const fileFor = (loc) => (loc === 'en' ? 'index.html' : `index.${loc}.html`);

// Builds one bundle edit per locale from a {loc: [old, new]} table. Every edit
// produced here is `critical` — each one corrects a statement of fact, so a
// re-export that stops it matching must break the build rather than quietly
// restore the old claim.
//
// Matching is whitespace-flexible: the export wraps prose across lines at
// arbitrary points, so an exact-string match breaks the moment a re-export
// re-wraps a sentence. Every run of whitespace in the search text matches any
// run of whitespace in the source.
const rxEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const flexible = (s) => new RegExp(s.trim().split(/\s+/).map(rxEscape).join('\\s+'), 'g');

function factEdits(label, table, extra = {}) {
  return LOCALES.filter((loc) => table[loc]).map((loc) => {
    const [from, to] = table[loc];
    const lead = /^\s/.test(from) ? '\\s*' : '';
    const rx = new RegExp(lead + flexible(from).source, 'g');
    return {
      file: fileFor(loc),
      label: `${label} (${loc})`,
      critical: true,
      // Stable across every edit here: they all live in the one bundled app
      // asset, and none of them touches this class name.
      anchor: 'className="about-p"',
      transform: (text) => {
        if (rx.test(text)) { rx.lastIndex = 0; return text.replace(rx, to); }
        rx.lastIndex = 0;
        // Not matched. Either already applied, or the export moved and this
        // correction is now silently dropped — which for a `critical` edit
        // must fail. A non-empty replacement is detectable, so check for it.
        // Pure removals have nothing to look for; those rely on the other
        // critical edits in the same group to catch a re-export.
        if (to === '' || text.includes(to.trim())) return text;
        return null;
      },
      ...extra,
    };
  });
}

// ── Six years, not five ─────────────────────────────────────────────────────
// He was first paid to write code in 2019. Three separate places said five —
// the hero line, the About stat, and the About paragraph — plus the meta
// description in the template and the llms.txt/JSON-LD copy in build.mjs.
const YEARS_EDITS = [
  ...factEdits('six years: hero line', {
    en: ['Five years shipping to production across the Gulf, the US, and the UK.',
         'Six years shipping to production across the Gulf, the US, and the UK.'],
    ar: ['خمس سنوات من الإطلاق في الإنتاج عبر الخليج والولايات المتحدة والمملكة المتحدة.',
         'ست سنوات من الإطلاق في الإنتاج عبر الخليج والولايات المتحدة والمملكة المتحدة.'],
    de: ['Fünf Jahre in Produktion im Golfraum, in den USA und in Großbritannien.',
         'Sechs Jahre in Produktion im Golfraum, in den USA und in Großbritannien.'],
    es: ['Cinco años llevando sistemas a producción en el Golfo, EE',
         'Seis años llevando sistemas a producción en el Golfo, EE'],
    fr: ['Cinq ans de mise en production dans le Golfe, aux États-Unis et au Royaume-Uni.',
         'Six ans de mise en production dans le Golfe, aux États-Unis et au Royaume-Uni.'],
  }),
  ...factEdits('six years: About stat', {
    en: ['v: "5+ yrs"', 'v: "6+ yrs"'],
    ar: ['v: "+٥ سنوات"', 'v: "+٦ سنوات"'],
    de: ['v: "5+ Jahre"', 'v: "6+ Jahre"'],
    es: ['v: "5+ años"', 'v: "6+ años"'],
    fr: ['v: "5+ ans"', 'v: "6+ ans"'],
  }),
  // The spec listed three occurrences; this is a fourth it missed. Left alone
  // the About paragraph would still open with "over the last five years".
  ...factEdits('six years: About paragraph', {
    en: ["Over the last five years I've built", "Over the last six years I've built"],
    ar: ['خلال السنوات الخمس الماضية', 'خلال السنوات الست الماضية'],
    de: ['In den letzten fünf Jahren', 'In den letzten sechs Jahren'],
    es: ['En los últimos cinco años', 'En los últimos seis años'],
    fr: ['Ces cinq dernières années', 'Ces six dernières années'],
  }),
];

// The meta description lives in the template, not the bundle.
const YEARS_HEAD = {
  en: ['Five years building multi-tenant SaaS', 'Six years building multi-tenant SaaS'],
  ar: ['خمس سنوات في بناء منصّات SaaS', 'ست سنوات في بناء منصّات SaaS'],
  de: ['Fünf Jahre Aufbau von Multi-Tenant-SaaS', 'Sechs Jahre Aufbau von Multi-Tenant-SaaS'],
  es: ['Cinco años construyendo SaaS multi-tenant', 'Seis años construyendo SaaS multi-tenant'],
  fr: ['Cinq ans à construire des SaaS multi-tenant', 'Six ans à construire des SaaS multi-tenant'],
};

// ── Remove the LinkedIn follower count ──────────────────────────────────────
// The number was true (27,034 on 12 Sep 2026). It comes down because it is the
// only claim on the site about an audience rather than about shipped work, and
// it invites arithmetic that does not flatter: best post in a month, 412
// impressions against 27k followers.
//
// Four places per locale, not the three the spec listed — the "notes" section
// carried a fourth mention.
const FOLLOWER_BLOCK_EDITS = LOCALES.map((loc) => ({
  file: fileFor(loc),
  label: `remove follower stat block (${loc})`,
  critical: true,
  // NOT `about-followers` — that is the thing being deleted, so using it as the
  // anchor makes the second run report "anchor not found" and fail the build.
  // The anchor has to be something the edit leaves behind.
  anchor: 'className="about-p"',
  transform: (text) => {
    // Self-consuming: once the block is gone the anchor is gone, and the guard
    // below returns the text untouched on any later run.
    const at = text.indexOf('<a className="about-followers"');
    if (at < 0) return text;
    // Delete the whole <Reveal_ab …> wrapper, not just the <a> — leaving an
    // empty animated wrapper would keep its vertical rhythm in the layout.
    const open = text.lastIndexOf('<Reveal_ab', at);
    const closeTok = '</Reveal_ab>';
    const close = text.indexOf(closeTok, at);
    if (open < 0 || close < 0) return null;
    let start = open;
    // Take the whitespace/newline before the block too, so the deletion does
    // not leave a blank indented line behind.
    const prevNl = text.lastIndexOf('\n', open - 1);
    if (prevNl >= 0 && text.slice(prevNl + 1, open).trim() === '') start = prevNl;
    return text.slice(0, start) + text.slice(close + closeTok.length);
  },
}));

const FOLLOWER_EDITS = [
  ...FOLLOWER_BLOCK_EDITS,
  ...factEdits('recommendations sub: drop follower count', {
    en: ['Recommendations from people who managed me directly — verified on LinkedIn, where 25,000+ follow my work.',
         'Recommendations from people who managed me directly, verified on LinkedIn.'],
    ar: ['توصيات من أشخاص أداروني مباشرةً — موثّقة على LinkedIn، حيث يتابع عملي ٢٥٬٠٠٠+.',
         'توصيات من أشخاص أداروني مباشرةً، موثّقة على LinkedIn.'],
    de: ['Empfehlungen von Personen, die mich direkt geführt haben — verifiziert auf LinkedIn, wo 25.000+ meiner Arbeit folgen.',
         'Empfehlungen von Personen, die mich direkt geführt haben, verifiziert auf LinkedIn.'],
    es: ['Recomendaciones de personas que me supervisaron directamente — verificadas en LinkedIn, donde 25.000+ siguen mi trabajo.',
         'Recomendaciones de personas que me supervisaron directamente, verificadas en LinkedIn.'],
    fr: ["Recommandations de personnes qui m'ont encadré directement — vérifiées sur LinkedIn, où 25 000+ suivent mon travail.",
         "Recommandations de personnes qui m'ont encadré directement, vérifiées sur LinkedIn."],
  }),
  ...factEdits('notes sub: drop follower count', {
    en: ['posted on LinkedIn where 25k+ people follow along.', 'posted on LinkedIn.'],
    ar: ['على LinkedIn حيث يتابع 25k+.', 'على LinkedIn.'],
    de: ['auf LinkedIn, wo 25k+ Menschen mitlesen.', 'auf LinkedIn.'],
    es: ['publicado en LinkedIn donde 25k+ personas me siguen.', 'publicado en LinkedIn.'],
    fr: ['publiés sur LinkedIn où 25k+ personnes me suivent.', 'publiés sur LinkedIn.'],
  }),
  // The connect card always renders a handle, so it gets the profile slug —
  // the same shape as the Behance card's "ahmedfarid20" — rather than being
  // blanked, which would leave a visibly empty line in the grid.
  ...factEdits('LinkedIn card: drop follower count', {
    en: ['handle: "25,000+ followers"', 'handle: "ahmed-farid"'],
    ar: ['handle: "٢٥٬٠٠٠+ متابع"', 'handle: "ahmed-farid"'],
    de: ['handle: "25.000+ Follower"', 'handle: "ahmed-farid"'],
    es: ['handle: "25.000+ seguidores"', 'handle: "ahmed-farid"'],
    fr: ['handle: "25 000+ abonnés"', 'handle: "ahmed-farid"'],
  }),
  ...factEdits('LinkedIn card desc: drop network size', {
    en: ['desc: "Career, recommendations & a 25K+ network."', 'desc: "Career history and recommendations."'],
    ar: ['desc: "المسيرة المهنية والتوصيات وشبكة تتجاوز ٢٥ ألفًا."', 'desc: "المسيرة المهنية والتوصيات."'],
    de: ['desc: "Karriere, Empfehlungen & ein Netzwerk von 25K+."', 'desc: "Karriere und Empfehlungen."'],
    es: ['desc: "Carrera, recomendaciones y una red de 25K+."', 'desc: "Carrera y recomendaciones."'],
    fr: ['desc: "Carrière, recommandations et un réseau de 25K+."', 'desc: "Carrière et recommandations."'],
  }),

  // Two more the spec's inventory missed, found by grepping the built output
  // rather than trusting the list: the writing-section CTA, and a service chip
  // that still offered relocation.
  ...factEdits('writing CTA: drop follower count', {
    en: ['25k+ followers · Read on LinkedIn', 'Read on LinkedIn'],
    ar: ['25k+ متابع · اقرأ على LinkedIn', 'اقرأ على LinkedIn'],
    de: ['25k+ Follower · Auf LinkedIn lesen', 'Auf LinkedIn lesen'],
    es: ['25k+ seguidores · Leer en LinkedIn', 'Leer en LinkedIn'],
    fr: ['25k+ abonnés · Lire sur LinkedIn', 'Lire sur LinkedIn'],
  }),
];

// ── Products shipped: 27, not 23 ────────────────────────────────────────────
// His count, not a tally of what the page displays — the site names 19
// projects, and the stat has always covered work that is not published here.
// Kept as "27+" to match every other stat on the row: a floor, not a precise
// figure, so it stays true as the number grows.
const PRODUCT_COUNT_EDITS = factEdits('products shipped: 27', {
  en: ['v: "23+", l: "Products built or shipped"', 'v: "27+", l: "Products built or shipped"'],
  ar: ['v: "+٢٣", l: "منتجًا تم بناؤه أو تسليمه"', 'v: "+٢٧", l: "منتجًا تم بناؤه أو تسليمه"'],
  de: ['v: "23+", l: "Produkte gebaut oder geliefert"', 'v: "27+", l: "Produkte gebaut oder geliefert"'],
  es: ['v: "23+", l: "Productos creados o entregados"', 'v: "27+", l: "Productos creados o entregados"'],
  fr: ['v: "23+", l: "Produits créés ou livrés"', 'v: "27+", l: "Produits créés ou livrés"'],
});

// ── Hero stats ──────────────────────────────────────────────────────────────
// The hero carries its own copy of the years and products numbers, separate
// from the About facts. It was missed the first time because the markup splits
// the value — `<em>5+</em> yrs` — so a grep for "5+ yrs" in the built output
// reports zero while the page still says five. Matched on the markup here, and
// the verification greps for the split form too.
const HERO_STAT_EDITS = [
  ...factEdits('hero: six years', {
    en: ['<em>5+</em> yrs', '<em>6+</em> yrs'],
    ar: ['<em>5+</em> سنوات', '<em>6+</em> سنوات'],
    de: ['<em>5+</em> Jahre', '<em>6+</em> Jahre'],
    es: ['<em>5+</em> años', '<em>6+</em> años'],
    fr: ['<em>5+</em> ans', '<em>6+</em> ans'],
  }),
  ...factEdits('hero: 27 products', {
    en: ['<div className="num">23+</div>\n              <div className="lbl">Products shipped & linked',
         '<div className="num">27+</div>\n              <div className="lbl">Products shipped & linked'],
    ar: ['<div className="num">+٢٣</div>\n              <div className="lbl">منتجًا تم تسليمه وربطه',
         '<div className="num">+٢٧</div>\n              <div className="lbl">منتجًا تم تسليمه وربطه'],
    de: ['<div className="num">23+</div>\n              <div className="lbl">Produkte geliefert & verlinkt',
         '<div className="num">27+</div>\n              <div className="lbl">Produkte geliefert & verlinkt'],
    es: ['<div className="num">23+</div>\n              <div className="lbl">Productos entregados y enlazados',
         '<div className="num">27+</div>\n              <div className="lbl">Productos entregados y enlazados'],
    fr: ['<div className="num">23+</div>\n              <div className="lbl">Produits livrés et liés',
         '<div className="num">27+</div>\n              <div className="lbl">Produits livrés et liés'],
  }),
];

// ── Yelo: Senior Software Engineer ──────────────────────────────────────────
// The CV and LinkedIn both say Senior for Yelo as of 12 Sep 2026; the site
// still said Software Engineer in two places, so the three sources contradicted
// each other. Only Yelo changed — every other case study keeps its label.
const YELO_TITLE_EDITS = [
  ...factEdits('Yelo eyebrow: Senior', {
    en: ['role: "Software Engineer · Gulf market (KSA)"', 'role: "Senior Software Engineer · Gulf market (KSA)"'],
    ar: ['role: "مهندس برمجيات · سوق الخليج (السعودية)"', 'role: "مهندس برمجيات أول · سوق الخليج (السعودية)"'],
    de: ['role: "Softwareentwickler · Golf-Markt (KSA)"', 'role: "Senior-Softwareentwickler · Golf-Markt (KSA)"'],
    es: ['role: "Ingeniero de Software · Mercado del Golfo (KSA)"', 'role: "Ingeniero de Software Senior · Mercado del Golfo (KSA)"'],
    fr: ['role: "Ingénieur logiciel · marché du Golfe (KSA)"', 'role: "Ingénieur logiciel senior · marché du Golfe (KSA)"'],
  }),
  ...factEdits('Yelo MY ROLE: Senior', {
    en: ['role: "Software Engineer — Laravel back-end, Next.js front-end, and the Flutter mobile app."',
         'role: "Senior Software Engineer — Laravel back-end, Next.js front-end, and the Flutter mobile app."'],
    ar: ['role: "مهندس برمجيات — الـ Backend بـ Laravel، والـ Frontend بـ Next.js، وتطبيق الجوّال بـ Flutter."',
         'role: "مهندس برمجيات أول — الـ Backend بـ Laravel، والـ Frontend بـ Next.js، وتطبيق الجوّال بـ Flutter."'],
    de: ['role: "Softwareentwickler — Laravel-Backend, Next.js-Frontend und die Flutter-Mobile-App."',
         'role: "Senior-Softwareentwickler — Laravel-Backend, Next.js-Frontend und die Flutter-Mobile-App."'],
    es: ['role: "Ingeniero de Software — back-end en Laravel, front-end en Next.js y la app móvil Flutter."',
         'role: "Ingeniero de Software Senior — back-end en Laravel, front-end en Next.js y la app móvil Flutter."'],
    fr: ["role: \"Ingénieur logiciel — back-end Laravel, front-end Next.js et l'app mobile Flutter.\"",
         "role: \"Ingénieur logiciel senior — back-end Laravel, front-end Next.js et l'app mobile Flutter.\""],
  }),
];

// ── Agentic SDLC ────────────────────────────────────────────────────────────
// The CV claims "Agentic SDLC — specs executed by coding agents, reviewed
// commit by commit" and the site said nothing about it, so a recruiter who
// read the line and looked found no trace of it.
//
// Written from how this repo is actually maintained, not from a description of
// how it might be: the audit-first rule, corrections living in the pipeline
// because the export replaces hand-edits, and the loud-failure gate — each of
// those is a mechanism in this file, not an aspiration.
//
// Deliberately NOT `critical`. If a re-export moves the markup this paragraph
// goes missing, which costs evidence; it does not put anything untrue on the
// page, and blocking a deploy over it would be disproportionate.
const SDLC_COPY = {
  en: "Most of my delivery now runs through coding agents, and the discipline lives in the "
    + "spec rather than the prompt: an audit pass against the real repository first, and where "
    + "the audit contradicts the plan, the audit wins. Corrections live in the build pipeline "
    + "instead of in edited files — generated sources get replaced, and a hand-edit "
    + "disappears without an error. Anything that asserts a fact fails the build the moment it "
    + "stops matching, because a deploy that quietly drops a correction is worse than one that "
    + "stops. Review is commit by commit, and it stays mine.",
  ar: "جزء كبير من التسليم عندي صار يمر عبر وكلاء برمجة، والانضباط في الـ spec لا في الـ prompt: "
    + "مراجعة تدقيق على المستودع الحقيقي أولاً، وحين يناقض التدقيق الخطة فالتدقيق هو الذي يفوز. "
    + "التصحيحات تعيش في خط البناء لا في ملفات مُعدَّلة يدويًا — المصادر المولَّدة تُستبدل، "
    + "والتعديل اليدوي يختفي بلا أي خطأ. وكل ما يقرِّر واقعة يُوقف البناء لحظة توقفه عن المطابقة، "
    + "لأن نشرة تُسقط تصحيحًا في صمت أسوأ من نشرة تتوقف. والمراجعة تتم commit بـ commit، وتبقى مسؤوليتي.",
  de: "Ein großer Teil meiner Auslieferung läuft inzwischen über Coding-Agents, und die "
    + "Disziplin steckt in der Spezifikation, nicht im Prompt: zuerst ein Audit gegen das echte "
    + "Repository, und wo das Audit dem Plan widerspricht, gewinnt das Audit. Korrekturen leben in "
    + "der Build-Pipeline statt in bearbeiteten Dateien — generierte Quellen werden ersetzt, und "
    + "eine Handkorrektur verschwindet ohne Fehlermeldung. Alles, was eine Tatsache behauptet, bricht "
    + "den Build, sobald es nicht mehr greift: ein Deploy, der eine Korrektur still verliert, ist "
    + "schlimmer als einer, der stoppt. Review erfolgt Commit für Commit und bleibt bei mir.",
  es: "Buena parte de mi entrega pasa ya por agentes de código, y la disciplina está en la "
    + "especificación, no en el prompt: primero una auditoría contra el repositorio real, y "
    + "donde la auditoría contradice al plan, gana la auditoría. Las correcciones viven en el "
    + "pipeline de build y no en archivos editados a mano — las fuentes generadas se reemplazan y "
    + "una edición manual desaparece sin ningún error. Todo lo que afirma un hecho rompe el "
    + "build en cuanto deja de coincidir, porque un despliegue que pierde una corrección en "
    + "silencio es peor que uno que se detiene. La revisión es commit a commit, y es mía.",
  fr: "Une bonne partie de mes livraisons passe désormais par des agents de code, et la discipline "
    + "tient à la spécification, pas au prompt : d'abord un audit du dépôt réel, "
    + "et là où l'audit contredit le plan, c'est l'audit qui gagne. Les corrections vivent dans "
    + "le pipeline de build plutôt que dans des fichiers édités — les sources "
    + "générées sont remplacées, et une correction manuelle disparaît sans la "
    + "moindre erreur. Tout ce qui affirme un fait fait échouer le build dès que la "
    + "correspondance est perdue, car un déploiement qui perd une correction en silence est pire "
    + "qu'un déploiement qui s'arrête. La revue se fait commit par commit, et elle reste la mienne.",
};

const SDLC_EDITS = LOCALES.map((loc) => ({
  file: fileFor(loc),
  label: `agentic SDLC paragraph (${loc})`,
  anchor: 'className="about-facts"',
  transform: (text) => {
    const marker = 'className="about-p about-p-sdlc"';
    if (text.includes(marker)) return text;           // self-consuming
    const at = text.indexOf('<Reveal_ab delay={300}>');
    if (at < 0) return null;
    const block =
      '<Reveal_ab delay={250}>\n' +
      '              <p ' + marker + '>\n' +
      '                ' + SDLC_COPY[loc] + '\n' +
      '              </p>\n' +
      '            </Reveal_ab>\n' +
      '            ';
    return text.slice(0, at) + block + text.slice(at);
  },
}));

// ── Footer phone: the UAE number ────────────────────────────────────────────
// Only the footer line changes. The contact card keeps both numbers on purpose
// (see WHATSAPP_EDITS) — a Gulf client wants a local number, existing contacts
// already have the Egyptian one.
const FOOTER_PHONE_EDITS = [
  ...factEdits('footer: UAE number (href)', {
    en: ['tel:+201013996079', 'tel:+971585562001'],
    ar: ['tel:+201013996079', 'tel:+971585562001'],
    de: ['tel:+201013996079', 'tel:+971585562001'],
    es: ['tel:+201013996079', 'tel:+971585562001'],
    fr: ['tel:+201013996079', 'tel:+971585562001'],
  }),
  // Anchored on the href so it cannot touch the contact card's own display of
  // the Egyptian number, which is the same digits in a different place.
  ...factEdits('footer: UAE number (label)', {
    en: ['tel:+971585562001">+20 10 1399 6079', 'tel:+971585562001">+971 58 556 2001'],
    ar: ['display:"inline-block"}}>+20 10 1399 6079', 'display:"inline-block"}}>+971 58 556 2001'],
    de: ['tel:+971585562001">+20 10 1399 6079', 'tel:+971585562001">+971 58 556 2001'],
    es: ['tel:+971585562001">+20 10 1399 6079', 'tel:+971585562001">+971 58 556 2001'],
    fr: ['tel:+971585562001">+20 10 1399 6079', 'tel:+971585562001">+971 58 556 2001'],
  }),
];

// ── Hero speaks to an employer, not a buyer ─────────────────────────────────
// "Available now · 2 slots" and "Book a free demo" are studio language. Every
// other thing on the page — case studies, architecture write-ups, role labels
// — is pitched at someone hiring. Those two lines were pitched at someone
// buying, and the buyer framing is the one that costs the interview.
//
// The pricing section keeps its own demo CTA: it sits inside an explicitly
// commercial block, where offering a demo is coherent rather than confusing.
const AVAILABILITY_EDITS = factEdits('hero/nav: open to roles', {
  en: ['Available now · 2 slots', 'Open to senior engineering roles · Dubai'],
  ar: ['متاح الآن · مقعدان', 'مفتوح لأدوار هندسية أولى · دبي'],
  de: ['Jetzt verfügbar · 2 Slots', 'Offen für Senior-Engineering-Rollen · Dubai'],
  es: ['Disponible ahora · 2 plazas', 'Abierto a roles senior de ingeniería · Dubái'],
  fr: ['Disponible maintenant · 2 places', 'Ouvert aux postes senior en ingénierie · Dubaï'],
});

// Nav and hero only — matched with the arrow so the pricing-section CTA, which
// has no arrow in two locales, is not swept up by accident. Handled as two
// edits per locale for that reason.
const CTA_EDITS = [
  ...factEdits('nav CTA: get in touch', {
    en: ['Book a free demo →', 'Get in touch →'],
    ar: ['احجز عرضًا مجانيًا →', 'تواصل معي →'],
    de: ['Kostenlose Demo buchen →', 'Kontakt aufnehmen →'],
    es: ['Reservar una demo gratis →', 'Ponte en contacto →'],
    fr: ['Réserver une démo gratuite →', 'Me contacter →'],
  }),
];

// The hero button's target moves with its label. The spec said to keep the
// anchor, but "Get in touch" pointing at a free-demo booking form is a broken
// promise — #contact is what the new label means. The pricing section's
// price-cta keeps both its label and /demo.html: there, offering a demo is the
// point of the section.
const HERO_CTA_EDITS = factEdits('hero CTA: get in touch', {
  en: ['<a href="/demo.html" className="btn btn-primary">\n                  Book a free demo',
       '<a href="#contact" className="btn btn-primary">\n                  Get in touch'],
  ar: ['<a href="/demo.html" className="btn btn-primary">\n                  احجز عرضًا مجانيًا',
       '<a href="#contact" className="btn btn-primary">\n                  تواصل معي'],
  de: ['<a href="/demo.html" className="btn btn-primary">\n                  Kostenlose Demo buchen',
       '<a href="#contact" className="btn btn-primary">\n                  Kontakt aufnehmen'],
  es: ['<a href="/demo.html" className="btn btn-primary">\n                  Reservar una demo gratis',
       '<a href="#contact" className="btn btn-primary">\n                  Ponte en contacto'],
  fr: ['<a href="/demo.html" className="btn btn-primary">\n                  Réserver une démo gratuite',
       '<a href="#contact" className="btn btn-primary">\n                  Me contacter'],
});

// ── Fifth architecture principle ────────────────────────────────────────────
// Replaces the About paragraph shipped earlier for the same claim: section 08
// already has the right shape for it, and saying it twice on one page is worse
// than saying it once in the right place.
const PRINCIPLE_COPY = {
  en: { t: 'Agents execute specs, not intentions',
        p: "A vague instruction gets a plausible answer, and plausible is the expensive failure. So the spec names the constraint that rules out the obvious approach, every change is written to fail loudly rather than silently do nothing, and I verify against the deployed site — not against the agent's summary of it." },
  ar: { t: 'الوكلاء ينفّذون المواصفات لا النوايا',
        p: 'التعليمة الغامضة تنتج إجابة تبدو معقولة، والمعقول هو الفشل الغالي الثمن. لذلك تسمّي المواصفة القيد الذي يستبعد الحل البديهي، ويُكتب كل تغيير ليفشل بصوت عالٍ بدل أن يمرّ صامتًا بلا أثر، وأتحقّق من الموقع المنشور نفسه — لا من ملخّص الوكيل عنه.' },
  de: { t: 'Agents führen Spezifikationen aus, keine Absichten',
        p: 'Eine vage Anweisung liefert eine plausible Antwort, und plausibel ist der teure Fehlschlag. Deshalb benennt die Spezifikation die Randbedingung, die den naheliegenden Weg ausschließt, jede Änderung ist so geschrieben, dass sie laut scheitert statt still nichts zu tun, und ich prüfe gegen die ausgelieferte Seite — nicht gegen die Zusammenfassung des Agents.' },
  es: { t: 'Los agentes ejecutan especificaciones, no intenciones',
        p: 'Una instrucción vaga produce una respuesta plausible, y lo plausible es el fallo caro. Por eso la especificación nombra la restricción que descarta el camino obvio, cada cambio se escribe para fallar en voz alta en lugar de no hacer nada en silencio, y verifico contra el sitio desplegado — no contra el resumen del agente.' },
  fr: { t: 'Les agents exécutent des spécifications, pas des intentions',
        p: "Une instruction vague produit une réponse plausible, et le plausible est l'échec coûteux. La spécification nomme donc la contrainte qui écarte l'approche évidente, chaque changement est écrit pour échouer bruyamment plutôt que de ne rien faire en silence, et je vérifie sur le site déployé — pas sur le résumé de l'agent." },
};

const PRINCIPLE_EDITS = [
  ...factEdits('arch: five principles', {
    en: ['Four principles I apply', 'Five principles I apply'],
    ar: ['أربعة مبادئ أطبّقها', 'خمسة مبادئ أطبّقها'],
    de: ['Vier Prinzipien, die ich', 'Fünf Prinzipien, die ich'],
    es: ['Cuatro principios que aplico', 'Cinco principios que aplico'],
    fr: ["Quatre principes que j'applique", "Cinq principes que j'applique"],
  }),
  ...LOCALES.map((loc) => ({
    file: fileFor(loc),
    label: `arch: principle V (${loc})`,
    anchor: 'function ArchitectureThinking()',
    transform: (text) => {
      if (text.includes('n: "v",')) return text;              // self-consuming
      const at = text.indexOf('{ n: "iv",');
      if (at < 0) return null;
      const end = text.indexOf('\n  ];', at);
      if (end < 0) return null;
      const c = PRINCIPLE_COPY[loc];
      const card = `\n    { n: "v", t: ${q(c.t)}, p: ${q(c.p)} },`;
      return text.slice(0, end) + card + text.slice(end);
    },
  })),
  // The About paragraph said the same thing; remove it now that the principle
  // card carries the claim in a better place.
  ...LOCALES.map((loc) => ({
    file: fileFor(loc),
    label: `remove superseded SDLC paragraph (${loc})`,
    anchor: 'className="about-facts"',
    transform: (text) => {
      const at = text.indexOf('<p className="about-p about-p-sdlc">');
      if (at < 0) return text;                                 // self-consuming
      const open = text.lastIndexOf('<Reveal_ab', at);
      const closeTok = '</Reveal_ab>';
      const close = text.indexOf(closeTok, at);
      if (open < 0 || close < 0) return null;
      let start = open;
      const prevNl = text.lastIndexOf('\n', open - 1);
      if (prevNl >= 0 && text.slice(prevNl + 1, open).trim() === '') start = prevNl;
      return text.slice(0, start) + text.slice(close + closeTok.length);
    },
  })),
];

// ── The footer claimed something that is no longer true ─────────────────────
// "No tracking · No cookies" was accurate until the ChatGPT Ads pixel went in.
// It loads on every page and manages a first-party cookie, so the line became
// a false statement on a site whose whole argument is rigour — and the first
// person to open devtools is exactly the audience it is written for.
//
// The claim is dropped rather than reworded: a smaller true claim is still a
// claim to defend, and the version string carries its own weight.
const FOOTER_CLAIM_EDITS = factEdits('footer: drop the false no-tracking claim', {
  en: ['v.2026.05 · No tracking · No cookies', 'v.2026.05'],
  ar: ['v.2026.05 · بلا تتبّع · بلا كوكيز', 'v.2026.05'],
  de: ['v.2026.05 · Kein Tracking · Keine Cookies', 'v.2026.05'],
  es: ['v.2026.05 · Sin rastreo · Sin cookies', 'v.2026.05'],
  fr: ['v.2026.05 · Sans tracking · Sans cookies', 'v.2026.05'],
});

// ── Relocation, the variants the first sweep missed ─────────────────────────
// The compact eyebrow uses a different wording — "Open to relocate", not
// "Open to relocation" — so the forbidden-string list walked straight past it.
// A gate is only as good as its list; the list now covers both.
const RELOCATE_SHORT_EDITS = factEdits('drop relocation: compact eyebrow', {
  en: [' · Open to relocate 🌍', ''],
  es: [' · Reubicación 🌍', ''],
  fr: [' · Mobilité 🌍', ''],
});

// ── FAQ: answer the hiring question first ───────────────────────────────────
// Six questions, and the one a hiring manager actually has was fourth in line
// behind engagement shape and rates. Moved to the front and rewritten to lead
// with the full-time answer; the freelance half stays, because it is true and
// pretending otherwise on a site that lists retainer pricing fools nobody.
const FAQ_FIRST = {
  en: ['{ q: "What does a typical engagement look like?"',
       '{ q: "Are you open to a full-time role?", a: "Yes — that is what I am looking for. I am a senior engineer in Dubai, currently full-time at Recovery Advisers, open to the right team. I also take a small number of freelance engagements each quarter, and the pricing further up is for those." }'],
  ar: ['{ q: "كيف يبدو التعاقد النموذجي؟"',
       '{ q: "هل أنت منفتح على وظيفة بدوام كامل؟", a: "نعم — وهذا ما أبحث عنه. مهندس أول مقيم في دبي، أعمل حاليًا بدوام كامل في Recovery Advisers، ومنفتح على الفريق المناسب. وآخذ أيضًا عددًا محدودًا من المشاريع المستقلة كل ربع سنة، والأسعار في الأعلى تخصّ تلك المشاريع." }'],
  de: ['{ q: "Wie sieht ein typisches Engagement aus?"',
       '{ q: "Sind Sie offen für eine Festanstellung?", a: "Ja — genau danach suche ich. Senior Engineer in Dubai, derzeit fest bei Recovery Advisers, offen für das richtige Team. Daneben nehme ich pro Quartal einige wenige freiberufliche Projekte an; die Preise weiter oben gelten für diese." }'],
  es: ['{ q: "¿Cómo es una colaboración típica?"',
       '{ q: "¿Estás abierto a un puesto a tiempo completo?", a: "Sí — es lo que busco. Ingeniero senior en Dubái, actualmente a tiempo completo en Recovery Advisers, abierto al equipo adecuado. También acepto unos pocos proyectos freelance por trimestre, y los precios de más arriba son para esos." }'],
  fr: ['{ q: "À quoi ressemble une mission type ?"',
       '{ q: "Êtes-vous ouvert à un poste à temps plein ?", a: "Oui — c\'est ce que je cherche. Ingénieur senior à Dubaï, actuellement à temps plein chez Recovery Advisers, ouvert à la bonne équipe. Je prends aussi quelques missions freelance par trimestre, et les tarifs plus haut concernent celles-ci." }'],
};

// A guarded transform, not a plain replacement: the new question is inserted
// *before* the old one, so the replacement contains the needle and a second run
// would insert it twice. The guard is what makes it idempotent — and the
// idempotency check refused to write the naive version, which is the whole
// reason that check exists.
const FAQ_FIRST_EDITS = LOCALES.map((loc) => ({
  file: fileFor(loc),
  label: `FAQ: lead with the hiring answer (${loc})`,
  critical: true,
  anchor: 'function FAQ()',
  transform: (text) => {
    const [needle, added] = FAQ_FIRST[loc];
    if (text.includes(added)) return text;
    const at = text.indexOf(needle);
    if (at < 0) return null;
    return text.slice(0, at) + added + ',\n    ' + text.slice(at);
  },
}));

// ── The Person block pointed at the wrong domain ────────────────────────────
// The template ships github.io and build.mjs merges its own fields over the
// top without replacing `url`, so the canonical identity told Google the site
// lives somewhere it does not — splitting signals across two hostnames.
const PERSON_URL_HEAD = ['"url": "https://ahmedfarid2.github.io"', '"url": "https://iamahmedfarid.com/"'];

// ── The commercial offer moves off the home page ────────────────────────────
// The page was asking a hiring manager for a job while quoting a $9,000
// three-week build a few sections later. Both are true — he is looking for a
// senior role and takes a few engagements a quarter — but stacked on one page
// they read as indecision, and indecision is what loses the interview.
//
// So the offer is not deleted, it is separated: pricing, tiers, add-ons and the
// free demo now live on /work-with-me.html, linked from the footer. Each
// audience sees one coherent page.
//
// Only the <Pricing/> render call is removed. The component itself stays in the
// bundle — deleting it would fight the next Claude-design export, which will
// ship it again, and an unused function costs nothing.
const PRICING_OFF_HOME = LOCALES.map((loc) => ({
  file: fileFor(loc),
  label: `move commercial sections off the home page (${loc})`,
  critical: true,
  anchor: 'function Pricing()',
  transform: (text) => {
    let out = text;
    // <Pricing/> is section 13 (plans, packages, the free-demo block);
    // <Services/> is section 14 (ways to work together). Both are the offer.
    for (const call of ['      <Pricing/>\n', '      <Services/>\n']) {
      out = out.split(call).join('');   // self-consuming: gone means gone
    }
    return out;
  },
}));

// Three FAQ answers belong to the buyer, not the reader of a CV: what an
// engagement looks like, where the clients are, and the rate. They move with
// the offer. The two that serve both audiences — taking a project from zero,
// and mobile-only work — stay.
const FAQ_MOVE_KEYS = {
  en: ['What does a typical engagement look like?', 'Where are your clients based?', "What's your rate?"],
  ar: ['كيف يبدو التعاقد النموذجي؟', 'أين يقع عملاؤك؟', 'ما سعرك؟'],
  de: ['Wie sieht ein typisches Engagement aus?', 'Wo sitzen Ihre Kunden?', 'Wie hoch ist Ihr Satz?'],
  es: ['¿Cómo es una colaboración típica?', '¿Dónde están tus clientes?', '¿Cuál es tu tarifa?'],
  fr: ['À quoi ressemble une mission type ?', 'Où sont vos clients ?', 'Quel est votre tarif ?'],
};
const FAQ_MOVE_EDITS = LOCALES.map((loc) => ({
  file: fileFor(loc),
  label: `move commercial FAQ items to /services (${loc})`,
  anchor: 'function FAQ()',
  transform: (text) => {
    let out = text;
    for (const q of FAQ_MOVE_KEYS[loc]) {
      const at = out.indexOf('{ q: "' + q + '"');
      if (at < 0) continue;                       // self-consuming
      const end = out.indexOf('" },', at);
      if (end < 0) return null;
      let start = at;
      const prevNl = out.lastIndexOf('\n', at - 1);
      if (prevNl >= 0 && out.slice(prevNl + 1, at).trim() === '') start = prevNl;
      out = out.slice(0, start) + out.slice(end + 4);
    }
    return out;
  },
}));

// The full-time answer led with "Both" and mentioned hiring last, as a caveat.
// It now leads with what he is actually looking for, and points the freelance
// half at the page that owns it.
const FAQ_FULLTIME_EDITS = factEdits('FAQ: full-time answer leads', {
  en: ["Both. I'm full-time at Recovery Advisers (remote, Dubai) and I take on a small number of freelance engagements per quarter. If you're hiring full-time, I'm open to conversations for the right team.",
       "I'm open to full-time senior engineering roles in Dubai — that's what I'm looking for now. I'm currently full-time at Recovery Advisers (remote) and take a small number of freelance engagements alongside it; those are on the services page."],
  ar: ['كليهما. أعمل بدوام كامل لدى Recovery Advisers (عن بُعد، دبي) وأقبل عددًا محدودًا من التعاقدات الحرّة كل ربع سنة. إن كنت توظّف بدوام كامل، فأنا منفتح على الحديث للفريق المناسب.',
       'أبحث عن أدوار هندسية أولى بدوام كامل في دبي — هذا ما أسعى إليه الآن. أعمل حاليًا بدوام كامل لدى Recovery Advisers (عن بُعد) وآخذ إلى جانبها عددًا محدودًا من التعاقدات الحرّة، وهي معروضة في صفحة الخدمات.'],
  de: ['Beides. Ich bin Vollzeit bei Recovery Advisers (remote, Dubai) und nehme pro Quartal eine kleine Zahl freiberuflicher Engagements an. Wenn Sie Vollzeit einstellen, bin ich offen für Gespräche für das richtige Team.',
       'Ich suche eine Senior-Engineering-Festanstellung in Dubai — das ist mein Ziel. Derzeit bin ich Vollzeit bei Recovery Advisers (remote) und nehme daneben einige wenige freiberufliche Projekte an; die stehen auf der Services-Seite.'],
  es: ['Ambos. Estoy a jornada completa en Recovery Advisers (remoto, Dubái) y acepto un número reducido de encargos freelance por trimestre. Si estás contratando a jornada completa, estoy abierto a conversar para el equipo adecuado.',
       'Busco un puesto senior de ingeniería a jornada completa en Dubái — es lo que quiero ahora. Actualmente estoy a jornada completa en Recovery Advisers (remoto) y acepto algunos encargos freelance en paralelo; están en la página de servicios.'],
  fr: ["Les deux. Je suis à temps plein chez Recovery Advisers (à distance, Dubaï) et je prends quelques missions freelance par trimestre. Si vous recrutez à temps plein, je suis ouvert à la discussion pour la bonne équipe.",
       "Je cherche un poste senior en ingénierie à temps plein à Dubaï — c'est mon objectif aujourd'hui. Je suis actuellement à temps plein chez Recovery Advisers (à distance) et je prends quelques missions freelance en parallèle ; elles sont sur la page services."],
});

// The extra question added in the previous pass now duplicates the export's own
// "full-time, freelance, or both?", which Commit B rewrites to lead with the
// employment answer. Two questions asking the same thing is worse than one
// answered well, so the invented one comes back out.
const FAQ_DEDUPE_EDITS = LOCALES.map((loc) => ({
  file: fileFor(loc),
  label: `FAQ: drop the duplicated hiring question (${loc})`,
  anchor: 'function FAQ()',
  transform: (text) => {
    const [, added] = FAQ_FIRST[loc];
    if (!text.includes(added)) return text;      // self-consuming
    return text.split(added + ',\n    ').join('');
  },
}));

// A quiet footer link, not a nav item: it should be findable by someone who
// wants it and invisible to someone who does not.
const HIRE_LINK = {
  en: 'Freelance & consulting',
  ar: 'اعمل معي على مشروع',
  de: 'Projektarbeit & Preise',
  es: 'Trabaja conmigo en un proyecto',
  fr: 'Travailler avec moi sur un projet',
};
const FOOTER_LINK_EDITS = LOCALES.map((loc) => ({
  file: fileFor(loc),
  label: `footer link to /work-with-me.html (${loc})`,
  anchor: 'className="foot-col"',
  transform: (text) => {
    if (text.includes('/services/')) return text;   // self-consuming
    // Anchored on structure, not on wording: the footer's section list is the
    // same shape in every locale but the link text is translated, so matching
    // the href and walking to its </li> works where matching the label does not.
    const at = text.indexOf('href="#process"');
    if (at < 0) return null;
    const tok = '</li>';
    const end = text.indexOf(tok, at);
    if (end < 0) return null;
    const insert = `\n              <li><a href="/services/">${HIRE_LINK[loc]}</a></li>`;
    return text.slice(0, end + tok.length) + insert + text.slice(end + tok.length);
  },
}));

// ── Renumber after the move ─────────────────────────────────────────────────
// Section numbers are displayed. Removing 13 (pricing) and 14 (ways to work
// together) left the tail reading 12 → 15 → 15 → 17 → 18: two gaps, and a
// duplicate 15 that predates this change — "Writing" and "Trust signals" both
// claimed it, and 16 never existed at all.
//
// Ordered longest-number-first is not needed here because each eyebrow carries
// its own label, so the matches cannot collide with one another.
const RENUMBER_EDITS = [
  ...factEdits('renumber: trust signals -> 13', {
    en: ['eyebrow="Trust signals · 15"', 'eyebrow="Trust signals · 13"'],
    ar: ['eyebrow="إشارات الثقة · ١٥"', 'eyebrow="إشارات الثقة · ١٣"'],
    de: ['eyebrow="Vertrauenssignale · 15"', 'eyebrow="Vertrauenssignale · 13"'],
    es: ['eyebrow="Señales de confianza · 15"', 'eyebrow="Señales de confianza · 13"'],
    fr: ['eyebrow="Signaux de confiance · 15"', 'eyebrow="Signaux de confiance · 13"'],
  }),
  ...factEdits('renumber: writing -> 14', {
    en: ['eyebrow="Writing · 15"', 'eyebrow="Writing · 14"'],
    ar: ['eyebrow="Writing · 15"', 'eyebrow="Writing · 14"'],
    de: ['eyebrow="Writing · 15"', 'eyebrow="Writing · 14"'],
    es: ['eyebrow="Writing · 15"', 'eyebrow="Writing · 14"'],
    fr: ['eyebrow="Writing · 15"', 'eyebrow="Writing · 14"'],
  }),
  ...factEdits('renumber: FAQ -> 15', {
    en: ['eyebrow="FAQ · 17"', 'eyebrow="FAQ · 15"'],
    ar: ['eyebrow="الأسئلة الشائعة · ١٧"', 'eyebrow="الأسئلة الشائعة · ١٥"'],
    de: ['eyebrow="FAQ · 17"', 'eyebrow="FAQ · 15"'],
    es: ['eyebrow="FAQ · 17"', 'eyebrow="FAQ · 15"'],
    fr: ['eyebrow="FAQ · 17"', 'eyebrow="FAQ · 15"'],
  }),
  ...factEdits('renumber: connect -> 16', {
    en: ['eyebrow="Connect · 18"', 'eyebrow="Connect · 16"'],
    ar: ['eyebrow="تواصل · ١٨"', 'eyebrow="تواصل · ١٦"'],
    de: ['eyebrow="Kontakt · 18"', 'eyebrow="Kontakt · 16"'],
    es: ['eyebrow="Contacto · 18"', 'eyebrow="Contacto · 16"'],
    fr: ['eyebrow="Contact · 18"', 'eyebrow="Contact · 16"'],
  }),
];

// ── The last thing on the page was still selling ────────────────────────────
// "One scoping call… whether I'm the right hands for the job — or whether I
// should point you somewhere else" is a vendor qualifying a lead. It is the
// final impression on a page that now opens by asking for a role.
const CLOSING_EDITS = factEdits('closing CTA speaks to an employer', {
  en: ["One scoping call. Thirty minutes. We'll know inside that whether I'm the right hands for the job — or whether I should point you somewhere else.",
       "Thirty minutes is usually enough to tell whether I'm the engineer your team is missing. Bring the problem you have not been able to hand to anyone yet."],
  // Translated to carry the same move — from "am I the right vendor for this
  // job" to "am I the engineer this team is missing" — rather than word for
  // word. "the problem you haven't been able to hand to anyone yet" is the
  // line doing the work, so each language keeps that idea intact.
  ar: ['مكالمة تحديد نطاق. ثلاثون دقيقة. خلالها سنعرف إن كنت الأيدي المناسبة للعمل — أو إن كان عليّ أن أحيلك إلى جهة أخرى.',
       'ثلاثون دقيقة تكفي عادةً لتعرف إن كنتُ المهندس الذي ينقص فريقك. احضر ومعك المشكلة التي لم تجد من تسلّمها له حتى الآن.'],
  de: ['Ein Scoping-Call. Dreißig Minuten. Darin wissen wir, ob ich die richtigen Hände für den Job bin — oder ob ich Sie woandershin verweisen sollte.',
       'Dreißig Minuten genügen meist, um zu sehen, ob ich der Entwickler bin, der Ihrem Team fehlt. Bringen Sie das Problem mit, das Sie bisher niemandem übergeben konnten.'],
  es: ['Una llamada de alcance. Treinta minutos. Dentro de ese tiempo sabremos si soy las manos adecuadas para el trabajo — o si debería remitirte a otro sitio.',
       'Treinta minutos suelen bastar para ver si soy el ingeniero que le falta a tu equipo. Trae el problema que todavía no has podido entregarle a nadie.'],
  fr: ["Un appel de cadrage. Trente minutes. On saura à l'intérieur si je suis les bonnes mains pour la mission — ou si je dois vous orienter ailleurs.",
       "Trente minutes suffisent en général à savoir si je suis l'ingénieur qui manque à votre équipe. Venez avec le problème que vous n'avez encore pu confier à personne."],
});

// ── The mobile nav button promised contact and opened the sales page ────────
// Its label was changed to "Get in touch" in the hero/nav pass; its href was
// not. The href had been set to /demo.html by the old "lead with the free
// offer" transform, and deleting that transform did not undo what it had
// already written into the committed export — a removed edit does not reverse
// its own past output.
//
// A button that says "Get in touch" and opens a page titled "Book a free demo"
// reads as bait, which is worse than the mismatch it replaced.
const MOBILE_CTA_EDITS = factEdits('mobile nav CTA -> #contact', {
  en: ['href="/demo.html" className="nav-mobile-cta"', 'href="#contact" className="nav-mobile-cta"'],
  ar: ['href="/demo.html" className="nav-mobile-cta"', 'href="#contact" className="nav-mobile-cta"'],
  de: ['href="/demo.html" className="nav-mobile-cta"', 'href="#contact" className="nav-mobile-cta"'],
  es: ['href="/demo.html" className="nav-mobile-cta"', 'href="#contact" className="nav-mobile-cta"'],
  fr: ['href="/demo.html" className="nav-mobile-cta"', 'href="#contact" className="nav-mobile-cta"'],
});

// ── "View CV" pointed at a frozen LinkedIn upload ───────────────────────────
// Two buttons sat side by side handing out different documents: "Download CV"
// served /Ahmed-Farid-CV.pdf, while "View CV" opened a copy uploaded to
// LinkedIn once and frozen there. Replacing the PDF updated one of them.
//
// Both now use the same file, so there is a single document to keep current
// and no way for the two to drift apart again. The same fix went into the
// GitHub profile's CV badge, which had the same link.
const CV_LINK_EDITS = factEdits('View CV -> the live PDF', Object.fromEntries(
  ['en', 'ar', 'de', 'es', 'fr'].map((loc) => [loc, [
    'href="https://www.linkedin.com/in/ahmed-farid-b46a5221b/overlay/1782022237581/single-media-viewer?profileId=ACoAADeBkOYB6O_rbWtqld6CsWkhtTkpduSbKXo"',
    'href="/Ahmed-Farid-CV.pdf"',
  ]])
));

// ── He is in Dubai, not heading there ───────────────────────────────────────
// "Open to relocation" reads to a Dubai employer as *this person may leave* —
// the opposite of the intended signal. Five places per locale, not the two the
// spec listed: the eyebrow (twice in ar/de, which ship a short variant), the
// hero paragraph, the About paragraph, and the contact sub-line.
const RELOCATION_EDITS = [
  ...factEdits('drop relocation: eyebrow', {
    en: [' · Open to relocation 🌍', ''],
    ar: [' · مستعدّ للانتقال 🌍', ''],
    de: [' · Umzugsbereit 🌍', ''],
    es: [' · Abierto a reubicación 🌍', ''],
    fr: [' · Ouvert à la mobilité 🌍', ''],
  }),
  ...factEdits('drop relocation: hero paragraph', {
    en: ['Flutter. Open to relocation.', 'Flutter.'],
    ar: ['Flutter. مستعدّ للانتقال.', 'Flutter.'],
    de: ['Flutter. Umzugsbereit.', 'Flutter.'],
    es: ['Flutter. Abierto a reubicación.', 'Flutter.'],
    fr: ['Flutter. Ouvert à la mobilité.', 'Flutter.'],
  }),
  ...factEdits('drop relocation: About paragraph', {
    en: ['Dubai-based, open to relocation.', 'Dubai-based.'],
    ar: ['مقيم في دبي، مستعدّ للانتقال.', 'مقيم في دبي.'],
    de: ['Mit Sitz in Dubai, umzugsbereit.', 'Mit Sitz in Dubai.'],
    es: ['Afincado en Dubái, abierto a reubicación.', 'Afincado en Dubái.'],
    fr: ['Basé à Dubaï, ouvert à la mobilité.', 'Basé à Dubaï.'],
  }),
  ...factEdits('drop relocation: contact sub', {
    en: ['Emirates · open to relocation. Pick', 'Emirates. Pick'],
    ar: ['المتحدة · مستعدّ للانتقال. اختر', 'المتحدة. اختر'],
    de: ['Emirate · umzugsbereit. Wählen', 'Emirate. Wählen'],
    es: ['Unidos · abierto a reubicación. Elige', 'Unidos. Elige'],
    fr: ['unis · ouvert à la mobilité. Choisissez', 'unis. Choisissez'],
  }),

  // The services grid still advertised relocation as a working mode.
  ...factEdits('drop relocation: service chip', {
    en: ['Remote / relocation', 'Remote / on-site'],
    ar: ['عن بُعد / انتقال', 'عن بُعد / من الموقع'],
    de: ['Remote / Umzug', 'Remote / vor Ort'],
    es: ['Remoto / reubicación', 'Remoto / presencial'],
    fr: ['Distanciel / mobilité', 'Distanciel / sur site'],
  }),
];

const RELOCATION_HEAD = {
  en: ['based in Dubai, open to relocation.', 'based in Dubai.'],
  ar: ['مقيم في دبي، مستعدّ للانتقال.', 'مقيم في دبي.'],
  de: ['mit Sitz in Dubai, umzugsbereit.', 'mit Sitz in Dubai.'],
  es: ['afincado en Dubái, abierto a reubicación.', 'afincado en Dubái.'],
  fr: ['basé à Dubaï, ouvert à la mobilité.', 'basé à Dubaï.'],
};

// ── Remove junior-coded language ────────────────────────────────────────────
// "I learn fast and adapt to whatever stack the job needs" volunteers
// adaptability where a senior profile should show judgement. Replaced rather
// than deleted, because the paragraph wants a closer and the replacement makes
// the stronger claim: choosing the stack, and owning what follows.
const SENIORITY_EDITS = LOCALES.map((loc) => ({
  file: fileFor(loc),
  label: `drop "fast learner" framing (${loc})`,
  critical: true,
  anchor: {
    en: 'the on-call rotation after launch.',
    ar: 'والمناوبة بعد الإطلاق.',
    de: 'nach dem Launch.',
    es: 'el lanzamiento.',
    fr: 'après le lancement.',
  }[loc],
  transform: (text) => {
    const [rx, replacement] = {
      en: [/I learn\s+fast and adapt to whatever stack the job actually needs\./,
           'I pick the stack the problem needs and own the consequences.'],
      ar: [/أتعلّم بسرعة وأتكيّف مع أي تقنية يحتاجها المشروع فعلًا\./,
           'أختار التقنية التي تناسب المشكلة وأتحمّل نتائج الاختيار.'],
      de: [/Ich lerne schnell und passe mich an jeden Stack an, den das Projekt wirklich braucht\./,
           'Ich wähle den Stack, den das Problem verlangt, und trage die Konsequenzen.'],
      es: [/Aprendo rápido y me adapto a cualquier stack que el proyecto realmente necesite\./,
           'Elijo el stack que el problema necesita y asumo las consecuencias.'],
      fr: [/J'apprends vite et je m'adapte au stack dont le projet a réellement besoin\./,
           "Je choisis la stack que le problème exige et j'en assume les conséquences."],
    }[loc];
    // Self-consuming: the pattern is gone once replaced, so a second run is a
    // no-op and reports "already applied".
    if (!rx.test(text)) return text;
    return text.replace(rx, replacement);
  },
}));


// Each edit is an exact string match, so a failed match is loud rather than
// silently rewriting the wrong thing.
const EDITS = [
  {
    file: 'index.html',
    label: 'hero-sub (en)',
    // Marker deliberately excludes the city: the Dubai/Cairo swap rewrites
    // this same sentence, and a marker containing the city name would stop
    // matching the moment it changed — reporting a false failure.
    appliedMarker:
      '            live bidding, role-based tenants, and the mobile apps that run on top.',
    old:
      '<p className="hero-sub">\n' +
      '            Cairo-based software engineer, open to relocation — five years building\n' +
      '            multi-tenant SaaS, real-time auction platforms, AI-assisted tools, and\n' +
      '            mobile apps shipped to production across the Gulf, the US, and the UK.\n' +
      '            Laravel, Next.js, FastAPI, Flutter.\n' +
      '          </p>',
    new:
      '<p className="hero-sub">\n' +
      '            Dubai-based senior engineer specializing in real-time, multi-tenant SaaS —\n' +
      '            live bidding, role-based tenants, and the mobile apps that run on top.\n' +
      '            Five years shipping to production across the Gulf, the US, and the UK.\n' +
      '            Laravel, Next.js, FastAPI, Flutter. Open to relocation.\n' +
      '          </p>',
  },
  {
    file: 'index.ar.html',
    label: 'hero-sub (ar)',
    // Marker deliberately excludes the city: the Dubai/Cairo swap rewrites
    // this same sentence, and a marker containing the city name would stop
    // matching the moment it changed — reporting a false failure.
    appliedMarker:
      '            والفورية — مزادات مباشرة، وصلاحيات حسب الدور، وتطبيقات',
    old:
      '<p className="hero-sub">\n' +
      '            مهندس برمجيات مقيم في القاهرة، مستعدّ للانتقال — خمس سنوات في بناء منصّات\n' +
      '            SaaS متعدّدة المستأجرين، ومنصّات مزادات فورية، وأدوات مدعومة بالذكاء الاصطناعي،\n' +
      '            وتطبيقات جوّال أُطلقت في الإنتاج عبر الخليج والولايات المتحدة والمملكة المتحدة.\n' +
      '            Laravel وNext.js وFastAPI وFlutter.\n' +
      '          </p>',
    new:
      '<p className="hero-sub">\n' +
      '            مهندس برمجيات أول مقيم في دبي، متخصّص في منصّات SaaS متعدّدة المستأجرين\n' +
      '            والفورية — مزادات مباشرة، وصلاحيات حسب الدور، وتطبيقات الجوّال التي تعمل فوقها.\n' +
      '            خمس سنوات من الإطلاق في الإنتاج عبر الخليج والولايات المتحدة والمملكة المتحدة.\n' +
      '            Laravel وNext.js وFastAPI وFlutter. مستعدّ للانتقال.\n' +
      '          </p>',
  },
  {
    file: 'index.de.html',
    label: 'hero-sub (de)',
    // Marker deliberately excludes the city: the Dubai/Cairo swap rewrites
    // this same sentence, and a marker containing the city name would stop
    // matching the moment it changed — reporting a false failure.
    appliedMarker:
      '            Multi-Tenant-SaaS — Live-Gebote, rollenbasierte Mandanten und die mobilen',
    old:
      '<p className="hero-sub">\n' +
      '            Softwareentwickler mit Sitz in Kairo, umzugsbereit — fünf Jahre Erfahrung im\n' +
      '            Aufbau von Multi-Tenant-SaaS, Echtzeit-Auktionsplattformen, KI-gestützten\n' +
      '            Tools und mobilen Apps, die im Golfraum, in den USA und in Großbritannien\n' +
      '            in Produktion gegangen sind. Laravel, Next.js, FastAPI, Flutter.\n' +
      '          </p>',
    new:
      '<p className="hero-sub">\n' +
      '            Senior-Softwareentwickler mit Sitz in Dubai, spezialisiert auf Echtzeit- und\n' +
      '            Multi-Tenant-SaaS — Live-Gebote, rollenbasierte Mandanten und die mobilen\n' +
      '            Apps, die darauf laufen. Fünf Jahre in Produktion im Golfraum, in den USA\n' +
      '            und in Großbritannien. Laravel, Next.js, FastAPI, Flutter. Umzugsbereit.\n' +
      '          </p>',
  },
  {
    file: 'index.es.html',
    label: 'hero-sub (es)',
    // Marker deliberately excludes the city: the Dubai/Cairo swap rewrites
    // this same sentence, and a marker containing the city name would stop
    // matching the moment it changed — reporting a false failure.
    appliedMarker:
      '            tiempo real — subastas en vivo, acceso por rol y las apps móviles que corren',
    old:
      '<p className="hero-sub">\n' +
      '            Ingeniero de software afincado en El Cairo, abierto a reubicación — cinco años\n' +
      '            construyendo SaaS multi-tenant, plataformas de subastas en tiempo real,\n' +
      '            herramientas asistidas por IA y apps móviles llevadas a producción en el\n' +
      '            Golfo, EE. UU. y el Reino Unido. Laravel, Next.js, FastAPI, Flutter.\n' +
      '          </p>',
    new:
      '<p className="hero-sub">\n' +
      '            Ingeniero senior afincado en Dubái, especializado en SaaS multi-tenant y en\n' +
      '            tiempo real — subastas en vivo, acceso por rol y las apps móviles que corren\n' +
      '            encima. Cinco años llevando sistemas a producción en el Golfo, EE. UU. y el\n' +
      '            Reino Unido. Laravel, Next.js, FastAPI, Flutter. Abierto a reubicación.\n' +
      '          </p>',
  },
  {
    file: 'index.fr.html',
    label: 'hero-sub (fr)',
    // Marker deliberately excludes the city: the Dubai/Cairo swap rewrites
    // this same sentence, and a marker containing the city name would stop
    // matching the moment it changed — reporting a false failure.
    appliedMarker:
      "            réel — enchères en direct, accès par rôle et les applications mobiles qui",
    old:
      '<p className="hero-sub">\n' +
      "            Ingénieur logiciel basé au Caire, ouvert à la mobilité — cinq ans à construire\n" +
      "            des SaaS multi-tenant, des plateformes d'enchères en temps réel, des outils\n" +
      '            assistés par IA et des applications mobiles livrées en production dans le Golfe,\n' +
      '            aux États-Unis et au Royaume-Uni. Laravel, Next.js, FastAPI, Flutter.\n' +
      '          </p>',
    new:
      '<p className="hero-sub">\n' +
      '            Ingénieur senior basé à Dubaï, spécialisé dans les SaaS multi-tenant et temps\n' +
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
  { file: 'index.html',    label: 'primary CTA (en)', expect: 1, old: 'Book a scoping call', new: 'Start a conversation' },
  { file: 'index.ar.html', label: 'primary CTA (ar)', expect: 1, old: 'احجز مكالمة استكشافية', new: 'ابدأ محادثة' },
  { file: 'index.de.html', label: 'primary CTA (de)', expect: 1, old: 'Scoping-Call buchen', new: 'Gespräch beginnen' },
  { file: 'index.es.html', label: 'primary CTA (es)', expect: 3, old: 'Empezar un proyecto', new: 'Agendar una llamada' },
  { file: 'index.fr.html', label: 'primary CTA (fr)', expect: 3, old: 'Démarrer un projet',  new: 'Réserver un appel' },

  // ── Migration: point the existing card at the capture form ───────────────
  // The card's href has had three values over time, so there are two states to
  // migrate from, not one:
  //   • "/checklist.html"        — the original, which gave the PDF away
  //                                without capturing anything
  //   • the old tally.so form    — capture, but hosted off-site
  // Both are rewritten to LM_HREF, now a page on this domain. Each is optional:
  // a freshly-inserted card already carries LM_HREF, so on a new export there
  // is nothing to migrate and "not found" is the expected result.
  ...['/checklist.html', 'https://tally.so/r/68YlMB'].flatMap((from) =>
    ['index.html', 'index.ar.html', 'index.de.html', 'index.es.html', 'index.fr.html'].map((file) => ({
      file,
      label:
        `lead-magnet href: ${from.startsWith('http') ? 'tally' : 'ungated'} → own form ` +
        `(${file.split('.')[1] === 'html' ? 'en' : file.split('.')[1]})`,
      optional: true,
      old: `      href: ${JSON.stringify(from)},\n`,
      new: `      href: ${JSON.stringify(LM_HREF)},\n`,
    }))
  ),

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
        label: `case shot: show only when there is one (${loc})`,
        appliedMarker: '{c.shotSrc && c.links && c.links.length ? (',
        // Two problems, one condition. Originally the mock rendered for any
        // case with NO `fleet`, which is why RevealSite — the one case that has
        // one — showed no screenshot however many times a shotSrc was added.
        // The first fix was `c.shotSrc || !c.fleet`, which let RevealSite
        // through but also kept rendering an empty browser frame for any case
        // without a screenshot. An empty frame reads as a broken image, which
        // is worse than no frame, so the condition is now simply: draw the mock
        // when there is something to put in it. Every other case carries an
        // inline base64 shot, so nothing else changes.
        old: '{(c.shotSrc || !c.fleet) && c.links && c.links.length ? (',
        new: '{c.shotSrc && c.links && c.links.length ? (',
      },
      // Migration for exports still carrying the original pre-RevealSite form.
      {
        file,
        label: `case shot: condition from fresh export (${loc})`,
        optional: true,
        appliedMarker: '{c.shotSrc && c.links && c.links.length ? (',
        old: '{!c.fleet && c.links && c.links.length ? (',
        new: '{c.shotSrc && c.links && c.links.length ? (',
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

  // ── Launchpad scoped to three weeks, so the tiers stop undercutting each
  //    other on implied hourly rate ─────────────────────────────────────────
  ...WEEKS_EDITS,

  // ── The free rung underneath the ladder ──────────────────────────────────
  ...DEMO_EDITS,

  // ── …and lead with it, instead of burying it in the pricing section ──────

  // ── React Native in the toolbelt ─────────────────────────────────────────
  // Added on Ahmed's word: he has the experience, and it is his CV to state.
  // It goes in the toolbelt — the section that lists what he works in — and
  // NOT into any case study's `stack`, because every one of those describes a
  // named, shipped project and all of the mobile ones are Flutter. Putting it
  // in a project stack would attach the claim to work that did not use it.
  //
  // Placed next to React rather than next to Flutter: it is the same ecosystem
  // as the React and Next.js already there, and the list is grouped by family
  // rather than by platform.
  ...['index.html', 'index.ar.html', 'index.de.html', 'index.es.html', 'index.fr.html'].map((file) => ({
    file,
    label: `toolbelt: React Native (${file.split('.')[1] === 'html' ? 'en' : file.split('.')[1]})`,
    appliedMarker: '"React", "React Native"',
    // Framework names are not translated in any locale, so one anchor serves
    // all five. Spans the following entry so the anchor is consumed.
    old: '"React", "Next.js"',
    new: '"React", "React Native", "Next.js"',
  })),

  // ── Based in Dubai ───────────────────────────────────────────────────────
  // Last, so it also catches the hero-sub this file rewrites earlier.
  ...CITY_EDITS,
  ...HEAD_EDITS,
  ...WHATSAPP_EDITS,
  ...PIXEL_EDITS,
  ...YEARS_EDITS,
  ...PRODUCT_COUNT_EDITS,
  ...HERO_STAT_EDITS,
  ...YELO_TITLE_EDITS,
  ...FOOTER_PHONE_EDITS,
  ...AVAILABILITY_EDITS,
  ...CTA_EDITS,
  ...MOBILE_CTA_EDITS,
  ...HERO_CTA_EDITS,
  ...PRINCIPLE_EDITS,
  ...PRICING_OFF_HOME,
  ...CV_LINK_EDITS,
  ...RENUMBER_EDITS,
  ...CLOSING_EDITS,
  ...FAQ_MOVE_EDITS,
  ...FAQ_FULLTIME_EDITS,
  ...FAQ_DEDUPE_EDITS,
  ...FOOTER_LINK_EDITS,
  ...FOOTER_CLAIM_EDITS,
  ...RELOCATE_SHORT_EDITS,
  ...FOLLOWER_EDITS,
  ...RELOCATION_EDITS,
  ...SENIORITY_EDITS,
];

// Locate the `__bundler/template` line: the document shell, stored as a single
// JSON-encoded string. The `<head>` lives here — <title>, meta description,
// OG tags and the JSON-LD Person block — so anything search engines read before
// React runs is edited here, not in the manifest.
function findTemplateLine(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('type="__bundler/template"')) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const s = lines[j].trim();
      if (!s || s[0] !== '"') continue;
      let str;
      try { str = JSON.parse(s); } catch { continue; }
      if (typeof str !== 'string') continue;
      return { index: j, text: str };
    }
  }
  return null;
}

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

// Some edits are cosmetic; some are corrections of fact. A re-export that moves
// the markup makes both stop matching, and `--soft` lets the deploy continue
// without them — fine for a tweak, not fine for a claim. An edit marked
// `critical: true` says: if this one cannot be applied, the page would state
// something untrue (five years instead of six, a follower count that was
// deliberately removed), so fail the build instead of shipping it quietly.
let criticalFailures = 0;
const fail = (edit) => {
  failures++;
  if (edit.critical) criticalFailures++;
};

for (const edit of EDITS) {
  const raw = readFileSync(edit.file, 'utf8');
  const lines = raw.split('\n');

  // ── Template edits ───────────────────────────────────────────────────────
  // Same idempotent-transform contract as below, but against the document
  // shell instead of a bundled asset.
  if (edit.template) {
    const tpl = findTemplateLine(lines);
    if (!tpl) {
      console.error(`✗ ${edit.label}: no bundler template found in ${edit.file}`);
      fail(edit);
      continue;
    }
    let updated;
    try { updated = edit.transform(tpl.text); } catch (e) {
      console.error(`✗ ${edit.label}: transform threw in ${edit.file} — ${e.message}`);
      fail(edit);
      continue;
    }
    if (updated == null) {
      console.error(`✗ ${edit.label}: transform could not parse the template in ${edit.file}`);
      fail(edit);
      continue;
    }
    if (updated === tpl.text) {
      console.log(`= ${edit.label}: already applied in ${edit.file}`);
      continue;
    }
    if (CHECK) {
      console.log(`✓ ${edit.label}: would rewrite the template in ${edit.file}`);
      continue;
    }
    if (edit.transform(updated) !== updated) {
      console.error(`✗ ${edit.label}: transform is not idempotent — refusing to write ${edit.file}`);
      fail(edit);
      continue;
    }
    // The template is a JSON string living *inside* a <script> element, so any
    // literal `</` in it (`</title>`, `</head>`) would close that script early
    // and shred the document. The export escapes them as `</`; JSON
    // .stringify does not, so re-escape here or the page stops rendering.
    lines[tpl.index] = JSON.stringify(updated).replace(/<\//g, '<\\u002F');
    writeFileSync(edit.file, lines.join('\n'), 'utf8');
    console.log(`✓ ${edit.label}: applied to the template in ${edit.file}`);
    applied++;
    continue;
  }

  const found = findManifestLine(lines);
  if (!found) {
    console.error(`✗ ${edit.label}: no bundler manifest found in ${edit.file}`);
    fail(edit);
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
      fail(edit);
      continue;
    }
    let updated;
    try { updated = edit.transform(hit.text); } catch (e) {
      console.error(`✗ ${edit.label}: transform threw in ${edit.file} — ${e.message}`);
      fail(edit);
      continue;
    }
    if (updated == null) {
      console.error(`✗ ${edit.label}: transform could not parse ${edit.file} (export may have changed)`);
      fail(edit);
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
      fail(edit);
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
    fail(edit);
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
    fail(edit);
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
    fail(edit);
    continue;
  }

  obj[target.id] = { ...target.asset, data: encode(target.asset, updated) };
  lines[index] = JSON.stringify(obj);
  writeFileSync(edit.file, lines.join('\n'), 'utf8');
  console.log(`✓ ${edit.label}: applied to ${edit.file} (asset ${target.id.slice(0, 8)})`);
  applied++;
}

console.log(`\n${CHECK ? 'check' : 'apply'} complete — ${applied} edited, ${failures} failed`);

if (criticalFailures) {
  // No soft path for these. A cosmetic edit that stops matching costs polish;
  // one of these stops matching and the site goes back to claiming five years,
  // or re-grows the follower count that was taken down on purpose. Shipping a
  // false statement is worse than not shipping, so this blocks the deploy even
  // under --soft.
  console.error(
    `\n✗ ${criticalFailures} CRITICAL copy edit(s) did not match — refusing to build.\n` +
    '   These correct statements of fact, so deploying without them would put\n' +
    '   something untrue back on the site. The exports were most likely replaced\n' +
    '   by a fresh Claude-design export whose markup moved: re-run the probe and\n' +
    '   update scripts/edit-copy.mjs to match the new markup.'
  );
  process.exit(1);
}

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
