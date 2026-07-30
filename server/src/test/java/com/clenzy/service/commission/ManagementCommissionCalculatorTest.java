package com.clenzy.service.commission;

import com.clenzy.model.ManagementContract;
import com.clenzy.model.Reservation;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Commission de gestion : assiette, taux, arrondi.
 *
 * <p>Ces tests figent la clause {@code CommissionBase} pour les trois modules qui la
 * lisent — facture, virement propriétaire, portail. Ils la lisaient différemment
 * jusqu'ici, et l'écart était masqué par un {@code ota_fee_amount} toujours NULL en
 * base ; il est devenu visible dès que l'import Channex a commencé à le renseigner.</p>
 */
class ManagementCommissionCalculatorTest {

    private final ManagementCommissionCalculator calculator = new ManagementCommissionCalculator();

    private static ManagementContract contract(String rate, ManagementContract.CommissionBase base) {
        ManagementContract c = new ManagementContract();
        c.setCommissionRate(new BigDecimal(rate));
        c.setCommissionBase(base);
        return c;
    }

    private static Reservation reservation(String total, String otaFee) {
        Reservation r = new Reservation();
        r.setTotalPrice(new BigDecimal(total));
        if (otaFee != null) {
            r.setOtaFeeAmount(new BigDecimal(otaFee));
        }
        return r;
    }

    @Test
    @DisplayName("GROSS : le taux s'applique au brut, frais OTA connus ou pas")
    void grossIgnoresTheOtaFee() {
        ManagementContract c = contract("0.20", ManagementContract.CommissionBase.GROSS);

        assertThat(calculator.of(reservation("289.50", "44.87"), c).amount())
            .isEqualByComparingTo("57.90");
        assertThat(calculator.of(reservation("289.50", null), c).amount())
            .isEqualByComparingTo("57.90");
    }

    @Test
    @DisplayName("NET_OF_OTA_FEE : les frais OTA sortent de l'assiette")
    void netOfOtaFeeShrinksTheBase() {
        ManagementContract c = contract("0.20", ManagementContract.CommissionBase.NET_OF_OTA_FEE);

        ManagementCommissionCalculator.Commission commission =
            calculator.of(reservation("289.50", "44.87"), c);

        assertThat(commission.base()).isEqualByComparingTo("244.63");
        assertThat(commission.amount()).isEqualByComparingTo("48.93");
    }

    /**
     * Channex ne fournit {@code ota_commission} que pour Booking.com et Airbnb, et
     * jamais pour le stock importé avant sa prise en charge. Un contrat au net des
     * frais OTA est alors facturé sur le brut : c'est le repli le moins mauvais, mais
     * il fait payer au propriétaire une assiette plus large que son contrat.
     */
    @Test
    @DisplayName("NET_OF_OTA_FEE sans frais OTA connus : repli sur le brut")
    void netOfOtaFeeFallsBackToGrossWhenTheFeeIsUnknown() {
        ManagementContract c = contract("0.20", ManagementContract.CommissionBase.NET_OF_OTA_FEE);

        assertThat(calculator.of(reservation("289.50", null), c).amount())
            .isEqualByComparingTo("57.90");
    }

    /** Des frais OTA aberrants ne doivent pas produire une commission négative. */
    @Test
    @DisplayName("frais OTA supérieurs au séjour : assiette plancher à zéro")
    void anOverlargeOtaFeeCannotTurnTheBaseNegative() {
        ManagementContract c = contract("0.20", ManagementContract.CommissionBase.NET_OF_OTA_FEE);

        ManagementCommissionCalculator.Commission commission =
            calculator.of(reservation("100.00", "150.00"), c);

        assertThat(commission.base()).isEqualByComparingTo("0");
        assertThat(commission.amount()).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("pas de contrat : pas de commission")
    void noContractMeansNoCommission() {
        ManagementCommissionCalculator.Commission commission =
            calculator.of(reservation("289.50", "44.87"), null);

        assertThat(commission.rate()).isEqualByComparingTo("0");
        assertThat(commission.amount()).isEqualByComparingTo("0.00");
    }

    /**
     * La propriété qui justifie ce calculateur : le virement propriétaire retient
     * exactement la somme des factures émises. Il faut donc arrondir séjour par séjour
     * — {@code taux × chiffre d'affaires total} dériverait du centime, en plus de ne
     * pas savoir déduire des frais OTA propres à chaque séjour.
     */
    @Test
    @DisplayName("un lot retient exactement la somme des séjours facturés")
    void aBatchRetainsExactlyTheSumOfTheInvoicedStays() {
        ManagementContract c = contract("0.185", ManagementContract.CommissionBase.NET_OF_OTA_FEE);
        List<Reservation> stays = List.of(
            reservation("289.50", "44.87"),
            reservation("133.33", null),
            reservation("410.10", "63.57"));

        BigDecimal sumOfInvoices = stays.stream()
            .map(r -> calculator.of(r, c).amount())
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        assertThat(calculator.ofAll(stays, c).amount()).isEqualByComparingTo(sumOfInvoices);
    }

    @Test
    @DisplayName("lot vide : commission nulle, pas d'exception")
    void anEmptyBatchIsZero() {
        assertThat(calculator.ofAll(List.of(),
            contract("0.20", ManagementContract.CommissionBase.GROSS)).amount())
            .isEqualByComparingTo("0.00");
    }

    /**
     * Sur un séjour OTA, la conciergerie n'encaisse jamais le brut : la plateforme retient
     * à la source. Reverser le brut moins la commission lui fait donc absorber ces frais
     * en silence. {@code OtaFeeBearer} rend le choix explicite, et {@code AGENCY} — le
     * défaut — préserve le comportement historique.
     */
    @Test
    @DisplayName("frais OTA a la charge de l'agence : rien n'est deduit du proprietaire")
    void agencyBearsTheOtaFeeByDefault() {
        ManagementContract c = contract("0.20", ManagementContract.CommissionBase.NET_OF_OTA_FEE);

        assertThat(c.getOtaFeeBorneBy()).isEqualTo(ManagementContract.OtaFeeBearer.AGENCY);
        assertThat(calculator.of(reservation("289.50", "44.87"), c).otaFeeBorneByOwner())
            .isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("frais OTA a la charge du proprietaire : imputes a son reversement")
    void ownerBearsTheOtaFeeWhenTheContractSaysSo() {
        ManagementContract c = contract("0.20", ManagementContract.CommissionBase.NET_OF_OTA_FEE);
        c.setOtaFeeBorneBy(ManagementContract.OtaFeeBearer.OWNER);

        ManagementCommissionCalculator.Commission commission =
            calculator.of(reservation("289.50", "44.87"), c);

        assertThat(commission.otaFeeBorneByOwner()).isEqualByComparingTo("44.87");
        // 289,50 - 44,87 - 48,93 = 195,70 : la conciergerie encaisse 244,63 de l'OTA et
        // garde exactement sa commission, ni plus ni moins.
        assertThat(commission.amount()).isEqualByComparingTo("48.93");
    }

    /** On n'impute au propriétaire aucun frais qui ne soit écrit dans un contrat. */
    @Test
    @DisplayName("pas de contrat : aucun frais OTA impute")
    void noContractImputesNoOtaFee() {
        assertThat(calculator.of(reservation("289.50", "44.87"), null).otaFeeBorneByOwner())
            .isEqualByComparingTo("0");
    }

    /**
     * L'égalité « virement retenu = somme des factures » ne tient que si le contrat se
     * résout par LOGEMENT. Les factures sont émises avec le contrat de chaque bien : un
     * propriétaire multi-logements verrait sinon ses séjours facturés sous un contrat et
     * retenus sous un autre.
     */
    @Test
    @DisplayName("un lot multi-contrats calcule chaque sejour sous le sien")
    void aBatchResolvesTheContractPerStay() {
        ManagementContract surNet = contract("0.20", ManagementContract.CommissionBase.NET_OF_OTA_FEE);
        ManagementContract surBrut = contract("0.20", ManagementContract.CommissionBase.GROSS);

        Reservation a = reservation("289.50", "44.87");
        Reservation b = reservation("289.50", "44.87");

        ManagementCommissionCalculator.Commission commission =
            calculator.ofAll(List.of(a, b), r -> r == a ? surNet : surBrut);

        // 48,93 + 57,90 : le contrat du premier sejour ne contamine pas le second.
        assertThat(commission.amount()).isEqualByComparingTo("106.83");
    }

    @Test
    @DisplayName("un lot totalise les frais OTA imputes au proprietaire")
    void aBatchTotalsTheOwnerBorneOtaFees() {
        ManagementContract c = contract("0.20", ManagementContract.CommissionBase.NET_OF_OTA_FEE);
        c.setOtaFeeBorneBy(ManagementContract.OtaFeeBearer.OWNER);

        ManagementCommissionCalculator.Commission commission = calculator.ofAll(
            List.of(reservation("289.50", "44.87"), reservation("133.33", null)), c);

        // Le second sejour n'a pas de frais OTA connus : rien a imputer.
        assertThat(commission.otaFeeBorneByOwner()).isEqualByComparingTo("44.87");
    }
}
