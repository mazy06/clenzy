# Phase 6 — Modèle opérationnel différenciant

> Campagne multi-agent Baitly — livrable Gate 6. Date : 2026-07-02.
> Base : veille concurrentielle sourcée (3 sous-agents, 11 acteurs, sources 2025-2026 en fin de document) + acquis Phases 1-5.

---

## 1. Angles morts du marché (synthèse de la veille)

| Acteur | Agentique | Autonomie | Monétisation IA | Audit/replay | Vue propriétaire |
|---|---|---|---|---|---|
| **Guesty** (Agent Hub, ~30 agents, 06/2026) | ✅ le plus avancé STR | paliers, toggles on/off grossiers | devis opaque, add-ons | ❌ | ❌ (alertes seulement) |
| **Hostaway** | ❌ copilote (rédige, n'envoie pas) | revue humaine obligatoire | « inclus » temporaire | ❌ | ❌ |
| **Hospitable** | MCP server (externalise l'orchestration) | garde-fous honnêtes, refus loggés | gate de plan (Mogul 99 $) | partiel (log refus) | ❌ |
| **Lodgify** | ❌ Co-Host = filtre d'exceptions | suggestions à valider | incluse (petits prix) | ❌ | ❌ |
| **Jurny** (NIA 3.0, multi-agents) | ✅ | élevée mais non configurable | flat 19 $/unité + add-ons | ❌ | ❌ |
| **Boom** (BAM) | ✅ | **curseur Co-Pilot→auto** (seul) | flat fee, devis | journal d'actions (pas de replay) | portail propriétaire (rapports) |
| **Smoobu** | ❌ (IA tierce) | — | incluse | ❌ | ❌ |
| **GuestReady/RentalReady** (Maia) | ✅ messaging (>50 % résolus sans humain) | autonome sur comm | levier de marge interne / licence | ❌ | ❌ (boîte noire commission) |
| **Houst** (OccuMax) | IA interne invisible | autonome interne, zéro config client | noyée dans la commission | ❌ | ❌ |
| **Mews** (hôtel, 300 M$ levés pour l'agentique) | ✅ RMS ferme la boucle | annoncée configurable, non démontrée | fondue dans les tiers, devis | ❌ | n/a (hôtel) |
| **Apaleo** (Agent Hub marketplace) | ✅ agents tiers | dépend de chaque partenaire | fragmentée entre N vendors | ❌ (dilué) | n/a (hôtel) |

**Les 5 trous du marché (aucun acteur ne les couvre) :**
1. **Coût IA transparent à l'action** — personne ne facture à l'usage réel ni n'affiche ce que coûte une action IA. Or c'est devenu la grammaire du SaaS B2B 2026 (HubSpot Credits 10 $/1 000, Microsoft Copilot Credits, Monday AI Credits, Salesforce Flex Credits ; per-outcome Intercom Fin 0,99 $/résolution) — l'hospitality a 2 ans de retard sur son propre marché acheteur.
2. **Auditabilité/replay des décisions IA** — angle mort généralisé (Boom : journal ; Hospitable : log des refus ; personne : replay).
3. **Autonomie finement configurable** (par agent × par action × par propriété, avec apprentissage) — Boom a un curseur global, Guesty des toggles ; personne n'apprend des validations.
4. **Transparence propriétaire** — les conciergeries tech (GuestReady, Houst) utilisent l'IA pour comprimer leurs marges en boîte noire totale ; aucun PMS n'offre de vue propriétaire des actions d'agents.
5. **Couverture STR multi-mandats** — Mews/Apaleo sont 100 % hôtel ; les PMS STR laissent l'ops terrain, la finance propriétaire et la supervision HITL centralisée faibles.

Notre Phase 0-5 couvre structurellement ces 5 trous : ledger de crédits par action (2), agent_run/replay (D-001), matrice d'autonomie 4 niveaux × tenant (3), agent Propriétaire + Constellation (4), roster ops/finance/owner (5).

## 2. Le modèle opérationnel cible : « l'exploitation supervisée par exception, au coût visible »

Six piliers (brief §6.2, confirmés et affûtés par la veille) :

1. **Autonome par défaut, supervisé par exception, avec validations apprises.** La matrice d'autonomie (Phase 3) démarre prudente (confirmer/suggérer) ; le système **apprend** : après N approbations identiques d'un même couple (agent, type d'action, contexte), il *propose* de passer le comportement à `notifier` — jamais de bascule silencieuse, la règle apprise est un objet visible, révocable, dans le panneau d'autonomie. Personne sur le marché n'a ce mécanisme (trou #3). Implémentation : les `pending_action` résolues (D-001) sont la donnée d'apprentissage ; une règle = (agent, actionType, conditions, niveau) versionnée.
2. **Proactif et prédictif.** Les scanners déterministes (0 LLM, marge intacte) + agents V1/V2 anticipent : baisse de rythme (Analytics), risque de mauvaise note (Réputation), rupture de stock (Stocks), pic événementiel (Revenue), panne probable (Maintenance/IoT). L'action anticipée arrive **avant** le problème, étiquetée socle ou premium.
3. **Copilote unifié + Constellation lisible et rejouable, coût affiché.** Chaque décision d'agent est une carte : quoi, pourquoi (motif), combien (crédits), rejouable (agent_run/agent_step). Le replay/time-travel devient un argument commercial, pas un outil de debug (trous #1 et #2).
4. **Transparence propriétaire comme produit** (conciergerie). Vue Constellation **lecture seule** par propriétaire : ce que les agents ont fait pour SON bien ce mois-ci (« 14 messages guests traités, 2 ajustements tarifaires +180 €, 1 intervention préventive »), adossée au relevé (agent Propriétaire, Phase 5 §11). Anti-thèse exacte de la boîte noire Houst/GuestReady (trou #4) — et argument de rétention des mandats pour nos clients conciergeries.
5. **Simulation what-if & replay.** Les outils simulate_* existants + replay D-001 : rejouer une décision avec d'autres paramètres avant d'appliquer (« si j'avais accepté la suggestion de min-stay, +X € »). Nourrit aussi la confiance → accélère l'adoption des validations apprises.
6. **La facturation à l'usage comme argument de valeur.** « Vous ne payez que ce qui travaille pour vous, et vous voyez tout » vs les flat fees opaques (Jurny 19 $/unité, Boom devis, Guesty add-ons). Le socle inclus neutralise la peur du compteur ; le hard cap + top-up neutralise la peur de la facture (pattern validé par tout le SaaS B2B 2026). Évolution possible : per-outcome sur les outcomes indiscutables (message guest résolu sans humain — benchmark Maia >50 %), en crédits (« résolution = 3 crédits, débitée seulement si résolue »).

## 3. Trois signature features

1. **Le Grand Livre d'Autonomie** (trous #1+#2) — chaque action d'agent : motif, coût en crédits, résultat, replay en un clic. Slogan interne : « aucune décision d'IA sans reçu ». Difficile à copier : exige un ledger par step ET un état de run persisté ET une UI intégrée — nous avons les trois par construction (Phases 2 + D-001 + Constellation).
2. **Les Règles de Confiance** (trou #3) — l'autonomie qui s'apprend par exception, visible et révocable. Difficile à copier : exige l'historique structuré des approbations HITL (notre pending_action unifié) et une matrice d'autonomie à 4 niveaux par action — les concurrents ont des toggles binaires.
3. **La Constellation Propriétaire** (trou #4) — la transparence IA vendue par nos clients conciergeries à LEURS propriétaires (white-label, lecture seule, avec le relevé mensuel). Difficile à copier : exige le modèle mandat/commission (déjà en prod chez nous : ManagementContract, CommissionInvoice, OwnerStatement) croisé avec le run-ledger. C'est aussi le déclencheur du multi-client temps réel (pont STOMP prévu en incrément D-001).

## 4. Positionnement stratégique (§6.3)

| | **Outil POUR les conciergeries (B2B2C) — reco** | Substitut aux conciergeries (opérateur IA) |
|---|---|---|
| Modèle | SaaS + crédits IA ; le client garde la relation propriétaire | commission ~15-20 % type Houst/GuestReady |
| Alignement avec l'existant | total (PMS multi-tenant, mandats, commissions, e-signature déjà en prod) | pivot complet : recruter des ops terrain, assurance, juridique |
| Marge | logicielle (~75-80 % sur crédits, Phase 2) | opérationnelle (faible, humaine) |
| Concurrence frontale | Guesty/Hostaway (nous : autonomie auditable + coût visible + owner view) | Houst/GuestReady (mieux capitalisés en ops) |
| Risque | les conciergeries exigent des preuves de fiabilité → les signature features 1-2 y répondent | canibalise nos propres clients conciergeries |
| Effet des signature features | la Constellation Propriétaire **arme nos clients** contre les opérateurs boîte noire | perdrait son sens |

**Recommandation : B2B2C assumé** — Baitly est l'outil qui rend une conciergerie (ou un particulier ambitieux) aussi outillée qu'un opérateur tech, avec la transparence en plus. Le segment petit hôtel reste fermé pour l'instant (Mews y lève 300 M$ ; notre terrain vacant est le STR multi-mandats — trou #5).

---

## Sources principales

Guesty [Agent Hub PR](https://www.prnewswire.com/news-releases/guesty-unleashes-the-agentic-revolution-the-first-pms-built-as-a-coordinated-system-of-ai-agents-302786962.html) · [AI features](https://www.guesty.com/features/ai-for-short-term-rentals/) — Hostaway [Hostaway AI](https://support.hostaway.com/hc/en-us/articles/37265258021787-What-is-Hostaway-AI) — Hospitable [AI Auto Replies](https://help.hospitable.com/en/articles/10977601-ai-auto-replies-for-guest-messages) · [MCP](https://help.hospitable.com/en/articles/14424057-connect-an-ai-agent-to-hospitable-using-mcp) · [Pricing](https://hospitable.com/pricing) — Lodgify [Co-Host & ChatGPT pilot](https://www.thehostreport.com/news/lodgify-launches-dynamic-pricing-an-ai-co-host-and-a-chatgpt-direct-booking-pilot) — Jurny [Pricing](https://www.jurny.com/pricing) · [NIA 3.0](https://blog.jurny.com/introducing-nia-30-the-future-of-hospitality-ai) — Boom [levée 12,7 M$](https://www.boomnow.com/blog/boom-raises-12-7m-to-power-the-next-generation-of-ai-driven-property-management) — GuestReady/RentalReady [Maia](https://www.phocuswire.com/rentalready-launches-fully-autonomous-ai-agent-maia) — Houst [Pricing](https://www.houst.com/pricing) — Mews [levée 300 M$](https://hoteltechnologynews.com/2026/01/mews-secures-300-million-to-accelerate-agentic-ai-for-autonomous-hotel-management/) · [Mews OS](https://www.hospitalitynet.org/news/4132634/mews-unveils-the-operating-system-for-hospitality) — Apaleo [Agent Hub](https://apaleo.com/blog/apaleo-news/apaleo-unveils-agent-hub) — Monétisation SaaS : [Intercom Fin/Zendesk/HubSpot/Salesforce/Copilot/Monday — SaaStr](https://www.saastr.com/salesforce-now-has-3-pricing-models-for-agentforce-and-maybe-right-now-thats-the-way-to-do-it/) · [HubSpot pay-per-result](https://www.hubspot.com/company-news/hubspots-customer-agent-and-prospecting-agent-now-you-pay-when-the-task-is-complete) · [Copilot Studio PAYG](https://azure.microsoft.com/en-us/pricing/details/copilot-studio/) · [Monday AI credits](https://support.monday.com/hc/en-us/articles/29544502265746-AI-Credits) · [Zuora — seats vs tokens vs outcomes](https://www.zuora.com/guides/ai-pricing-models/)
