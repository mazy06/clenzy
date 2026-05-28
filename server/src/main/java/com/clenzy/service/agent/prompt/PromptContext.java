package com.clenzy.service.agent.prompt;

import com.clenzy.model.AssistantMemory;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.kb.KbSearchService;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Contexte immutable consomme par les {@link PromptSection} pour composer le
 * system prompt.
 *
 * <p>Separe les preoccupations : l'{@link AgentContext} porte l'identite et les
 * informations UI brutes ; {@code PromptContext} y ajoute les donnees
 * pre-calculees (memoires charges, hits RAG, date courante, preset cible) que
 * les sections n'auraient pas a re-calculer individuellement (DIP : sections
 * dependent d'un contexte stable, pas de services).</p>
 *
 * <p>Construction via {@link Builder} (sealed-like : seul {@link SystemPromptComposer}
 * a vocation a le construire). Sections recoivent un PromptContext deja
 * <b>complet et coherent</b> — pas de mutation, pas de queries DB ad-hoc.</p>
 *
 * <h3>Thread-safety</h3>
 * <p>Record immutable. Listes interieures defensivement copiees + unmodifiable.
 * Safe a partager entre threads.</p>
 *
 * @param agentContext      identite et hints UI (jamais null)
 * @param preset            cas d'usage ciblé (CHAT, BRIEFING_DAILY, ...) — sert
 *                          aux sections a se desactiver hors-scope (ex: examples
 *                          desactives pour un briefing)
 * @param latestUserMessage dernier message user pour la sélection mémoire/RAG.
 *                          Null pour resume-after-confirmation (pas de re-search)
 * @param memories          memoires deja chargees (jamais null, peut etre vide)
 * @param kbHits            hits RAG deja chargees (jamais null, peut etre vide).
 *                          Filtrage relevance fait <b>avant</b> insertion
 * @param today             date courante (injectable via Clock pour tests)
 */
public record PromptContext(
        AgentContext agentContext,
        PromptPreset preset,
        String latestUserMessage,
        List<AssistantMemory> memories,
        List<KbSearchService.KbSearchHit> kbHits,
        LocalDate today
) {

    public PromptContext {
        Objects.requireNonNull(agentContext, "agentContext");
        Objects.requireNonNull(preset, "preset");
        memories = (memories == null) ? List.of() : Collections.unmodifiableList(List.copyOf(memories));
        kbHits = (kbHits == null) ? List.of() : Collections.unmodifiableList(List.copyOf(kbHits));
        if (today == null) today = LocalDate.now();
    }

    /** Helper raccourci pour les sections : code langue effectif ("fr" par defaut). */
    public String language() {
        return agentContext.language();
    }

    /** True si on est sur un cas chat (vs briefing). */
    public boolean isChat() {
        return preset == PromptPreset.CHAT;
    }

    /** True si on est sur un briefing (DAILY/WEEKLY/ALERTS). */
    public boolean isBriefing() {
        return preset == PromptPreset.BRIEFING_DAILY
                || preset == PromptPreset.BRIEFING_WEEKLY
                || preset == PromptPreset.BRIEFING_ALERTS;
    }

    public static Builder builder(AgentContext agentContext, PromptPreset preset) {
        return new Builder(agentContext, preset);
    }

    /**
     * Builder fluent. SystemPromptComposer reste maitre de la construction —
     * les sections ne construisent pas leur propre context (DIP).
     */
    public static final class Builder {
        private final AgentContext agentContext;
        private final PromptPreset preset;
        private String latestUserMessage;
        private List<AssistantMemory> memories;
        private List<KbSearchService.KbSearchHit> kbHits;
        private LocalDate today;
        private Clock clock;

        private Builder(AgentContext agentContext, PromptPreset preset) {
            this.agentContext = agentContext;
            this.preset = preset;
        }

        public Builder latestUserMessage(String message) {
            this.latestUserMessage = message;
            return this;
        }

        public Builder memories(List<AssistantMemory> memories) {
            this.memories = memories;
            return this;
        }

        public Builder kbHits(List<KbSearchService.KbSearchHit> hits) {
            this.kbHits = hits;
            return this;
        }

        public Builder today(LocalDate today) {
            this.today = today;
            return this;
        }

        public Builder clock(Clock clock) {
            this.clock = clock;
            return this;
        }

        public PromptContext build() {
            LocalDate resolvedToday = today;
            if (resolvedToday == null) {
                resolvedToday = (clock != null) ? LocalDate.now(clock) : LocalDate.now();
            }
            return new PromptContext(agentContext, preset, latestUserMessage,
                    memories, kbHits, resolvedToday);
        }
    }
}
