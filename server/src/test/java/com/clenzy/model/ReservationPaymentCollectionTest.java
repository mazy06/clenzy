package com.clenzy.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regime d'encaissement : derivation a l'ecriture, lecture ensuite.
 *
 * <p>C'est le coeur du decouplage. Le nom du canal ne sert plus qu'a DECIDER le
 * regime, une seule fois, au moment ou la reservation est ecrite ; les lecteurs
 * lisent le resultat. Ces tests fixent les proprietes qui rendent la bascule
 * sure : la derivation reproduit l'ancienne regle, un producteur peut
 * l'outrepasser, et la lecture ne devine plus rien.</p>
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
     * La lecture ne devine plus rien.
     *
     * <p>Tant que la colonne etait nullable, {@code isCollectedByChannel} rejouait
     * l'ancienne deduction depuis {@code source} — le filet de la migration. Le
     * changeset 0368 rend la colonne NOT NULL : l'invariant est tenu par la base,
     * et la lecture redevient une lecture. Une entite jamais persistee n'a pas
     * encore de regime, et repond donc « non », y compris sur un canal qui
     * encaisse — c'est ce que ce test verrouille, pour qu'un futur appelant ne
     * reintroduise pas la deduction en croyant corriger un oubli.</p>
     */
    @Test
    void whenNeverPersisted_thenReadingDoesNotGuessFromTheChannelName() {
        assertThat(withSource("booking").isCollectedByChannel()).isFalse();
        assertThat(withSource(null).isCollectedByChannel()).isFalse();
    }

    /**
     * Longue traine : ces canaux n'ont pas d'adapter dedie, ils arrivent par un
     * flux iCal. Ils encaissent malgre tout pour le compte de l'hote — les
     * oublier redonnerait un solde du sur de l'argent deja percu, le bug meme
     * que ce chantier corrige.
     */
    @Test
    void whenChannelIsLongTail_thenItCollectsToo() {
        for (String channel : new String[] {
                "agoda", "hotels_com", "hometogo", "mabeet", "rentelly", "gathern" }) {
            Reservation r = withSource(channel);

            r.derivePaymentCollection();

            assertThat(r.getPaymentCollection())
                .as("canal %s", channel)
                .isEqualTo(PaymentCollection.CHANNEL);
        }
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
