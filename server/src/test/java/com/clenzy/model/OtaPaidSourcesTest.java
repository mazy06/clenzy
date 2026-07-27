package com.clenzy.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sources « deja reglees sur le canal ».
 *
 * <p>Cette liste decide si un sejour compte comme paye : une omission ne plante
 * rien, elle fait juste apparaitre un solde du sur de l'argent deja encaisse.
 * C'est exactement ce qui est arrive a Channex, oublie des cinq copies de la
 * liste au moment de son branchement. D'ou ces tests.</p>
 */
class OtaPaidSourcesTest {

    @Test
    void whenSourceIsChannex_thenItCountsAsPaidOnTheChannel() {
        // Le bug d'origine : Channex ecrit `source = "channex"` et n'etait dans
        // aucune des listes — tout sejour Channex comptait « reste a payer ».
        assertThat(OtaPaidSources.contains("channex")).isTrue();
    }

    @Test
    void whenSourceIsAKnownOta_thenItCountsAsPaidOnTheChannel() {
        assertThat(OtaPaidSources.contains("airbnb")).isTrue();
        assertThat(OtaPaidSources.contains("booking")).isTrue();
        // Vrbo et Expedia sont desormais des sources a part entiere, plus des
        // « other » : sans eux ici, l'elargissement du vocabulaire ferait
        // basculer leurs sejours en « reste a payer ».
        assertThat(OtaPaidSources.contains("vrbo")).isTrue();
        assertThat(OtaPaidSources.contains("expedia")).isTrue();
        // `other` : un canal non reconnu reste un canal de vente, qui encaisse.
        assertThat(OtaPaidSources.contains("other")).isTrue();
    }

    @Test
    void whenSourceIsDirect_thenThePmsIsTheOneCollecting() {
        assertThat(OtaPaidSources.contains("direct")).isFalse();
    }

    /** Les producteurs n'ont pas tous ete rigoureux — cf. « DIRECT » en majuscules. */
    @Test
    void whenSourceCasingVaries_thenTheAnswerDoesNot() {
        assertThat(OtaPaidSources.contains("AIRBNB")).isTrue();
        assertThat(OtaPaidSources.contains("Channex")).isTrue();
        assertThat(OtaPaidSources.contains("DIRECT")).isFalse();
    }

    @Test
    void whenSourceIsAbsent_thenNothingProvesItWasPaid() {
        assertThat(OtaPaidSources.contains(null)).isFalse();
        assertThat(OtaPaidSources.contains("")).isFalse();
    }
}
