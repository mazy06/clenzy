package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.dto.MappingSuggestion;
import com.clenzy.integration.channex.service.MappingSuggestionMatcher.ChannexCandidate;
import com.clenzy.integration.channex.service.MappingSuggestionMatcher.ClenzyCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Apparieur de mapping Clenzy ↔ Channex (CLZ Domaine 1) — fonction pure.
 */
class MappingSuggestionMatcherTest {

    private final MappingSuggestionMatcher matcher = new MappingSuggestionMatcher();

    @Test
    void exactNormalizedNameMatch_highConfidence() {
        List<MappingSuggestion> s = matcher.suggest(
            List.of(new ClenzyCandidate(1L, "Studio Marais")),
            List.of(new ChannexCandidate("chx-1", "studio  MARAIS !")));

        assertThat(s).hasSize(1);
        assertThat(s.get(0).clenzyPropertyId()).isEqualTo(1L);
        assertThat(s.get(0).channexPropertyId()).isEqualTo("chx-1");
        assertThat(s.get(0).confidence()).isEqualTo("HIGH");
    }

    @Test
    void accentsNormalized_match() {
        List<MappingSuggestion> s = matcher.suggest(
            List.of(new ClenzyCandidate(1L, "Appartement Hôtel-de-Ville")),
            List.of(new ChannexCandidate("chx-9", "Appartement Hotel de Ville")));

        assertThat(s).extracting(MappingSuggestion::confidence).containsExactly("HIGH");
    }

    @Test
    void partialMatch_mediumConfidence() {
        List<MappingSuggestion> s = matcher.suggest(
            List.of(new ClenzyCandidate(2L, "Loft Bastille")),
            List.of(new ChannexCandidate("chx-2", "Loft Bastille - 2 chambres")));

        assertThat(s).hasSize(1);
        assertThat(s.get(0).confidence()).isEqualTo("MEDIUM");
    }

    @Test
    void noMatch_empty() {
        List<MappingSuggestion> s = matcher.suggest(
            List.of(new ClenzyCandidate(3L, "Villa Nice")),
            List.of(new ChannexCandidate("chx-3", "Chalet Chamonix")));

        assertThat(s).isEmpty();
    }

    @Test
    void aChannexPropertyIsSuggestedOnlyOnce() {
        List<MappingSuggestion> s = matcher.suggest(
            List.of(new ClenzyCandidate(1L, "Studio"), new ClenzyCandidate(2L, "Studio")),
            List.of(new ChannexCandidate("chx-1", "Studio")));

        assertThat(s).hasSize(1); // la 2e propriete Clenzy ne re-suggere pas chx-1
        assertThat(s.get(0).clenzyPropertyId()).isEqualTo(1L);
    }

    @Test
    void blankNamesIgnored() {
        List<MappingSuggestion> s = matcher.suggest(
            List.of(new ClenzyCandidate(1L, "   ")),
            List.of(new ChannexCandidate("chx-1", "Studio")));

        assertThat(s).isEmpty();
    }
}
