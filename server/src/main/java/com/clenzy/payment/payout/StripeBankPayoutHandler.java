package com.clenzy.payment.payout;

import com.clenzy.model.BankPayoutObservation;
import com.clenzy.payment.StripeGateway;
import com.clenzy.service.payout.BankPayoutStore;
import com.clenzy.tenant.TenantContext;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.Payout;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.Instant;
import java.util.*;

/** Lecture PSP uniquement : webhook signé ou rattrapage interne d'un compte connu du journal. */
@Component
public class StripeBankPayoutHandler {
    private final StripeGateway stripe;
    private final BankPayoutStore store;
    private final TenantContext tenant;

    public StripeBankPayoutHandler(StripeGateway stripe, BankPayoutStore store, TenantContext tenant) {
        this.stripe = stripe; this.store = store; this.tenant = tenant;
    }

    /** Aucun événement Stripe simulé : la preuve provient d'une lecture canonique du compte connecté. */
    public void recover(String account, boolean live, String payoutId, Instant observedAt) throws StripeException {
        if (TransactionSynchronizationManager.isActualTransactionActive()) throw new IllegalStateException("Lecture PSP hors transaction requise.");
        boolean previousSystem = tenant.isSystemOrg();
        try {
            tenant.setSystemOrg(true);
            if (!store.isKnownAccount(account, live)) throw new IllegalArgumentException("Compte absent du journal.");
            if (payoutId == null || !payoutId.startsWith("po_")) throw new IllegalArgumentException("Versement bancaire requis.");
            var payout = stripe.retrieveConnectedPayout(account, payoutId);
            if (payout == null || !payoutId.equals(payout.getId()) || payout.getCreated() == null
                    || !Boolean.valueOf(live).equals(payout.getLivemode())) {
                throw new IllegalStateException("Compte ou mode de versement bancaire incohérent.");
            }
            var status = BankPayoutObservation.Status.valueOf(payout.getStatus().toUpperCase(Locale.ROOT));
            var credits = Boolean.TRUE.equals(payout.getAutomatic()) && "completed".equals(payout.getReconciliationStatus())
                    ? sources(account, payout) : List.<BankPayoutObservation.Source>of();
            var sorted = credits.stream().sorted(Comparator.comparing(BankPayoutObservation.Source::source)
                    .thenComparingLong(BankPayoutObservation.Source::amountMinor).thenComparing(BankPayoutObservation.Source::currency)).toList();
            // Même état/preuves => une seule observation, même après crash avant sauvegarde du curseur.
            String fingerprint = String.join("|", account, Boolean.toString(live), payoutId, status.name(),
                    String.valueOf(payout.getCreated()), String.valueOf(payout.getArrivalDate()),
                    String.valueOf(payout.getFailureCode()), sorted.toString());
            String key;
            try {
                key = "recovery:" + HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                        .digest(fingerprint.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
            store.append(key, account, payoutId, live, status, Instant.ofEpochSecond(payout.getCreated()), observedAt,
                    payout.getArrivalDate() == null ? null : Instant.ofEpochSecond(payout.getArrivalDate()),
                    payout.getFailureCode(), sorted);
        } finally { tenant.setSystemOrg(previousSystem); }
    }

    public void handleVerifiedEvent(Event event) throws StripeException {
        if (TransactionSynchronizationManager.isActualTransactionActive()) throw new IllegalStateException("Lecture PSP hors transaction requise.");
        // Les payouts du compte plateforme ne sont pas ceux des bénéficiaires.
        if (event.getAccount() == null) return;
        if (event.getId() == null || event.getCreated() == null || event.getLivemode() == null) {
            throw new IllegalArgumentException("Événement bancaire incomplet.");
        }
        boolean previousSystem = tenant.isSystemOrg();
        try {
            // Exemption explicite, bornée au webhook authentifié ; fonctionne aussi en RLS strict.
            tenant.setSystemOrg(true);
            if (!store.needsProcessing(event.getAccount(), event.getId())) return;
            var object = event.getDataObjectDeserializer().getObject().orElse(null);
            if (!(object instanceof Payout)) {
                try { object = event.getDataObjectDeserializer().deserializeUnsafe(); }
                catch (Exception e) { throw new IllegalArgumentException("Objet bancaire Stripe illisible.", e); }
            }
            if (!(object instanceof Payout received) || received.getId() == null || !received.getId().startsWith("po_")) {
                throw new IllegalArgumentException("Versement bancaire Stripe requis.");
            }
            // Lecture canonique sous Stripe-Account : pas de confiance dans l'ordre de livraison des webhooks.
            var payout = stripe.retrieveConnectedPayout(event.getAccount(), received.getId());
            if (payout == null || !received.getId().equals(payout.getId()) || payout.getCreated() == null
                    || !event.getLivemode().equals(payout.getLivemode())) {
                throw new IllegalStateException("Compte ou mode de versement bancaire incohérent.");
            }
            var status = BankPayoutObservation.Status.valueOf(payout.getStatus().toUpperCase(Locale.ROOT));
            List<BankPayoutObservation.Source> sources = List.of();
            // Les virements manuels / fractionnés sans rapprochement ne fournissent pas cette preuve.
            if (Boolean.TRUE.equals(payout.getAutomatic()) && "completed".equals(payout.getReconciliationStatus())) {
                sources = sources(event.getAccount(), payout);
            }
            store.append(event.getId(), event.getAccount(), payout.getId(), payout.getLivemode(), status,
                    Instant.ofEpochSecond(payout.getCreated()), Instant.ofEpochSecond(event.getCreated()),
                    payout.getArrivalDate() == null ? null : Instant.ofEpochSecond(payout.getArrivalDate()),
                    payout.getFailureCode(), sources);
        } finally {
            tenant.setSystemOrg(previousSystem);
        }
    }

    private List<BankPayoutObservation.Source> sources(String account, Payout payout) throws StripeException {
        if (payout.getAmount() == null || payout.getAmount() <= 0 || payout.getCurrency() == null) {
            throw new IllegalStateException("Montant bancaire canonique incomplet.");
        }
        var result = new ArrayList<BankPayoutObservation.Source>();
        var seen = new HashSet<String>();
        var creditSources = new HashSet<String>();
        long netFunding = 0;
        boolean exactAttribution = true;
        boolean payoutDebitSeen = false;
        String after = null;
        for (int page = 0; page < 100; page++) {
            var response = stripe.listConnectedPayoutTransactions(account, payout.getId(), after);
            if (response == null || response.getData() == null || response.getHasMore() == null) {
                throw new IllegalStateException("Rapprochement bancaire incomplet.");
            }
            for (var transaction : response.getData()) {
                if (transaction.getId() == null || !seen.add(transaction.getId())) {
                    throw new IllegalStateException("Pagination bancaire incohérente.");
                }
                after = transaction.getId();
                if (transaction.getAmount() == null || transaction.getNet() == null || transaction.getCurrency() == null) {
                    throw new IllegalStateException("Mouvement bancaire incomplet.");
                }
                // Le débit du payout lui-même ne réduit pas les fonds qui le financent.
                // Ne pas confondre un autre débit (remboursement, frais, reprise) avec celui-ci.
                if (payout.getId().equals(transaction.getSource())) {
                    if (payoutDebitSeen || !"payout".equals(transaction.getType())
                            || transaction.getAmount() != -payout.getAmount()
                            || !transaction.getAmount().equals(transaction.getNet())
                            || !payout.getCurrency().equals(transaction.getCurrency())) {
                        throw new IllegalStateException("Débit du versement bancaire incohérent.");
                    }
                    payoutDebitSeen = true;
                    continue;
                }
                // Sans affectation des débits aux crédits, on ne peut certifier le brut d'un transfert.
                // Le payout reste observable, mais aucun bénéficiaire n'est déclaré reçu en banque.
                if (!payout.getCurrency().equals(transaction.getCurrency()) || transaction.getNet() < 0
                        || transaction.getAmount() < 0) exactAttribution = false;
                netFunding = Math.addExact(netFunding, transaction.getNet());
                // Seuls les crédits de transfert sans frais ni conversion prouvent ce montant précis.
                if (transaction.getSource() != null && transaction.getSource().startsWith("py_")
                        && transaction.getAmount() != null && transaction.getAmount() > 0
                        && transaction.getAmount().equals(transaction.getNet())
                        && payout.getCurrency() != null && payout.getCurrency().equals(transaction.getCurrency())) {
                    if (!creditSources.add(transaction.getSource())) {
                        throw new IllegalStateException("Crédit bancaire présent plusieurs fois.");
                    }
                    result.add(new BankPayoutObservation.Source(transaction.getSource(), transaction.getAmount(),
                            transaction.getCurrency().toLowerCase(Locale.ROOT)));
                }
            }
            if (!response.getHasMore()) {
                return exactAttribution && netFunding == payout.getAmount() ? List.copyOf(result) : List.of();
            }
            if (response.getData().isEmpty()) throw new IllegalStateException("Pagination bancaire interrompue.");
        }
        throw new IllegalStateException("Lot bancaire trop volumineux : rapprochement à reprendre, aucun succès présumé.");
    }
}
