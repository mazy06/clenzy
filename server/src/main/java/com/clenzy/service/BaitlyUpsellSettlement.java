package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Objects;

/** Prix, bénéficiaire et commissions figés avant encaissement ; attribution atomique après preuve. */
@Service
public class BaitlyUpsellSettlement {
    private final UpsellOrderRepository orders;
    private final PaymentTransactionRepository transactions;
    private final ReservationRepository reservations;
    private final WelcomeGuideRepository guides;
    private final MonetizationConfigService pricing;
    private final ManagementContractService contracts;
    private final WalletService wallets;
    private final LedgerService ledger;
    private final Clock clock;

    public BaitlyUpsellSettlement(UpsellOrderRepository orders, PaymentTransactionRepository transactions,
            ReservationRepository reservations, WelcomeGuideRepository guides, MonetizationConfigService pricing,
            ManagementContractService contracts, WalletService wallets, LedgerService ledger, Clock clock) {
        this.orders = orders;
        this.transactions = transactions;
        this.reservations = reservations;
        this.guides = guides;
        this.pricing = pricing;
        this.contracts = contracts;
        this.wallets = wallets;
        this.ledger = ledger;
        this.clock = clock;
    }

    @Transactional
    public void snapshot(UpsellOrder order) {
        require(order.getOrganizationId() != null && order.getAmount() != null && order.getAmount().signum() > 0,
                "Prix de vente manquant");
        order.setAmount(order.getAmount().setScale(2, RoundingMode.UNNECESSARY));
        Property property;
        if (order.getReservationId() != null) {
            Reservation reservation = reservations.findById(order.getReservationId()).orElseThrow();
            require(Objects.equals(reservation.getOrganizationId(), order.getOrganizationId()), "Réservation hors organisation");
            property = reservation.getProperty();
        } else {
            WelcomeGuide guide = guides.findById(order.getGuideId()).orElseThrow();
            require(Objects.equals(guide.getOrganizationId(), order.getOrganizationId()), "Livret hors organisation");
            property = guide.getProperty();
        }
        require(property != null && Objects.equals(property.getOrganizationId(), order.getOrganizationId()),
                "Logement hors organisation");
        require(property.getOwner() != null && property.getOwner().getId() != null, "Bénéficiaire à renseigner avant la vente");
        order.setBeneficiaryOwnerId(property.getOwner().getId());
        BigDecimal platform = percent(order.getAmount(), pricing.getEffectiveUpsellPlatformFeePct(order.getOrganizationId()));
        BigDecimal conciergeRate = contracts.getActiveContract(property.getId(), order.getOrganizationId())
                .map(ManagementContract::getUpsellCommissionRate)
                .map(rate -> rate.multiply(BigDecimal.valueOf(100)))
                .orElseGet(() -> pricing.getEffectiveUpsellOrgCommissionPct(order.getOrganizationId()));
        BigDecimal concierge = percent(order.getAmount().subtract(platform), conciergeRate);
        order.setPlatformFeeAmount(platform);
        order.setConciergeAmount(concierge);
        order.setHostAmount(order.getAmount().subtract(platform).subtract(concierge));
    }

    @Transactional
    public void settle(String sessionId) {
        UpsellOrder order = orders.lockBySession(sessionId)
                .orElseThrow(() -> new IllegalStateException("Commande à rapprocher"));
        PaymentTransaction tx = transactions.findByProviderTxId(sessionId)
                .orElseThrow(() -> new IllegalStateException("Preuve d'encaissement absente"));
        require(tx.getStatus() == TransactionStatus.COMPLETED
                && tx.getPaymentType() == TransactionType.CHECKOUT
                && "UPSELL".equals(tx.getSourceType())
                && Objects.equals(tx.getSourceId(), order.getId())
                && Objects.equals(tx.getOrganizationId(), order.getOrganizationId())
                && tx.getAmount() != null && tx.getAmount().compareTo(order.getAmount()) == 0
                && order.getCurrency().equalsIgnoreCase(tx.getCurrency()), "Preuve d'encaissement incompatible");
        // Un rejeu après remboursement ne doit jamais recréditer la vente.
        if (order.getStatus() == UpsellOrderStatus.PAID || order.getStatus() == UpsellOrderStatus.REFUNDED) return;
        require(order.getStatus() == UpsellOrderStatus.PENDING, "Commande annulée : rapprochement requis");
        require(order.getBeneficiaryOwnerId() != null && order.getConciergeAmount() != null
                && order.getHostAmount() != null && order.getPlatformFeeAmount() != null,
                "Ancienne commande sans répartition figée : rapprochement requis");
        require(order.getConciergeAmount().signum() >= 0 && order.getHostAmount().signum() >= 0
                && order.getPlatformFeeAmount().signum() >= 0
                && order.getConciergeAmount().add(order.getHostAmount()).add(order.getPlatformFeeAmount())
                    .compareTo(order.getAmount()) == 0, "Répartition incompatible");
        Wallet platform = wallets.getOrCreatePlatformWallet(order.getOrganizationId(), order.getCurrency());
        transfer(order, platform, WalletType.CONCIERGE, null, order.getConciergeAmount());
        transfer(order, platform, WalletType.OWNER, order.getBeneficiaryOwnerId(), order.getHostAmount());
        order.setStatus(UpsellOrderStatus.PAID);
        order.setPaidAt(LocalDateTime.now(clock));
        orders.save(order);
    }

    private void transfer(UpsellOrder order, Wallet platform, WalletType type, Long beneficiary, BigDecimal amount) {
        if (amount.signum() == 0) return;
        Wallet target = wallets.getOrCreateWallet(order.getOrganizationId(), type, beneficiary, order.getCurrency());
        ledger.recordTransfer(platform, target, amount, LedgerReferenceType.UPSELL,
                "UPSELL-" + order.getId(), "Part " + type + " de la commande Baitly " + order.getId());
    }

    private static BigDecimal percent(BigDecimal amount, BigDecimal rate) {
        require(rate != null && rate.signum() >= 0 && rate.compareTo(BigDecimal.valueOf(100)) <= 0,
                "Taux de commission invalide");
        return amount.multiply(rate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    private static void require(boolean valid, String reason) {
        if (!valid) throw new IllegalStateException(reason);
    }
}
