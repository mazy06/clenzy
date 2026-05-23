package com.clenzy.payment.payout.executor;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.payout.PayoutExecutor;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.payment.payout.wise.WiseClient;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Exécuteur Wise Business : virement international auto, 80+ pays dont
 * Maroc et Arabie Saoudite.
 *
 * <h2>Flow d'exécution</h2>
 * <ol>
 *   <li>Si le recipient Wise n'existe pas encore pour cet owner (premier
 *       payout), on le crée via l'IBAN stocké dans {@code OwnerPayoutConfig}
 *       et on persiste le {@code wiseRecipientId}.</li>
 *   <li>Création d'un quote Wise (devis avec frais) pour le couple
 *       (currency, montant, recipient).</li>
 *   <li>Création du transfer (référence le quote + recipient).</li>
 *   <li>Funding du transfer depuis le solde Wise Business de Clenzy.</li>
 *   <li>Le payout passe en PROCESSING — le webhook Wise viendra ensuite
 *       le marquer PAID quand {@code OUTGOING_PAYMENT_SENT}.</li>
 * </ol>
 *
 * <h2>Marchés cibles</h2>
 * <p>Recommandé pour les propriétaires <strong>hors zone Stripe Connect</strong> :
 * MA, KSA, EAU, et tout pays où Stripe Connect n'est pas disponible. Pour les
 * propriétaires EU, Stripe Connect ou Open Banking restent préférables (frais
 * plus bas, devise native).</p>
 *
 * <h2>Etat passage à PAID</h2>
 * <p>Wise est un flow async : l'exécuteur laisse le payout en {@code PROCESSING}
 * après funding. Le passage en {@code PAID} se fait via le webhook géré par
 * {@code WiseWebhookController} lors du state_change
 * {@code OUTGOING_PAYMENT_SENT}.</p>
 */
@Component
public class WisePayoutExecutor implements PayoutExecutor {

    private static final Logger log = LoggerFactory.getLogger(WisePayoutExecutor.class);

    private final WiseClient wiseClient;
    private final OwnerPayoutRepository payoutRepository;
    private final OwnerPayoutConfigRepository configRepository;
    private final UserRepository userRepository;
    private final PayoutNotifier notifier;

    public WisePayoutExecutor(WiseClient wiseClient,
                               OwnerPayoutRepository payoutRepository,
                               OwnerPayoutConfigRepository configRepository,
                               UserRepository userRepository,
                               PayoutNotifier notifier) {
        this.wiseClient = wiseClient;
        this.payoutRepository = payoutRepository;
        this.configRepository = configRepository;
        this.userRepository = userRepository;
        this.notifier = notifier;
    }

    @Override
    public PayoutMethod getSupportedMethod() {
        return PayoutMethod.WISE;
    }

    @Override
    public OwnerPayout execute(OwnerPayout payout, OwnerPayoutConfig config) {
        if (!wiseClient.isEnabled()) {
            throw new PayoutExecutionException(
                "Wise n'est pas configure cote Clenzy (wise.api-token + wise.profile-id manquants).");
        }
        if (config.getIban() == null || config.getIban().isBlank()) {
            throw new PayoutExecutionException(
                "Wise payout : IBAN du proprietaire absent dans la configuration.");
        }

        payout.setStatus(PayoutStatus.PROCESSING);
        payout.setPayoutMethod(PayoutMethod.WISE);
        payoutRepository.save(payout);

        try {
            // 1. Assure que le recipient Wise existe pour ce proprietaire
            String recipientId = ensureRecipient(config, payout.getCurrency());

            // 2. Crée un quote pour le montant à transférer
            // sourceCurrency = devise du compte Clenzy (EUR par défaut),
            // targetCurrency = devise du payout (MAD/SAR/EUR…)
            String sourceCurrency = "EUR";
            WiseClient.WiseQuote quote = wiseClient.createQuote(
                payout.getNetAmount(), sourceCurrency, payout.getCurrency(), recipientId);

            // 3. Crée le transfer
            String reference = "Clenzy " + payout.getPeriodStart() + " → " + payout.getPeriodEnd();
            String transferId = wiseClient.createTransfer(quote.quoteId(), recipientId,
                payout.getId(), reference);

            // 4. Funde le transfer depuis le solde Wise Business de Clenzy
            wiseClient.fundTransfer(transferId);

            payout.setPaymentReference("WISE:" + transferId);
            // On reste en PROCESSING — le webhook OUTGOING_PAYMENT_SENT
            // marquera PAID.
            OwnerPayout saved = payoutRepository.save(payout);

            log.info("Wise transfer {} created+funded for payout {} (org {}, target {} {})",
                transferId, payout.getId(), payout.getOrganizationId(),
                quote.targetAmount(), payout.getCurrency());

            return saved;
        } catch (WiseClient.WiseApiException e) {
            return failPayout(payout, e.getMessage());
        } catch (Exception e) {
            return failPayout(payout, "Wise unexpected error: " + e.getMessage());
        }
    }

    /**
     * Récupère ou crée le recipient Wise pour cet owner. L'ID est persisté
     * dans {@code wiseRecipientId} pour éviter une recréation à chaque payout.
     */
    private String ensureRecipient(OwnerPayoutConfig config, String currency) {
        if (config.getWiseRecipientId() != null && !config.getWiseRecipientId().isBlank()) {
            return config.getWiseRecipientId();
        }

        // Le legalType (PRIVATE / BUSINESS) impacte les champs requis Wise.
        // Par défaut PRIVATE = particulier (cas le plus fréquent pour Clenzy).
        String holderName = config.getBankAccountHolder();
        if (holderName == null || holderName.isBlank()) {
            // Fallback : nom complet de l'owner
            holderName = userRepository.findById(config.getOwnerId())
                .map(u -> u.getFirstName() + " " + u.getLastName())
                .map(String::trim)
                .orElse("Clenzy Owner #" + config.getOwnerId());
        }

        String recipientId = wiseClient.createRecipient(
            config.getIban(),
            holderName,
            currency,
            "PRIVATE"
        );
        config.setWiseRecipientId(recipientId);
        configRepository.save(config);
        log.info("Wise recipient {} cree pour owner {} (org {})",
            recipientId, config.getOwnerId(), config.getOrganizationId());
        return recipientId;
    }

    private OwnerPayout failPayout(OwnerPayout payout, String reason) {
        payout.setStatus(PayoutStatus.FAILED);
        payout.setFailureReason(reason);
        payout.setRetryCount(payout.getRetryCount() + 1);
        OwnerPayout saved = payoutRepository.save(payout);
        notifier.notifyFailure(saved, reason);
        log.error("Wise payout {} failed (attempt {}): {}",
            payout.getId(), payout.getRetryCount(), reason);
        return saved;
    }
}
