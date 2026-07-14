package com.clenzy.service.payout;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.HousekeeperPayoutConfig;
import com.clenzy.model.HousekeeperPayoutRecord;
import com.clenzy.model.HousekeeperPayoutRecord.Status;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionPhoto;
import com.clenzy.model.InterventionType;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.User;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.HousekeeperPayoutConfigRepository;
import com.clenzy.repository.HousekeeperPayoutRecordRepository;
import com.clenzy.repository.InterventionPhotoRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.PricingConfigService;
import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import com.stripe.model.AccountSession;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
import com.stripe.param.AccountSessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

/**
 * Payout Stripe Connect des prestataires ménage (Moteur Ménage 3B — P9).
 *
 * <p><b>Money-path — règles d'audit appliquées strictement :</b>
 * <ul>
 *   <li>Tous les appels Stripe passent par {@link StripeGateway} (jamais statique) ;</li>
 *   <li>{@link StripeAmounts#toMinorUnits} pour la conversion centimes ;</li>
 *   <li>JAMAIS d'appel Stripe dans une transaction DB : préparation en transaction
 *       courte (record PENDING), transfert {@code afterCommit}, résultat persisté
 *       dans une NOUVELLE transaction ;</li>
 *   <li>check-then-act interdit : contrainte UNIQUE(intervention_id) + UPDATE
 *       conditionnel (CAS) {@code transitionStatus} ;</li>
 *   <li>aucun catch avaleur : échec → record FAILED + notification admins.</li>
 * </ul></p>
 *
 * <p><b>Gate</b> (à la complétion d'une intervention ménage) : paiement host acquis
 * (PAID) + preuve photo ({@link #isProofComplete}) + onboarding Connect complet.
 * Gate KO → record BLOCKED avec raison (jamais silencieux) + notif au pro pour
 * l'onboarding. <b>Commission</b> : catégorie « entretien » de
 * {@code commissionConfigs} (Tarification) — désactivée par défaut.</p>
 */
@Service
public class HousekeeperPayoutService {

    private static final Logger log = LoggerFactory.getLogger(HousekeeperPayoutService.class);

    /** Catégorie du commissionConfigs branchée (le ménage vit dans l'onglet Entretien). */
    static final String COMMISSION_CATEGORY = "entretien";

    /** URLs de retour de l'AccountLink pro (flux mobile navigateur in-app). */
    @org.springframework.beans.factory.annotation.Value(
            "${stripe.connect.pro-return-url:https://app.clenzy.fr/settings?tab=my-payouts-pro}")
    private String proReturnUrl;

    @org.springframework.beans.factory.annotation.Value(
            "${stripe.connect.pro-refresh-url:https://app.clenzy.fr/settings?tab=my-payouts-pro&refresh=true}")
    private String proRefreshUrl;

    private final HousekeeperPayoutConfigRepository configRepository;
    private final HousekeeperPayoutRecordRepository recordRepository;
    private final InterventionRepository interventionRepository;
    private final InterventionPhotoRepository interventionPhotoRepository;
    private final UserRepository userRepository;
    private final StripeGateway stripeGateway;
    private final PricingConfigService pricingConfigService;
    private final NotificationService notificationService;
    private final HousekeeperPayoutRecorder recorder;
    private final com.clenzy.payment.payout.StripeConnectTransferClient transferClient;

    public HousekeeperPayoutService(HousekeeperPayoutConfigRepository configRepository,
                                    HousekeeperPayoutRecordRepository recordRepository,
                                    InterventionRepository interventionRepository,
                                    InterventionPhotoRepository interventionPhotoRepository,
                                    UserRepository userRepository,
                                    StripeGateway stripeGateway,
                                    PricingConfigService pricingConfigService,
                                    NotificationService notificationService,
                                    HousekeeperPayoutRecorder recorder,
                                    com.clenzy.payment.payout.StripeConnectTransferClient transferClient) {
        this.configRepository = configRepository;
        this.recordRepository = recordRepository;
        this.interventionRepository = interventionRepository;
        this.interventionPhotoRepository = interventionPhotoRepository;
        this.userRepository = userRepository;
        this.stripeGateway = stripeGateway;
        this.pricingConfigService = pricingConfigService;
        this.notificationService = notificationService;
        this.recorder = recorder;
        this.transferClient = transferClient;
    }

    // ─── Onboarding (compte Express + Account Session embarquée) ───────────────

    /** Résout l'entité User du porteur du JWT. */
    public User requireCurrentUser(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new NotFoundException("Utilisateur non trouvé"));
    }

    /**
     * Crée (ou récupère) le compte Connect Express du pro puis renvoie le
     * client_secret d'une Account Session pour l'onboarding EMBARQUÉ.
     * Les appels Stripe sont HORS transaction (méthode non transactionnelle,
     * persistance déléguée à {@link #persistAccountId}).
     */
    public String createAccountSession(User user, Long orgId) throws StripeException {
        String accountId = ensureExpressAccount(user, orgId);

        AccountSession session = stripeGateway.createAccountSession(
                AccountSessionCreateParams.builder()
                        .setAccount(accountId)
                        .setComponents(AccountSessionCreateParams.Components.builder()
                                .setAccountOnboarding(
                                        AccountSessionCreateParams.Components.AccountOnboarding.builder()
                                                .setEnabled(true)
                                                .build())
                                .build())
                        .build());
        return session.getClientSecret();
    }

    /** Crée le compte Connect Express du pro s'il n'existe pas encore, retourne son id. */
    private String ensureExpressAccount(User user, Long orgId) throws StripeException {
        HousekeeperPayoutConfig config = configRepository
                .findByUserIdAndOrganizationId(user.getId(), orgId)
                .orElse(null);
        String accountId = config != null ? config.getStripeAccountId() : null;
        if (accountId != null) {
            return accountId;
        }
        AccountCreateParams.Builder params = AccountCreateParams.builder()
                .setType(AccountCreateParams.Type.EXPRESS)
                .setCountry("FR")
                .setCapabilities(AccountCreateParams.Capabilities.builder()
                        .setTransfers(AccountCreateParams.Capabilities.Transfers.builder()
                                .setRequested(true)
                                .build())
                        .build());
        if (user.getEmail() != null) {
            params.setEmail(user.getEmail());
        }
        Account account = stripeGateway.createAccount(params.build());
        recorder.persistAccountId(user.getId(), orgId, account.getId());
        log.info("Compte Connect Express {} créé pour le housekeeper {}", account.getId(), user.getId());
        return account.getId();
    }

    /**
     * AccountLink d'onboarding hébergé Stripe pour le flux MOBILE (les composants
     * embarqués @stripe/connect-js sont web-only). Même pattern que
     * {@code StripeConnectService.generateOnboardingLink} des owners : URLs
     * configurables, compte Express créé si absent. Appels Stripe hors transaction.
     */
    public String generateOnboardingLink(User user, Long orgId) throws StripeException {
        String accountId = ensureExpressAccount(user, orgId);
        AccountLinkCreateParams params = AccountLinkCreateParams.builder()
                .setAccount(accountId)
                .setRefreshUrl(proRefreshUrl)
                .setReturnUrl(proReturnUrl)
                .setType(AccountLinkCreateParams.Type.ACCOUNT_ONBOARDING)
                .build();
        AccountLink link = stripeGateway.createAccountLink(params);
        return link.getUrl();
    }


    @Transactional(readOnly = true)
    public Optional<HousekeeperPayoutConfig> getConfig(Long userId, Long orgId) {
        return configRepository.findByUserIdAndOrganizationId(userId, orgId);
    }

    /**
     * Rafraîchit le statut d'onboarding depuis Stripe (complément du webhook
     * account.updated — utile au retour du composant embarqué). Appel Stripe
     * hors transaction, persistance ensuite.
     */
    public boolean refreshOnboardingStatus(Long userId, Long orgId) throws StripeException {
        HousekeeperPayoutConfig config = configRepository
                .findByUserIdAndOrganizationId(userId, orgId)
                .orElseThrow(() -> new NotFoundException("Aucun compte de versement configuré"));
        if (config.getStripeAccountId() == null) {
            return false;
        }
        Account account = stripeGateway.retrieveAccount(config.getStripeAccountId());
        boolean complete = Boolean.TRUE.equals(account.getChargesEnabled())
                && Boolean.TRUE.equals(account.getPayoutsEnabled());
        recorder.markOnboarding(config.getId(), complete);
        return complete;
    }


    /** Webhook account.updated (dispatch depuis StripeConnectService) — compte PRO. */
    @Transactional
    public void handleAccountUpdated(String accountId, boolean chargesEnabled, boolean payoutsEnabled) {
        configRepository.findByStripeAccountId(accountId).ifPresent(config -> {
            boolean nowComplete = chargesEnabled && payoutsEnabled;
            boolean wasComplete = config.isOnboardingCompleted();
            config.setOnboardingCompleted(nowComplete);
            configRepository.save(config);
            if (!wasComplete && nowComplete) {
                log.info("Onboarding Connect housekeeper complété pour le compte {}", accountId);
            }
        });
    }

    // ─── Preuve de fin de mission ───────────────────────────────────────────────

    /**
     * Preuve de fin de mission (v1) : <b>au moins une photo de phase AFTER
     * réellement persistée</b> — signal le plus solide disponible (ligne en base
     * avec binaire/S3), contrairement aux champs déclaratifs du mobile
     * (completedSteps/progressPercentage, JSON libres). Méthode isolée : le
     * critère évoluera ici (checklist structurée, quorum de pièces, etc.).
     */
    public boolean isProofComplete(Intervention intervention) {
        if (intervention.getId() == null || intervention.getOrganizationId() == null) {
            return false;
        }
        return !interventionPhotoRepository.findByInterventionIdAndPhaseOrderByCreatedAtAsc(
                intervention.getId(), InterventionPhoto.PhotoPhase.AFTER,
                intervention.getOrganizationId()).isEmpty();
    }

    // ─── Payout à la complétion validée ─────────────────────────────────────────

    /**
     * Déclenché à la COMPLÉTION d'une intervention ménage (host déjà payé dans ce
     * flux). Best-effort du point de vue de l'appelant : ne bloque jamais la
     * complétion — mais chaque refus laisse un record BLOCKED motivé.
     */
    public void processPayoutForIntervention(Intervention intervention) {
        try {
            if (!isCleaningType(intervention) || intervention.getAssignedUser() == null) {
                return; // pas un cas payout (équipe, maintenance…) — pas de record.
            }
            if (intervention.getPaymentStatus() != PaymentStatus.PAID) {
                log.info("Payout intervention {} différé : paiement host non acquis ({})",
                        intervention.getId(), intervention.getPaymentStatus());
                return;
            }

            Long orgId = intervention.getOrganizationId();
            User pro = intervention.getAssignedUser();

            // Gate 1 : preuve photo.
            if (!isProofComplete(intervention)) {
                recorder.insertRecord(intervention, pro, BigDecimal.ZERO, BigDecimal.ZERO,
                        Status.BLOCKED, HousekeeperPayoutRecord.REASON_PROOF_MISSING);
                return;
            }

            // Gate 2 : onboarding Connect complet.
            HousekeeperPayoutConfig config = configRepository
                    .findByUserIdAndOrganizationId(pro.getId(), orgId).orElse(null);
            if (config == null || config.getStripeAccountId() == null || !config.isOnboardingCompleted()) {
                boolean created = recorder.insertRecord(intervention, pro, BigDecimal.ZERO, BigDecimal.ZERO,
                        Status.BLOCKED, HousekeeperPayoutRecord.REASON_ONBOARDING_INCOMPLETE);
                if (created && pro.getKeycloakId() != null) {
                    notificationService.send(pro.getKeycloakId(), NotificationKey.PAYOUT_BLOCKED_ONBOARDING,
                            "Versement en attente",
                            "Votre versement pour la mission '" + intervention.getTitle()
                                    + "' est en attente : configurez votre compte de versement dans Réglages > Mes versements.",
                            "/settings?tab=my-payouts-pro", orgId);
                }
                return;
            }

            // Montant : rémunération résolue (actualCost sinon estimatedCost) − commission.
            BigDecimal gross = intervention.getActualCost() != null
                    ? intervention.getActualCost() : intervention.getEstimatedCost();
            if (gross == null || gross.compareTo(BigDecimal.ZERO) <= 0) {
                recorder.insertRecord(intervention, pro, BigDecimal.ZERO, BigDecimal.ZERO,
                        Status.BLOCKED, "AMOUNT_NOT_POSITIVE");
                return;
            }
            BigDecimal commission = commissionFor(gross);
            BigDecimal net = gross.subtract(commission).setScale(2, RoundingMode.HALF_UP);
            if (net.compareTo(BigDecimal.ZERO) <= 0) {
                recorder.insertRecord(intervention, pro, net.max(BigDecimal.ZERO), commission,
                        Status.BLOCKED, "AMOUNT_NOT_POSITIVE");
                return;
            }

            // Préparation en transaction courte : record PENDING. La contrainte UNIQUE
            // est le verrou anti-double-payout (insert concurrent → violation → stop).
            if (!recorder.insertRecord(intervention, pro, net, commission, Status.PENDING, null)) {
                return; // déjà traité (SENT/PENDING/BLOCKED existant) — aucun nouvel appel Stripe.
            }
            HousekeeperPayoutRecord record = recordRepository
                    .findByInterventionId(intervention.getId())
                    .orElseThrow(() -> new IllegalStateException("Record payout introuvable après insert"));

            // Transfert Stripe APRÈS COMMIT — jamais dans la transaction appelante.
            scheduleTransferAfterCommit(record.getId(), intervention.getId(),
                    intervention.getTitle(), net, config.getStripeAccountId(),
                    pro.getKeycloakId(), orgId);
        } catch (Exception e) {
            // Jamais bloquer la complétion — mais tracer + alerter (pas de catch avaleur
            // silencieux : les admins sont notifiés qu'une réconciliation est requise).
            log.error("Payout intervention {} : erreur inattendue : {}", intervention.getId(), e.getMessage(), e);
            notifyAdminsFailure(intervention.getId(), intervention.getTitle(), null, e.getMessage());
        }
    }

    /** Relance manuelle admin d'un record FAILED ou BLOCKED (re-gate complet). */
    public HousekeeperPayoutRecord retryPayout(Long recordId, Long orgId) {
        HousekeeperPayoutRecord record = recordRepository.findById(recordId)
                .orElseThrow(() -> new NotFoundException("Versement non trouvé"));
        if (!record.getOrganizationId().equals(orgId)) {
            throw new org.springframework.security.access.AccessDeniedException("Versement hors organisation");
        }
        if (record.getStatus() == Status.SENT || record.getStatus() == Status.PENDING) {
            return record; // rien à relancer — aucun nouvel appel Stripe.
        }

        Intervention intervention = interventionRepository.findById(record.getInterventionId())
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));
        User pro = intervention.getAssignedUser();
        HousekeeperPayoutConfig config = pro != null
                ? configRepository.findByUserIdAndOrganizationId(pro.getId(), orgId).orElse(null) : null;

        // Re-gate complet (la situation a pu évoluer : photo ajoutée, onboarding fini).
        if (pro == null || !isProofComplete(intervention)
                || config == null || config.getStripeAccountId() == null || !config.isOnboardingCompleted()) {
            throw new IllegalStateException("Conditions du versement toujours non réunies (preuve/onboarding)");
        }
        BigDecimal gross = intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost();
        if (gross == null || gross.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("Montant de versement non positif");
        }
        BigDecimal commission = commissionFor(gross);
        BigDecimal net = gross.subtract(commission).setScale(2, RoundingMode.HALF_UP);
        if (net.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("Montant net non positif après commission");
        }

        // CAS FAILED|BLOCKED → PENDING (le montant est refixé au passage).
        int updated = recorder.requeueRecord(record.getId(), record.getStatus(), net, commission);
        if (updated == 0) {
            return recordRepository.findById(recordId).orElse(record); // concurrent — état actuel.
        }
        scheduleTransferAfterCommit(record.getId(), intervention.getId(), intervention.getTitle(),
                net, config.getStripeAccountId(), pro.getKeycloakId(), orgId);
        return recordRepository.findById(recordId).orElse(record);
    }


    @Transactional(readOnly = true)
    public List<HousekeeperPayoutRecord> listRecordsForUser(Long userId, Long orgId) {
        return recordRepository.findByUserIdAndOrganizationIdOrderByCreatedAtDesc(userId, orgId);
    }

    @Transactional(readOnly = true)
    public List<HousekeeperPayoutRecord> listRecordsForOrg(Long orgId) {
        return recordRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId);
    }

    // ─── Internes ───────────────────────────────────────────────────────────────

    private static boolean isCleaningType(Intervention intervention) {
        String type = intervention.getType();
        return type != null && (type.equals(InterventionType.CLEANING.name())
                || type.equals(InterventionType.EXPRESS_CLEANING.name())
                || type.equals(InterventionType.DEEP_CLEANING.name()));
    }

    /**
     * Commission de la catégorie « entretien » du commissionConfigs (Tarification).
     * Désactivée par défaut : absente ou {@code enabled=false} → zéro.
     */
    BigDecimal commissionFor(BigDecimal gross) {
        try {
            List<PricingConfigDto.CommissionConfig> configs =
                    pricingConfigService.getCurrentConfig().getCommissionConfigs();
            if (configs == null) return BigDecimal.ZERO;
            return configs.stream()
                    .filter(c -> COMMISSION_CATEGORY.equals(c.getCategory()) && c.isEnabled()
                            && c.getRate() != null && c.getRate() > 0)
                    .findFirst()
                    .map(c -> gross.multiply(BigDecimal.valueOf(c.getRate()))
                            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP))
                    .orElse(BigDecimal.ZERO);
        } catch (Exception e) {
            // Une erreur de config ne doit pas surfacturer le pro : commission zéro + log.
            log.warn("Lecture commissionConfigs impossible, commission ignorée : {}", e.getMessage());
            return BigDecimal.ZERO;
        }
    }


    /**
     * Programme le transfert Stripe APRÈS COMMIT de la transaction courante
     * (ou immédiatement si aucune transaction active — ex. retry admin hors tx).
     */
    private void scheduleTransferAfterCommit(Long recordId, Long interventionId, String title,
                                             BigDecimal net, String stripeAccountId,
                                             String proKeycloakId, Long orgId) {
        Runnable transfer = () -> executeTransfer(recordId, interventionId, title, net,
                stripeAccountId, proKeycloakId, orgId);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    transfer.run();
                }
            });
        } else {
            transfer.run();
        }
    }

    /**
     * Exécute le transfert Stripe (HORS transaction) puis persiste le résultat par
     * UPDATE CONDITIONNEL dans une nouvelle transaction. Idempotency key stable
     * par intervention : un retry réseau ne crée jamais deux transferts.
     */
    void executeTransfer(Long recordId, Long interventionId, String title, BigDecimal net,
                         String stripeAccountId, String proKeycloakId, Long orgId) {
        try {
            // Versement Stripe Connect via l'adaptateur partagé (plus de types Stripe ici).
            // Le versement ménage reste Stripe-Connect-only par design (HousekeeperPayoutConfig
            // ne porte que stripeAccountId) — cf. doc §7 flux Stripe-only.
            String transferId = transferClient.createTransfer(
                    net, "eur", stripeAccountId,
                    "Versement mission ménage #" + interventionId,
                    "payout-intervention-" + interventionId);

            int updated = recorder.markSent(recordId, transferId);
            if (updated > 0 && proKeycloakId != null) {
                notificationService.send(proKeycloakId, NotificationKey.PAYOUT_SENT,
                        "Versement envoyé",
                        "Votre versement de " + net.stripTrailingZeros().toPlainString()
                                + " EUR pour la mission '" + title + "' a été envoyé.",
                        "/settings?tab=my-payouts-pro", orgId);
            }
            log.info("Payout intervention {} : transfert {} envoyé ({} EUR)", interventionId, transferId, net);
        } catch (StripeException e) {
            log.error("Payout intervention {} : transfert Stripe en échec : {}", interventionId, e.getMessage());
            recorder.markFailed(recordId, e.getMessage());
            notifyAdminsFailure(recordId, interventionId, title, net, e.getMessage());
        }
    }



    private void notifyAdminsFailure(Long interventionId, String title, BigDecimal amount, String reason) {
        notifyAdminsFailure(null, interventionId, title, amount, reason);
    }

    /**
     * Alerte admins/managers d'un versement prestataire en échec. Deep-link : quand le
     * record existe ({@code recordId != null}, échec du transfert Stripe), pointe vers la
     * vue admin des versements prestataires (onglet Facturation) avec surlignage de la
     * ligne pour une relance en un clic ; sinon, repli sur l'intervention.
     */
    private void notifyAdminsFailure(Long recordId, Long interventionId, String title,
                                     BigDecimal amount, String reason) {
        try {
            String actionUrl = recordId != null
                    ? "/billing?tab=housekeeper-payouts&highlight=" + recordId
                    : "/interventions/" + interventionId;
            notificationService.notifyAdminsAndManagers(NotificationKey.PAYOUT_FAILED,
                    "Versement prestataire en échec",
                    "Le versement" + (amount != null ? " de " + amount.stripTrailingZeros().toPlainString() + " EUR" : "")
                            + " pour la mission '" + title + "' (intervention #" + interventionId
                            + ") a échoué : " + reason + ". Relance manuelle requise.",
                    actionUrl);
        } catch (Exception e) {
            log.error("Notification PAYOUT_FAILED impossible pour l'intervention {} : {}", interventionId, e.getMessage());
        }
    }
}
