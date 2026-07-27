package com.clenzy.service.agent.analytics;

import com.clenzy.model.Reservation;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Commission par canal.
 *
 * <p><b>Ces taux CHANGENT des chiffres affiches.</b> Vrbo 8 % et Expedia 15 %
 * existaient depuis toujours mais restaient inertes : aucune reservation ne
 * portait ces sources, tout ce trafic etant replie sur « other », dont le taux
 * est nul. Depuis que le vocabulaire des canaux est ouvert, ils s'appliquent —
 * de la commission estimee apparait sur du chiffre d'affaires compte net a 100 %
 * jusqu'ici, et le net proprietaire baisse sur ces sejours.</p>
 *
 * <p>Ce n'est pas une regression : la commission existait, elle n'etait
 * simplement pas comptee. Ces tests figent les taux pour qu'un changement futur
 * soit un choix, pas un effet de bord.</p>
 */
class ChannelCommissionResolverTest {

    private final ChannelCommissionResolver resolver = new ChannelCommissionResolver();

    private Reservation reservation(String source, BigDecimal otaFee) {
        Reservation r = new Reservation();
        r.setSource(source);
        r.setOtaFeeAmount(otaFee);
        return r;
    }

    @Test
    void whenChannelIsKnown_thenItsDefaultRateApplies() {
        assertThat(resolver.rateFor("airbnb")).isEqualTo(0.03);
        assertThat(resolver.rateFor("booking")).isEqualTo(0.15);
        assertThat(resolver.rateFor("vrbo")).isEqualTo(0.08);
        assertThat(resolver.rateFor("expedia")).isEqualTo(0.15);
    }

    /** Une vente en direct ne paie aucune commission — et « other » reste inconnu. */
    @Test
    void whenNoCommissionIsDue_thenTheRateIsZero() {
        assertThat(resolver.rateFor("direct")).isZero();
        assertThat(resolver.rateFor("other")).isZero();
    }

    /**
     * Le changement de chiffres, mis noir sur blanc : le meme sejour Vrbo passe
     * d'une commission nulle (source repliee sur « other ») a 8 %.
     */
    @Test
    void whenVrboIsNamed_thenItsCommissionStopsBeingInvisible() {
        BigDecimal gross = new BigDecimal("1000");

        BigDecimal beforeWiden = resolver.commissionOf(reservation("other", null), gross);
        BigDecimal afterWiden = resolver.commissionOf(reservation("vrbo", null), gross);

        assertThat(beforeWiden).isEqualByComparingTo("0");
        assertThat(afterWiden).isEqualByComparingTo("80.00");
    }

    /** Un montant reel prime toujours sur l'estimation, et n'est pas signale estime. */
    @Test
    void whenTheRealFeeIsKnown_thenItWinsOverTheDefaultRate() {
        Reservation r = reservation("expedia", new BigDecimal("42.50"));

        assertThat(resolver.commissionOf(r, new BigDecimal("1000"))).isEqualByComparingTo("42.50");
        assertThat(resolver.isEstimated(r)).isFalse();
    }

    /**
     * Sans montant reel, la commission est une ESTIMATION : l'interface doit
     * pouvoir le dire plutot que de presenter une supposition comme un fait.
     */
    @Test
    void whenOnlyTheDefaultRateIsAvailable_thenTheCommissionIsFlaggedAsEstimated() {
        assertThat(resolver.isEstimated(reservation("vrbo", null))).isTrue();
        assertThat(resolver.isEstimated(reservation("expedia", null))).isTrue();
        // Taux nul : rien a estimer, donc rien a signaler.
        assertThat(resolver.isEstimated(reservation("direct", null))).isFalse();
    }
}
