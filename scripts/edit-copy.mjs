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
    ['FAQ answer', c.faqOld, c.faqNew],
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
