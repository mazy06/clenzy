package com.clenzy.service.agent.multiagent;

import java.util.Set;

/**
 * Spécialiste d'un domaine métier dans l'architecture multi-agents.
 *
 * <p>Chaque spécialiste expose un sub-set restreint (≤ 10) du
 * {@code ToolRegistry} global, ce qui ameliore drastiquement le routing du
 * LLM (au-dela de ~10 tools, qualite chute, voir Anthropic Claude tool use
 * guide).</p>
 *
 * <p><b>SOLID</b> :</p>
 * <ul>
 *   <li><b>SRP</b> : 1 spécialiste = 1 domaine (data, ops, insights, etc.)</li>
 *   <li><b>OCP</b> : ajouter un domaine = nouveau {@code @Component}, ZERO
 *       modification de l'existant (auto-collection Spring via
 *       {@link SpecialistRegistry})</li>
 *   <li><b>DIP</b> : depend de {@link com.clenzy.service.agent.ToolHandler}
 *       via leur nom, pas via une dépendance concrète</li>
 *   <li><b>LSP</b> : tous les spécialistes substituables via cette interface</li>
 *   <li><b>ISP</b> : interface minimale (4 méthodes)</li>
 * </ul>
 *
 * <p><b>Stateless mandatory</b> : Spring singleton, partagé entre threads.
 * Toute mutation interne est interdite.</p>
 */
public interface AgentSpecialist {

    /**
     * Identifiant stable (snake_case, court). Utilise par l'orchestrator pour
     * le routing via {@code delegate_to(specialist_name, ...)}.
     *
     * <p>Convention : {@code data_analyst}, {@code operations}, {@code insights}…</p>
     */
    String name();

    /**
     * Domaine couvert (1-2 mots-cles pour le system prompt orchestrator).
     *
     * <p>Ex: "Analyse de donnees et KPIs", "Operations terrain (menages, interventions)".</p>
     */
    String domain();

    /**
     * Description longue : guide l'orchestrator pour decider quand deleguer ici.
     * Doit inclure des EXEMPLES de questions types.
     */
    String description();

    /**
     * Sub-set des noms de tools (depuis le {@code ToolRegistry} global) que ce
     * specialiste peut invoquer. <b>Limit ≤ 10</b> pour preserver la qualite
     * du routing.
     *
     * <p>Convention : noms snake_case identiques a ceux declares par
     * {@link com.clenzy.service.agent.ToolHandler#name()}.</p>
     */
    Set<String> toolNames();

    /**
     * Execute le spécialiste : LLM call avec ses sub-tools, boucle d'execution,
     * retourne une synthese textuelle pour l'orchestrator.
     */
    SpecialistResult handle(SpecialistRequest request);
}
