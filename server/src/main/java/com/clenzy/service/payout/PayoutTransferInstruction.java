package com.clenzy.service.payout;

import com.clenzy.model.PayoutTransfer;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Currency;
import java.util.Locale;
import java.util.Objects;

/** Données résolues côté serveur, figées avant tout appel PSP. Jamais un corps de requête utilisateur. */
public record PayoutTransferInstruction(Long organizationId, PayoutTransfer.Source source, Long sourceId,
        Long beneficiaryUserId, Long beneficiaryOrganizationId, BigDecimal amount, String currency, String destination, String description) {
    public PayoutTransferInstruction(Long organizationId, PayoutTransfer.Source source, Long sourceId,
            Long beneficiaryUserId, BigDecimal amount, String currency, String destination, String description) {
        this(organizationId, source, sourceId, beneficiaryUserId, null, amount, currency, destination, description);
    }

    public PayoutTransferInstruction {
        new com.clenzy.model.PayoutBeneficiary(beneficiaryUserId, beneficiaryOrganizationId);
        if (organizationId == null || source == null || sourceId == null
                || organizationId <= 0 || sourceId <= 0
                || amount == null || amount.signum() <= 0 || currency == null
                || destination == null || !destination.matches("acct_[A-Za-z0-9]+")
                || destination.length() > 100 || description == null || description.isBlank() || description.length() > 255) {
            throw new IllegalArgumentException("Instruction de transfert incomplète ou invalide.");
        }
        currency = currency.trim().toUpperCase(Locale.ROOT);
        // Le convertisseur actuel et les trois marchés EUR/MAD/SAR utilisent deux décimales.
        if (Currency.getInstance(currency).getDefaultFractionDigits() != 2) {
            throw new IllegalArgumentException("Cette devise exige un convertisseur de montants dédié.");
        }
        amount = amount.setScale(2, RoundingMode.UNNECESSARY);
    }

    /** Clés historiques conservées : un déploiement ne change jamais la clé d'un transfert existant. */
    public String idempotencyKey() {
        return switch (source) {
            case OWNER_PAYOUT -> "payout-" + sourceId;
            case INTERVENTION -> "payout-intervention-" + sourceId;
            case PROVIDER_EXPENSE -> "baitly-expense-" + sourceId;
            case COMMERCE -> "baitly-commerce-payout-" + sourceId;
        };
    }

    public boolean matches(PayoutTransfer transfer) {
        return Objects.equals(organizationId, transfer.getOrganizationId())
                && source == transfer.getSource() && Objects.equals(sourceId, transfer.getSourceId())
                && Objects.equals(beneficiaryUserId, transfer.getBeneficiaryUserId())
                && Objects.equals(beneficiaryOrganizationId, transfer.getBeneficiaryOrganizationId())
                && amount.compareTo(transfer.getAmount()) == 0 && currency.equals(transfer.getCurrency())
                && destination.equals(transfer.getDestination()) && description.equals(transfer.getDescription())
                && "STRIPE".equals(transfer.getProvider()) && idempotencyKey().equals(transfer.getIdempotencyKey());
    }
}
