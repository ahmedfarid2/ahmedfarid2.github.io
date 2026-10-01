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

export const METRICS = {
  // Owner-confirmed canonical claim: first paid to write code in 2019.
  years: { display: '6+', evidence: 'professional since 2019 (owner-confirmed)' },
  storeApps: { display: '12+', evidence: '15 distinct App Store / Google Play links across the case studies' },
  products: { display: '27+', evidence: 'case studies + RevealSite fleet + own products + builds, all linked' },
  countries: { display: '17+', evidence: '17 country flags listed in the Reach section' },
  flagship: { display: '9+', evidence: '12 case studies, 5 marked FLAGSHIP' },
  whiteLabelBrands: { display: '13+', evidence: 'RevealSite fleet: 13 pharmacies + Almani institute (14 products & storefronts)' },
  companies: { display: '8+', evidence: '12+ companies named in Experience' },
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
  home: {
    en: {
      title: 'Ahmed Farid — Senior Software Engineer in Dubai · Multi-tenant SaaS',
      description: 'Dubai-based Senior Software Engineer (6+ years): real-time, multi-tenant SaaS, end to end — Laravel, Next.js, Flutter. Open to senior roles and consulting.',
    },
    ar: {
      title: 'Ahmed Farid — مهندس برمجيات أول في دبي · منصّات SaaS متعدّدة المستأجرين',
      description: 'مهندس برمجيات أول مقيم في دبي (+6 سنوات): منصّات SaaS فورية متعدّدة المستأجرين من البداية إلى النهاية — Laravel وNext.js وFlutter. متاح لأدوار أولى واستشارات.',
    },
    de: {
      title: 'Ahmed Farid — Senior-Softwareentwickler in Dubai · Multi-Tenant-SaaS',
      description: 'Senior-Softwareentwickler in Dubai (6+ Jahre): Echtzeit-Multi-Tenant-SaaS, end to end — Laravel, Next.js, Flutter. Offen für Senior-Rollen und Beratung.',
    },
    es: {
      title: 'Ahmed Farid — Ingeniero de Software Senior en Dubái · SaaS multi-tenant',
      description: 'Ingeniero de Software Senior en Dubái (6+ años): SaaS multi-tenant en tiempo real, de principio a fin — Laravel, Next.js, Flutter. Abierto a roles senior y consultoría.',
    },
    fr: {
      title: 'Ahmed Farid — Ingénieur logiciel senior à Dubaï · SaaS multi-tenant',
      description: 'Ingénieur logiciel senior à Dubaï (6+ ans) : SaaS multi-tenant temps réel, de bout en bout — Laravel, Next.js, Flutter. Ouvert aux postes senior et au conseil.',
    },
  },
  services: {
    en: {
      title: 'Freelance & Consulting — Ahmed Farid, Senior Software Engineer',
      description: 'Fixed-scope builds, engineering retainers and architecture reviews for real-time, multi-tenant SaaS — with pricing, FAQ and a 30-minute scoping call. Dubai-based.',
    },
    ar: {
      title: 'العمل الحر والاستشارات — Ahmed Farid، مهندس برمجيات أول',
      description: 'مشاريع محدّدة النطاق، وعقود هندسية مستمرة، ومراجعات معمارية لمنصّات SaaS فورية متعدّدة المستأجرين — مع الأسعار والأسئلة الشائعة ومكالمة تحديد نطاق مدتها 30 دقيقة. من دبي.',
    },
    de: {
      title: 'Freelance & Beratung — Ahmed Farid, Senior-Softwareentwickler',
      description: 'Festpreis-Projekte, Engineering-Retainer und Architektur-Reviews für Echtzeit-Multi-Tenant-SaaS — mit Preisen, FAQ und 30-minütigem Scoping-Call. Aus Dubai.',
    },
    es: {
      title: 'Freelance y consultoría — Ahmed Farid, Ingeniero de Software Senior',
      description: 'Proyectos de alcance cerrado, retainers de ingeniería y revisiones de arquitectura para SaaS multi-tenant en tiempo real — con precios, FAQ y llamada de alcance de 30 min. Desde Dubái.',
    },
    fr: {
      title: 'Freelance & conseil — Ahmed Farid, Ingénieur logiciel senior',
      description: 'Projets au forfait, retainers d’ingénierie et revues d’architecture pour SaaS multi-tenant temps réel — tarifs, FAQ et appel de cadrage de 30 min. Basé à Dubaï.',
    },
  },
};

// Strings that mean a fact drifted back to a retired value. Merged into the
// build's FORBIDDEN scan (entries take `s` for a literal or `re` for a /g
// RegExp; `max` is the allowed count across dist/).
export const DRIFT_GUARDS = [
  // LinkedIn slug repair: a path must keep its separator.
  { s: 'iamahmedfaridrecent', max: 0 },
  { re: /linkedin\.com\/in\/iamahmedfarid[A-Za-z0-9]/g, max: 0 },
  // Tracking parameter stripped from LinkedIn company links. (The Compass Med
  // link stays on http:// until its https:// form is confirmed to resolve.)
  { s: 'originalSubdomain', max: 0 },
  // RevealSite brand count is METRICS.whiteLabelBrands (13+), not 12+.
  { s: '12+ branded', max: 0 },
  // Years: public copy says "6+" or "over six years", never a bare six/5.
  { s: 'Six years', max: 0 },
  { re: /(?<![Oo]ver |[Mm]ore than )\bsix years\b/g, max: 0 },
  { re: /(?<!أكثر من )ست سنوات/g, max: 0 },
  { re: /(?<![Üü]ber |mehr als )[Ss]echs Jahre/g, max: 0 },
  { re: /(?<![Mm]ás de )[Ss]eis años/g, max: 0 },
  { re: /(?<![Pp]lus de )[Ss]ix ans/g, max: 0 },
  { re: /\b6 (years|Jahre|años|ans)\b/g, max: 0 },
];
