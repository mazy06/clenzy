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
import org.springframework.transaction.annotation.Propagation;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Objects;

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
            .map(a -> Math.max(0L,a.getBalanceCents())).orElse(0L);
    }

    /** Une intention de remise ne peut jamais convertir une devise en une autre. */
    @Transactional(readOnly = true)
    public long getBalanceCents(Long orgId, String email, String currency) {
        if (email == null || email.isBlank() || currency == null) return 0;
        return accountRepository.findByOrganizationIdAndEmail(orgId, normalize(email))
            .filter(a -> currency.equalsIgnoreCase(a.getCurrency()))
            .map(a -> Math.max(0L,a.getBalanceCents())).orElse(0L);
    }

    /** Identité figée au checkout, recontrôlée lors de la consommation effective. */
    @Transactional(readOnly = true)
    public Long accountId(Long orgId, String email, String currency) {
        if (email == null || email.isBlank() || currency == null)
            throw new IllegalStateException("Titulaire et devise du crédit obligatoires");
        return accountRepository.findByOrganizationIdAndEmail(orgId, normalize(email))
            .filter(a -> currency.equalsIgnoreCase(a.getCurrency())).map(GuestCreditAccount::getId)
            .orElseThrow(() -> new IllegalStateException("Compte de crédit incompatible avec le paiement"));
    }

    @Transactional
    public void earn(Long orgId, String email, long amount, String currency, String code) {
        credit(orgId, email, amount, currency == null ? "EUR" : currency, code, GuestCreditTxType.EARN);
    }

    /** Le parrainage historique exprime les montants en EUR, sans conversion implicite. */
    @Transactional
    public void grant(Long orgId, String email, long amount, String code) {
        credit(orgId, email, amount, "EUR", code, GuestCreditTxType.GRANT);
    }

    private void credit(Long orgId, String email, long amount, String currency, String code, GuestCreditTxType type) {
        if (amount <= 0 || email == null || email.isBlank()) return;
        requireCode(code);
        String mail = normalize(email);
        String curr = java.util.Currency.getInstance(currency.toUpperCase(Locale.ROOT)).getCurrencyCode();
        accountRepository.ensureAccount(orgId, mail, curr);
        var account = accountRepository.lockBalance(orgId, mail).orElseThrow();
        requireCurrency(account, curr);
        if (existing(orgId, code, type, account.getId(), amount)) return;
        Math.addExact(account.getBalanceCents(), amount);
        accountRepository.addBalance(account.getId(), amount);
        record(orgId, account.getId(), amount, code, type);
    }

    @Transactional
    public boolean redeem(Long orgId, String email, long amount, String code) {
        return redeem(orgId, email, amount, "EUR", code, null);
    }

    /** Verrou commun aux gains, restitutions et consommations ; aucun solde stale ne peut gagner. */
    @Transactional
    public boolean redeem(Long orgId, String email, long amount, String currency, String code, Long expectedAccount) {
        if (amount <= 0 || email == null || email.isBlank()) return false;
        requireCode(code);
        String mail = normalize(email);
        var account = accountRepository.lockBalance(orgId, mail).orElse(null);
        if (account == null) return false;
        requireCurrency(account, currency);
        if (expectedAccount != null && !expectedAccount.equals(account.getId()))
            throw new IllegalStateException("Le bénéficiaire du crédit a changé : rapprochement requis");
        if (txRepository.existsByOrganizationIdAndReservationCodeAndType(orgId, code, GuestCreditTxType.CLAWBACK))
            throw new IllegalStateException("Crédit déjà restitué : rapprochement requis");
        if (existing(orgId, code, GuestCreditTxType.REDEEM, account.getId(), -amount)) return true;
        if (accountRepository.deductIfSufficient(orgId, mail, amount) != 1) return false;
        record(orgId, account.getId(), -amount, code, GuestCreditTxType.REDEEM);
        return true;
    }

    @Transactional(readOnly = true)
    public boolean hasExactRedemption(Long orgId, String email, long amount, String currency, String code) {
        if (email == null || code == null || amount <= 0) return false;
        var account = accountRepository.findByOrganizationIdAndEmail(orgId, normalize(email)).orElse(null);
        if (account == null || currency == null || !currency.equalsIgnoreCase(account.getCurrency())
                || txRepository.existsByOrganizationIdAndReservationCodeAndType(orgId, code, GuestCreditTxType.CLAWBACK)) return false;
        return txRepository.findByOrganizationIdAndReservationCodeAndType(orgId, code, GuestCreditTxType.REDEEM)
            .filter(t -> account.getId().equals(t.getAccountId()) && t.getAmountCents() == -amount).isPresent();
    }

    /** Une restitution après paiement ne supprime pas la preuve historique de remise. */
    @Transactional(readOnly = true)
    public boolean hasReconciledRedemption(Long orgId, String email, long amount, String currency, String code) {
        if (email == null || code == null || amount <= 0) return false;
        var account = accountRepository.findByOrganizationIdAndEmail(orgId, normalize(email)).orElse(null);
        if (account == null || currency == null || !currency.equalsIgnoreCase(account.getCurrency())) return false;
        var spend = txRepository.findByOrganizationIdAndReservationCodeAndType(orgId, code, GuestCreditTxType.REDEEM).orElse(null);
        if (spend == null || !account.getId().equals(spend.getAccountId()) || spend.getAmountCents() != -amount) return false;
        long returned = 0;
        for (var entry : txRepository.findByOrganizationIdAndSourceCreditId(orgId, spend.getId())) {
            if (entry.getType() != GuestCreditTxType.REDEEM_RETURN || !account.getId().equals(entry.getAccountId()) || entry.getAmountCents() < 0) return false;
            returned = Math.addExact(returned, entry.getAmountCents());
        }
        var cancellation = txRepository.findByOrganizationIdAndReservationCodeAndType(orgId, code, GuestCreditTxType.CLAWBACK).orElse(null);
        if (cancellation != null) {
            if (!account.getId().equals(cancellation.getAccountId()) || cancellation.getAmountCents() < 0) return false;
            returned = Math.addExact(returned, cancellation.getAmountCents());
            if (returned != amount) return false;
        }
        return returned <= amount;
    }

    /** Restitue exactement la consommation enregistrée, jamais une simple intention de remise. */
    @Transactional
    public void clawback(Long orgId, String email, long amount, String code) {
        if (amount <= 0 || email == null || email.isBlank()) return;
        requireCode(code);
        var account = accountRepository.lockBalance(orgId, normalize(email))
            .orElseThrow(() -> new IllegalStateException("Compte du crédit consommé introuvable"));
        if (!existing(orgId, code, GuestCreditTxType.REDEEM, account.getId(), -amount))
            throw new IllegalStateException("Aucun crédit consommé à restituer");
        var spend=txRepository.findByOrganizationIdAndReservationCodeAndType(orgId,code,GuestCreditTxType.REDEEM).orElseThrow();
        long returned=txRepository.findByOrganizationIdAndSourceCreditId(orgId,spend.getId()).stream()
                .filter(t->t.getType()==GuestCreditTxType.REDEEM_RETURN).mapToLong(GuestCreditTransaction::getAmountCents).sum();
        if(returned<0 || returned>amount) throw new IllegalStateException("Restitution de crédit incohérente");
        amount-=returned;
        if (existing(orgId, code, GuestCreditTxType.CLAWBACK, account.getId(), amount)) return;
        Math.addExact(account.getBalanceCents(), amount);
        accountRepository.addBalance(account.getId(), amount);
        record(orgId, account.getId(), amount, code, GuestCreditTxType.CLAWBACK);
    }

    private boolean existing(Long orgId, String code, GuestCreditTxType type, Long accountId, long amount) {
        var previous = txRepository.findByOrganizationIdAndReservationCodeAndType(orgId, code, type).orElse(null);
        if (previous == null) return false;
        if (!accountId.equals(previous.getAccountId()) || previous.getAmountCents() != amount)
            throw new IllegalStateException("Écriture de crédit différente : rapprochement requis");
        return true;
    }

    private void record(Long orgId, Long accountId, long amount, String code, GuestCreditTxType type) {
        var entry = new GuestCreditTransaction();
        entry.setOrganizationId(orgId); entry.setAccountId(accountId); entry.setAmountCents(amount);
        entry.setReservationCode(code); entry.setType(type);
        txRepository.saveAndFlush(entry);
    }

    /** Récompenses offertes : reprise proportionnelle de la valeur historique, jamais un débit bancaire.
     * Si les points ont déjà été dépensés, le solde comptable négatif absorbe les gains suivants ;
     * le solde utilisable reste zéro. Les transactions d'origine sont conservées.
     */
    @Transactional(propagation=Propagation.MANDATORY)
    public void reverseRewards(Long org,String code,BigDecimal cash,BigDecimal before,BigDecimal after,String refundRef) {
        if(code==null || refundRef==null || refundRef.length()>64) throw new IllegalArgumentException("Référence de remboursement absente");
        var rewards=new java.util.ArrayList<GuestCreditTransaction>();
        txRepository.findByOrganizationIdAndReservationCodeAndType(org,code,GuestCreditTxType.EARN).ifPresent(rewards::add);
        txRepository.findByOrganizationIdAndReservationCodeAndType(org,"REF:"+code+":referrer",GuestCreditTxType.GRANT).ifPresent(rewards::add);
        txRepository.findByOrganizationIdAndReservationCodeAndType(org,"REF:"+code+":referee",GuestCreditTxType.GRANT).ifPresent(rewards::add);
        for(var reward:rewards.stream().sorted(java.util.Comparator.comparing(GuestCreditTransaction::getAccountId)).toList()) {
            var account=accountRepository.findById(reward.getAccountId()).orElseThrow();
            if(!org.equals(account.getOrganizationId()) || reward.getAmountCents()<=0) throw new IllegalStateException("Récompense incohérente");
            var locked=accountRepository.lockBalance(org,account.getEmail()).orElseThrow(); requireCurrency(locked,"EUR");
            BigDecimal basis=BigDecimal.valueOf(reward.getAmountCents(),2);
            long expectedBefore=StripeAmounts.toMinorUnits(com.clenzy.service.BaitlyRefundSeries.delta(basis,BigDecimal.ZERO,before,cash));
            long amount=StripeAmounts.toMinorUnits(com.clenzy.service.BaitlyRefundSeries.delta(basis,before,after,cash));
            // La référence inclut l'origine : les deux côtés d'un parrainage ont des écritures distinctes.
            String ref="R:"+reward.getId()+":"+refundRef;
            var previous=txRepository.findByOrganizationIdAndReservationCodeAndType(org,ref,GuestCreditTxType.EARN_REVERSAL).orElse(null);
            if(previous!=null) {
                if(!reward.getId().equals(previous.getSourceCreditId()) || previous.getAmountCents()!=-amount
                        || !reward.getAccountId().equals(previous.getAccountId())) throw new IllegalStateException("Reprise de récompense différente");
                continue;
            }
            long reversed=0;
            for(var row:txRepository.findByOrganizationIdAndSourceCreditId(org,reward.getId())) {
                if(row.getType()!=GuestCreditTxType.EARN_REVERSAL || row.getAmountCents()>0 || !reward.getAccountId().equals(row.getAccountId()))
                    throw new IllegalStateException("Historique des récompenses à rapprocher");
                reversed=Math.subtractExact(reversed,row.getAmountCents());
            }
            if(reversed!=expectedBefore) throw new IllegalStateException("Reprise antérieure des récompenses à rapprocher");
            Math.subtractExact(locked.getBalanceCents(),amount);
            accountRepository.addBalance(locked.getId(),-amount);
            var entry=new GuestCreditTransaction();entry.setOrganizationId(org);entry.setAccountId(locked.getId());
            entry.setAmountCents(-amount);entry.setReservationCode(ref);entry.setType(GuestCreditTxType.EARN_REVERSAL);entry.setSourceCreditId(reward.getId());
            txRepository.saveAndFlush(entry);
        }
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void restoreConsumed(Long org,String code,long applied,BigDecimal cash,BigDecimal before,BigDecimal after,String refundRef,Long expectedAccount) {
        if(applied==0) return;
        var spend=txRepository.findByOrganizationIdAndReservationCodeAndType(org,code,GuestCreditTxType.REDEEM).orElseThrow();
        if(!Objects.equals(expectedAccount,spend.getAccountId()) || spend.getAmountCents()!=-applied || txRepository.existsByOrganizationIdAndReservationCodeAndType(org,code,GuestCreditTxType.CLAWBACK))
            throw new IllegalStateException("Crédit consommé déjà restitué ou différent");
        var account=accountRepository.findById(spend.getAccountId()).orElseThrow();
        if(!org.equals(account.getOrganizationId())) throw new IllegalStateException("Compte hors organisation");
        var locked=accountRepository.lockBalance(org,account.getEmail()).orElseThrow();requireCurrency(locked,"EUR");
        long prior=StripeAmounts.toMinorUnits(com.clenzy.service.BaitlyRefundSeries.delta(BigDecimal.valueOf(applied,2),BigDecimal.ZERO,before,cash));
        long amount=StripeAmounts.toMinorUnits(com.clenzy.service.BaitlyRefundSeries.delta(BigDecimal.valueOf(applied,2),before,after,cash));
        String ref="R:"+spend.getId()+":"+refundRef;
        var existing=txRepository.findByOrganizationIdAndReservationCodeAndType(org,ref,GuestCreditTxType.REDEEM_RETURN).orElse(null);
        if(existing!=null) {
            if(!spend.getId().equals(existing.getSourceCreditId()) || existing.getAmountCents()!=amount || !locked.getId().equals(existing.getAccountId()))
                throw new IllegalStateException("Restitution différente");
            return;
        }
        long returned=0;
        for(var row:txRepository.findByOrganizationIdAndSourceCreditId(org,spend.getId())) {
            if(row.getType()!=GuestCreditTxType.REDEEM_RETURN || row.getAmountCents()<0 || !locked.getId().equals(row.getAccountId()))
                throw new IllegalStateException("Restitutions de crédit incohérentes");
            returned=Math.addExact(returned,row.getAmountCents());
        }
        if(returned!=prior) throw new IllegalStateException("Restitution antérieure à rapprocher");
        Math.addExact(locked.getBalanceCents(),amount);accountRepository.addBalance(locked.getId(),amount);
        var entry=new GuestCreditTransaction();entry.setOrganizationId(org);entry.setAccountId(locked.getId());entry.setSourceCreditId(spend.getId());
        entry.setReservationCode(ref);entry.setAmountCents(amount);entry.setType(GuestCreditTxType.REDEEM_RETURN);txRepository.saveAndFlush(entry);
    }

    private static void requireCode(String code) {
        if (code == null || code.isBlank()) throw new IllegalArgumentException("Référence du crédit obligatoire");
    }

    private static void requireCurrency(GuestCreditAccountRepository.LockedBalance account, String currency) {
        if (currency == null || !currency.equalsIgnoreCase(account.getCurrency()))
            throw new IllegalStateException("Devise du crédit différente du paiement");
    }

    /** Recontrôle sous verrou : une annulation entre le scan et le gain ne crée aucun crédit. */
    @Transactional
    public void earnCompletedStay(Long orgId, String code, int percent, LocalDate cutoff) {
        var stay = reservationRepository.lockCancellation(orgId, code)
            .orElseThrow(() -> new IllegalStateException("Séjour du crédit introuvable"));
        if (percent <= 0 || stay.getPaymentStatus() != com.clenzy.model.PaymentStatus.PAID || stay.getCancelledAt() != null
                || !"confirmed".equalsIgnoreCase(stay.getStatus()) || !"direct".equalsIgnoreCase(stay.getSource())
                || stay.getCheckOut() == null || !stay.getCheckOut().isBefore(cutoff)
                || stay.getGuest() == null || stay.getGuest().getEmail() == null || stay.getTotalPrice() == null)
            throw new IllegalStateException("Le séjour doit être terminé et réglé avant le gain de crédit");
        BigDecimal amount = BaitlyReservationCredit.cash(stay).multiply(BigDecimal.valueOf(Math.min(percent, 100)))
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        earn(orgId, stay.getGuest().getEmail(), StripeAmounts.toMinorUnits(amount), stay.getCurrency(), code);
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
                    self.getObject().earnCompletedStay(org.getId(), r.getConfirmationCode(), pct, cutoff);
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
