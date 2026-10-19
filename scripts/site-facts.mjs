// scripts/site-facts.mjs
//
// The single source of truth for facts the site states about Ahmed: where he
// is, how to reach him, and every number used as proof. Both edit-copy.mjs
// (which patches the exports) and build.mjs (head metadata, JSON-LD,
// llms.txt, the drift guard) import from here, so a value changes in one
// place and cannot drift between sections or locales again.
//
// Rules for METRICS: never invent, round up or inflate. Each value carries the
// evidence it rests on; change a number only when that evidence changes.

export const SITE_URL = 'https://iamahmedfarid.com';

// IndexNow (Bing, Yandex, Seznam…) proves site ownership by fetching
// /<key>.txt from the site. The file lives at the repo root and is deployed
// by copyStaticAssets; scripts/indexnow.mjs submits the sitemap with it.
// Rotating the key means renaming that file in the same commit.
export const INDEXNOW_KEY = '9c4d4d137838a4b86f90f8070f173b53';

// Visitor analytics (Umami Cloud — free, cookieless, no consent banner needed).
// Empty = no analytics script on any page. To turn it on: create a free account
// at cloud.umami.is, add the website iamahmedfarid.com, and paste its Website ID
// (a UUID) here. Clicks on book-a-call, WhatsApp, email, CV, LinkedIn, services
// and project cards are already tagged by the build and show up as events.
//
// adPixelId: the OpenAI / ChatGPT Ads measurement pixel. Empty = off: no pixel
// and no consent banner on any page. Off since Oct 2026 — the opt-in banner sat
// over the hero's buttons on every first visit, with no ad campaign running.
// To turn it back on (only worth it while a ChatGPT Ads campaign runs), set it
// to the Ads Manager pixel id, '9ceAHjhY9TXnV8VVdRpZEx'.
export const ANALYTICS = { umamiWebsiteId: '58daf3f0-a2f3-48b7-8bfd-895a96e3607a', adPixelId: '' };

// Owner-confirmed (Oct 2026): living in Dubai now.
export const LOCATION = {
  city: 'Dubai',
  country: 'United Arab Emirates',
  countryCode: 'AE',
  tz: 'GMT+4',
  cityByLocale: { en: 'Dubai', ar: 'دبي', de: 'Dubai', es: 'Dubái', fr: 'Dubaï' },
};
export const LOCATION_LABEL = `${LOCATION.city}, ${LOCATION.country}`;

export const CONTACT = {
  email: 'ahmed@iamahmedfarid.com',
  linkedin: 'https://www.linkedin.com/in/iamahmedfarid',
  github: 'https://github.com/ahmedfarid2',
  whatsapp: 'https://wa.me/message/CFOPUVBTQVPLM1',
  calendly: 'https://calendly.com/iamahmedfarid/30min',
  cv: '/Ahmed-Farid-CV.pdf',
};

// Documentation-grade today: the displayed numbers live in the exports and
// edit-copy factEdits; this table is where their evidence is recorded and
// checked before any of them changes.
export const METRICS = {
  // Owner-confirmed canonical claim: first paid to write code in 2019.
  years: { display: '6+', evidence: 'professional since 2019 (owner-confirmed)' },
  storeApps: { display: '12+', evidence: '15 distinct App Store / Google Play links across the case studies' },
  products: { display: '27+', evidence: 'case studies + RevealSite fleet + own products + builds, all linked' },
  countries: { display: '17+', evidence: '17 country flags listed in the Reach section' },
  flagship: { display: '9+', evidence: '12 linked case studies (5 marked FLAGSHIP); 9+ is a floor, not the flagship count' },
  // Replaces the export's "9+ flagship platforms" on /about/, which contradicted the
  // five flagships the site shows. The build fails if /work/ stops carrying this many.
  caseStudies: { display: '12', evidence: '5 flagship pages + 7 further case studies on /work/, each linked to its live product' },
  whiteLabelBrands: { display: '13+', evidence: 'RevealSite fleet: 13 pharmacies + Almani institute (14 products & storefronts)' },
  companies: { display: '12+', evidence: '13 companies named in Experience on /about/ (full-time, freelance clients, teaching); 12+ is a floor' },
  tools: { display: '60+', evidence: '~93 items in the toolbelt' },
};

// Natural prose form of METRICS.years — "over six years", never a bare
// "six years" where 6+ is meant.
export const YEARS_PROSE = {
  en: 'over six years',
  ar: 'أكثر من ست سنوات',
  de: 'über sechs Jahre',
  es: 'más de seis años',
  fr: 'plus de six ans',
};

// Head metadata the build writes for every page. Descriptions stay under
// ~165 characters; city, 6+ and stack names are never translated away.
export const SEO = {
  // Home speaks to a client first; the CV and the hiring pitch are on /about/.
  home: {
    en: {
      title: 'Ahmed Farid — Laravel & Next.js Developer in Dubai · SaaS Engineer',
      description: 'Dubai-based senior software engineer (6+ years) building real-time, multi-tenant SaaS end to end — Laravel, Next.js, Flutter. Fixed-scope builds and consulting.',
    },
    ar: {
      title: 'Ahmed Farid — مطوّر Laravel وNext.js في دبي · مهندس منصّات SaaS',
      description: 'مهندس برمجيات أول مقيم في دبي (+6 سنوات): منصّات SaaS فورية متعدّدة المستأجرين من البداية إلى النهاية — Laravel وNext.js وFlutter. مشاريع محدّدة النطاق واستشارات.',
    },
    de: {
      title: 'Ahmed Farid — Laravel- & Next.js-Entwickler in Dubai · SaaS-Engineer',
      description: 'Senior-Softwareentwickler in Dubai (6+ Jahre): Echtzeit-Multi-Tenant-SaaS, end to end — Laravel, Next.js, Flutter. Festpreis-Projekte und Beratung.',
    },
    es: {
      title: 'Ahmed Farid — Desarrollador Laravel y Next.js en Dubái · Ingeniero SaaS',
      description: 'Ingeniero de Software Senior en Dubái (6+ años): SaaS multi-tenant en tiempo real, de punta a punta — Laravel, Next.js, Flutter. Proyectos cerrados y consultoría.',
    },
    fr: {
      title: 'Ahmed Farid — Développeur Laravel & Next.js à Dubaï · Ingénieur SaaS',
      description: 'Ingénieur logiciel senior à Dubaï (6+ ans) : SaaS multi-tenant temps réel, de bout en bout — Laravel, Next.js, Flutter. Projets au forfait et conseil.',
    },
  },
  services: {
    en: {
      title: 'Hire a Laravel & Next.js Developer in Dubai — Pricing · Ahmed Farid',
      description: 'Fixed-scope Laravel & Next.js builds, retainers and architecture reviews for real-time, multi-tenant SaaS — with pricing, FAQ and a 30-minute scoping call.',
    },
    ar: {
      title: 'وظّف مطوّر Laravel وNext.js في دبي — الأسعار · Ahmed Farid',
      description: 'مشاريع محدّدة النطاق وعقود مستمرة ومراجعات معمارية لمنصّات SaaS متعدّدة المستأجرين — الأسعار والأسئلة الشائعة ومكالمة 30 دقيقة. من دبي.',
    },
    de: {
      title: 'Laravel- & Next.js-Entwickler in Dubai beauftragen — Preise · Ahmed Farid',
      description: 'Festpreis-Projekte, Engineering-Retainer und Architektur-Reviews für Echtzeit-Multi-Tenant-SaaS — mit Preisen, FAQ und 30-minütigem Scoping-Call. Aus Dubai.',
    },
    es: {
      title: 'Contrata a un desarrollador Laravel y Next.js en Dubái — Precios · Ahmed Farid',
      description: 'Proyectos cerrados, retainers y revisiones de arquitectura para SaaS multi-tenant en tiempo real — precios, FAQ y llamada de alcance de 30 min. Desde Dubái.',
    },
    fr: {
      title: 'Engager un développeur Laravel & Next.js à Dubaï — Tarifs · Ahmed Farid',
      description: 'Projets au forfait, retainers d’ingénierie et revues d’architecture pour SaaS multi-tenant temps réel — tarifs, FAQ et appel de cadrage de 30 min. Basé à Dubaï.',
    },
  },
  work: {
    en: {
      title: 'Work — Case Studies in SaaS, Real-Time & Mobile · Ahmed Farid',
      description: 'Case studies of production systems: live-bidding auctions, multi-tenant SaaS, AI-assisted tools and Flutter apps shipped across the Gulf, US and UK.',
    },
    ar: {
      title: 'الأعمال — دراسات حالة في SaaS والأنظمة الفورية والموبايل · Ahmed Farid',
      description: 'دراسات حالة لأنظمة في الإنتاج: مزادات مباشرة، منصّات SaaS متعدّدة المستأجرين، أدوات بالذكاء الاصطناعي وتطبيقات Flutter في الخليج وأمريكا وبريطانيا.',
    },
    de: {
      title: 'Arbeiten — Fallstudien zu SaaS, Echtzeit & Mobile · Ahmed Farid',
      description: 'Fallstudien produktiver Systeme: Live-Auktionen, Multi-Tenant-SaaS, KI-gestützte Tools und Flutter-Apps für den Golf, die USA und Großbritannien.',
    },
    es: {
      title: 'Proyectos — Casos de estudio de SaaS, tiempo real y móvil · Ahmed Farid',
      description: 'Casos de estudio de sistemas en producción: subastas en vivo, SaaS multi-tenant, herramientas con IA y apps Flutter en el Golfo, EE. UU. y Reino Unido.',
    },
    fr: {
      title: 'Projets — Études de cas SaaS, temps réel et mobile · Ahmed Farid',
      description: 'Études de cas de systèmes en production : enchères en direct, SaaS multi-tenant, outils d’IA et apps Flutter livrés dans le Golfe, aux États-Unis et au Royaume-Uni.',
    },
  },
  about: {
    en: {
      title: 'About Ahmed Farid — Senior Software Engineer in Dubai',
      description: 'Who you work with: 6+ years shipping production SaaS from Dubai, the stack and principles behind it, past roles, open-source code and the CV.',
    },
    ar: {
      title: 'نبذة عن Ahmed Farid — مهندس برمجيات أول في دبي',
      description: 'مع من ستعمل: +6 سنوات في بناء منصّات SaaS للإنتاج من دبي، والتقنيات والمبادئ وراءها، والأدوار السابقة، والشيفرة المفتوحة المصدر، والسيرة الذاتية.',
    },
    de: {
      title: 'Über Ahmed Farid — Senior-Softwareentwickler in Dubai',
      description: 'Mit wem Sie arbeiten: 6+ Jahre Produktions-SaaS aus Dubai, Stack und Prinzipien dahinter, bisherige Rollen, Open-Source-Code und der Lebenslauf.',
    },
    es: {
      title: 'Sobre Ahmed Farid — Ingeniero de Software Senior en Dubái',
      description: 'Con quién trabajas: 6+ años creando SaaS en producción desde Dubái, el stack y los principios detrás, roles anteriores, código abierto y el CV.',
    },
    fr: {
      title: 'À propos d’Ahmed Farid — Ingénieur logiciel senior à Dubaï',
      description: 'Avec qui vous travaillez : 6+ ans de SaaS en production depuis Dubaï, la stack et les principes derrière, les postes passés, le code open source et le CV.',
    },
  },
};

// Page names and link labels the build writes into the navigation, breadcrumbs
// and cards, per locale. `work` is the export's own #work nav label in each
// locale (read from the built pages, not translated here). Brand and case names
// are never translated and do not appear here. Arrows are written by the build
// as "→" in every locale.
//   work/services/about/contact  the four navigation links
//   pricing                      the home hero's button to /services/
//   caseStudy / allWork / moreWork  project cards and the links around them
export const NAV = {
  en: { work: 'Work', services: 'Services', about: 'About', contact: 'Contact', caseStudy: 'Case study', allWork: 'All work', moreWork: 'More work', pricing: 'Services & pricing' },
  ar: { work: 'أعمال', services: 'الخدمات', about: 'نبذة عني', contact: 'تواصل', caseStudy: 'دراسة الحالة', allWork: 'كل الأعمال', moreWork: 'أعمال أخرى', pricing: 'الخدمات والأسعار' },
  de: { work: 'Arbeiten', services: 'Leistungen', about: 'Über mich', contact: 'Kontakt', caseStudy: 'Fallstudie', allWork: 'Alle Arbeiten', moreWork: 'Weitere Arbeiten', pricing: 'Leistungen & Preise' },
  es: { work: 'Proyectos', services: 'Servicios', about: 'Sobre mí', contact: 'Contacto', caseStudy: 'Caso de estudio', allWork: 'Todo el trabajo', moreWork: 'Más trabajo', pricing: 'Servicios y precios' },
  fr: { work: 'Projets', services: 'Services', about: 'À propos', contact: 'Contact', caseStudy: 'Étude de cas', allWork: 'Toutes les réalisations', moreWork: 'Autres réalisations', pricing: 'Services et tarifs' },
};

// The five flagship case studies, each with a page of its own at
// /work/<slug>/ in every locale. `name` is the export's case-study name (brand
// names are never translated, so it is the same in all five locales and is how
// the build finds the case in the render); `slug` is the URL segment and is the
// same in every locale. Adding a flagship is adding a row here — and marking
// the case FLAGSHIP in the export.
// Client testimonials on home, client first, before the LinkedIn-verified
// recommendation. Ahmed drafted these at the clients' request; each person
// approved the final wording and the use of their name before it shipped.
// Changing a quote means getting that approval again. No LinkedIn badge: that
// mark stays on recommendations that are actually on LinkedIn.
// `name` and `initials` are per locale only where the script changes (Arabic);
// every other locale falls back to `en`.
export const CLIENT_QUOTES = [
  {
    name: { en: 'Remon Adel', ar: 'ريمون عادل' }, initials: { en: 'RA', ar: 'ر' },
    role: { en: 'CTO, Recovery Advisers', ar: 'المدير التقني، Recovery Advisers', de: 'CTO, Recovery Advisers', es: 'CTO, Recovery Advisers', fr: 'CTO, Recovery Advisers' },
    quote: {
      en: "He rebuilt our case system while the team kept using it every day, which I honestly didn't think was possible. Our clients now check their own case status instead of emailing us.",
      ar: 'أعاد بناء نظام القضايا لدينا بينما كان الفريق يستخدمه كل يوم، وبصراحة لم أكن أظن ذلك ممكنًا. عملاؤنا الآن يتابعون حالة قضاياهم بأنفسهم بدل مراسلتنا.',
      de: 'Er hat unser Fallsystem neu gebaut, während das Team es jeden Tag benutzt hat. Ehrlich gesagt hätte ich das nicht für möglich gehalten. Unsere Mandanten sehen ihren Fallstatus jetzt selbst, statt uns zu mailen.',
      es: 'Reconstruyó nuestro sistema de casos mientras el equipo lo usaba cada día, algo que sinceramente no creía posible. Ahora nuestros clientes consultan el estado de su caso ellos mismos en lugar de escribirnos.',
      fr: 'Il a reconstruit notre système de dossiers pendant que l’équipe l’utilisait tous les jours, ce que je ne pensais honnêtement pas possible. Nos clients consultent maintenant eux-mêmes l’état de leur dossier au lieu de nous écrire.',
    },
  },
  {
    name: { en: 'Mohamed Atef', ar: 'محمد عاطف' }, initials: { en: 'MA', ar: 'م' },
    role: { en: 'Tech Lead, Yelo Sale', ar: 'قائد الفريق التقني، Yelo Sale', de: 'Tech Lead, Yelo Sale', es: 'Líder técnico, Yelo Sale', fr: 'Responsable technique, Yelo Sale' },
    quote: {
      en: "Live auctions don't forgive mistakes. One bid in the wrong order and you lose a buyer's trust. Ahmed owned that part, web and mobile, Arabic and English, and it held up when real traffic hit it.",
      ar: 'المزادات المباشرة لا تغفر الأخطاء. مزايدة واحدة بترتيب خاطئ وتخسر ثقة المشتري. تولّى أحمد هذا الجزء على الويب والجوال، بالعربية والإنجليزية، وصمد النظام حين جاءت الحركة الحقيقية.',
      de: 'Live-Auktionen verzeihen keine Fehler. Ein Gebot in der falschen Reihenfolge, und das Vertrauen des Käufers ist weg. Ahmed hat diesen Teil verantwortet, Web und Mobile, Arabisch und Englisch, und es hat gehalten, als echter Traffic kam.',
      es: 'Las subastas en vivo no perdonan errores. Una puja en el orden equivocado y pierdes la confianza del comprador. Ahmed se encargó de esa parte, web y móvil, árabe e inglés, y aguantó cuando llegó el tráfico real.',
      fr: 'Les enchères en direct ne pardonnent pas. Une offre dans le mauvais ordre et vous perdez la confiance de l’acheteur. Ahmed a pris cette partie en charge, web et mobile, arabe et anglais, et tout a tenu quand le vrai trafic est arrivé.',
    },
  },
  {
    name: { en: 'Bandar', ar: 'بندر' }, initials: { en: 'B', ar: 'ب' },
    role: { en: 'Founder, Ibdaa Course & Applyni', ar: 'مؤسس Ibdaa Course وApplyni', de: 'Gründer, Ibdaa Course & Applyni', es: 'Fundador, Ibdaa Course y Applyni', fr: 'Fondateur, Ibdaa Course et Applyni' },
    quote: {
      en: "I'm not technical, and Ahmed never made me feel it. He built the whole platform and explained every decision in words I could follow. When he handed it over, we actually knew how to run it.",
      ar: 'لست تقنيًا، ولم يُشعرني أحمد بذلك يومًا. بنى المنصّة كاملة وشرح كل قرار بكلام أفهمه. وحين سلّمها، كنا نعرف فعلًا كيف نديرها.',
      de: 'Ich bin kein Techniker, und Ahmed hat mich das nie spüren lassen. Er hat die ganze Plattform gebaut und jede Entscheidung so erklärt, dass ich sie verstanden habe. Bei der Übergabe wussten wir wirklich, wie wir sie betreiben.',
      es: 'No soy técnico, y Ahmed nunca me lo hizo sentir. Construyó toda la plataforma y explicó cada decisión con palabras que yo entendía. Cuando nos la entregó, sabíamos de verdad cómo llevarla.',
      fr: 'Je ne suis pas technique, et Ahmed ne me l’a jamais fait sentir. Il a construit toute la plateforme et expliqué chaque décision avec des mots que je comprenais. À la livraison, nous savions vraiment la faire tourner.',
    },
  },
  {
    name: { en: 'Amr Khalaf', ar: 'عمرو خلف' }, initials: { en: 'AK', ar: 'ع' },
    role: { en: 'CEO, Compass Med', ar: 'الرئيس التنفيذي، Compass Med', de: 'CEO, Compass Med', es: 'CEO, Compass Med', fr: 'PDG, Compass Med' },
    quote: {
      en: "Ahmed handled the engineering and a lot of the design for our store and internal tools. For a company our size, that meant one person who understood both the product and the business, instead of two who didn't talk.",
      ar: 'تولّى أحمد الجانب الهندسي وجزءًا كبيرًا من التصميم لمتجرنا وأدواتنا الداخلية. لشركة بحجمنا، كان ذلك يعني شخصًا واحدًا يفهم المنتج والعمل معًا، بدل شخصين لا يتحدثان مع بعضهما.',
      de: 'Ahmed hat die Technik und einen großen Teil des Designs für unseren Shop und unsere internen Tools übernommen. Für ein Unternehmen unserer Größe hieß das: eine Person, die Produkt und Geschäft versteht, statt zwei, die nicht miteinander reden.',
      es: 'Ahmed se ocupó de la ingeniería y de buena parte del diseño de nuestra tienda y nuestras herramientas internas. Para una empresa de nuestro tamaño, eso significó una sola persona que entendía el producto y el negocio, en vez de dos que no se hablaban.',
      fr: 'Ahmed s’est occupé de l’ingénierie et d’une bonne partie du design de notre boutique et de nos outils internes. Pour une entreprise de notre taille, cela voulait dire une seule personne qui comprenait le produit et le métier, au lieu de deux qui ne se parlaient pas.',
    },
  },
  {
    name: { en: 'Amar Khalil', ar: 'عمار خليل' }, initials: { en: 'AK', ar: 'ع' },
    role: { en: 'Project Manager, Phonic Maps', ar: 'مدير المشروع، Phonic Maps', de: 'Projektmanager, Phonic Maps', es: 'Jefe de proyecto, Phonic Maps', fr: 'Chef de projet, Phonic Maps' },
    quote: {
      en: "We manage reviews for a lot of locations, and before this it was tab after tab. Now it's one screen, with replies drafted for us. He also flagged problems before we ran into them, which doesn't happen often.",
      ar: 'ندير التقييمات لعدد كبير من الفروع، وكان الأمر قبل ذلك تبويبًا بعد تبويب. الآن أصبح شاشة واحدة، والردود تُصاغ لنا. وكان ينبّهنا إلى المشكلات قبل أن نقع فيها، وهذا نادر.',
      de: 'Wir verwalten Bewertungen für viele Standorte, und vorher war das Tab um Tab. Jetzt ist es ein Bildschirm, die Antworten werden für uns vorformuliert. Und er hat uns auf Probleme hingewiesen, bevor wir hineingelaufen sind. Das erlebt man selten.',
      es: 'Gestionamos reseñas de muchas sedes, y antes era pestaña tras pestaña. Ahora es una sola pantalla, con las respuestas redactadas para nosotros. Además nos avisaba de los problemas antes de que llegáramos a ellos, y eso no pasa a menudo.',
      fr: 'Nous gérons les avis de nombreux établissements, et avant c’était onglet après onglet. Maintenant tout tient sur un écran, avec des réponses rédigées pour nous. Et il nous prévenait des problèmes avant qu’on tombe dessus, ce qui est rare.',
    },
  },
];

export const FLAGSHIP = [
  { name: 'Yelo Sale', slug: 'yelo-sale' },
  { name: 'Qoralia', slug: 'qoralia' },
  { name: 'KhebraOS', slug: 'khebraos' },
  { name: 'Phonic Maps', slug: 'phonic-maps' },
  { name: 'Recovery Advisers', slug: 'recovery-advisers' },
];

// Strings that mean a fact drifted back to a retired value. Merged into the
// build's FORBIDDEN scan (entries take `s` for a literal or `re` for a /g
// RegExp; `max` is the allowed count across dist/).
export const DRIFT_GUARDS = [
  // LinkedIn slug repair: a path must keep its separator.
  { s: 'iamahmedfaridrecent', max: 0 },
  { re: /linkedin\.com\/in\/iamahmedfarid[A-Za-z0-9]/g, max: 0 },
  // Insecure / tracking link forms the build cleans.
  { s: 'http://www.compass-egy.com', max: 0 },
  { s: 'originalSubdomain', max: 0 },
  // The services pricing CTA said "30-min call"; it now matches the contact
  // block's "30-minute scoping call" wording in every locale.
  { s: 'Book a 30-min call', max: 0 },
  { s: 'احجز مكالمة ٣٠ دقيقة', max: 0 },
  { s: '30-Minuten-Call buchen', max: 0 },
  { s: 'Reservar una llamada de 30 min', max: 0 },
  { s: 'Réserver un appel de 30 min', max: 0 },
  // RevealSite brand count is METRICS.whiteLabelBrands (13+), not 12+.
  { s: '12+ branded', max: 0 },
  { s: 'وراء +١٢', max: 0 },
  { s: 'hinter 12+ Marken', max: 0 },
  { s: 'tras 12+ apps', max: 0 },
  { s: 'derrière 12+ apps', max: 0 },
  // Years: public copy says "6+" or "over six years", never a bare six/5.
  // These fail closed: a legitimate "twenty-six years" or "dix-six ans" would
  // also stop the build — reword it or add a lookbehind, don't drop the guard.
  { s: 'Six years', max: 0 },
  { re: /(?<![Oo]ver |[Mm]ore than )\bsix years\b/g, max: 0 },
  { re: /(?<!أكثر من )ست سنوات/g, max: 0 },
  { re: /(?<![Üü]ber |mehr als )[Ss]echs Jahre/g, max: 0 },
  { re: /(?<![Mm]ás de )[Ss]eis años/g, max: 0 },
  { re: /(?<![Pp]lus de )[Ss]ix ans/g, max: 0 },
  { re: /\b6 (years|Jahre|años|ans)\b/g, max: 0 },
];
