// scripts/company-copy.mjs
//
// Company-only copy (owner decision, Nov 2026; docs/STUDIO-SPEC.md, "Company-
// only decision"). The site is Ahmed Farid Studio's B2B website: it speaks to
// founders, CTOs and businesses buying software development, and recruits no
// one. Ahmed stays on the page as the founder who leads every project, a
// credibility signal rather than the product.
//
// Applied by build.mjs as the very last copy pass on every page (after
// studio-voice.mjs), by element rather than by exact text, so a re-export that
// rewords a sentence does not leave the personal version behind. Each value
// is set only where its element exists on the page; a missing element is
// reported as a warning per page, never silently skipped.
//
// Honesty rules (docs/STUDIO-SPEC.md R1–R6) hold here too:
//   - roles Ahmed held are never client work: case studies and testimonials
//     from those companies are labelled "In-house role" (PROVENANCE_LABEL);
//   - the only scale claims are the owner-confirmed ones: a senior-led team of
//     7+, 4 client projects a quarter, the studio since 2022 (STUDIO.since,
//     written out in the about text below; owner to verify, STUDIO-SPEC
//     open item 8), Ahmed's 6+ years;
//   - no registered company, office, licence or named team member until the
//     owner supplies them (DRIFT_GUARDS refuse the build otherwise).
//
//   navCta      the phone menu's contact button (said "contact me")
//   introRole   the first-visit intro splash under the name (said
//               "Senior Software Engineer")
//   countriesLabel  the hero's 17+ stat: countries the shipped products reach
//               (founder-wide, employment included), not "countries served"
//   heroH1      home hero heading (HTML: <br> and the gold <span class="it">,
//               which does not wrap: keep it to a word or two, or it
//               overflows a 320px phone; the tag and sub say SaaS/mobile/AI)
//   hi          the line beside the founder's portrait in the hero
//   proof       the hero's link to the testimonials (clients first, then roles)
//   footTag     the footer line under the studio name, on every page
//   work        #work heading/sub (home and /work/): case studies, labelled
//   tests       #testimonials heading/sub
//   products / builds / brands / regions  the /work/ sections that said "I"
//               (or called employers' products clients')
//   contactTitle / connect      /contact/'s h1 and the channel descriptions
//   about       /about/, now the company page: the studio, its founder, the
//               facts (all owner-confirmed, see site-facts.mjs) and portrait
//   depth / arch / why  the capability, principle and "why us" sections
//   archParts   [from, to] sentence parts in the principles that said "I"
//   faq         the three general FAQ items (/about/), rewritten for a buyer:
//               set before the page inventory, so the inventory counts them

export const COMPANY = {
  en: {
    navCta: 'Get in touch →',
    introRole: 'Software development studio',
    countriesLabel: 'Countries reached',
    heroH1: 'Custom software,<br>built <span class="it">end to end.</span>',
    hi: 'Led by founder Ahmed Farid, who is on every project: you talk to the engineer in charge, from the first call to launch.',
    proof: 'Recommended by clients at Phonic Maps and Ibdaa Course, and by leaders at companies where Ahmed held a role. Read what they say ↓',
    footTag: 'Software development studio · SaaS, mobile & AI · Dubai. Fixed-price builds, monthly engineering and architecture reviews.',
    work: {
      h2: 'Selected case studies.',
      sub: 'Client projects first, then products built in roles Ahmed held, each one labelled. Every entry links to the live product, its store listing or its admin panel.',
    },
    tests: {
      h2: 'What clients and colleagues say.',
      sub: 'Client projects first. Quotes from companies where Ahmed held an in-house role are labelled as such; the LinkedIn-verified one is marked.',
    },
    products: {
      h2: 'Products we built and run ourselves.',
      sub: 'Client work shows what we deliver against someone else’s brief. These are our own: we picked the problem, shipped the product and host it on the studio’s domain.',
    },
    builds: { sub: 'Client work and client demos, live on the studio’s domain so you can click through them. Each one is labelled for what it is.' },
    brands: {
      h2: 'Client teams and the companies Ahmed has worked in.',
      sub: 'More real products and teams, client and in-house, beyond the case studies above: from a bank and an e-learning platform to US and UK pharmacy brands. Each name opens its live site.',
    },
    regions: { h2: 'Products and teams in 17+ countries.' },
    contactTitle: 'Request a proposal.',
    connect: {
      LinkedIn: 'The founder’s profile and recommendations.',
      GitHub: 'The founder’s public code. Client work stays private.',
      WhatsApp: 'The fastest way to reach us directly.',
    },
    about: {
      eyebrow: 'The studio',
      h1: ['A senior-led software studio, founded by ', 'Ahmed Farid', '.'],
      p: [
        'Ahmed Farid Studio designs, builds and runs custom software for founders, CTOs and growing businesses: multi-tenant SaaS platforms, web and mobile apps, AI features and internal tools, from the first architecture decision to production and the support after launch. We work from Dubai, on Gulf time, with clients in the region and abroad.',
        'Ahmed founded the studio in 2022 and leads every engagement: he scopes the work, owns the architecture and stays your single point of contact. He has spent over six years shipping production systems, including engineering roles at product companies in the Gulf and the US; case studies from those roles are labelled as in-house work, never as studio clients. Larger builds are delivered with the studio’s senior-led team of 7+.',
      ],
      facts: [['2022', 'Studio founded'], ['7+', 'People on the senior-led team'], ['4', 'Client projects a quarter'], ['6+ yrs', 'Founder in production software']],
      portraitAlt: 'Ahmed Farid, founder of Ahmed Farid Studio',
    },
    depth: { eyebrow: 'Capabilities', h2: 'What we build with.', sub: 'What we use, and why. Mostly proven tools that hold up in production.', toolbelt: 'Everything we ship with: the languages, frameworks and platforms we work in every day.' },
    arch: { eyebrow: 'Engineering principles', h2: ['How we make ', 'technical decisions.'], sub: 'Five principles we apply on every project, and drop when the evidence says otherwise.' },
    archParts: [
      ['I draw the seams in the system before writing the screens.', 'We draw the seams in the system before writing the screens.'],
      ['without paging me', 'without paging anyone'],
      ['and I verify against', 'and we verify against'],
    ],
    why: {
      eyebrow: 'Why the studio', h2: 'Why clients work with us.', them: 'Typical vendor', us: '→ With us', sub: 'What you can expect when we work together.',
      v2: 'Backend, web, mobile and infra, with one senior lead accountable for all of it.',
    },
    faq: [
      ['Who will work on my project?', 'Ahmed Farid, the founder, leads every engagement: he scopes the work, owns the architecture and stays your point of contact. Larger builds add engineers from the studio’s senior-led team of 7+, all under the same NDA and IP terms.'],
      ['Can you take a product from zero?', 'Yes. Architecture, schema, deployment and the first slice in production; then we stay on through scale or hand it over cleanly, with docs, a runbook and 30 days of fixes.'],
      ['Do you build mobile apps?', 'Yes. Flutter apps for iOS and Android, including the App Store and Google Play submission. They work best when we build the API behind them too, so both ends of the contract are ours.'],
    ],
  },
  ar: {
    navCta: 'تواصل معنا ←',
    introRole: 'استوديو تطوير برمجيات',
    countriesLabel: 'دولة وصلت إليها المنتجات',
    heroH1: 'برمجيات مخصّصة،<br><span class="it">من الفكرة إلى الإنتاج.</span>',
    hi: 'بقيادة المؤسّس أحمد فريد، الحاضر في كل مشروع: تتحدّث مع المهندس المسؤول من أول مكالمة حتى الإطلاق.',
    proof: 'موصى بنا من عملاء في Phonic Maps وIbdaa Course، ومن قادة في شركات شغل فيها أحمد أدوارًا داخلية. اقرأ ما قالوه ↓',
    footTag: 'استوديو تطوير برمجيات · SaaS والجوّال والذكاء الاصطناعي · دبي. مشاريع بسعر ثابت، وهندسة شهرية، ومراجعات معمارية.',
    work: {
      h2: 'دراسات حالة مختارة.',
      sub: 'مشاريع العملاء أولًا، ثم منتجات بُنيت في أدوار شغلها أحمد، وكلٌّ منها مُعلَّم. كل عنصر يفتح المنتج الحيّ أو صفحته في المتجر أو لوحة إدارته.',
    },
    tests: {
      h2: 'ما يقوله العملاء والزملاء.',
      sub: 'مشاريع العملاء أولًا. الآراء من شركات شغل فيها أحمد دورًا داخليًا مُعلَّمة بذلك، والتوصية الموثّقة على LinkedIn مُشار إليها.',
    },
    products: {
      eyebrow: 'منتجاتنا الخاصة',
      h2: 'منتجات بنيناها ونديرها بأنفسنا.',
      sub: 'أعمال العملاء تُظهر ما نسلّمه وفق متطلبات غيرنا. أمّا هذه فمنتجاتنا: اخترنا المشكلة، وأطلقنا المنتج، ونستضيفه على نطاق الاستوديو.',
    },
    builds: { sub: 'أعمال وعروض لعملاء، منشورة على نطاق الاستوديو لتتصفّحها بنفسك. كلٌّ منها مُعلَّم بما هو عليه.' },
    brands: {
      h2: 'فِرق العملاء والشركات التي عمل فيها أحمد.',
      sub: 'منتجات وفِرق حقيقية أخرى، لعملاء وفي أدوار داخلية، إلى جانب دراسات الحالة أعلاه: من بنك ومنصّة تعليم إلكتروني إلى علامات صيدليات في الولايات المتحدة والمملكة المتحدة. كل اسم يفتح موقعه الحيّ.',
    },
    regions: { h2: 'منتجات وفِرق في أكثر من ١٧ دولة.' },
    contactTitle: 'اطلب عرضًا.',
    connect: {
      LinkedIn: 'ملف المؤسّس وتوصياته.',
      GitHub: 'الشيفرة العامة للمؤسّس. أعمال العملاء تبقى خاصة.',
      WhatsApp: 'أسرع طريقة للوصول إلينا مباشرةً.',
    },
    about: {
      eyebrow: 'الاستوديو',
      h1: ['استوديو برمجيات بقيادة كبار المهندسين، أسّسه ', 'أحمد فريد', '.'],
      p: [
        'يصمّم Ahmed Farid Studio برمجيات مخصّصة ويبنيها ويشغّلها للمؤسّسين والمديرين التقنيين والشركات النامية: منصّات SaaS متعدّدة المستأجرين، وتطبيقات ويب وجوّال، ومزايا ذكاء اصطناعي، وأدوات داخلية، من أول قرار معماري حتى الإنتاج والدعم بعد الإطلاق. نعمل من دبي بتوقيت الخليج، مع عملاء في المنطقة وخارجها.',
        'أسّس أحمد الاستوديو عام ٢٠٢٢ ويقود كل تعاقد بنفسه: يحدّد النطاق، ويتولّى المعمارية، ويبقى نقطة تواصلك الوحيدة. أمضى أكثر من ست سنوات في إطلاق أنظمة إلى الإنتاج، منها أدوار هندسية في شركات منتجات في الخليج والولايات المتحدة؛ ودراسات الحالة من تلك الأدوار مُعلَّمة كعمل داخلي، لا كعملاء للاستوديو. أمّا المشاريع الأكبر فيسلّمها فريق الاستوديو من أكثر من ٧ أشخاص بقيادة مهندس أول.',
      ],
      facts: [['٢٠٢٢', 'تأسيس الاستوديو'], ['٧+', 'فريق بقيادة كبار المهندسين'], ['٤', 'مشاريع عملاء كل ربع سنة'], ['+٦ سنوات', 'خبرة المؤسّس في الإنتاج']],
      portraitAlt: 'أحمد فريد، مؤسّس Ahmed Farid Studio',
    },
    depth: { eyebrow: 'القدرات', h2: 'ما نبني به.', sub: 'ما نستخدمه، ولماذا. في الغالب أدوات مجرَّبة تصمد في الإنتاج.', toolbelt: 'كل ما نسلّم به: اللغات والأُطر والمنصّات التي نعمل بها يوميًّا.' },
    arch: { eyebrow: 'المبادئ الهندسية', h2: ['كيف نتّخذ ', 'القرارات التقنية.'], sub: 'خمسة مبادئ نطبّقها في كل مشروع، ونتخلّى عنها حين تقول الأدلّة غير ذلك.' },
    archParts: [
      ['أرسم خطوط النظام قبل كتابة الشاشات.', 'نرسم خطوط النظام قبل كتابة الشاشات.'],
      ['يستطيع غيري تشغيلها في الثانية صباحًا دون إيقاظي', 'يستطيع أي شخص تشغيلها في الثانية صباحًا دون إيقاظ أحد'],
      ['وأتحقّق من الموقع المنشور نفسه', 'ونتحقّق من الموقع المنشور نفسه'],
    ],
    why: {
      eyebrow: 'لماذا الاستوديو', h2: 'لماذا يعمل العملاء معنا.', them: 'المورّد المعتاد', us: '← معنا', sub: 'ما يمكنك توقّعه حين نعمل معًا.',
      v2: 'الواجهة الخلفية والويب والجوّال والبنية التحتية، بقائد أول واحد مسؤول عنها كلها.',
    },
    faq: [
      ['من سيعمل على مشروعي؟', 'يقود أحمد فريد، المؤسّس، كل تعاقد: يحدّد النطاق، ويتولّى المعمارية، ويبقى نقطة تواصلك. وتضيف المشاريع الأكبر مهندسين من فريق الاستوديو (أكثر من ٧ أشخاص بقيادة مهندس أول)، وتشمل الجميعَ الاتفاقيةُ السرّية نفسها وشروط الملكية الفكرية نفسها.'],
      ['هل تبنون منتجًا من الصفر؟', 'نعم. المعمارية والمخطّط والنشر وأول جزء في الإنتاج، ثم نبقى معك حين يكبر أو نسلّمه بشكل نظيف: مستندات وكتاب تشغيل و٣٠ يومًا من الإصلاحات.'],
      ['هل تبنون تطبيقات الجوّال؟', 'نعم. تطبيقات Flutter لنظامَي iOS وAndroid، بما في ذلك النشر على App Store وGoogle Play. وتكون أفضل حين نبني الواجهة البرمجية خلفها أيضًا، فيكون طرفا العقد بين أيدينا.'],
    ],
  },
  de: {
    navCta: 'Kontakt aufnehmen →',
    introRole: 'Softwareentwicklungsstudio',
    countriesLabel: 'Länder erreicht',
    heroH1: 'Software nach Maß,<br>gebaut <span class="it">end to end.</span>',
    hi: 'Geführt von Gründer Ahmed Farid, der in jedem Projekt dabei ist: Sie sprechen vom ersten Gespräch bis zum Launch mit dem verantwortlichen Engineer.',
    proof: 'Empfohlen von Kunden bei Phonic Maps und Ibdaa Course sowie von Führungskräften in Unternehmen, in denen Ahmed eine Rolle innehatte. Was sie sagen ↓',
    // A soft hyphen (\u00ad) lets the long compound break in the narrow footer column on a phone.
    footTag: 'Studio für Software\u00adentwicklung · SaaS, Mobile & KI · Dubai. Festpreis-Projekte, monatliches Engineering und Architektur-Reviews.',
    work: {
      h2: 'Ausgewählte Fallstudien.',
      sub: 'Kundenprojekte zuerst, dann Produkte aus Rollen, die Ahmed innehatte, jeweils gekennzeichnet. Jeder Eintrag führt zum Live-Produkt, zum Store-Eintrag oder zum Admin-Bereich.',
    },
    tests: {
      h2: 'Was Kunden und Kollegen sagen.',
      sub: 'Kundenprojekte zuerst. Stimmen aus Unternehmen, in denen Ahmed eine interne Rolle hatte, sind als solche gekennzeichnet; die auf LinkedIn verifizierte ist markiert.',
    },
    products: {
      h2: 'Eigene Produkte, die wir bauen und betreiben.',
      sub: 'Kundenarbeit zeigt, was wir nach fremdem Briefing liefern. Diese hier sind unsere eigenen: Wir haben das Problem gewählt, das Produkt gebaut und hosten es auf der Domain des Studios.',
    },
    builds: { sub: 'Kundenarbeiten und Kunden-Demos, live auf der Domain des Studios, damit Sie sie selbst ausprobieren können. Jede ist als das gekennzeichnet, was sie ist.' },
    brands: {
      h2: 'Kundenteams und die Unternehmen, in denen Ahmed gearbeitet hat.',
      sub: 'Weitere echte Produkte und Teams, als Kunde oder intern, über die Fallstudien oben hinaus: von einer Bank und einer E-Learning-Plattform bis zu Apotheken-Marken in den USA und Großbritannien. Jeder Name öffnet die Live-Seite.',
    },
    regions: { h2: 'Produkte und Teams in 17+ Ländern.' },
    contactTitle: 'Angebot anfragen.',
    connect: {
      LinkedIn: 'Profil und Empfehlungen des Gründers.',
      GitHub: 'Öffentlicher Code des Gründers. Kundenarbeit bleibt privat.',
      WhatsApp: 'Der schnellste Weg, uns direkt zu erreichen.',
    },
    about: {
      eyebrow: 'Das Studio',
      h1: ['Ein Softwarestudio unter Senior-Leitung, gegründet von ', 'Ahmed Farid', '.'],
      p: [
        'Ahmed Farid Studio konzipiert, baut und betreibt Individualsoftware für Gründer, CTOs und wachsende Unternehmen: Multi-Tenant-SaaS-Plattformen, Web- und Mobile-Apps, KI-Funktionen und interne Tools, von der ersten Architekturentscheidung bis zum Produktivbetrieb und dem Support nach dem Launch. Wir arbeiten aus Dubai, in Golf-Zeit, mit Kunden in der Region und darüber hinaus.',
        'Ahmed hat das Studio 2022 gegründet und leitet jedes Projekt selbst: Er legt den Umfang fest, verantwortet die Architektur und bleibt Ihr einziger Ansprechpartner. Er bringt über sechs Jahre mit Produktionssystemen mit, darunter Engineering-Rollen bei Produktfirmen am Golf und in den USA; Fallstudien aus diesen Rollen sind als interne Arbeit gekennzeichnet, nie als Studio-Kunden. Größere Projekte liefert das Studio-Team aus 7+ Personen unter Senior-Leitung.',
      ],
      facts: [['2022', 'Studio gegründet'], ['7+', 'Personen im Team unter Senior-Leitung'], ['4', 'Kundenprojekte pro Quartal'], ['6+ Jahre', 'Gründer in Produktions-Software']],
      portraitAlt: 'Ahmed Farid, Gründer von Ahmed Farid Studio',
    },
    depth: { eyebrow: 'Kompetenzen', h2: 'Womit wir bauen.', sub: 'Was wir einsetzen, und warum. Vor allem bewährte Werkzeuge, die im Produktivbetrieb halten.', toolbelt: 'Alles, womit wir liefern: die Sprachen, Frameworks und Plattformen, mit denen wir täglich arbeiten.' },
    arch: { eyebrow: 'Engineering-Prinzipien', h2: ['Wie wir ', 'technische Entscheidungen treffen.'], sub: 'Fünf Prinzipien, die wir in jedem Projekt anwenden und aufgeben, wenn die Belege dagegen sprechen.' },
    archParts: [
      ['Ich zeichne die Nähte im System, bevor ich die Screens schreibe.', 'Wir zeichnen die Nähte im System, bevor wir die Screens schreiben.'],
      ['ohne mich zu wecken', 'ohne jemanden zu wecken'],
      ['und ich prüfe gegen', 'und wir prüfen gegen'],
    ],
    why: {
      eyebrow: 'Warum das Studio', h2: 'Warum Kunden mit uns arbeiten.', them: 'Typischer Dienstleister', us: '→ Mit uns', sub: 'Was Sie von der Zusammenarbeit erwarten können.',
      v2: 'Backend, Web, Mobile und Infra, mit einer Senior-Leitung, die für alles verantwortlich ist.',
    },
    faq: [
      ['Wer arbeitet an meinem Projekt?', 'Ahmed Farid, der Gründer, leitet jedes Projekt: Er legt den Umfang fest, verantwortet die Architektur und bleibt Ihr Ansprechpartner. Größere Projekte ergänzen Engineers aus dem Studio-Team (7+ Personen unter Senior-Leitung), alle unter derselben NDA und denselben IP-Regeln.'],
      ['Bauen Sie ein Produkt von null auf?', 'Ja. Architektur, Schema, Deployment und der erste Abschnitt in Produktion; danach bleiben wir beim Skalieren dabei oder übergeben sauber, mit Doku, Runbook und 30 Tagen Fehlerbehebung.'],
      ['Bauen Sie Mobile-Apps?', 'Ja. Flutter-Apps für iOS und Android, einschließlich der Einreichung im App Store und bei Google Play. Am besten funktionieren sie, wenn wir auch die API dahinter bauen, sodass beide Seiten des Vertrags bei uns liegen.'],
    ],
  },
  es: {
    navCta: 'Ponte en contacto →',
    introRole: 'Estudio de desarrollo de software',
    countriesLabel: 'Países alcanzados',
    heroH1: 'Software a medida,<br>de principio <span class="it">a fin.</span>',
    hi: 'Dirigido por su fundador, Ahmed Farid, presente en cada proyecto: hablas con el ingeniero responsable desde la primera llamada hasta el lanzamiento.',
    proof: 'Recomendados por clientes de Phonic Maps e Ibdaa Course, y por responsables de empresas donde Ahmed ocupó un puesto. Lee lo que dicen ↓',
    footTag: 'Estudio de desarrollo de software · SaaS, móvil e IA · Dubái. Proyectos a precio cerrado, ingeniería mensual y revisiones de arquitectura.',
    work: {
      h2: 'Casos de estudio seleccionados.',
      sub: 'Primero los proyectos para clientes, luego productos creados en puestos que ocupó Ahmed, cada uno señalado. Cada entrada enlaza al producto en vivo, su ficha en la tienda o su panel.',
    },
    tests: {
      h2: 'Lo que dicen clientes y colegas.',
      sub: 'Primero, proyectos para clientes. Las opiniones de empresas donde Ahmed tuvo un puesto en plantilla están señaladas como tales; la verificada en LinkedIn está marcada.',
    },
    products: {
      h2: 'Productos propios que construimos y operamos.',
      sub: 'El trabajo con clientes muestra lo que entregamos sobre el brief de otro. Estos son nuestros: elegimos el problema, lanzamos el producto y lo alojamos en el dominio del estudio.',
    },
    builds: { sub: 'Trabajos y demos para clientes, publicados en el dominio del estudio para que puedas probarlos. Cada uno está señalado como lo que es.' },
    brands: {
      h2: 'Equipos de clientes y empresas donde ha trabajado Ahmed.',
      sub: 'Más productos y equipos reales, de clientes y en plantilla, además de los casos de arriba: de un banco y una plataforma de e-learning a marcas de farmacias de EE. UU. y Reino Unido. Cada nombre abre su web.',
    },
    regions: { h2: 'Productos y equipos en más de 17 países.' },
    contactTitle: 'Solicita una propuesta.',
    connect: {
      LinkedIn: 'Perfil y recomendaciones del fundador.',
      GitHub: 'Código público del fundador. El trabajo con clientes es privado.',
      WhatsApp: 'La forma más rápida de contactarnos directamente.',
    },
    about: {
      eyebrow: 'El estudio',
      h1: ['Un estudio de software con liderazgo sénior, fundado por ', 'Ahmed Farid', '.'],
      p: [
        'Ahmed Farid Studio diseña, construye y opera software a medida para fundadores, CTO y empresas en crecimiento: plataformas SaaS multi-tenant, apps web y móviles, funciones de IA y herramientas internas, desde la primera decisión de arquitectura hasta producción y el soporte tras el lanzamiento. Trabajamos desde Dubái, en horario del Golfo, con clientes en la región y fuera de ella.',
        'Ahmed fundó el estudio en 2022 y dirige cada proyecto: define el alcance, se encarga de la arquitectura y sigue siendo tu único interlocutor. Lleva más de seis años lanzando sistemas a producción, incluidos puestos de ingeniería en empresas de producto del Golfo y de EE. UU.; los casos de esos puestos están señalados como trabajo en plantilla, nunca como clientes del estudio. Los proyectos más grandes los entrega el equipo del estudio, de más de 7 personas con liderazgo sénior.',
      ],
      facts: [['2022', 'Estudio fundado'], ['7+', 'Personas en el equipo, con liderazgo sénior'], ['4', 'Proyectos de clientes por trimestre'], ['6+ años', 'Del fundador en software en producción']],
      portraitAlt: 'Ahmed Farid, fundador de Ahmed Farid Studio',
    },
    depth: { eyebrow: 'Capacidades', h2: 'Con qué construimos.', sub: 'Lo que usamos y por qué. Sobre todo herramientas probadas que aguantan en producción.', toolbelt: 'Todo con lo que entregamos: los lenguajes, frameworks y plataformas con los que trabajamos a diario.' },
    arch: { eyebrow: 'Principios de ingeniería', h2: ['Cómo tomamos ', 'decisiones técnicas.'], sub: 'Cinco principios que aplicamos en cada proyecto, y que dejamos de lado cuando la evidencia dice otra cosa.' },
    archParts: [
      ['Dibujo las costuras', 'Dibujamos las costuras'],
      ['sin llamarme', 'sin llamar a nadie'],
      ['y verifico contra', 'y verificamos contra'],
    ],
    why: {
      eyebrow: 'Por qué el estudio', h2: 'Por qué los clientes trabajan con nosotros.', them: 'Proveedor típico', us: '→ Con nosotros', sub: 'Lo que puedes esperar cuando trabajamos juntos.',
      v2: 'Backend, web, móvil e infraestructura, con un único responsable sénior de todo.',
    },
    faq: [
      ['¿Quién trabajará en mi proyecto?', 'Ahmed Farid, el fundador, dirige cada proyecto: define el alcance, se encarga de la arquitectura y sigue siendo tu interlocutor. Los proyectos más grandes suman ingenieros del equipo del estudio (más de 7 personas con liderazgo sénior), todos con el mismo NDA y las mismas condiciones de PI.'],
      ['¿Se puede empezar un producto desde cero?', 'Sí. Arquitectura, esquema, despliegue y la primera parte en producción; después seguimos contigo mientras crece o lo entregamos de forma limpia, con documentación, runbook y 30 días de correcciones.'],
      ['¿Y las apps móviles?', 'También. Apps Flutter para iOS y Android, incluida la publicación en App Store y Google Play. Funcionan mejor cuando también construimos la API que hay detrás, así los dos extremos del contrato son nuestros.'],
    ],
  },
  fr: {
    navCta: 'Nous contacter →',
    introRole: 'Studio de développement logiciel',
    countriesLabel: 'Pays atteints',
    heroH1: 'Logiciel sur mesure,<br>de bout <span class="it">en bout.</span>',
    hi: 'Dirigé par son fondateur, Ahmed Farid, présent sur chaque projet : vous échangez avec l’ingénieur responsable, du premier appel au lancement.',
    proof: 'Recommandé par des clients chez Phonic Maps et Ibdaa Course, et par des responsables d’entreprises où Ahmed a occupé un poste. Lire leurs avis ↓',
    footTag: 'Studio de développement logiciel · SaaS, mobile et IA · Dubaï. Projets au forfait, ingénierie mensuelle et revues d’architecture.',
    work: {
      h2: 'Études de cas choisies.',
      sub: 'Les projets clients d’abord, puis des produits construits dans des postes occupés par Ahmed, chacun signalé. Chaque entrée mène au produit en ligne, à sa fiche sur les stores ou à son back-office.',
    },
    tests: {
      h2: 'Ce que disent clients et collègues.',
      sub: 'Les projets clients d’abord. Les avis venant d’entreprises où Ahmed occupait un poste en interne sont signalés comme tels ; celui vérifié sur LinkedIn est marqué.',
    },
    products: {
      eyebrow: 'Nos propres produits',
      h2: 'Nos propres produits, que nous exploitons.',
      sub: 'Le travail client montre ce que nous livrons sur le brief d’un autre. Ceux-ci sont à nous : nous avons choisi le problème, livré le produit et l’hébergeons sur le domaine du studio.',
    },
    builds: { sub: 'Travaux et démos pour des clients, en ligne sur le domaine du studio pour que vous puissiez les essayer. Chacun est signalé pour ce qu’il est.' },
    brands: {
      h2: 'Équipes clientes et entreprises où Ahmed a travaillé.',
      sub: 'D’autres produits et équipes réels, en client ou en interne, au-delà des études de cas ci-dessus : d’une banque et d’une plateforme d’e-learning à des marques de pharmacies aux États-Unis et au Royaume-Uni. Chaque nom ouvre son site.',
    },
    regions: { h2: 'Produits et équipes dans plus de 17 pays.' },
    contactTitle: 'Demander une proposition.',
    connect: {
      LinkedIn: 'Profil et recommandations du fondateur.',
      GitHub: 'Code public du fondateur. Le travail client reste privé.',
      WhatsApp: 'Le moyen le plus rapide de nous joindre directement.',
    },
    about: {
      eyebrow: 'Le studio',
      h1: ['Un studio logiciel dirigé par des seniors, fondé par ', 'Ahmed Farid', '.'],
      p: [
        'Ahmed Farid Studio conçoit, construit et fait tourner des logiciels sur mesure pour fondateurs, CTO et entreprises en croissance : plateformes SaaS multi-tenant, applications web et mobiles, fonctions IA et outils internes, de la première décision d’architecture à la production et au support après le lancement. Nous travaillons depuis Dubaï, à l’heure du Golfe, avec des clients dans la région et au-delà.',
        'Ahmed a fondé le studio en 2022 et dirige chaque mission : il cadre le travail, porte l’architecture et reste votre unique interlocuteur. Il a plus de six ans de systèmes livrés en production, dont des postes d’ingénieur dans des entreprises produit du Golfe et des États-Unis ; les études de cas issues de ces postes sont signalées comme travail en interne, jamais comme clients du studio. Les projets plus larges sont livrés par l’équipe du studio, plus de 7 personnes encadrées par des seniors.',
      ],
      facts: [['2022', 'Studio fondé'], ['7+', 'Personnes dans l’équipe, encadrée par des seniors'], ['4', 'Projets clients par trimestre'], ['6+ ans', 'Du fondateur en logiciel de production']],
      portraitAlt: 'Ahmed Farid, fondateur d’Ahmed Farid Studio',
    },
    depth: { eyebrow: 'Compétences', h2: 'Avec quoi nous construisons.', sub: 'Ce que nous utilisons, et pourquoi. Surtout des outils éprouvés qui tiennent en production.', toolbelt: 'Tout ce avec quoi nous livrons : les langages, frameworks et plateformes que nous utilisons au quotidien.' },
    arch: { eyebrow: 'Principes d’ingénierie', h2: ['Comment nous prenons nos ', 'décisions techniques.'], sub: 'Cinq principes que nous appliquons à chaque projet, et que nous abandonnons quand les faits disent le contraire.' },
    archParts: [
      ['Je trace les coutures', 'Nous traçons les coutures'],
      ["sans m'appeler", 'sans appeler personne'],
      ['et je vérifie sur', 'et nous vérifions sur'],
    ],
    why: {
      eyebrow: 'Pourquoi le studio', h2: 'Pourquoi les clients travaillent avec nous.', them: 'Prestataire classique', us: '→ Avec nous', sub: 'Ce à quoi vous pouvez vous attendre en travaillant avec nous.',
      v2: 'Backend, web, mobile et infra, avec un seul responsable senior pour l’ensemble.',
    },
    faq: [
      ['Qui travaillera sur mon projet ?', 'Ahmed Farid, le fondateur, dirige chaque mission : il cadre le travail, porte l’architecture et reste votre interlocuteur. Les projets plus larges ajoutent des ingénieurs de l’équipe du studio (plus de 7 personnes encadrées par des seniors), tous sous le même NDA et les mêmes règles de PI.'],
      ['Pouvez-vous partir de zéro ?', 'Oui. Architecture, schéma, déploiement et la première tranche en production ; ensuite nous restons pendant la montée en charge ou nous passons la main proprement, avec documentation, runbook et 30 jours de corrections.'],
      ['Faites-vous des applications mobiles ?', 'Oui. Des apps Flutter pour iOS et Android, publication sur l’App Store et Google Play comprise. Elles marchent mieux quand nous construisons aussi l’API derrière, pour tenir les deux bouts du contrat.'],
    ],
  },
};
