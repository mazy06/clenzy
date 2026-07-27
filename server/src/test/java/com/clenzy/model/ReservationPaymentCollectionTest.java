package com.clenzy.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regime d'encaissement : derivation a l'ecriture, lecture ensuite.
 *
 * <p>C'est le coeur du decouplage. Le nom du canal ne sert plus qu'a DECIDER le
 * regime, une seule fois, au moment ou la reservation est ecrite ; les lecteurs
 * lisent le resultat. Ces tests fixent les trois proprietes qui rendent la
 * bascule sure : la derivation reproduit l'ancienne regle, un producteur peut
 * l'outrepasser, et une ligne non renseignee se comporte comme avant.</p>
 */
class ReservationPaymentCollectionTest {

    private Reservation withSource(String source) {
        Reservation r = new Reservation();
        r.setSource(source);
        return r;
    }

    @Test
    void whenChannelCollects_thenPersistingMarksItAsSuch() {
        Reservation r = withSource("channex");

        r.derivePaymentCollection();

        // Le bug d'origine : "channex" n'etait dans aucune des cinq listes.
        assertThat(r.getPaymentCollection()).isEqualTo(PaymentCollection.CHANNEL);
        assertThat(r.isCollectedByChannel()).isTrue();
    }

    @Test
    void whenSaleIsDirect_thenThePmsIsTheOneCollecting() {
        Reservation r = withSource("direct");

        r.derivePaymentCollection();

        assertThat(r.getPaymentCollection()).isEqualTo(PaymentCollection.PMS);
        assertThat(r.isCollectedByChannel()).isFalse();
    }

    /**
     * Le nom du canal n'est qu'un indice par defaut : un producteur qui connait
     * le regime doit pouvoir l'imposer. C'est ce qui permettra, en elargissant le
     * vocabulaire des canaux, de ne plus dependre de la chaine du tout.
     */
    @Test
    void whenProducerSetsTheRegimeItself_thenDerivationLeavesItAlone() {
        Reservation r = withSource("airbnb");
        r.setPaymentCollection(PaymentCollection.PMS);

        r.derivePaymentCollection();

        assertThat(r.getPaymentCollection()).isEqualTo(PaymentCollection.PMS);
        assertThat(r.isCollectedByChannel()).isFalse();
    }

    /**
     * Filet de migration : une ligne ecrite avant le backfill, ou par un
     * producteur qui aurait echappe au hook, se comporte exactement comme avant.
     */
    @Test
    void whenRegimeIsUnset_thenTheLegacyRuleStillAnswers() {
        assertThat(withSource("booking").isCollectedByChannel()).isTrue();
        assertThat(withSource("other").isCollectedByChannel()).isTrue();
        assertThat(withSource("direct").isCollectedByChannel()).isFalse();
        assertThat(withSource(null).isCollectedByChannel()).isFalse();
    }

    /** « DIRECT » a existe en base ; la derivation ne doit pas s'y laisser prendre. */
    @Test
    void whenSourceCasingVaries_thenTheRegimeDoesNot() {
        Reservation upper = withSource("AIRBNB");
        upper.derivePaymentCollection();
        assertThat(upper.getPaymentCollection()).isEqualTo(PaymentCollection.CHANNEL);

        Reservation legacyDirect = withSource("DIRECT");
        legacyDirect.derivePaymentCollection();
        assertThat(legacyDirect.getPaymentCollection()).isEqualTo(PaymentCollection.PMS);
    }
}
