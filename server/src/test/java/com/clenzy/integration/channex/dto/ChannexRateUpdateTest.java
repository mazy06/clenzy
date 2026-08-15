package com.clenzy.integration.channex.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Invariants de l'entree ARI « rates ».
 *
 * <p>Ce DTO n'avait aucun test, et c'est ce qui a laisse passer le bug du
 * 2026-08-15 : son constructeur exigeait un tarif non nul, ce qui etait juste
 * tant que chaque push portait tous les champs. Le passage en delta l'a rendu
 * faux — une mise a jour de sejour minimum seul n'a pas de tarif — et le push
 * entier echouait sur « rate must be >= 0, got null ». Les tests du listener et
 * du batcher n'exercaient pas ce chemin ; seul le rejeu contre le serveur l'a
 * revele.</p>
 */
@DisplayName("ChannexRateUpdate")
class ChannexRateUpdateTest {

    private static final String PROP = "789973a4-dabb-4a35-988b-5670ff4c103c";
    private static final String PLAN = "bdacb7fc-684a-4532-84f4-2bca19dcb246";
    private static final LocalDate DATE = LocalDate.parse("2027-08-01");

    @Test
    @DisplayName("tarif nul accepte : c'est ainsi qu'un delta l'omet du payload")
    void nullRateIsAccepted() {
        assertThatCode(() -> new ChannexRateUpdate(
            PROP, PLAN, DATE, null, 4, 4, null, null, 21, null))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("sejour minimum seul : aucun autre champ n'est renseigne")
    void minStayOnly() {
        ChannexRateUpdate u = new ChannexRateUpdate(
            PROP, PLAN, DATE, null, 4, 4, null, null, null, null);

        assertThat(u.rate()).isNull();
        assertThat(u.stopSell()).isNull();
        assertThat(u.closedToArrival()).isNull();
        assertThat(u.minStayThrough()).isEqualTo(4);
    }

    @Test
    @DisplayName("fermeture a la vente seule : ni tarif ni restriction")
    void stopSellOnly() {
        ChannexRateUpdate u = new ChannexRateUpdate(
            PROP, PLAN, DATE, null, null, null, null, null, null, Boolean.TRUE);

        assertThat(u.stopSell()).isTrue();
        assertThat(u.rate()).isNull();
        assertThat(u.minStayThrough()).isNull();
    }

    @Test
    @DisplayName("tarif negatif refuse")
    void negativeRateIsRejected() {
        assertThatThrownBy(() -> new ChannexRateUpdate(
            PROP, PLAN, DATE, new BigDecimal("-1"), null, null, null, null, null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("rate must be >= 0");
    }

    @Test
    @DisplayName("entree sans aucun champ refusee : elle ne veut rien dire")
    void emptyUpdateIsRejected() {
        assertThatThrownBy(() -> new ChannexRateUpdate(
            PROP, PLAN, DATE, null, null, null, null, null, null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("sans aucun champ");
    }
}
