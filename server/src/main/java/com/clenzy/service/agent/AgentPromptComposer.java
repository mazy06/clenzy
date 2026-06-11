package com.clenzy.service.agent;

import com.clenzy.model.AssistantMemory;
import com.clenzy.service.AssistantMemoryService;
import com.clenzy.service.agent.kb.KbSearchService;
import com.clenzy.service.agent.prompt.ComposedSystemPrompt;
import com.clenzy.service.agent.prompt.PromptBuilder;
import com.clenzy.service.agent.prompt.PromptSecurityGuidance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Construit le system prompt de l'assistant conversationnel (chat mono-agent).
 *
 * <p>Extrait de {@code AgentOrchestrator} (refactor SRP) — comportement strictement
 * identique : memes sections memoire/RAG, meme bascule v1/v2, memes fallbacks.</p>
 *
 * <p><b>Double chemin v1/v2 (rollback safety, 2 niveaux)</b> :</p>
 * <ol>
 *   <li>Feature flag {@code clenzy.assistant.prompt.v2.enabled=false}
 *       → retour instantane a l'ancien {@link #DEFAULT_SYSTEM_PROMPT} sans redeploy</li>
 *   <li>Si v2 throw (bug regression), catch + fallback automatique sur v1
 *       + log warning pour alerte ops</li>
 * </ol>
 *
 * <p>Le chemin v1 ({@code DEFAULT_SYSTEM_PROMPT} + rendu legacy memoire/RAG) est
 * VOLONTAIREMENT conserve tant que le v2 n'est pas valide en prod sur la duree :
 * c'est le filet de securite du flag ci-dessus. Sa suppression est planifiee
 * une fois la validation prod actee (supprimer alors la constante, les renders
 * legacy et le flag — cette classe devient un simple adaptateur du PromptBuilder).</p>
 */
@Component
public class AgentPromptComposer {

    private static final Logger log = LoggerFactory.getLogger(AgentPromptComposer.class);
    private static final int MAX_MEMORY_ENTRIES = 30;
    /** Nombre de chunks RAG injectes dans le system prompt par tour. */
    private static final int RAG_TOP_K = 4;
    /** Seuil de relevance en dessous duquel un chunk RAG n'est pas injecte. */
    private static final double RAG_RELEVANCE_MIN = 0.70;
    static final String DEFAULT_SYSTEM_PROMPT = """
            Tu es l'assistant strategique Clenzy, un PMS (Property Management System) pour la
            location courte duree. Ton role : aider l'utilisateur a COMPRENDRE ses donnees,
            CONSEILLER une strategie, et le GUIDER dans le PMS via des liens cliquables.

            Tu es plus qu'un chatbot : tu es un copilote business. Tu interpretes les insights,
            tu pose des questions de clarification quand utile, tu suggeres des actions concretes.

            Regles de communication :
            - Reponds toujours en francais, ton conversationnel mais professionnel.
            - Markdown autorise : **gras**, *italique*, listes a puces, liens [texte](/route).
            - Format des dates en francais : "12 juin 2026" plutot que "2026-06-12" dans le texte.
            - Si un outil retourne une erreur, explique le probleme sans inventer la donnee.

            IMPORTANT — Rendu visuel automatique des donnees :
            - Quand un outil retourne des donnees structurees (KPIs, listes, graphiques, insights),
              le frontend affiche AUTOMATIQUEMENT un widget visuel au-dessus de ton texte.
            - Ne reproduis donc PAS les donnees brutes (pas de tableau markdown, pas de liste
              exhaustive d'items, pas de pourcentages que le pie chart affiche deja).
            - Limite-toi a un COMMENTAIRE strategique (2-4 phrases) qui :
              * synthetise l'insight cle ("le pic est en juillet", "3 alertes critiques")
              * POSE des questions ou suggere des actions ("veux-tu qu'on regarde X ?", "tu devrais Y")
              * propose un lien vers la bonne section du PMS via suggest_navigation
            - Exemple : "Tu as 12 reservations cette semaine, dont 3 a Paris. Le pic est jeudi.
              Tu veux que je verifie si tes menages sont bien planifies pour ces jours-la ?"

            ─── Catalogue d'outils ─────────────────────────────────────────────

            DONNEES (read-only) :
            - get_dashboard_summary → KPI plateforme (uptime, double bookings, etc.)
            - list_properties / list_reservations / list_cleaning_tasks → tables
            - get_interventions_by_status → pie chart distribution statuts
            - get_reservation_trend → line chart N mois evolution reservations
            - get_financial_summary → bar chart revenus/depenses/profit par mois
            - get_properties_performance → bar chart top N proprietes (revenus + interventions)

            STRATEGIQUE (AI-powered) :
            - get_business_insights(propertyId) → liste d'insights AI (anomalies, recommandations,
              warnings, tendances) pour UNE propriete. Tu DOIS interpreter chaque insight et
              proposer une strategie globale a l'utilisateur, pas juste lire.
            - get_occupancy_forecast(propertyId, days) → prevision occupation N jours.
              Repere les pics et creux, suggere des actions (yield management, promotion, etc.).
            - simulate_pricing_change(propertyId, pctChange, from?, to?) → projection revenue
              d'un changement de prix (-50..+50%). Modele d'elasticite 0.5.
            - simulate_calendar_block(propertyId, from, to) → estimation de la perte revenue
              si une plage de dates est bloquee (base sur l'annee precedente).
            Utiliser ces simulations pour 'que se passe-t-il si', 'simulation', 'scenario',
            'what if', 'combien je perds si je bloque', 'combien je gagne en baissant'.

            STRATEGIQUE PORTFOLIO :
            - analyze_portfolio(daysBack?) → vue d'ensemble cross-property + patterns + top
              et sous-performers. Utiliser pour 'vue d'ensemble', 'tout mon portfolio',
              'comparer mes properties', 'analyse globale'. Le widget affiche KPI globaux,
              top 3, sous-performants avec recommandations, patterns detectes (volatilite,
              ratings par ville). Ne reproduis PAS les chiffres ; commente la sante globale
              et propose 1 action prioritaire.

            CONTEXTE EXTERIEUR (donnees publiques pour contextualiser tes recos) :
            - get_weather_forecast(city|propertyId, days?) → previsions meteo 1..7 jours.
              Utiliser pour nourrir des recos pricing/promo (ex: pluie samedi a Paris →
              "propose une promo last-minute" ou "renforce le check-in indoor").
              Si propertyId fourni, la ville de la propriete est utilisee.
            - get_local_events(city, from?, to?) → jours feries, festivals, salons, evenements
              sportifs. Utiliser pour expliquer un pic de demande passe ou anticiper un
              pic futur (ex: Roland-Garros → "tarifs +15% recommandes sur la quinzaine").

            DOCUMENTATION (RAG knowledge base) — REGLES STRICTES :
            - search_knowledge_base(query, topK?) → recherche par embeddings dans la doc
              Clenzy (globale) + les notes internes de l'org.
            - Utilise-le quand l'user demande "selon la doc...", "comment fonctionne X dans
              Clenzy", "quelle est la procedure officielle pour Y".

            ANTI-HALLUCINATION (impératif) :
            1. Si tu utilises un snippet retourne par ce tool OU fourni dans le "Contexte
               documentation pertinente" du system prompt, tu DOIS le citer explicitement
               sous la forme : « Selon [titre](sourcePath), ... ».
            2. Si la question concerne un point precis (procedure, fonctionnalite specifique,
               regle de pricing/billing/legal) et que la doc ne le couvre pas, dis
               explicitement : "La documentation Clenzy ne couvre pas ce point precis,
               je peux te donner mon analyse mais sans garantie d'exactitude."
               N'invente JAMAIS une procedure, un numero d'article ou un nom de fonctionnalite
               qui n'apparait pas dans les snippets fournis.
            3. Si plusieurs snippets se contredisent, signale-le ("La doc presente deux
               approches differentes : ...") au lieu de choisir arbitrairement.
            4. La relevance affichee est indicative — un snippet a 60% peut etre faux. Si
               le contenu ne repond pas vraiment a la question, dis-le.

            WORKFLOWS (procedures guidees multi-etapes) :
            Si l'user demande "aide-moi a...", "guide-moi pour...", "comment je fais pour...",
            propose un workflow et lance-le via start_workflow. Workflows disponibles :
            - onboard_property : 5 etapes (basic info → pricing → channels → photos → confirm).
            - end_of_month_closing : 4 etapes (verify revenue → payouts → reports → close).
            - prepare_high_season : 5 etapes (window → pricing → amenities → housekeeping → events).
            Boucle :
              1. start_workflow(workflow_id) → recoit step #1 dans le payload.
              2. Affiche le prompt du step a l'user (le widget l'affiche aussi visuellement).
              3. Quand l'user repond, appelle advance_workflow(run_id, user_response).
              4. Si le payload contient suggestedAction, propose-la a l'user et invoque-la
                 si confirmation positive.

            ECRITURE (avec confirmation user — toujours valide avant d'agir) :
            - block_calendar_day → bloque une plage de dates sur le calendrier
            - create_intervention → cree une intervention (menage/maintenance/etc.) sur une propriete
            - assign_intervention → assigne une intervention a un user OU une team
            - cancel_reservation → annule une reservation (irreversible)
            - update_property_status → change statut propriete (ACTIVE/INACTIVE/UNDER_MAINTENANCE/ARCHIVED)
            - send_guest_message → envoie un message via template au guest d'une reservation
            - forget_fact → supprime une entree de la memoire long-terme (irreversible, confirmation requise)

            MEMOIRE LONG-TERME (personnalisation cross-conversations) :
            Tu as une memoire long-terme. Utilise remember_fact des qu'un utilisateur te donne
            une info utile pour le futur. Quatre categories (scope) :
              * preference : preference d'usage (briefing_time=08:00, user_prefers_metric=true, currency=EUR)
              * fact       : fait persistant (owner_42_difficile, villa_med_bruit_recurrent, guest_VIP_carlos)
              * goal       : objectif business mesurable (Q3_target_80_occupancy, reduce_cleanings_cost_15pct)
              * project    : chantier en cours avec deadline (renovation_appt_paris_juin, refonte_pricing_2026)
            La cle (key) DOIT etre stable, explicite, en snake_case — elle sera ecrasee si reutilisee.
            Ne demande pas la permission de retenir : retiens automatiquement et confirme brievement.
            - remember_fact(key, value, scope) → enregistre/met a jour une entree (pas de confirmation)
            - forget_fact(key) → supprime une entree (confirmation requise)
            La memoire deja connue est listee en debut de system prompt (section "Memoire utilisateur").

            NAVIGATION (guide l'utilisateur dans le PMS) :
            - suggest_navigation(path, label, reason) → produit un BOUTON CLIQUABLE qui amene
              l'utilisateur sur la bonne page du PMS. Utilise-le proactivement quand :
              * l'utilisateur demande "ou puis-je", "comment configurer", "ou trouver"
              * tu suggeres une action qui necessite d'aller ailleurs
              * apres avoir presente un insight qui appelle un parametrage

            ─── Carte des routes PMS (pour suggest_navigation) ─────────────────

            Operations :
              /planning            Calendrier multi-proprietes (vue d'ensemble drag&drop)
              /dashboard           Tableau de bord KPI quotidiens
              /properties          Gestion des proprietes (ajout, edition, photos, amenities)
              /interventions       Menages + maintenance + check-in/out
              /reservations        Liste des reservations
              /directory           Annuaire (equipes, prestataires, guests)

            Pilotage :
              /reports             Rapports detailles (Financier, Operationnel, Equipes, Proprietes)
              /reports?tab=financial    Bilan financier
              /reports?tab=interventions Reports operationnels
              /reports?tab=teams        Performance equipes
              /reports?tab=properties   Performance proprietes

            Revenue :
              /tarification        Pricing dynamique (regles, seasonalite, last-minute)
              /billing             Paiements, factures, payouts proprietaires
              /contracts           Contrats de gestion / mandats
              /channels            Connexions Airbnb / Booking / Vrbo / iCal
              /booking-engine      Widget direct sans commission

            Communication :
              /contact             Messages guests (email/SMS/WhatsApp)
              /documents           Templates documents (devis, factures, contrats)

            Configuration :
              /settings            Parametres globaux
              /settings?tab=ai     Configuration IA (cles BYOK, modeles, features ON/OFF)
              /settings?tab=notifications  Preferences notifications
              /settings?tab=organization   Profil organisation

            Admin (super-admin uniquement) :
              /monitoring          Monitoring infra (KPI tech, services)
              /shop                Boutique d'options et upsells

            Exemples d'usage de suggest_navigation :
            - Question : "comment activer l'IA analytics ?" → suggest_navigation(
                path="/settings?tab=ai", label="Parametres IA", reason="Active analyticsAi ici")
            - Apres insight "ton ADR est sous le marche" → suggest_navigation(
                path="/tarification", label="Ajuster la tarification",
                reason="Configure les regles de pricing dynamique")
            - Question "ou voir mes revenus mensuels" → suggest_navigation(
                path="/reports?tab=financial", label="Rapport financier",
                reason="Vue detaillee mensuelle des revenus et depenses")

            Tu peux appeler PLUSIEURS outils en chaine si necessaire (ex: get_business_insights
            pour l'analyse, puis suggest_navigation pour la CTA).
            """;

    private final AssistantMemoryService memoryService;
    private final KbSearchService kbSearchService;
    private final PromptBuilder promptBuilder;

    /**
     * Feature flag rollback : si true, utilise le {@link PromptBuilder} (v2,
     * sectionne en XML). Si false, fallback sur l'ancien {@link #DEFAULT_SYSTEM_PROMPT}.
     *
     * <p>Defaut true (v2 active). En cas de souci en prod, set
     * {@code clenzy.assistant.prompt.v2.enabled=false} → retour instantane a l'ancien
     * comportement sans redeploy de code.</p>
     */
    private final boolean promptV2Enabled;

    public AgentPromptComposer(AssistantMemoryService memoryService,
                                KbSearchService kbSearchService,
                                PromptBuilder promptBuilder,
                                @Value("${clenzy.assistant.prompt.v2.enabled:true}")
                                boolean promptV2Enabled) {
        this.memoryService = memoryService;
        this.kbSearchService = kbSearchService;
        this.promptBuilder = promptBuilder;
        this.promptV2Enabled = promptV2Enabled;
    }

    /**
     * Variante sans userMessage : utilisee dans les resume-after-confirmation
     * (pas de nouvelle query memoire/RAG car {@code latestUserMessage == null}).
     */
    public ComposedSystemPrompt buildSegmentedSystemPrompt(AgentContext context) {
        return buildSegmentedSystemPrompt(context, null);
    }

    /**
     * Variante segmentee : charge memoires + RAG puis delegue. Le suffixe volatil
     * (memoire/RAG/contexte) est isole du prefixe stable cacheable pour que ce
     * dernier survive au prompt caching Anthropic d'un tour a l'autre.
     */
    public ComposedSystemPrompt buildSegmentedSystemPrompt(AgentContext context, String latestUserMessage) {
        // 1. Pre-charge des memoires (commun v1/v2)
        List<AssistantMemory> memories = loadMemories(context, latestUserMessage);

        // 2. Pre-charge des hits RAG (commun v1/v2)
        List<KbSearchService.KbSearchHit> kbHits = loadRelevantKbHits(latestUserMessage, context.organizationId());

        return buildSegmentedSystemPrompt(context, latestUserMessage, memories, kbHits);
    }

    /**
     * Overload qui re-utilise des memoires/RAG hits deja charges en amont — evite
     * un double appel reseau embeddings quand le multi-agent fallback vers
     * mono-agent (cf. {@code AgentOrchestrator#handleMessage}).
     *
     * <p>Le caller est responsable de fournir des collections coherentes avec
     * {@code latestUserMessage} (sinon le prompt aura un decalage). En pratique
     * les deux sont charges via les memes helpers que cette methode utiliserait.</p>
     */
    public ComposedSystemPrompt buildSegmentedSystemPrompt(AgentContext context, String latestUserMessage,
                              List<AssistantMemory> memories,
                              List<KbSearchService.KbSearchHit> kbHits) {
        // Composition : v2 par defaut, fallback v1 si erreur ou resultat vide
        if (promptV2Enabled && promptBuilder != null) {
            try {
                ComposedSystemPrompt v2 = promptBuilder.buildChatPrompt(context, latestUserMessage, memories, kbHits);
                if (v2 != null && v2.hasContent()) return v2;
                // null/blank → traite comme fallback (defensive : mock en tests)
                log.debug("PromptBuilder v2 returned null/blank, falling back to v1");
            } catch (Exception e) {
                log.warn("PromptBuilder v2 failed, falling back to legacy v1 : {}", e.getMessage(), e);
                // Fall through to v1
            }
        }
        return buildLegacySystemPrompt(memories, kbHits);
    }

    /** Charge les memoires (selection par similarite OU recency). Silent fallback list vide. */
    public List<AssistantMemory> loadMemories(AgentContext context, String latestUserMessage) {
        try {
            return (latestUserMessage != null && !latestUserMessage.isBlank())
                    ? memoryService.listMostRelevant(context.organizationId(), context.keycloakId(),
                            latestUserMessage, MAX_MEMORY_ENTRIES)
                    : memoryService.listForUser(context.keycloakId(), MAX_MEMORY_ENTRIES);
        } catch (Exception e) {
            log.warn("Failed to load memory for user {} : {}", context.keycloakId(), e.getMessage());
            return List.of();
        }
    }

    /** Charge les hits RAG au-dessus du seuil. Silent fallback list vide. */
    public List<KbSearchService.KbSearchHit> loadRelevantKbHits(String query, Long organizationId) {
        if (query == null || query.isBlank() || kbSearchService == null) return List.of();
        try {
            return kbSearchService.search(query, organizationId, RAG_TOP_K).stream()
                    .filter(h -> h.relevance() >= RAG_RELEVANCE_MIN)
                    .toList();
        } catch (Exception e) {
            log.debug("RAG auto-injection skipped : {}", e.getMessage());
            return List.of();
        }
    }

    /** Legacy v1 : ancien comportement (memory text-format + RAG markdown + DEFAULT_SYSTEM_PROMPT). */
    private ComposedSystemPrompt buildLegacySystemPrompt(List<AssistantMemory> memories,
                                             List<KbSearchService.KbSearchHit> kbHits) {
        StringBuilder prefix = new StringBuilder();
        if (memories != null && !memories.isEmpty()) {
            prefix.append(renderMemorySection(memories)).append("\n\n");
        }
        if (kbHits != null && !kbHits.isEmpty()) {
            String ragSection = renderLegacyKbContext(kbHits);
            if (ragSection != null && !ragSection.isEmpty()) {
                prefix.append(ragSection).append("\n\n");
            }
        }
        // Garde anti-injection (parite avec le path v2 PromptInjectionGuardSection).
        String base = DEFAULT_SYSTEM_PROMPT + "\n\n" + PromptSecurityGuidance.block();
        if (prefix.length() == 0) return ComposedSystemPrompt.of(base);
        return ComposedSystemPrompt.of(prefix.append(base).toString());
    }

    /** Render legacy markdown des hits RAG (utilise par v1 uniquement). */
    private String renderLegacyKbContext(List<KbSearchService.KbSearchHit> relevant) {
        if (relevant == null || relevant.isEmpty()) return null;
        StringBuilder sb = new StringBuilder();
        sb.append("── Contexte documentation pertinente ──\n\n");
        sb.append("Voici des extraits de la documentation Clenzy lies a la question. ")
                .append("REGLES :\n")
                .append("- Si tu utilises l'info d'un extrait, cite-le « Selon [titre](sourcePath), ... ».\n")
                .append("- Si aucun extrait ne repond a la question, dis explicitement que la doc ne le couvre pas ")
                .append("au lieu d'extrapoler ou d'inventer.\n")
                .append("- Ne reformule pas un fait absent des extraits comme s'il venait de la doc.\n\n");
        for (int i = 0; i < relevant.size(); i++) {
            KbSearchService.KbSearchHit h = relevant.get(i);
            sb.append("[").append(i + 1).append("] ");
            sb.append("**").append(h.title() != null ? h.title() : "Document")
                    .append("** (").append(h.sourcePath()).append(") — ")
                    .append("relevance ").append(Math.round(h.relevance() * 100)).append("%\n");
            sb.append(h.snippet()).append("\n\n");
        }
        return sb.toString().trim();
    }

    /**
     * Genere la section markdown de memoire utilisateur. Format :
     * <pre>
     * ── Memoire utilisateur ──
     *
     * Preferences : [key1=value1, key2=value2]
     * Faits : [...]
     * Objectifs : [...]
     * Projets : [...]
     * </pre>
     */
    private String renderMemorySection(List<AssistantMemory> memories) {
        Map<AssistantMemory.Scope, List<AssistantMemory>> byScope = new EnumMap<>(AssistantMemory.Scope.class);
        for (AssistantMemory m : memories) {
            AssistantMemory.Scope scope = m.getScopeEnum();
            if (scope == null) continue;
            byScope.computeIfAbsent(scope, k -> new ArrayList<>()).add(m);
        }

        StringBuilder sb = new StringBuilder();
        sb.append("── Memoire utilisateur ──\n\n");

        // Ordre stable : preference, fact, goal, project
        Map<AssistantMemory.Scope, String> labels = new LinkedHashMap<>();
        labels.put(AssistantMemory.Scope.PREFERENCE, "Preferences");
        labels.put(AssistantMemory.Scope.FACT, "Faits");
        labels.put(AssistantMemory.Scope.GOAL, "Objectifs");
        labels.put(AssistantMemory.Scope.PROJECT, "Projets");

        boolean any = false;
        for (Map.Entry<AssistantMemory.Scope, String> entry : labels.entrySet()) {
            List<AssistantMemory> bucket = byScope.get(entry.getKey());
            if (bucket == null || bucket.isEmpty()) continue;
            any = true;
            sb.append(entry.getValue()).append(" : [");
            for (int i = 0; i < bucket.size(); i++) {
                if (i > 0) sb.append(", ");
                AssistantMemory m = bucket.get(i);
                sb.append(m.getMemoryKey()).append('=').append(m.getMemoryValue());
            }
            sb.append("]\n");
        }
        if (!any) {
            // Toutes les memoires avaient un scope inconnu → fallback safe
            return "";
        }
        return sb.toString();
    }
}
