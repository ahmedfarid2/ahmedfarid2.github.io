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
// Company-only (owner decision, Nov 2026; docs/STUDIO-SPEC.md "Company-only
// decision"): every page speaks for Ahmed Farid Studio to a client. No title
// or description pitches a person for hire; "Ahmed Farid" stays in every
// title through the studio name, which keeps the name search.
export const SEO = {
  home: {
    en: {
      title: 'Ahmed Farid Studio — Custom Software, SaaS & Mobile App Development · Dubai',
      description: 'Dubai software development studio for founders and businesses: custom SaaS, web and mobile apps and AI features, built end to end. Fixed-price builds and retainers.',
    },
    ar: {
      title: 'Ahmed Farid Studio — تطوير برمجيات مخصّصة وSaaS وتطبيقات جوّال · دبي',
      description: 'استوديو تطوير برمجيات في دبي للمؤسّسين والشركات: منصّات SaaS وتطبيقات ويب وجوّال ومزايا ذكاء اصطناعي، من البداية إلى النهاية. مشاريع بسعر ثابت وعقود شهرية.',
    },
    de: {
      title: 'Ahmed Farid Studio — Individualsoftware, SaaS & App-Entwicklung · Dubai',
      description: 'Softwareentwicklungsstudio in Dubai für Gründer und Unternehmen: SaaS, Web- und Mobile-Apps und KI-Funktionen, end to end gebaut. Festpreis-Projekte und Retainer.',
    },
    es: {
      title: 'Ahmed Farid Studio — Software a medida, SaaS y apps móviles · Dubái',
      description: 'Estudio de desarrollo de software en Dubái para fundadores y empresas: SaaS, apps web y móviles y funciones de IA, de punta a punta. Precio cerrado o retainer mensual.',
    },
    fr: {
      title: 'Ahmed Farid Studio — Logiciel sur mesure, SaaS et apps mobiles · Dubaï',
      description: 'Studio de développement logiciel à Dubaï pour fondateurs et entreprises : SaaS, applications web et mobiles, fonctions IA, de bout en bout. Au forfait ou en retainer.',
    },
  },
  services: {
    en: {
      title: 'Laravel & Next.js Development Services & Pricing · Dubai · Ahmed Farid Studio',
      description: 'Fixed-price builds, monthly engineering retainers and architecture reviews for SaaS, web and mobile products, with published prices, FAQ and a 30-minute scoping call.',
    },
    ar: {
      title: 'خدمات تطوير Laravel وNext.js والأسعار · دبي · Ahmed Farid Studio',
      description: 'مشاريع بسعر ثابت وعقود هندسية شهرية ومراجعات معمارية لمنتجات SaaS والويب والجوّال — بأسعار معلنة وأسئلة شائعة ومكالمة تحديد نطاق مدتها ٣٠ دقيقة.',
    },
    de: {
      title: 'Laravel- & Next.js-Entwicklung: Leistungen & Preise · Ahmed Farid Studio',
      description: 'Festpreis-Projekte, monatliche Engineering-Retainer und Architektur-Reviews für SaaS-, Web- und Mobile-Produkte — mit Preisen, FAQ und 30-minütigem Scoping-Call.',
    },
    es: {
      title: 'Desarrollo Laravel y Next.js: servicios y precios · Ahmed Farid Studio',
      description: 'Proyectos a precio cerrado, retainers mensuales de ingeniería y revisiones de arquitectura para productos SaaS, web y móviles — con precios, FAQ y llamada de 30 min.',
    },
    fr: {
      title: 'Développement Laravel & Next.js : services et tarifs · Ahmed Farid Studio',
      description: 'Projets au forfait, retainers d’ingénierie mensuels et revues d’architecture pour produits SaaS, web et mobiles — tarifs publiés, FAQ et appel de cadrage de 30 min.',
    },
  },
  work: {
    en: {
      title: 'Case Studies — SaaS, Real-Time & Mobile Products · Ahmed Farid Studio',
      description: 'Case studies of production systems: multi-tenant SaaS, AI-assisted tools, live auctions and Flutter apps shipped across the Gulf, US and UK. Client projects labelled.',
    },
    ar: {
      title: 'دراسات الحالة — منتجات SaaS والأنظمة الفورية والجوّال · Ahmed Farid Studio',
      description: 'دراسات حالة لأنظمة في الإنتاج: منصّات SaaS متعدّدة المستأجرين، أدوات بالذكاء الاصطناعي، مزادات مباشرة وتطبيقات Flutter، مع تمييز واضح لمشاريع العملاء.',
    },
    de: {
      title: 'Fallstudien — SaaS, Echtzeit & Mobile · Ahmed Farid Studio',
      description: 'Fallstudien produktiver Systeme: Multi-Tenant-SaaS, KI-gestützte Tools, Live-Auktionen und Flutter-Apps für den Golf, die USA und Großbritannien. Kundenprojekte markiert.',
    },
    es: {
      title: 'Casos de estudio — SaaS, tiempo real y móvil · Ahmed Farid Studio',
      description: 'Casos de estudio de sistemas en producción: SaaS multi-tenant, herramientas con IA, subastas en vivo y apps Flutter en el Golfo, EE. UU. y Reino Unido.',
    },
    fr: {
      title: 'Études de cas — SaaS, temps réel et mobile · Ahmed Farid Studio',
      description: 'Études de cas de systèmes en production : SaaS multi-tenant, outils d’IA, enchères en direct et apps Flutter livrés dans le Golfe, aux États-Unis et au Royaume-Uni.',
    },
  },
  about: {
    en: {
      title: 'About Ahmed Farid Studio — Senior-Led Software Development, Dubai',
      description: 'Who builds your software: a senior-led team of 7+, founded by Ahmed Farid in 2022. Capabilities, delivery process, engineering principles and how engagements work.',
    },
    ar: {
      title: 'عن Ahmed Farid Studio — استوديو تطوير برمجيات بقيادة كبار المهندسين · دبي',
      description: 'من يبني برمجياتك: فريق من أكثر من ٧ أشخاص بقيادة مهندس أول، أسّسه أحمد فريد عام ٢٠٢٢. القدرات وطريقة التسليم والمبادئ الهندسية وكيف يسير التعاون.',
    },
    de: {
      title: 'Über Ahmed Farid Studio — Softwareentwicklung unter Senior-Leitung, Dubai',
      description: 'Wer Ihre Software baut: ein Team aus 7+ Personen unter Senior-Leitung, 2022 von Ahmed Farid gegründet. Leistungen, Lieferprozess, Prinzipien und Zusammenarbeit.',
    },
    es: {
      title: 'Sobre Ahmed Farid Studio — Desarrollo de software con liderazgo sénior',
      description: 'Quién construye tu software: un equipo de más de 7 personas con liderazgo sénior, fundado por Ahmed Farid en 2022. Capacidades, proceso, principios y colaboración.',
    },
    fr: {
      title: 'À propos d’Ahmed Farid Studio — Studio logiciel à Dubaï',
      description: 'Qui construit votre logiciel : une équipe de plus de 7 personnes encadrée par des seniors, fondée par Ahmed Farid en 2022. Compétences, méthode, principes, collaboration.',
    },
  },
  contact: {
    en: {
      title: 'Request a Proposal — Ahmed Farid Studio · Book a Scoping Call · Dubai',
      description: 'Tell us about your project: book a 30-minute scoping call, send a brief or message us on WhatsApp. A written scope and fixed price within 2 business days. GMT+4.',
    },
    ar: {
      title: 'اطلب عرضًا — Ahmed Farid Studio · احجز مكالمة تحديد نطاق · دبي',
      description: 'أخبرنا عن مشروعك: احجز مكالمة تحديد نطاق مدتها ٣٠ دقيقة، أو أرسل وصف المشروع، أو راسلنا عبر واتساب. نطاق مكتوب وسعر ثابت خلال يومَي عمل. GMT+4.',
    },
    de: {
      title: 'Angebot anfragen — Ahmed Farid Studio · Scoping-Call buchen · Dubai',
      description: 'Erzählen Sie uns von Ihrem Projekt: Scoping-Call (30 Min.) buchen, Briefing senden oder per WhatsApp schreiben. Schriftlicher Umfang und Festpreis in 2 Werktagen.',
    },
    es: {
      title: 'Solicita una propuesta — Ahmed Farid Studio · Llamada de alcance · Dubái',
      description: 'Cuéntanos tu proyecto: agenda una llamada de alcance de 30 minutos, envía un brief o escríbenos por WhatsApp. Alcance por escrito y precio cerrado en 2 días hábiles.',
    },
    fr: {
      title: 'Demander une proposition — Ahmed Farid Studio · Appel de cadrage · Dubaï',
      description: 'Parlez-nous de votre projet : appel de cadrage de 30 minutes, brief écrit ou WhatsApp. Un périmètre écrit et un prix fixe sous 2 jours ouvrés. Basé à Dubaï (GMT+4).',
    },
  },
};

// Page names and link labels the build writes into the navigation, breadcrumbs
// and cards, per locale. The company structure (Nov 2026): Case studies,
// Services, Company (/about/), Contact; the URLs stay as they were. Brand and case names
// are never translated and do not appear here. Arrows are written by the build
// as "→" in every locale.
//   work/services/about/contact  the four navigation links
//   pricing                      the home hero's button to /services/
//   caseStudy / allWork / moreWork  project cards and the links around them
//   insights / writeUp           the footer link to /insights/ and the label of
//                                a case study's link to its write-up (English)
export const NAV = {
  en: { work: 'Case studies', services: 'Services', about: 'Company', contact: 'Contact', caseStudy: 'Case study', allWork: 'All case studies', moreWork: 'More case studies', pricing: 'Services & pricing', insights: 'Insights', writeUp: 'Engineering write-up' },
  ar: { work: 'دراسات الحالة', services: 'الخدمات', about: 'من نحن', contact: 'تواصل', caseStudy: 'دراسة الحالة', allWork: 'كل دراسات الحالة', moreWork: 'دراسات حالة أخرى', pricing: 'الخدمات والأسعار', insights: 'مقالات', writeUp: 'مقال تقني (بالإنجليزية)' },
  de: { work: 'Fallstudien', services: 'Leistungen', about: 'Über uns', contact: 'Kontakt', caseStudy: 'Fallstudie', allWork: 'Alle Fallstudien', moreWork: 'Weitere Fallstudien', pricing: 'Leistungen & Preise', insights: 'Artikel', writeUp: 'Technischer Artikel (auf Englisch)' },
  es: { work: 'Casos', services: 'Servicios', about: 'Nosotros', contact: 'Contacto', caseStudy: 'Caso de estudio', allWork: 'Todos los casos', moreWork: 'Más casos', pricing: 'Servicios y precios', insights: 'Artículos', writeUp: 'Artículo técnico (en inglés)' },
  fr: { work: 'Études de cas', services: 'Services', about: 'Le studio', contact: 'Contact', caseStudy: 'Étude de cas', allWork: 'Toutes les études de cas', moreWork: 'Autres études de cas', pricing: 'Services et tarifs', insights: 'Articles', writeUp: 'Article technique (en anglais)' },
};

// The five flagship case studies, each with a page of its own at
// /work/<slug>/ in every locale. `name` is the export's case-study name (brand
// names are never translated, so it is the same in all five locales and is how
// the build finds the case in the render); `slug` is the URL segment and is the
// same in every locale. Adding a flagship is adding a row here — and marking
// the case FLAGSHIP in the export.
// Testimonials on home, before the LinkedIn-verified recommendation: client
// projects first, then people from companies where Ahmed held a role. Every
// card shows PROVENANCE_LABEL from `provenance` (rule R1: an employer's quote
// is never presented as a client's). Ahmed drafted these at the clients' request; each person
// approved the final wording and the use of their name before it shipped.
// Changing a quote means getting that approval again. No LinkedIn badge: that
// mark stays on recommendations that are actually on LinkedIn.
// `name` and `initials` are per locale only where the script changes (Arabic);
// every other locale falls back to `en`. `caseStudy` is the FLAGSHIP slug of
// the product the quote is about; the card links to that case study.
export const CLIENT_QUOTES = [
  {
    name: { en: 'Bandar', ar: 'بندر' }, initials: { en: 'B', ar: 'ب' },
    provenance: 'client',
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
    name: { en: 'Amr Khalil', ar: 'عمرو خليل' }, initials: { en: 'AK', ar: 'ع' },
    provenance: 'client',
    role: { en: 'Project Manager, Phonic Maps', ar: 'مدير المشروع، Phonic Maps', de: 'Projektmanager, Phonic Maps', es: 'Jefe de proyecto, Phonic Maps', fr: 'Chef de projet, Phonic Maps' },
    caseStudy: 'phonic-maps',
    quote: {
      en: "We manage reviews for a lot of locations, and before this it was tab after tab. Now it's one screen, with replies drafted for us. He also flagged problems before we ran into them, which doesn't happen often.",
      ar: 'ندير التقييمات لعدد كبير من الفروع، وكان الأمر قبل ذلك تبويبًا بعد تبويب. الآن أصبح شاشة واحدة، والردود تُصاغ لنا. وكان ينبّهنا إلى المشكلات قبل أن نقع فيها، وهذا نادر.',
      de: 'Wir verwalten Bewertungen für viele Standorte, und vorher war das Tab um Tab. Jetzt ist es ein Bildschirm, die Antworten werden für uns vorformuliert. Und er hat uns auf Probleme hingewiesen, bevor wir hineingelaufen sind. Das erlebt man selten.',
      es: 'Gestionamos reseñas de muchas sedes, y antes era pestaña tras pestaña. Ahora es una sola pantalla, con las respuestas redactadas para nosotros. Además nos avisaba de los problemas antes de que llegáramos a ellos, y eso no pasa a menudo.',
      fr: 'Nous gérons les avis de nombreux établissements, et avant c’était onglet après onglet. Maintenant tout tient sur un écran, avec des réponses rédigées pour nous. Et il nous prévenait des problèmes avant qu’on tombe dessus, ce qui est rare.',
    },
  },
  {
    name: { en: 'Remon Adel', ar: 'ريمون عادل' }, initials: { en: 'RA', ar: 'ر' },
    provenance: 'employment',
    role: { en: 'CTO, Recovery Advisers', ar: 'المدير التقني، Recovery Advisers', de: 'CTO, Recovery Advisers', es: 'CTO, Recovery Advisers', fr: 'CTO, Recovery Advisers' },
    caseStudy: 'recovery-advisers',
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
    provenance: 'employment',
    role: { en: 'Tech Lead, Yelo Sale', ar: 'قائد الفريق التقني، Yelo Sale', de: 'Tech Lead, Yelo Sale', es: 'Líder técnico, Yelo Sale', fr: 'Responsable technique, Yelo Sale' },
    caseStudy: 'yelo-sale',
    quote: {
      en: "Live auctions don't forgive mistakes. One bid in the wrong order and you lose a buyer's trust. Ahmed owned that part, web and mobile, Arabic and English, and it held up when real traffic hit it.",
      ar: 'المزادات المباشرة لا تغفر الأخطاء. مزايدة واحدة بترتيب خاطئ وتخسر ثقة المشتري. تولّى أحمد هذا الجزء على الويب والجوال، بالعربية والإنجليزية، وصمد النظام حين جاءت الحركة الحقيقية.',
      de: 'Live-Auktionen verzeihen keine Fehler. Ein Gebot in der falschen Reihenfolge, und das Vertrauen des Käufers ist weg. Ahmed hat diesen Teil verantwortet, Web und Mobile, Arabisch und Englisch, und es hat gehalten, als echter Traffic kam.',
      es: 'Las subastas en vivo no perdonan errores. Una puja en el orden equivocado y pierdes la confianza del comprador. Ahmed se encargó de esa parte, web y móvil, árabe e inglés, y aguantó cuando llegó el tráfico real.',
      fr: 'Les enchères en direct ne pardonnent pas. Une offre dans le mauvais ordre et vous perdez la confiance de l’acheteur. Ahmed a pris cette partie en charge, web et mobile, arabe et anglais, et tout a tenu quand le vrai trafic est arrivé.',
    },
  },
  {
    name: { en: 'Amr Khalaf', ar: 'عمرو خلف' }, initials: { en: 'AK', ar: 'ع' },
    provenance: 'employment',
    role: { en: 'CEO, Compass Med', ar: 'الرئيس التنفيذي، Compass Med', de: 'CEO, Compass Med', es: 'CEO, Compass Med', fr: 'PDG, Compass Med' },
    quote: {
      en: "Ahmed handled the engineering and a lot of the design for our store and internal tools. For a company our size, that meant one person who understood both the product and the business, instead of two who didn't talk.",
      ar: 'تولّى أحمد الجانب الهندسي وجزءًا كبيرًا من التصميم لمتجرنا وأدواتنا الداخلية. لشركة بحجمنا، كان ذلك يعني شخصًا واحدًا يفهم المنتج والعمل معًا، بدل شخصين لا يتحدثان مع بعضهما.',
      de: 'Ahmed hat die Technik und einen großen Teil des Designs für unseren Shop und unsere internen Tools übernommen. Für ein Unternehmen unserer Größe hieß das: eine Person, die Produkt und Geschäft versteht, statt zwei, die nicht miteinander reden.',
      es: 'Ahmed se ocupó de la ingeniería y de buena parte del diseño de nuestra tienda y nuestras herramientas internas. Para una empresa de nuestro tamaño, eso significó una sola persona que entendía el producto y el negocio, en vez de dos que no se hablaban.',
      fr: 'Ahmed s’est occupé de l’ingénierie et d’une bonne partie du design de notre boutique et de nos outils internes. Pour une entreprise de notre taille, cela voulait dire une seule personne qui comprenait le produit et le métier, au lieu de deux qui ne se parlaient pas.',
    },
  },
];

// Who each case study was built for (owner-confirmed, Nov 2026). `employment`:
// a role Ahmed held at that company; `client`: work delivered to a client.
// Every case on /work/ carries one label (docs/STUDIO-SPEC.md, rule R1: a
// role is never shown as clientele). Keyed by the export's case name; the
// build fails if a case on the page has no entry here.
export const CASE_PROVENANCE = {
  'Yelo Sale': 'employment',
  'Recovery Advisers': 'employment',
  'RevealSite': 'employment',
  'Compass Med': 'employment',
  'Qoralia': 'client',
  'KhebraOS': 'client',
  'Phonic Maps': 'client',
  'Fixawy': 'client',
  'Proven Group': 'client',
  'Ibdaa Course': 'client',
  'Applyni': 'client',
  'Ezhal': 'client',
};
export const PROVENANCE_LABEL = {
  en: { client: 'Client project', employment: 'In-house role' },
  ar: { client: 'مشروع لعميل', employment: 'دور داخلي' },
  de: { client: 'Kundenprojekt', employment: 'Interne Rolle' },
  es: { client: 'Proyecto para cliente', employment: 'Puesto en plantilla' },
  fr: { client: 'Projet client', employment: 'Poste en interne' },
};

// Client projects taken per quarter (owner-confirmed, Nov 2026), stated on
// /services/ under the plans. One number, never hard-coded in copy.
export const CAPACITY = { projectsPerQuarter: 4, availableNow: true };

// The practice's name (owner-confirmed, Nov 2026; docs/STUDIO-SPEC.md 2.1):
// founder-led, so the person's name leads. It sits next to the name in the
// nav, the footer and the home title. A brand name, never translated. No
// "we" or team copy goes with it until a named member is on the site (R2).
// since: the year the independent practice started (CV: freelance, Jan 2022).
export const STUDIO = { name: 'Ahmed Farid Studio', suffix: 'Studio', since: 2022 };

// The footer's bottom line on every page: the studio, where it is, since
// when, and the privacy page (English only, like /insights/).
export const STUDIO_FOOT = {
  en: { place: 'Dubai, UAE', since: 'Since', privacy: 'Privacy' },
  ar: { place: 'دبي، الإمارات', since: 'منذ', privacy: 'الخصوصية' },
  de: { place: 'Dubai, VAE', since: 'Seit', privacy: 'Datenschutz' },
  es: { place: 'Dubái, EAU', since: 'Desde', privacy: 'Privacidad' },
  fr: { place: 'Dubaï, EAU', since: 'Depuis', privacy: 'Confidentialité' },
};

// Order is display order (cards on home and /work/, the CollectionPage
// list): client projects first, then the roles Ahmed held, each labelled by
// CASE_PROVENANCE (company-only decision, Nov 2026).
export const FLAGSHIP = [
  { name: 'Qoralia', slug: 'qoralia' },
  { name: 'Phonic Maps', slug: 'phonic-maps' },
  { name: 'KhebraOS', slug: 'khebraos' },
  { name: 'Yelo Sale', slug: 'yelo-sale' },
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
  // Studio claims the site can't back (docs/STUDIO-SPEC.md R1, R3). Narrow on
  // purpose: "Agency-ready" (a Phonic Maps feature) and a client's own "our
  // clients" in a testimonial are fine. The team itself is owner-confirmed
  // (Nov 2026: 7+ people), so "a team of 7+" is allowed; an agency, offices or
  // round-the-clock support are not claims the practice makes.
  { re: /\b(our|my) agency\b|وكالتنا|unsere Agentur|nuestra agencia|notre agence/gi, max: 0 },
  { re: /\b(dedicated team|offices in)\b|24\/7/gi, max: 0 },
  // No legal entity exists yet (owner, Nov 2026): the studio works and
  // invoices through Ahmed personally. Nothing may claim a registered
  // company, a company suffix or a trade licence until the papers exist.
  { re: /\b(LLC|L\.L\.C\.?|FZ-?LLC|FZE|FZCO|Ltd\.?|registered (company|business)|trade licen[cs]e)\b|ذ\.م\.م|شركة مسجّ?لة|رخصة تجارية|eingetragene Firma|empresa registrada|société immatriculée/gi, max: 0 },
  // The team is described as it is (owner, Nov 2026: a senior-led team of
  // 7+), never as an unnamed "vetted team" (docs/STUDIO-SPEC.md 2.3).
  { re: /vetted team|erprobtes Team|erprobten Team|equipo probado|équipe éprouvée|فريق مؤهّل/gi, max: 0 },
  // A role Ahmed held is never presented as a client (R1).
  { re: /\bour clients?\b[^.<]{0,80}\b(Yelo|Recovery Advisers|RevealSite|Arab Bank|Compass Med)\b/gi, max: 0 },
  // Company-only (owner decision, Nov 2026; docs/STUDIO-SPEC.md): the site
  // sells the studio's work to clients and recruits no one. The CV PDF stays
  // served at its URL for links already out there, but no page, llms.txt or
  // sitemap points at it, and no page pitches a hire.
  { s: 'Ahmed-Farid-CV.pdf', max: 0 },
  { re: /\bsenior roles?\b|Senior-Rolle|puesto senior|poste senior|دور (هندسي )?أول/gi, max: 0 },
  { re: /\bfull-time (senior )?(engineering )?roles?\b|\bopen to (senior|full-time)\b|Senior Software Engineer role/gi, max: 0 },
  // The first-visit intro splash names the studio, not a job title.
  { re: /class="intro-role">[^<]*(Senior|Engineer|مهندس|Entwickler|Ingeniero|Ingénieur)/g, max: 0 },
];
