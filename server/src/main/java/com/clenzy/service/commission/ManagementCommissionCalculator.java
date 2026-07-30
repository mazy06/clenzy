package com.clenzy.service.commission;

import com.clenzy.model.ManagementContract;
import com.clenzy.model.Reservation;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;

/**
 * Source unique de vérité pour la commission de GESTION — celle que la conciergerie
 * facture au propriétaire au titre du {@link ManagementContract}.
 *
 * <p>À ne pas confondre avec la commission de CANAL (ce que l'OTA prélève), qui est
 * du ressort de {@code ChannelCommissionResolver}. Les deux se croisent ici : sur un
 * contrat {@link ManagementContract.CommissionBase#NET_OF_OTA_FEE}, les frais OTA
 * réellement prélevés sortent de la base avant application du taux de gestion.</p>
 *
 * <p>Ce calculateur existe parce que trois modules calculaient la même clause de
 * contrat différemment : {@code InvoiceGeneratorService} honorait
 * {@code NET_OF_OTA_FEE}, {@code AccountingService} facturait toujours sur le brut,
 * et {@code OwnerPortalService} appliquait 20 % en dur sans regarder le contrat. Tant
 * que {@code Reservation.otaFeeAmount} restait NULL en base, les deux premiers
 * tombaient d'accord par accident ; l'import des frais OTA réels depuis Channex a
 * rendu l'écart visible — la facture émise et la commission retenue sur le virement
 * ne portaient plus sur la même base.</p>
 */
@Component
public class ManagementCommissionCalculator {

    /**
     * Commission d'un séjour ou d'un lot de séjours.
     *
     * @param base   assiette effectivement retenue (brut, ou net des frais OTA)
     * @param rate   taux du contrat appliqué (0 si aucun contrat)
     * @param amount montant HT, arrondi au centime
     */
    public record Commission(BigDecimal base, BigDecimal rate, BigDecimal amount) {}

    /** Taux du contrat, 0 si le contrat est absent ou n'en porte pas. */
    public BigDecimal rateOf(ManagementContract contract) {
        if (contract == null || contract.getCommissionRate() == null) {
            return BigDecimal.ZERO;
        }
        return contract.getCommissionRate();
    }

    /**
     * Assiette de commission d'un séjour selon la clause du contrat.
     *
     * <p>Sur {@code NET_OF_OTA_FEE}, les frais OTA ne sont déduits que s'ils sont
     * CONNUS : Channex ne les fournit que pour Booking.com et Airbnb, et pas du tout
     * sur le stock importé avant leur prise en charge. Sans eux, on retombe sur le
     * brut — le propriétaire est alors facturé sur une assiette plus large que ce que
     * son contrat prévoit, ce qui est le repli le moins mauvais mais reste un écart.</p>
     */
    public BigDecimal baseOf(Reservation reservation, ManagementContract contract) {
        BigDecimal gross = reservation.getTotalPrice() != null
            ? reservation.getTotalPrice() : BigDecimal.ZERO;
        if (contract != null
                && contract.getCommissionBase() == ManagementContract.CommissionBase.NET_OF_OTA_FEE
                && reservation.getOtaFeeAmount() != null) {
            return gross.subtract(reservation.getOtaFeeAmount()).max(BigDecimal.ZERO);
        }
        return gross;
    }

    /** Commission d'un séjour, arrondie au centime. */
    public Commission of(Reservation reservation, ManagementContract contract) {
        BigDecimal base = baseOf(reservation, contract);
        BigDecimal rate = rateOf(contract);
        return new Commission(base, rate, base.multiply(rate).setScale(2, RoundingMode.HALF_UP));
    }

    /**
     * Commission d'un lot de séjours, séjour par séjour.
     *
     * <p>Deux raisons de ne jamais faire {@code taux × chiffre d'affaires total} :
     * l'assiette dépend des frais OTA de CHAQUE séjour, et l'arrondi doit se faire au
     * même endroit que sur la facture. En sommant les montants déjà arrondis, le
     * virement au propriétaire retient exactement la somme des factures émises — la
     * propriété qu'on cherche à garantir.</p>
     */
    public Commission ofAll(Collection<Reservation> reservations, ManagementContract contract) {
        BigDecimal rate = rateOf(contract);
        BigDecimal totalBase = BigDecimal.ZERO;
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (Reservation r : reservations) {
            Commission c = of(r, contract);
            totalBase = totalBase.add(c.base());
            totalAmount = totalAmount.add(c.amount());
        }
        return new Commission(totalBase, rate, totalAmount.setScale(2, RoundingMode.HALF_UP));
    }
}
