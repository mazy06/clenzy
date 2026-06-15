package com.clenzy.booking.service;

import com.clenzy.booking.model.GuestCreditAccount;
import com.clenzy.booking.model.GuestCreditTransaction;
import com.clenzy.booking.model.GuestCreditTxType;
import com.clenzy.booking.repository.GuestCreditAccountRepository;
import com.clenzy.booking.repository.GuestCreditTransactionRepository;
import com.clenzy.model.Organization;
import com.clenzy.model.Reservation;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Locale;

/**
 * Crédit fidélité « Book Direct & Save » (2.8 phase 2b). Le voyageur gagne un % de chaque séjour
 * DIRECT terminé, crédité par (organisation, email), réutilisable. Soldes en centimes pour une
 * déduction atomique (rédemption — phase suivante). Le gain est idempotent par réservation.
 */
@Service
public class GuestCreditService {

    private static final Logger log = LoggerFactory.getLogger(GuestCreditService.class);

    private final GuestCreditAccountRepository accountRepository;
    private final GuestCreditTransactionRepository txRepository;
    private final OrganizationRepository organizationRepository;
    private final ReservationRepository reservationRepository;
    private final ObjectProvider<GuestCreditService> self;

    public GuestCreditService(GuestCreditAccountRepository accountRepository,
                              GuestCreditTransactionRepository txRepository,
                              OrganizationRepository organizationRepository,
                              ReservationRepository reservationRepository,
                              ObjectProvider<GuestCreditService> self) {
        this.accountRepository = accountRepository;
        this.txRepository = txRepository;
        this.organizationRepository = organizationRepository;
        this.reservationRepository = reservationRepository;
        this.self = self;
    }

    /** Une réservation a-t-elle effectivement consommé du crédit (REDEEM) ? — garde le clawback. */
    @Transactional(readOnly = true)
    public boolean wasRedeemed(Long orgId, String reservationCode) {
        return reservationCode != null
            && txRepository.existsByOrganizationIdAndReservationCodeAndType(orgId, reservationCode, GuestCreditTxType.REDEEM);
    }

    /** Solde de crédit (centimes) d'un voyageur pour une org. 0 si aucun compte. */
    @Transactional(readOnly = true)
    public long getBalanceCents(Long orgId, String email) {
        if (email == null || email.isBlank()) {
            return 0;
        }
        return accountRepository.findByOrganizationIdAndEmail(orgId, normalize(email))
            .map(GuestCreditAccount::getBalanceCents).orElse(0L);
    }

    /**
     * Crédite un gain (idempotent par réservation via l'index unique EARN + pré-vérification).
     * Transaction dédiée (appelée via le proxy) : un échec n'impacte qu'une réservation.
     */
    @Transactional
    public void earn(Long orgId, String email, long amountCents, String currency, String reservationCode) {
        if (amountCents <= 0 || email == null || email.isBlank()) {
            return;
        }
        if (reservationCode != null
            && txRepository.existsByOrganizationIdAndReservationCodeAndType(orgId, reservationCode, GuestCreditTxType.EARN)) {
            return; // déjà crédité
        }
        String mail = normalize(email);
        GuestCreditAccount acc = accountRepository.findByOrganizationIdAndEmail(orgId, mail)
            .orElseGet(() -> {
                GuestCreditAccount a = new GuestCreditAccount();
                a.setOrganizationId(orgId);
                a.setEmail(mail);
                a.setBalanceCents(0);
                a.setCurrency(currency != null ? currency : "EUR");
                return accountRepository.save(a);
            });
        acc.setBalanceCents(acc.getBalanceCents() + amountCents);
        accountRepository.save(acc);

        GuestCreditTransaction tx = new GuestCreditTransaction();
        tx.setAccountId(acc.getId());
        tx.setOrganizationId(orgId);
        tx.setAmountCents(amountCents);
        tx.setType(GuestCreditTxType.EARN);
        tx.setReservationCode(reservationCode);
        // Contrainte unique (org, code, EARN) → en cas de course, rollback complet (solde non incrémenté).
        txRepository.save(tx);
    }

    /**
     * Crédit accordé (2.11 parrainage / geste commercial) : ajoute {@code amountCents} au solde,
     * idempotent par {@code idempotencyKey} (index unique (org, code, GRANT)). Transaction dédiée.
     */
    @Transactional
    public void grant(Long orgId, String email, long amountCents, String idempotencyKey) {
        if (amountCents <= 0 || email == null || email.isBlank()) {
            return;
        }
        if (idempotencyKey != null
            && txRepository.existsByOrganizationIdAndReservationCodeAndType(orgId, idempotencyKey, GuestCreditTxType.GRANT)) {
            return; // déjà accordé
        }
        String mail = normalize(email);
        GuestCreditAccount acc = accountRepository.findByOrganizationIdAndEmail(orgId, mail)
            .orElseGet(() -> {
                GuestCreditAccount a = new GuestCreditAccount();
                a.setOrganizationId(orgId);
                a.setEmail(mail);
                a.setBalanceCents(0);
                return accountRepository.save(a);
            });
        acc.setBalanceCents(acc.getBalanceCents() + amountCents);
        accountRepository.save(acc);

        GuestCreditTransaction tx = new GuestCreditTransaction();
        tx.setAccountId(acc.getId());
        tx.setOrganizationId(orgId);
        tx.setAmountCents(amountCents);
        tx.setType(GuestCreditTxType.GRANT);
        tx.setReservationCode(idempotencyKey);
        txRepository.save(tx); // course → contrainte unique (org, code, GRANT) → rollback (solde non incrémenté)
    }

    /**
     * Rédemption (2.8 phase 2b-2) : déduit {@code amountCents} du solde de façon ATOMIQUE (UPDATE
     * conditionnel — pas de check-then-act ; audit #8). Renvoie true si appliqué (solde suffisant),
     * false sinon (le checkout facture alors le plein). Idempotent par réservation (index unique REDEEM).
     */
    @Transactional
    public boolean redeem(Long orgId, String email, long amountCents, String reservationCode) {
        if (amountCents <= 0 || email == null || email.isBlank()) {
            return false;
        }
        String mail = normalize(email);
        if (accountRepository.deductIfSufficient(orgId, mail, amountCents) == 0) {
            return false; // solde insuffisant / compte absent
        }
        GuestCreditAccount acc = accountRepository.findByOrganizationIdAndEmail(orgId, mail).orElseThrow();
        GuestCreditTransaction tx = new GuestCreditTransaction();
        tx.setAccountId(acc.getId());
        tx.setOrganizationId(orgId);
        tx.setAmountCents(-amountCents); // négatif = déduction
        tx.setType(GuestCreditTxType.REDEEM);
        tx.setReservationCode(reservationCode);
        txRepository.save(tx); // course/double-rédemption → contrainte unique → rollback (déduction annulée)
        return true;
    }

    /**
     * Clawback (2.8) : re-crédite le crédit consommé par une réservation annulée. Idempotent
     * (un seul CLAWBACK par réservation) — ne re-crédite pas deux fois si l'annulation est rejouée.
     */
    @Transactional
    public void clawback(Long orgId, String email, long amountCents, String reservationCode) {
        if (amountCents <= 0 || email == null || email.isBlank()) {
            return;
        }
        if (reservationCode != null
            && txRepository.existsByOrganizationIdAndReservationCodeAndType(orgId, reservationCode, GuestCreditTxType.CLAWBACK)) {
            return; // déjà re-crédité
        }
        String mail = normalize(email);
        GuestCreditAccount acc = accountRepository.findByOrganizationIdAndEmail(orgId, mail)
            .orElseGet(() -> {
                GuestCreditAccount a = new GuestCreditAccount();
                a.setOrganizationId(orgId);
                a.setEmail(mail);
                a.setBalanceCents(0);
                return accountRepository.save(a);
            });
        acc.setBalanceCents(acc.getBalanceCents() + amountCents);
        accountRepository.save(acc);
        GuestCreditTransaction tx = new GuestCreditTransaction();
        tx.setAccountId(acc.getId());
        tx.setOrganizationId(orgId);
        tx.setAmountCents(amountCents);
        tx.setType(GuestCreditTxType.CLAWBACK);
        tx.setReservationCode(reservationCode);
        txRepository.save(tx);
    }

    /**
     * Scan (scheduler) : crédite les séjours directs terminés avant {@code cutoff} non encore crédités,
     * à hauteur de loyalty_credit_percent % du total payé. Idempotent. Renvoie le nombre de gains tentés.
     */
    public int creditCompletedStays(LocalDate cutoff) {
        int credited = 0;
        for (Organization org : organizationRepository.findByLoyaltyCreditPercentGreaterThan(0)) {
            Integer pct = org.getLoyaltyCreditPercent();
            if (pct == null || pct <= 0) {
                continue;
            }
            for (Reservation r : reservationRepository.findLoyaltyEligible(org.getId(), cutoff)) {
                String email = r.getGuest() != null ? r.getGuest().getEmail() : null;
                if (email == null || email.isBlank() || r.getTotalPrice() == null) {
                    continue;
                }
                BigDecimal credit = r.getTotalPrice()
                    .multiply(BigDecimal.valueOf(Math.min(pct, 100)))
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                long cents = StripeAmounts.toMinorUnits(credit);
                if (cents <= 0) {
                    continue;
                }
                try {
                    self.getObject().earn(org.getId(), email, cents, r.getCurrency(), r.getConfirmationCode());
                    credited++;
                } catch (RuntimeException e) {
                    log.warn("Crédit fidélité : échec résa {} (org {}) : {}",
                        r.getConfirmationCode(), org.getId(), e.getMessage());
                }
            }
        }
        return credited;
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
