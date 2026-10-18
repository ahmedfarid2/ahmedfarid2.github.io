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
export const ANALYTICS = { umamiWebsiteId: '58daf3f0-a2f3-48b7-8bfd-895a96e3607a' };

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
  calendly: 'https://calendly.com/ahmedfareed2025/30min',
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
  whiteLabelBrands: { display: '13+', evidence: 'RevealSite fleet: 13 pharmacies + Almani institute (14 products & storefronts)' },
  companies: { display: '8+', evidence: '12+ companies named in Experience; 8+ is a conservative floor' },
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
      description: 'Experience, engineering depth, architecture principles, open-source work and writing — plus the CV for senior roles. Dubai-based, 6+ years in production.',
    },
    ar: {
      title: 'نبذة عن Ahmed Farid — مهندس برمجيات أول في دبي',
      description: 'الخبرة والعمق الهندسي ومبادئ البنية المعمارية والأعمال مفتوحة المصدر والكتابة — إضافةً إلى السيرة الذاتية للأدوار الأولى. مقيم في دبي، +6 سنوات في الإنتاج.',
    },
    de: {
      title: 'Über Ahmed Farid — Senior-Softwareentwickler in Dubai',
      description: 'Erfahrung, technische Tiefe, Architekturprinzipien, Open-Source-Arbeit und Texte — plus der Lebenslauf für Senior-Rollen. In Dubai, 6+ Jahre Praxis in Produktion.',
    },
    es: {
      title: 'Sobre Ahmed Farid — Ingeniero de Software Senior en Dubái',
      description: 'Experiencia, profundidad técnica, principios de arquitectura, código abierto y escritos — además del CV para roles senior. Desde Dubái, 6+ años en producción.',
    },
    fr: {
      title: 'À propos d’Ahmed Farid — Ingénieur logiciel senior à Dubaï',
      description: 'Expérience, profondeur technique, principes d’architecture, open source et écrits — plus le CV pour les postes senior. Basé à Dubaï, 6+ ans en production.',
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
