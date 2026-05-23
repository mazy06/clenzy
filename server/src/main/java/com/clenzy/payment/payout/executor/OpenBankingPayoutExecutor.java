package com.clenzy.payment.payout.executor;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.payment.payout.openbanking.GoCardlessPisClient;
import com.clenzy.payment.payout.openbanking.OpenBankingProvider;
import com.clenzy.repository.OwnerPayoutRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Exécuteur Open Banking PIS : initie un virement SEPA Credit Transfer
 * automatiquement depuis le compte Clenzy via la directive PSD2.
 *
 * <h2>Avantages vs SEPA_TRANSFER classique</h2>
 * <ul>
 *   <li>Zéro upload manuel du XML pain.001</li>
 *   <li>Pas de portail bancaire à ouvrir individuellement</li>
 *   <li>Coût ~0.10 €/virement (vs frais variables banque)</li>
 *   <li>Statut tracé en temps réel via webhook</li>
 * </ul>
 *
 * <h2>Prérequis admin</h2>
 * <p>Une fois par période (90 jours typique), l'admin doit valider un SCA
 * (2FA banque) pour autoriser Clenzy à initier des virements depuis son
 * compte. Le {@code consent_id} obtenu est stocké dans
 * {@code OwnerPayoutConfig.openBankingConsentId} — réutilisé pour tous les
 * virements jusqu'à expiration.</p>
 *
 * <h2>Note importante : un seul consent pour tous les owners</h2>
 * <p>Le consent autorise <strong>Clenzy</strong> à virer depuis SON compte,
 * pas chaque owner individuellement. On stocke quand même le consent_id dans
 * {@code OwnerPayoutConfig} pour suivre quelle config est éligible
 * (= l'IBAN owner est connu + l'admin a complété le SCA). En pratique, tous
 * les owners ayant OPEN_BANKING partagent le même consent au niveau org.</p>
 *
 * <h2>Provider choice</h2>
 * <p>MVP : GoCardless. Tink sera ajouté dans une PR ultérieure avec un
 * second exécuteur ou un dispatcher interne basé sur {@code openBankingProvider}.</p>
 */
@Component
public class OpenBankingPayoutExecutor implements PayoutExecutor {

    private static final Logger log = LoggerFactory.getLogger(OpenBankingPayoutExecutor.class);

    private final GoCardlessPisClient gocardlessClient;
    private final OwnerPayoutRepository payoutRepository;
    private final PayoutNotifier notifier;

    public OpenBankingPayoutExecutor(GoCardlessPisClient gocardlessClient,
                                      OwnerPayoutRepository payoutRepository,
                                      PayoutNotifier notifier) {
        this.gocardlessClient = gocardlessClient;
        this.payoutRepository = payoutRepository;
        this.notifier = notifier;
    }

    @Override
    public PayoutMethod getSupportedMethod() {
        return PayoutMethod.OPEN_BANKING;
    }

    @Override
    public OwnerPayout execute(OwnerPayout payout, OwnerPayoutConfig config) {
        if (!gocardlessClient.isEnabled()) {
            throw new PayoutExecutionException(
                "Open Banking n'est pas configure cote Clenzy (gocardless.secret-id "
              + "+ gocardless.debtor-account-id manquants).");
        }

        // Validation : consent valide ?
        String consentId = config.getOpenBankingConsentId();
        if (consentId == null || consentId.isBlank()) {
            throw new PayoutExecutionException(
                "Open Banking : aucun consent SCA enregistre. L'admin doit completer "
              + "le SCA bancaire dans Parametres > Reversements > Open Banking.");
        }
        if (config.getOpenBankingConsentExpiresAt() != null
            && config.getOpenBankingConsentExpiresAt().isBefore(Instant.now())) {
            throw new PayoutExecutionException(
                "Open Banking : le consent SCA est expire. L'admin doit re-signer le "
              + "SCA bancaire dans Parametres > Reversements > Open Banking.");
        }

        // Validation : provider connu
        String provider = config.getOpenBankingProvider();
        if (provider == null || provider.isBlank()) {
            throw new PayoutExecutionException(
                "Open Banking : provider non configure (GOCARDLESS ou TINK attendu).");
        }
        // MVP : on ne gère que GoCardless ; Tink à venir
        OpenBankingProvider providerEnum;
        try {
            providerEnum = OpenBankingProvider.valueOf(provider.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new PayoutExecutionException(
                "Open Banking : provider inconnu " + provider + ".");
        }
        if (providerEnum != OpenBankingProvider.GOCARDLESS) {
            throw new PayoutExecutionException(
                "Open Banking : provider " + providerEnum + " pas encore implemente (MVP = GOCARDLESS).");
        }

        if (config.getIban() == null || config.getIban().isBlank()) {
            throw new PayoutExecutionException(
                "Open Banking : IBAN du proprietaire absent.");
        }

        payout.setStatus(PayoutStatus.PROCESSING);
        payout.setPayoutMethod(PayoutMethod.OPEN_BANKING);
        payoutRepository.save(payout);

        try {
            String reference = "CLENZY-" + payout.getId() + "-"
                + payout.getPeriodStart() + "-" + payout.getPeriodEnd();
            String creditorName = config.getBankAccountHolder() != null
                ? config.getBankAccountHolder()
                : "Owner #" + payout.getOwnerId();

            String paymentId = gocardlessClient.initiatePayment(
                consentId,
                payout.getNetAmount(),
                payout.getCurrency(),
                config.getIban(),
                creditorName,
                reference
            );

            payout.setPaymentReference("GOCARDLESS:" + paymentId);
            // On reste en PROCESSING — le webhook payments.state_changed
            // marquera PAID quand SEPA est exécuté par la banque (J ou J+1).
            OwnerPayout saved = payoutRepository.save(payout);

            log.info("Open Banking payment {} initiated for payout {} (org {})",
                paymentId, payout.getId(), payout.getOrganizationId());
            return saved;
        } catch (GoCardlessPisClient.OpenBankingApiException e) {
            return failPayout(payout, e.getMessage());
        } catch (Exception e) {
            return failPayout(payout, "Open Banking unexpected error: " + e.getMessage());
        }
    }

    private OwnerPayout failPayout(OwnerPayout payout, String reason) {
        payout.setStatus(PayoutStatus.FAILED);
        payout.setFailureReason(reason);
        payout.setRetryCount(payout.getRetryCount() + 1);
        OwnerPayout saved = payoutRepository.save(payout);
        notifier.notifyFailure(saved, reason);
        log.error("Open Banking payout {} failed (attempt {}): {}",
            payout.getId(), payout.getRetryCount(), reason);
        return saved;
    }
}
