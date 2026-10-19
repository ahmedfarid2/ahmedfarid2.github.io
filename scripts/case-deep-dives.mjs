// Full case studies for the flagships the export only carries as a summary.
// Yelo Sale ships with a `deepDive` in every export; the other four flagships
// had an approach paragraph and three highlight boxes, so their pages read as
// stubs next to it. edit-copy.mjs (rewriteCases) writes one of these into each
// case object, in each locale, where the export's own CaseDeepDive renders it.
//
// Facts only: everything here is already stated on the site (approach,
// highlights, client recommendations) or in cv/cv.html. No figures that are
// not already published. `problem` is not repeated here: the generator reuses
// the case object's own problem line, so the two can never disagree.
//
// Keyed by the case object's `name` exactly as the exports spell it.

export const CASE_DEEP_DIVES = {
  'Qoralia': {
    en: {
      hard: 'A model is good at finding candidate grants and interventions in a pile of regulations, but it can’t be the one that says a city qualifies: an official has to be able to defend that answer. And every city’s emissions data has to stay in its own workspace, checked before it counts.',
      arch: [
        ['The model suggests, rules decide', 'The model surfaces candidate grants and interventions; deterministic scoring decides eligibility, and the UI shows which rule decided.'],
        ['Retrieval over climate sources', 'RAG over regulations, grants and intervention catalogues in PostgreSQL + pgvector, behind an OpenRouter multi-model gateway.'],
        ['Whole pathways, not single projects', 'Cost, CO₂ impact and feasibility are modelled across a full emission-reduction pathway.'],
        ['Staged data import', 'Bulk emissions data is staged and validated before it reaches the books.'],
        ['A workspace per city', 'Multi-tenant workspaces with role-based access, Auth0 sign-in and separate environments behind nginx.'],
      ],
      outcome: [
        'One workspace to find interventions, match funding and model CO₂ impact, instead of scattered spreadsheets and consultant reports.',
        'Eligibility answers an official can trace back to a rule, not just a model’s opinion.',
        'Each city’s team sees only its own data.',
      ],
      role: 'Software Engineer — FastAPI back end and React front end.',
    },
    ar: {
      hard: 'النموذج بارع في إيجاد المنح والتدخّلات المرشّحة وسط كمّ من اللوائح، لكنه لا يصلح لأن يكون من يقرّر أن مدينةً مؤهّلة؛ فالمسؤول يجب أن يستطيع الدفاع عن هذه الإجابة. كما يجب أن تبقى بيانات انبعاثات كل مدينة في مساحتها الخاصة، وأن تُراجَع قبل أن تُحتسب.',
      arch: [
        ['النموذج يقترح، والقواعد تقرّر', 'يقترح النموذج المنح والتدخّلات المرشّحة، ويحسم تقييمٌ قائم على قواعد ثابتة الأهلية، وتعرض الواجهة القاعدة التي حسمت القرار.'],
        ['بحث في مصادر المناخ', 'استرجاع معزّز (RAG) على اللوائح والمنح وكتالوجات التدخّلات في PostgreSQL + pgvector، عبر بوابة OpenRouter لعدّة نماذج.'],
        ['مسارات كاملة لا مشاريع منفردة', 'تُنمذَج التكلفة وأثر ثاني أكسيد الكربون والجدوى على مسار خفض الانبعاثات كاملًا.'],
        ['استيراد على مراحل', 'تمرّ بيانات الانبعاثات المستوردة بمرحلة تجهيز وتحقّق قبل أن تدخل السجلّات.'],
        ['مساحة لكل مدينة', 'مساحات عمل متعدّدة المستأجرين بصلاحيات حسب الدور، وتسجيل دخول عبر Auth0، وبيئات منفصلة خلف nginx.'],
      ],
      outcome: [
        'مساحة واحدة لإيجاد التدخّلات ومطابقة التمويل ونمذجة أثر الكربون، بدل جداول متفرّقة وتقارير استشارية.',
        'إجابات عن الأهلية يستطيع المسؤول تتبّعها إلى قاعدة محدّدة، لا مجرّد رأي نموذج.',
        'يرى فريق كل مدينة بياناته فقط.',
      ],
      role: 'مهندس برمجيات — الواجهة الخلفية بـ FastAPI والواجهة الأمامية بـ React.',
    },
    de: {
      hard: 'Ein Modell findet in einem Berg von Vorschriften gut mögliche Förderprogramme und Maßnahmen, darf aber nicht entscheiden, ob eine Stadt förderfähig ist: Diese Antwort muss eine Verwaltung vertreten können. Außerdem müssen die Emissionsdaten jeder Stadt in ihrem eigenen Bereich bleiben und geprüft sein, bevor sie zählen.',
      arch: [
        ['Das Modell schlägt vor, Regeln entscheiden', 'Das Modell findet mögliche Förderungen und Maßnahmen; eine deterministische Bewertung entscheidet über die Förderfähigkeit, und die Oberfläche zeigt, welche Regel entschieden hat.'],
        ['Suche in Klimaquellen', 'RAG über Vorschriften, Förderprogramme und Maßnahmenkataloge in PostgreSQL + pgvector, hinter einem OpenRouter-Gateway für mehrere Modelle.'],
        ['Ganze Pfade statt Einzelprojekte', 'Kosten, CO₂-Wirkung und Machbarkeit werden über einen vollständigen Reduktionspfad modelliert.'],
        ['Import in Stufen', 'Massenimporte von Emissionsdaten werden bereitgestellt und geprüft, bevor sie in die Bücher gehen.'],
        ['Ein Bereich je Stadt', 'Mandantenfähige Arbeitsbereiche mit Rollenrechten, Anmeldung über Auth0 und getrennten Umgebungen hinter nginx.'],
      ],
      outcome: [
        'Ein Arbeitsbereich, um Maßnahmen zu finden, Förderungen zuzuordnen und die CO₂-Wirkung zu modellieren, statt verstreuter Tabellen und Gutachten.',
        'Antworten zur Förderfähigkeit, die eine Verwaltung auf eine Regel zurückführen kann, nicht nur auf die Meinung eines Modells.',
        'Das Team jeder Stadt sieht nur seine eigenen Daten.',
      ],
      role: 'Software Engineer — FastAPI-Backend und React-Frontend.',
    },
    es: {
      hard: 'Un modelo encuentra bien subvenciones e intervenciones candidatas entre montones de normativa, pero no puede ser quien diga que una ciudad cumple los requisitos: esa respuesta la tiene que poder defender un responsable público. Y los datos de emisiones de cada ciudad deben quedarse en su propio espacio y validarse antes de contar.',
      arch: [
        ['El modelo sugiere, las reglas deciden', 'El modelo propone subvenciones e intervenciones candidatas; una puntuación determinista decide la elegibilidad y la interfaz muestra qué regla decidió.'],
        ['Búsqueda en fuentes climáticas', 'RAG sobre normativa, subvenciones y catálogos de intervenciones en PostgreSQL + pgvector, tras una pasarela OpenRouter multimodelo.'],
        ['Trayectorias completas, no proyectos sueltos', 'Coste, impacto en CO₂ y viabilidad se modelan sobre una trayectoria de reducción completa.'],
        ['Importación por etapas', 'Los datos de emisiones en bloque se preparan y validan antes de llegar a los registros.'],
        ['Un espacio por ciudad', 'Espacios multiinquilino con permisos por rol, acceso con Auth0 y entornos separados tras nginx.'],
      ],
      outcome: [
        'Un solo espacio para encontrar intervenciones, cruzar financiación y modelar el impacto en CO₂, en lugar de hojas de cálculo e informes de consultoría dispersos.',
        'Respuestas de elegibilidad que un responsable puede rastrear hasta una regla, no solo la opinión de un modelo.',
        'El equipo de cada ciudad solo ve sus propios datos.',
      ],
      role: 'Ingeniero de software — back end en FastAPI y front end en React.',
    },
    fr: {
      hard: 'Un modèle sait repérer des subventions et des actions possibles dans une masse de réglementations, mais il ne peut pas être celui qui déclare une ville éligible : un agent doit pouvoir défendre cette réponse. Et les données d’émissions de chaque ville doivent rester dans leur propre espace, vérifiées avant de compter.',
      arch: [
        ['Le modèle propose, les règles tranchent', 'Le modèle fait remonter les subventions et actions candidates ; un score déterministe décide de l’éligibilité, et l’interface montre quelle règle a tranché.'],
        ['Recherche dans les sources climat', 'RAG sur les réglementations, subventions et catalogues d’actions dans PostgreSQL + pgvector, derrière une passerelle OpenRouter multi-modèles.'],
        ['Des trajectoires entières, pas des projets isolés', 'Coût, impact CO₂ et faisabilité sont modélisés sur une trajectoire de réduction complète.'],
        ['Import par étapes', 'Les données d’émissions importées en masse sont préparées et validées avant d’entrer dans les comptes.'],
        ['Un espace par ville', 'Espaces multi-locataires avec droits par rôle, connexion Auth0 et environnements séparés derrière nginx.'],
      ],
      outcome: [
        'Un seul espace pour trouver des actions, rapprocher les financements et modéliser l’impact CO₂, au lieu de tableurs et de rapports de consultants éparpillés.',
        'Des réponses d’éligibilité qu’un agent peut rattacher à une règle, pas seulement à l’avis d’un modèle.',
        'L’équipe de chaque ville ne voit que ses propres données.',
      ],
      role: 'Ingénieur logiciel — back-end FastAPI et front-end React.',
    },
  },

  'KhebraOS': {
    en: {
      hard: 'Arabic-first means right-to-left from the first component, not an English app mirrored at the end. On top of that, the AI course wizard chains several paid services, from script to narration to cover to promo video, and a teacher has to be able to follow every step. And every academy has to look like its own brand, on its own address.',
      arch: [
        ['A school per tenant', 'Each academy gets its own branded school at username.khebraos.com, with separate student, academy and admin panels.'],
        ['RTL from the first component', 'Arabic and right-to-left are the default layout, with English alongside, not mirrored afterwards.'],
        ['A 6-step AI course wizard', 'GPT-4o-mini writes the scripts, ElevenLabs narrates in 10 Arabic voices, DALL·E 3 draws the covers, and the steps end in a promo video.'],
        ['Live updates without polling', 'Server-sent events driven by Postgres NOTIFY keep progress and dashboards current.'],
        ['Selling built in', 'Courses, digital products, 1:1 coaching through Zoom and Calendly, and a drag-and-drop landing-page and funnel builder.'],
      ],
      outcome: [
        'A teacher launches a branded Arabic academy on their own address, without stitching tools together.',
        'A course draft, from script and narration to cover and promo video, in six steps.',
        'Courses, coaching, products and marketing in one platform, in Arabic and English.',
      ],
      role: 'Software Engineer — full stack: React 19 front end, Express 5 API and PostgreSQL.',
    },
    ar: {
      hard: 'العربية أولًا تعني الاتجاه من اليمين لليسار منذ أول مكوّن، لا تطبيقًا إنجليزيًا يُعكَس في النهاية. ويضاف إلى ذلك أن معالج الدورات بالذكاء الاصطناعي يربط عدّة خدمات مدفوعة، من النص إلى التعليق الصوتي إلى الغلاف إلى الفيديو الترويجي، ويجب أن يتابع المعلّم كل خطوة. وكل أكاديمية يجب أن تظهر بهويتها الخاصة وعلى عنوانها الخاص.',
      arch: [
        ['مدرسة لكل مستأجر', 'تحصل كل أكاديمية على مدرستها بهويتها على username.khebraos.com، مع لوحات منفصلة للطالب والأكاديمية والإدارة.'],
        ['من اليمين لليسار منذ أول مكوّن', 'العربية والاتجاه من اليمين لليسار هما التخطيط الافتراضي، والإنجليزية إلى جانبهما، لا انعكاسًا لاحقًا.'],
        ['معالج دورات بالذكاء الاصطناعي في ٦ خطوات', 'يكتب GPT-4o-mini النصوص، ويعلّق ElevenLabs صوتيًا بعشرة أصوات عربية، ويرسم DALL·E 3 الأغلفة، وتنتهي الخطوات بفيديو ترويجي.'],
        ['تحديثات حيّة دون استطلاع متكرّر', 'أحداث يرسلها الخادم، يحرّكها Postgres NOTIFY، تُبقي التقدّم ولوحات التحكّم محدَّثة.'],
        ['البيع مدمج', 'دورات ومنتجات رقمية وتدريب فردي عبر Zoom وCalendly، ومنشئ صفحات هبوط ومسارات تسويق بالسحب والإفلات.'],
      ],
      outcome: [
        'يطلق المعلّم أكاديمية عربية بهويته على عنوانه الخاص، دون أن يجمع أدوات متفرّقة.',
        'مسودّة دورة كاملة، من النص والتعليق الصوتي إلى الغلاف والفيديو الترويجي، في ست خطوات.',
        'الدورات والتدريب والمنتجات والتسويق في منصّة واحدة، بالعربية والإنجليزية.',
      ],
      role: 'مهندس برمجيات — تطوير متكامل: واجهة React 19 وواجهة برمجة Express 5 وPostgreSQL.',
    },
    de: {
      hard: 'Arabisch zuerst heißt: von rechts nach links ab der ersten Komponente, keine englische App, die am Ende gespiegelt wird. Dazu verkettet der KI-Kursassistent mehrere kostenpflichtige Dienste, vom Skript über die Vertonung und das Cover bis zum Promo-Video, und eine Lehrkraft muss jedem Schritt folgen können. Und jede Akademie muss wie ihre eigene Marke aussehen, unter ihrer eigenen Adresse.',
      arch: [
        ['Eine Schule je Mandant', 'Jede Akademie bekommt ihre eigene Markenschule unter username.khebraos.com, mit getrennten Bereichen für Lernende, Akademie und Administration.'],
        ['RTL ab der ersten Komponente', 'Arabisch und Rechts-nach-links sind das Standardlayout, Englisch daneben, nicht nachträglich gespiegelt.'],
        ['KI-Kursassistent in 6 Schritten', 'GPT-4o-mini schreibt die Skripte, ElevenLabs vertont mit 10 arabischen Stimmen, DALL·E 3 gestaltet die Cover, am Ende steht ein Promo-Video.'],
        ['Live-Updates ohne Polling', 'Server-Sent Events, ausgelöst über Postgres NOTIFY, halten Fortschritt und Dashboards aktuell.'],
        ['Verkauf eingebaut', 'Kurse, digitale Produkte, 1:1-Coaching über Zoom und Calendly sowie ein Drag-and-drop-Baukasten für Landingpages und Funnels.'],
      ],
      outcome: [
        'Eine Lehrkraft startet eine arabische Markenakademie unter eigener Adresse, ohne Werkzeuge zusammenzustückeln.',
        'Ein Kursentwurf, vom Skript und der Vertonung bis zu Cover und Promo-Video, in sechs Schritten.',
        'Kurse, Coaching, Produkte und Marketing auf einer Plattform, auf Arabisch und Englisch.',
      ],
      role: 'Software Engineer — Full Stack: React-19-Frontend, Express-5-API und PostgreSQL.',
    },
    es: {
      hard: 'Árabe primero significa de derecha a izquierda desde el primer componente, no una app en inglés reflejada al final. Además, el asistente de cursos con IA encadena varios servicios de pago, del guion a la narración, la portada y el vídeo promocional, y el profesor tiene que poder seguir cada paso. Y cada academia debe verse como su propia marca, en su propia dirección.',
      arch: [
        ['Una escuela por inquilino', 'Cada academia tiene su propia escuela con marca en username.khebraos.com, con paneles separados para alumnos, academia y administración.'],
        ['RTL desde el primer componente', 'El árabe y la escritura de derecha a izquierda son el diseño por defecto, con el inglés al lado, no reflejado después.'],
        ['Asistente de cursos con IA en 6 pasos', 'GPT-4o-mini escribe los guiones, ElevenLabs narra con 10 voces árabes, DALL·E 3 crea las portadas y los pasos terminan en un vídeo promocional.'],
        ['Actualizaciones en vivo sin sondeo', 'Eventos enviados por el servidor, disparados con Postgres NOTIFY, mantienen al día el progreso y los paneles.'],
        ['La venta, integrada', 'Cursos, productos digitales, mentoría 1:1 con Zoom y Calendly, y un constructor de landing pages y embudos de arrastrar y soltar.'],
      ],
      outcome: [
        'Un profesor lanza una academia árabe con su marca y en su propia dirección, sin juntar herramientas sueltas.',
        'Un borrador de curso, del guion y la narración a la portada y el vídeo promocional, en seis pasos.',
        'Cursos, mentoría, productos y marketing en una plataforma, en árabe y en inglés.',
      ],
      role: 'Ingeniero de software — full stack: front end en React 19, API en Express 5 y PostgreSQL.',
    },
    fr: {
      hard: 'Arabe d’abord veut dire de droite à gauche dès le premier composant, pas une app anglaise retournée à la fin. En plus, l’assistant de cours IA enchaîne plusieurs services payants, du script à la narration, à la couverture et à la vidéo promo, et un formateur doit pouvoir suivre chaque étape. Et chaque académie doit avoir l’air de sa propre marque, à sa propre adresse.',
      arch: [
        ['Une école par locataire', 'Chaque académie a sa propre école à ses couleurs sur username.khebraos.com, avec des espaces séparés pour l’apprenant, l’académie et l’administration.'],
        ['Le RTL dès le premier composant', 'L’arabe et la lecture de droite à gauche sont la mise en page par défaut, l’anglais à côté, sans miroir après coup.'],
        ['Un assistant de cours IA en 6 étapes', 'GPT-4o-mini écrit les scripts, ElevenLabs narre avec 10 voix arabes, DALL·E 3 dessine les couvertures, et les étapes se terminent par une vidéo promo.'],
        ['Du temps réel sans polling', 'Des server-sent events déclenchés par Postgres NOTIFY tiennent la progression et les tableaux de bord à jour.'],
        ['La vente intégrée', 'Cours, produits numériques, coaching individuel via Zoom et Calendly, et un éditeur de pages d’atterrissage et de tunnels par glisser-déposer.'],
      ],
      outcome: [
        'Un formateur lance une académie arabe à ses couleurs, à sa propre adresse, sans assembler d’outils épars.',
        'Un brouillon de cours, du script et de la narration à la couverture et à la vidéo promo, en six étapes.',
        'Cours, coaching, produits et marketing sur une seule plateforme, en arabe et en anglais.',
      ],
      role: 'Ingénieur logiciel — full stack : front-end React 19, API Express 5 et PostgreSQL.',
    },
  },

  'Phonic Maps': {
    en: {
      hard: 'One business can run hundreds of storefronts, and one reseller can run many such businesses. Every reply, post and metric has to land on the right location for the right client, Google’s data has to stay in sync without anyone watching it, and bulk actions across hundreds of locations can’t freeze the app or fail without anyone knowing.',
      arch: [
        ['Reseller, client, location', 'Resellers onboard business clients as tenants; each client manages its own locations, isolated from every other client.'],
        ['Google Business Profile sync', 'One OAuth connection per business; reviews and per-location metrics sync automatically.'],
        ['AI-suggested replies and auto-reply rules', 'Replies are drafted by AI, and per-location rules answer reviews in bulk.'],
        ['Bulk work runs in queues', 'Posting to many locations, CSV import/export and media processing run as Horizon-queued jobs.'],
        ['An audit trail', 'A Spatie activity log records who changed what, across every tenant.'],
      ],
      outcome: [
        'Every location’s reviews, replies and metrics in one dashboard, instead of tab after tab.',
        'One post published to many locations at once.',
        'Scales from a single business to resellers managing hundreds of storefronts.',
      ],
      role: 'Software Engineer — Laravel 12 API and Next.js 16 app.',
    },
    ar: {
      hard: 'قد يدير نشاطٌ تجاري واحد مئات الفروع، وقد يدير موزّع واحد عددًا من هذه الأنشطة. كل ردّ ومنشور ومؤشّر يجب أن يصل إلى الفرع الصحيح للعميل الصحيح، وبيانات Google يجب أن تبقى متزامنة دون أن يراقبها أحد، والعمليات الجماعية على مئات الفروع لا يجوز أن تجمّد التطبيق أو تفشل دون أن يعلم أحد.',
      arch: [
        ['موزّع، ثم عميل، ثم فرع', 'يضيف الموزّعون عملاءهم من الأنشطة التجارية كمستأجرين، ويدير كل عميل فروعه معزولًا عن بقية العملاء.'],
        ['مزامنة Google Business Profile', 'اتصال OAuth واحد لكل نشاط، وتُزامَن التقييمات ومؤشّرات كل فرع تلقائيًا.'],
        ['ردود يقترحها الذكاء الاصطناعي وقواعد ردّ تلقائي', 'يصوغ الذكاء الاصطناعي الردود، وتردّ قواعد خاصة بكل فرع على التقييمات دفعةً واحدة.'],
        ['العمل الجماعي في طوابير', 'النشر على فروع كثيرة، واستيراد CSV وتصديره، ومعالجة الوسائط تعمل كمهام في طوابير Horizon.'],
        ['سجلّ تدقيق', 'سجلّ نشاط (Spatie) يوثّق من غيّر ماذا، عبر كل المستأجرين.'],
      ],
      outcome: [
        'تقييمات كل الفروع والردود والمؤشّرات في لوحة واحدة، بدل تبويب بعد تبويب.',
        'منشور واحد يُنشر على فروع كثيرة في آنٍ واحد.',
        'يتّسع من نشاط تجاري واحد إلى موزّعين يديرون مئات الفروع.',
      ],
      role: 'مهندس برمجيات — واجهة برمجة Laravel 12 وتطبيق Next.js 16.',
    },
    de: {
      hard: 'Ein Unternehmen kann Hunderte Standorte haben, und ein Wiederverkäufer viele solcher Unternehmen. Jede Antwort, jeder Beitrag und jede Kennzahl muss beim richtigen Standort des richtigen Kunden landen, Googles Daten müssen synchron bleiben, ohne dass jemand danebensitzt, und Sammelaktionen über Hunderte Standorte dürfen die App nicht blockieren oder unbemerkt scheitern.',
      arch: [
        ['Wiederverkäufer, Kunde, Standort', 'Wiederverkäufer legen Geschäftskunden als Mandanten an; jeder Kunde verwaltet seine Standorte, getrennt von allen anderen.'],
        ['Google-Business-Profile-Sync', 'Eine OAuth-Verbindung je Unternehmen; Bewertungen und Kennzahlen je Standort synchronisieren automatisch.'],
        ['KI-Antwortvorschläge und Auto-Antwort-Regeln', 'Antworten werden von der KI entworfen, Regeln je Standort beantworten Bewertungen gesammelt.'],
        ['Sammelarbeit in Warteschlangen', 'Beiträge an viele Standorte, CSV-Import/-Export und Medienverarbeitung laufen als Horizon-Jobs.'],
        ['Ein Audit-Trail', 'Ein Spatie-Aktivitätsprotokoll hält fest, wer was geändert hat, über alle Mandanten hinweg.'],
      ],
      outcome: [
        'Bewertungen, Antworten und Kennzahlen aller Standorte in einem Dashboard statt Tab für Tab.',
        'Ein Beitrag geht an viele Standorte gleichzeitig.',
        'Skaliert von einem einzelnen Unternehmen bis zu Wiederverkäufern mit Hunderten Standorten.',
      ],
      role: 'Software Engineer — Laravel-12-API und Next.js-16-App.',
    },
    es: {
      hard: 'Un negocio puede tener cientos de sedes, y un revendedor puede gestionar muchos negocios así. Cada respuesta, publicación y métrica tiene que llegar a la sede correcta del cliente correcto, los datos de Google deben mantenerse sincronizados sin que nadie los vigile, y las acciones en bloque sobre cientos de sedes no pueden bloquear la app ni fallar sin que nadie se entere.',
      arch: [
        ['Revendedor, cliente, sede', 'Los revendedores dan de alta a sus clientes como inquilinos; cada cliente gestiona sus sedes, aislado del resto.'],
        ['Sincronización con Google Business Profile', 'Una conexión OAuth por negocio; las reseñas y las métricas de cada sede se sincronizan solas.'],
        ['Respuestas sugeridas por IA y reglas automáticas', 'La IA redacta las respuestas y las reglas de cada sede responden reseñas en bloque.'],
        ['El trabajo en bloque, en colas', 'Publicar en muchas sedes, importar y exportar CSV y procesar medios se ejecutan como trabajos en colas de Horizon.'],
        ['Un registro de auditoría', 'Un registro de actividad (Spatie) guarda quién cambió qué, en todos los inquilinos.'],
      ],
      outcome: [
        'Las reseñas, respuestas y métricas de todas las sedes en un solo panel, en lugar de pestaña tras pestaña.',
        'Una publicación sale a muchas sedes a la vez.',
        'Escala de un solo negocio a revendedores que gestionan cientos de sedes.',
      ],
      role: 'Ingeniero de software — API en Laravel 12 y app en Next.js 16.',
    },
    fr: {
      hard: 'Une entreprise peut avoir des centaines d’établissements, et un revendeur peut gérer beaucoup d’entreprises de ce type. Chaque réponse, publication et indicateur doit arriver sur le bon établissement du bon client, les données Google doivent rester synchronisées sans que personne ne les surveille, et les actions groupées sur des centaines d’établissements ne doivent ni bloquer l’app ni échouer en silence.',
      arch: [
        ['Revendeur, client, établissement', 'Les revendeurs ajoutent leurs clients comme locataires ; chaque client gère ses établissements, isolé des autres.'],
        ['Synchronisation Google Business Profile', 'Une connexion OAuth par entreprise ; avis et indicateurs par établissement se synchronisent automatiquement.'],
        ['Réponses suggérées par l’IA et règles automatiques', 'L’IA rédige les réponses, et des règles par établissement répondent aux avis en masse.'],
        ['Le travail groupé en files d’attente', 'Publication sur de nombreux établissements, import et export CSV et traitement des médias tournent en tâches Horizon.'],
        ['Une piste d’audit', 'Un journal d’activité (Spatie) enregistre qui a changé quoi, pour chaque locataire.'],
      ],
      outcome: [
        'Les avis, réponses et indicateurs de tous les établissements dans un seul tableau de bord, au lieu d’onglet après onglet.',
        'Une publication envoyée à de nombreux établissements d’un coup.',
        'Passe d’une seule entreprise à des revendeurs qui gèrent des centaines d’établissements.',
      ],
      role: 'Ingénieur logiciel — API Laravel 12 et app Next.js 16.',
    },
  },

  'Recovery Advisers': {
    en: {
      hard: 'Clients see their cases in a separate portal, so every change in the main app has to reach it, and webhooks can arrive late, twice or out of order. A mirrored case must never move backwards. Creditors and law firms may only ever see their own cases, staff sign in with their company Microsoft accounts, and the team kept using the system every day while it was rebuilt.',
      arch: [
        ['Two apps, one source of truth', 'An internal app runs the lifecycle, from lead to case, mandate, litigation, recovery and invoice. The client portal is a read-only mirror.'],
        ['Webhook push instead of polling', 'Changes are pushed to client environments as events. Per-case sequence numbers stop late or duplicated deliveries from moving a case backwards.'],
        ['Access enforced in the data layer', 'Role-based access lives in the data layer, not the UI, and tenant-resolve middleware isolates every tenant.'],
        ['Company sign-in and finance tools', 'Microsoft 365 / Entra ID single sign-on (OAuth 2.0 / OIDC), Zoho Books and Teams integration.'],
        ['Commissions and HR in the same system', 'An affiliate commission engine with per-agreement schedules, plus contracts and goals.'],
      ],
      outcome: [
        'Clients follow their cases in their own portal instead of emailing for updates.',
        'Rebuilt while the team kept using it every day.',
        'One system from first lead to final invoice, with commissions and HR alongside.',
      ],
      role: 'Senior Software Engineer, full time — I own the architecture, schema, API contracts and production delivery.',
    },
    ar: {
      hard: 'يرى العملاء قضاياهم في بوابة منفصلة، لذا يجب أن يصل إليها كل تغيير في التطبيق الرئيسي، بينما قد تصل الـ webhooks متأخّرة أو مكرّرة أو بغير ترتيبها. ولا يجوز أن تعود قضية منسوخة إلى حالة سابقة أبدًا. ولا يرى الدائنون ومكاتب المحاماة إلا قضاياهم، ويسجّل الموظّفون الدخول بحسابات Microsoft الخاصة بشركتهم، وقد ظلّ الفريق يستخدم النظام كل يوم أثناء إعادة بنائه.',
      arch: [
        ['تطبيقان ومصدر حقيقة واحد', 'يدير تطبيق داخلي دورة العمل كاملة، من العميل المحتمل إلى القضية والتوكيل والتقاضي والتحصيل والفاتورة، والبوابة نسخة للقراءة فقط.'],
        ['دفع عبر webhooks بدل الاستطلاع', 'تُدفع التغييرات إلى بيئات العملاء كأحداث، وأرقام تسلسل لكل قضية تمنع التسليم المتأخّر أو المكرّر من إعادتها إلى الخلف.'],
        ['الصلاحيات في طبقة البيانات', 'التحكّم في الوصول حسب الدور يُطبَّق في طبقة البيانات لا في الواجهة، ووسيط تحديد المستأجر يعزل كل مستأجر.'],
        ['دخول بحساب الشركة وأدوات مالية', 'دخول موحّد عبر Microsoft 365 / Entra ID بمعيار OAuth 2.0 / OIDC، وتكامل مع Zoho Books وTeams.'],
        ['العمولات والموارد البشرية في النظام نفسه', 'محرّك عمولات للشركاء بجداول خاصة بكل اتفاقية، إلى جانب العقود والأهداف.'],
      ],
      outcome: [
        'يتابع العملاء قضاياهم من بوابتهم الخاصة بدل المراسلة للسؤال عن التحديثات.',
        'أُعيد بناؤه بينما ظلّ الفريق يستخدمه كل يوم.',
        'نظام واحد من أول عميل محتمل إلى الفاتورة النهائية، مع العمولات والموارد البشرية.',
      ],
      role: 'مهندس برمجيات أول بدوام كامل — أتولّى المعمارية والمخطّط وعقود الواجهات البرمجية والتسليم إلى الإنتاج.',
    },
    de: {
      hard: 'Mandanten sehen ihre Fälle in einem separaten Portal, also muss jede Änderung der Haupt-App dort ankommen, und Webhooks können verspätet, doppelt oder in falscher Reihenfolge eintreffen. Ein gespiegelter Fall darf nie zurückspringen. Gläubiger und Kanzleien dürfen nur ihre eigenen Fälle sehen, Mitarbeitende melden sich mit ihrem Microsoft-Firmenkonto an, und das Team arbeitete während des Umbaus jeden Tag weiter mit dem System.',
      arch: [
        ['Zwei Apps, eine Quelle der Wahrheit', 'Eine interne App steuert den Ablauf vom Lead über Fall, Mandat, Verfahren und Beitreibung bis zur Rechnung. Das Mandantenportal ist ein reiner Lesespiegel.'],
        ['Webhook-Push statt Polling', 'Änderungen gehen als Events an die Mandantenumgebungen. Sequenznummern je Fall verhindern, dass verspätete oder doppelte Zustellungen einen Fall zurücksetzen.'],
        ['Rechte in der Datenschicht', 'Rollenbasierte Rechte sitzen in der Datenschicht, nicht in der Oberfläche, und eine Tenant-Resolve-Middleware trennt jeden Mandanten.'],
        ['Firmen-Login und Finanz-Tools', 'Single Sign-on über Microsoft 365 / Entra ID (OAuth 2.0 / OIDC), Anbindung an Zoho Books und Teams.'],
        ['Provisionen und HR im selben System', 'Eine Provisions-Engine für Partner mit Zeitplänen je Vereinbarung, dazu Verträge und Ziele.'],
      ],
      outcome: [
        'Mandanten verfolgen ihre Fälle im eigenen Portal, statt per E-Mail nach dem Stand zu fragen.',
        'Umgebaut, während das Team täglich damit weiterarbeitete.',
        'Ein System vom ersten Lead bis zur letzten Rechnung, mit Provisionen und HR daneben.',
      ],
      role: 'Senior Software Engineer in Vollzeit — verantwortlich für Architektur, Schema, API-Verträge und Produktivbetrieb.',
    },
    es: {
      hard: 'Los clientes ven sus casos en un portal aparte, así que cada cambio en la app principal tiene que llegar allí, y los webhooks pueden llegar tarde, duplicados o desordenados. Un caso reflejado nunca debe retroceder. Acreedores y despachos solo pueden ver sus propios casos, el personal entra con su cuenta de Microsoft de la empresa, y el equipo siguió usando el sistema cada día mientras se reconstruía.',
      arch: [
        ['Dos apps, una sola fuente de verdad', 'Una app interna lleva el ciclo, del primer contacto al caso, el mandato, el litigio, el cobro y la factura. El portal de clientes es un espejo de solo lectura.'],
        ['Webhooks en lugar de sondeo', 'Los cambios se envían como eventos a los entornos de los clientes. Números de secuencia por caso impiden que una entrega tardía o duplicada haga retroceder un caso.'],
        ['Permisos en la capa de datos', 'El acceso por rol vive en la capa de datos, no en la interfaz, y un middleware de resolución de inquilino aísla a cada uno.'],
        ['Acceso corporativo y herramientas financieras', 'Inicio de sesión único con Microsoft 365 / Entra ID (OAuth 2.0 / OIDC), integración con Zoho Books y Teams.'],
        ['Comisiones y RR. HH. en el mismo sistema', 'Un motor de comisiones para afiliados con calendarios por acuerdo, además de contratos y objetivos.'],
      ],
      outcome: [
        'Los clientes siguen sus casos en su propio portal en lugar de escribir para preguntar.',
        'Reconstruido mientras el equipo lo seguía usando cada día.',
        'Un solo sistema del primer contacto a la factura final, con comisiones y RR. HH. al lado.',
      ],
      role: 'Ingeniero de software sénior a tiempo completo — me ocupo de la arquitectura, el esquema, los contratos de API y la entrega a producción.',
    },
    fr: {
      hard: 'Les clients suivent leurs dossiers dans un portail séparé : chaque changement de l’app principale doit donc y arriver, alors que les webhooks peuvent arriver en retard, en double ou dans le désordre. Un dossier recopié ne doit jamais revenir en arrière. Créanciers et cabinets d’avocats ne doivent voir que leurs propres dossiers, l’équipe se connecte avec son compte Microsoft d’entreprise, et elle a continué à utiliser le système chaque jour pendant sa refonte.',
      arch: [
        ['Deux apps, une seule source de vérité', 'Une app interne gère le cycle, du premier contact au dossier, au mandat, au contentieux, au recouvrement et à la facture. Le portail client en est un miroir en lecture seule.'],
        ['Des webhooks plutôt que du polling', 'Les changements sont poussés vers les environnements clients sous forme d’événements. Des numéros de séquence par dossier empêchent une livraison tardive ou en double de faire reculer un dossier.'],
        ['Les droits dans la couche de données', 'L’accès par rôle est appliqué dans la couche de données, pas dans l’interface, et un middleware de résolution du locataire isole chacun.'],
        ['Connexion d’entreprise et outils financiers', 'Authentification unique Microsoft 365 / Entra ID (OAuth 2.0 / OIDC), intégration Zoho Books et Teams.'],
        ['Commissions et RH dans le même système', 'Un moteur de commissions pour les partenaires avec des échéanciers par accord, plus les contrats et les objectifs.'],
      ],
      outcome: [
        'Les clients suivent leurs dossiers dans leur propre portail au lieu d’écrire pour avoir des nouvelles.',
        'Refondu pendant que l’équipe continuait à l’utiliser chaque jour.',
        'Un seul système du premier contact à la facture finale, avec les commissions et les RH à côté.',
      ],
      role: 'Ingénieur logiciel senior à temps plein — je porte l’architecture, le schéma, les contrats d’API et la mise en production.',
    },
  },
};
