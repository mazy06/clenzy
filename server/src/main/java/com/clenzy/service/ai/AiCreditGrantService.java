package com.clenzy.service.ai;

import com.clenzy.model.AiCreditGrant;
import com.clenzy.model.AiUsageLedgerEntry;
import com.clenzy.model.User;
import com.clenzy.repository.AiCreditGrantRepository;
import com.clenzy.repository.AiUsageLedgerRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Dotations et cycle de vie des poches de credits IA (campagne T-07, ADR-005).
 *
 * <p><b>Idempotence webhook</b> : chaque grant Stripe porte un {@code stripeRef}
 * unique (invoice id / checkout session id). Check {@code existsByStripeRef} +
 * contrainte unique DB en filet : une re-livraison Stripe (le webhook retourne
 * 500 sur echec → retry natif) ne double-credite jamais.</p>
 *
 * <p>Chaque mouvement ecrit sa ligne au ledger (GRANT positif / EXPIRY negatif)
 * et invalide le solde chaud Redis ({@link CreditBalanceService#invalidate}).</p>
 */
@Service
public class AiCreditGrantService {

    private static final Logger log = LoggerFactory.getLogger(AiCreditGrantService.class);

    /** Dotation mensuelle : expire en fin de cycle + marge (pas de rollover — D-102). */
    private static final Duration SUBSCRIPTION_GRANT_TTL = Duration.ofDays(32);
    /** Top-up prepaye : 12 mois (D-102). */
    private static final Duration TOPUP_GRANT_TTL = Duration.ofDays(365);

    private final AiCreditGrantRepository grantRepository;
    private final AiUsageLedgerRepository ledgerRepository;
    private final CreditBalanceService balanceService;
    private final UserRepository userRepository;
    private final com.clenzy.repository.OrganizationRepository organizationRepository;

    private final long allotmentEssentiel;
    private final long allotmentConfort;
    private final long allotmentPremium;

    public AiCreditGrantService(AiCreditGrantRepository grantRepository,
                                AiUsageLedgerRepository ledgerRepository,
                                CreditBalanceService balanceService,
                                UserRepository userRepository,
                                com.clenzy.repository.OrganizationRepository organizationRepository,
                                @Value("${clenzy.ai.credits.allotment.essentiel-millicredits:500000}") long allotmentEssentiel,
                                @Value("${clenzy.ai.credits.allotment.confort-millicredits:2000000}") long allotmentConfort,
                                @Value("${clenzy.ai.credits.allotment.premium-millicredits:8000000}") long allotmentPremium) {
        this.grantRepository = grantRepository;
        this.ledgerRepository = ledgerRepository;
        this.balanceService = balanceService;
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.allotmentEssentiel = allotmentEssentiel;
        this.allotmentConfort = allotmentConfort;
        this.allotmentPremium = allotmentPremium;
    }

    /**
     * Dotation mensuelle a la reception d'un {@code invoice.paid} d'abonnement :
     * retrouve l'utilisateur payeur par son subscription Stripe, mappe son
     * forfait vers la dotation, credite son organisation. No-op silencieux si
     * l'invoice n'est pas un abonnement PMS connu.
     */
    @Transactional
    public void grantForPaidInvoice(String stripeSubscriptionId, String invoiceId) {
        if (stripeSubscriptionId == null || invoiceId == null) {
            return;
        }
        User payer = userRepository.findByStripeSubscriptionId(stripeSubscriptionId).orElse(null);
        if (payer == null || payer.getOrganizationId() == null) {
            log.debug("[CREDITS] invoice.paid sans abonnement PMS connu (sub={}) — ignore",
                    stripeSubscriptionId);
            return;
        }
        long allotment = allotmentFor(payer.getForfait());
        grant(payer.getOrganizationId(), AiCreditGrant.SOURCE_SUBSCRIPTION, allotment,
                Instant.now().plus(SUBSCRIPTION_GRANT_TTL), invoiceId);
    }

    /**
     * Dotation initiale d'amorçage (T-07) : crédite une org existante AVANT
     * l'activation de l'enforcement, pour qu'aucune ne soit coupée au flip du
     * flag. <b>Idempotent</b> : ne fait rien si l'org possède déjà une poche
     * active (non expirée) — même consommée. TTL identique à l'abonnement
     * mensuel : couvre jusqu'à la prochaine facture Stripe qui prend le relais.
     *
     * @return {@code true} si une poche a été créée, {@code false} si déjà dotée
     */
    @Transactional
    public boolean grantInitialIfAbsent(Long organizationId, long millicredits) {
        if (organizationId == null || millicredits <= 0) {
            return false;
        }
        boolean alreadyGranted = !grantRepository
                .findByOrganizationIdAndExpiresAtAfterOrderByExpiresAtAsc(organizationId, Instant.now())
                .isEmpty();
        if (alreadyGranted) {
            return false;
        }
        grant(organizationId, AiCreditGrant.SOURCE_INITIAL, millicredits,
                Instant.now().plus(SUBSCRIPTION_GRANT_TTL), null);
        return true;
    }

    /**
     * Dote TOUTES les orgs existantes d'une poche initiale (amorçage T-07),
     * à lancer AVANT l'activation de l'enforcement pour n'en couper aucune.
     * Idempotent par org (voir {@link #grantInitialIfAbsent}).
     *
     * @return {@code {granted, skipped, millicredits}}
     */
    @Transactional
    public Map<String, Object> grantInitialToAllOrgs(long millicredits) {
        int granted = 0;
        int skipped = 0;
        for (com.clenzy.model.Organization org : organizationRepository.findAll()) {
            if (grantInitialIfAbsent(org.getId(), millicredits)) {
                granted++;
            } else {
                skipped++;
            }
        }
        log.info("[CREDITS] Dotation initiale : {} orgs dotées, {} ignorées ({}mc chacune)",
                granted, skipped, millicredits);
        return Map.of("granted", granted, "skipped", skipped, "millicredits", millicredits);
    }

    /** Credite un pack top-up apres paiement Checkout confirme (webhook). */
    @Transactional
    public void grantTopUp(Long organizationId, long millicredits, String checkoutSessionId) {
        grant(organizationId, AiCreditGrant.SOURCE_TOPUP, millicredits,
                Instant.now().plus(TOPUP_GRANT_TTL), checkoutSessionId);
    }

    /**
     * Expire les poches echues avec restant > 0 : ligne EXPIRY au ledger
     * (auditabilite du non-consomme — D-102) + poche soldee + invalidation du
     * solde chaud. Idempotent (cle ledger par poche). Appele par le scheduler
     * quotidien.
     *
     * @return nombre de poches expirees
     */
    @Transactional
    public int expireOverdueGrants() {
        List<AiCreditGrant> overdue = grantRepository.findExpiredWithRemaining(Instant.now());
        for (AiCreditGrant grant : overdue) {
            long remaining = grant.remaining();
            writeLedgerLine(grant.getOrganizationId(), AiUsageLedgerEntry.TYPE_EXPIRY,
                    -remaining, "expiry:grant:" + grant.getId());
            grant.applyConsumption(remaining); // solde la poche → jamais re-expiree
            balanceService.invalidate(grant.getOrganizationId());
            log.info("[CREDITS] Poche {} expiree : org={} source={} perdu={}mc",
                    grant.getId(), grant.getOrganizationId(), grant.getSource(), remaining);
        }
        grantRepository.saveAll(overdue);
        return overdue.size();
    }

    /** Dernieres lignes du ledger de l'org (ecran credits, T-08) — libellees par agent/type. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRecentLedger(Long organizationId) {
        return ledgerRepository.findTop50ByOrganizationIdOrderByCreatedAtDesc(organizationId).stream()
                .map(e -> {
                    Map<String, Object> line = new java.util.LinkedHashMap<>();
                    line.put("createdAt", e.getCreatedAt());
                    line.put("entryType", e.getEntryType());
                    line.put("agent", e.getAgent());
                    line.put("model", e.getModel());
                    line.put("feature", e.getFeature());
                    line.put("millicredits", e.getMillicredits());
                    line.put("runId", e.getRunId());
                    return line;
                })
                .toList();
    }

    /** Solde froid detaille (poches actives, ordonnees par expiration) — UX T-08. */
    @Transactional(readOnly = true)
    public Map<String, Object> getBalance(Long organizationId) {
        List<AiCreditGrant> active = grantRepository
                .findByOrganizationIdAndExpiresAtAfterOrderByExpiresAtAsc(organizationId, Instant.now());
        long total = active.stream().mapToLong(AiCreditGrant::remaining).sum();
        List<Map<String, Object>> pockets = active.stream()
                .filter(g -> g.remaining() > 0)
                .map(g -> Map.<String, Object>of(
                        "source", g.getSource(),
                        "remainingMillicredits", g.remaining(),
                        "expiresAt", g.getExpiresAt()))
                .toList();
        return Map.of("totalMillicredits", total, "pockets", pockets);
    }

    private long allotmentFor(String forfait) {
        String f = forfait == null ? "essentiel" : forfait.toLowerCase(Locale.ROOT);
        return switch (f) {
            case "premium" -> allotmentPremium;
            case "confort" -> allotmentConfort;
            default -> allotmentEssentiel;
        };
    }

    private void grant(Long organizationId, String source, long millicredits,
                       Instant expiresAt, String stripeRef) {
        if (organizationId == null || millicredits <= 0) {
            return;
        }
        // Idempotence : check explicite + contrainte unique DB en filet (une course
        // de double-livraison leve → 500 → retry Stripe → le check passe).
        if (stripeRef != null && grantRepository.existsByStripeRef(stripeRef)) {
            log.info("[CREDITS] Grant deja credite (stripeRef={}) — idempotence", stripeRef);
            return;
        }
        grantRepository.save(new AiCreditGrant(organizationId, source, millicredits,
                expiresAt, stripeRef));
        writeLedgerLine(organizationId, AiUsageLedgerEntry.TYPE_GRANT, millicredits,
                "grant:" + (stripeRef != null ? stripeRef : java.util.UUID.randomUUID()));
        balanceService.invalidate(organizationId);
        log.info("[CREDITS] Grant {} : org={} {}mc (expire {})", source, organizationId,
                millicredits, expiresAt);
    }

    private void writeLedgerLine(Long organizationId, String entryType, long millicredits,
                                 String idempotencyKey) {
        if (ledgerRepository.existsByIdempotencyKey(idempotencyKey)) {
            return;
        }
        ledgerRepository.save(new AiUsageLedgerEntry(
                organizationId, null, null, null, "billing", "CREDITS",
                entryType, AiUsageLedgerEntry.BUCKET_INTERACTIVE,
                null, null, 0, 0, 0, null, null,
                millicredits, 0, idempotencyKey));
    }
}
