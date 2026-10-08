package com.clenzy.service.payout;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.dto.HousekeeperPayoutDtos.RetryQuote;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.HousekeeperPayoutConfig;
import com.clenzy.model.HousekeeperPayoutRecord;
import com.clenzy.model.HousekeeperPayoutRecord.Status;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionPhoto;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.User;
import com.clenzy.model.PayoutBeneficiary;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.HousekeeperPayoutConfigRepository;
import com.clenzy.repository.HousekeeperPayoutRecordRepository;
import com.clenzy.repository.InterventionPhotoRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.NotificationMetadata;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

/**
 * Versements Stripe Connect des prestataires de tous les métiers Baitly.
 * Le nom technique historique reste conservé pour les intégrations existantes.
 *
 * <p>Une mission doit être terminée, encaissée avec ses éventuels remboursements rapprochés et justifiée par une
 * pièce de réalisation. Le compte du bénéficiaire doit être prêt. Les ordres sont
 * uniques par intervention, puis émis après commit à travers le journal commun.
 * Un résultat PSP incertain exige un rapprochement, sans nouvelle émission.</p>
 * <p>La commission est celle de la catégorie du catalogue. Ce circuit conserve
 * son périmètre EUR ; une organisation bénéficiaire doit être désignée explicitement,
 * sans inventer un destinataire ni convertir le montant.</p>
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
    private final ProviderPayoutPolicy payoutPolicy;
    private final ProviderPayoutAccountResolver payoutAccounts;
    private final ProviderPayoutBeneficiaryService beneficiaries;
    private final ProviderPayoutMissionReader missionReader;
    private final com.clenzy.payment.payout.StripeConnectTransferClient transferClient;
    /** Execution post-commit HORS transaction (voir {@link #scheduleTransferAfterCommit}). */
    private final TransactionTemplate outsideTransaction;

    public HousekeeperPayoutService(HousekeeperPayoutConfigRepository configRepository,
                                    HousekeeperPayoutRecordRepository recordRepository,
                                    InterventionRepository interventionRepository,
                                    InterventionPhotoRepository interventionPhotoRepository,
                                    UserRepository userRepository,
                                    StripeGateway stripeGateway,
                                    PricingConfigService pricingConfigService,
                                    NotificationService notificationService,
                                    HousekeeperPayoutRecorder recorder,
                                    ProviderPayoutPolicy payoutPolicy,
                                    ProviderPayoutAccountResolver payoutAccounts,
                                    ProviderPayoutBeneficiaryService beneficiaries,
                                    ProviderPayoutMissionReader missionReader,
                                    com.clenzy.payment.payout.StripeConnectTransferClient transferClient,
                                    PlatformTransactionManager transactionManager) {
        this.configRepository = configRepository;
        this.recordRepository = recordRepository;
        this.interventionRepository = interventionRepository;
        this.interventionPhotoRepository = interventionPhotoRepository;
        this.userRepository = userRepository;
        this.stripeGateway = stripeGateway;
        this.pricingConfigService = pricingConfigService;
        this.notificationService = notificationService;
        this.recorder = recorder;
        this.payoutPolicy = payoutPolicy;
        this.payoutAccounts = payoutAccounts;
        this.beneficiaries = beneficiaries;
        this.missionReader = missionReader;
        this.transferClient = transferClient;
        this.outsideTransaction = new TransactionTemplate(transactionManager);
        this.outsideTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_NOT_SUPPORTED);
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
     * persistance déléguée à {@link HousekeeperPayoutRecorder#persistAccountId}).
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
        log.info("Compte Connect Express {} créé pour le prestataire {}", account.getId(), user.getId());
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
                log.info("Onboarding Connect prestataire complété pour le compte {}", accountId);
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
     * Déclenché à la complétion d'une prestation, quel que soit son métier. Best-effort du point de vue de l'appelant : ne bloque jamais la
     * complétion. Un refus laisse un record BLOCKED motivé quand le bénéficiaire
     * est identifié ; sinon, la plateforme reçoit une alerte sans inventer de bénéficiaire.
     */
    public void processPayoutForIntervention(Intervention intervention) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            Long missionId = intervention.getId();
            Long orgId = intervention.getOrganizationId();
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() {
                    outsideTransaction.executeWithoutResult(status -> processCompletedMission(missionId, orgId));
                }
            });
            return;
        }
        processCommittedIntervention(intervention);
    }

    public void processCompletedMission(Long missionId, Long orgId) {
        Intervention mission;
        try {
            mission = missionReader.load(missionId, orgId);
        } catch (RuntimeException failure) {
            // La mission ou le choix du bénéficiaire est déjà commité : une lecture
            // indisponible ne doit pas faire croire à l'appelant que sa validation a échoué.
            log.error("Lecture du versement de l'intervention {} impossible après validation", missionId, failure);
            notifyAdminsFailure(missionId, "#" + missionId, null,
                    "Impossible de vérifier la mission après validation. Aucun transfert émis par cette tentative");
            return;
        }
        if (mission.getStatus() == com.clenzy.model.InterventionStatus.COMPLETED) processCommittedIntervention(mission);
    }

    private void processCommittedIntervention(Intervention intervention) {
        try {
            var recipient = beneficiaries.resolve(intervention.getId(), intervention.getOrganizationId()).orElse(null);
            if (recipient == null) {
                notifyAdminsFailure(intervention.getId(), intervention.getTitle(), null,
                        "Bénéficiaire de versement à désigner pour cette équipe. Aucun paiement envoyé à un membre par défaut");
                return;
            }
            PayoutBeneficiary beneficiary = recipient.beneficiary();
            String blockingReason = payoutPolicy.blockingReason(intervention);
            if (blockingReason != null) {
                recorder.insertRecord(intervention, beneficiary, BigDecimal.ZERO, BigDecimal.ZERO,
                        Status.BLOCKED, blockingReason);
                return;
            }

            Long orgId = intervention.getOrganizationId();

            // Gate 1 : preuve photo.
            if (!isProofComplete(intervention)) {
                recorder.insertRecord(intervention, beneficiary, BigDecimal.ZERO, BigDecimal.ZERO,
                        Status.BLOCKED, HousekeeperPayoutRecord.REASON_PROOF_MISSING);
                return;
            }

            // Gate 2 : onboarding Connect complet.
            HousekeeperPayoutConfig config = payoutAccounts.resolve(intervention, beneficiary).orElse(null);
            if (config == null || config.getStripeAccountId() == null || !config.isOnboardingCompleted()) {
                boolean created = recorder.insertRecord(intervention, beneficiary, BigDecimal.ZERO, BigDecimal.ZERO,
                        Status.BLOCKED, HousekeeperPayoutRecord.REASON_ONBOARDING_INCOMPLETE);
                if (created && recipient.notificationSubject() != null) {
                    notificationService.send(recipient.notificationSubject(), NotificationKey.PAYOUT_BLOCKED_ONBOARDING,
                            "Versement en attente",
                            "Votre versement pour la mission '" + intervention.getTitle()
                                    + "' est en attente : configurez votre compte de versement dans Réglages > Mes versements.",
                            "/settings?tab=my-payouts-pro", orgId,
                            NotificationMetadata.of()
                                    .intervention(intervention.getTitle())
                                    .interventionId(intervention.getId())
                                    .build());
                }
                return;
            }

            // Après remboursement, la commission s'applique uniquement au montant conservé.
            BigDecimal gross = payoutPolicy.payableGross(intervention);
            if (gross == null || gross.compareTo(BigDecimal.ZERO) <= 0) {
                recorder.insertRecord(intervention, beneficiary, BigDecimal.ZERO, BigDecimal.ZERO,
                        Status.BLOCKED, "AMOUNT_NOT_POSITIVE");
                return;
            }
            BigDecimal commission = commissionFor(gross, payoutPolicy.commissionCategory(intervention));
            BigDecimal net = gross.subtract(commission).setScale(2, RoundingMode.HALF_UP);
            if (net.compareTo(BigDecimal.ZERO) <= 0) {
                recorder.insertRecord(intervention, beneficiary, net.max(BigDecimal.ZERO), commission,
                        Status.BLOCKED, "AMOUNT_NOT_POSITIVE");
                return;
            }

            // Préparation en transaction courte : le verrou partagé fige le bénéficiaire
            // avec la décision plateforme ; la contrainte UNIQUE protège aussi la mission.
            if (!recorder.insertRecord(intervention, beneficiary, net, commission, Status.PENDING, null)) {
                return; // déjà traité (SENT/PENDING/BLOCKED existant) — aucun nouvel appel Stripe.
            }
            HousekeeperPayoutRecord record = recordRepository
                    .findByInterventionId(intervention.getId())
                    .orElseThrow(() -> new IllegalStateException("Record payout introuvable après insert"));

            // Transfert Stripe APRÈS COMMIT — jamais dans la transaction appelante.
            executeTransfer(record.getId(), intervention.getId(),
                    intervention.getTitle(), net, config.getStripeAccountId(),
                    recipient.notificationSubject(), orgId);
        } catch (Exception e) {
            // Jamais bloquer la complétion — mais tracer + alerter (pas de catch avaleur
            // silencieux : les admins sont notifiés qu'une réconciliation est requise).
            log.error("Payout intervention {} : erreur inattendue : {}", intervention.getId(), e.getMessage(), e);
            notifyAdminsFailure(intervention.getId(), intervention.getTitle(), null, e.getMessage());
        }
    }

    /** La lecture de cet aperçu ne réserve ni ne transfère aucun montant. */
    public RetryQuote previewRetry(Long recordId, Long orgId) {
        var plan = prepareRetry(requireRetryRecord(recordId, orgId), orgId);
        return new RetryQuote(plan.net(), plan.commission());
    }

    /** Relance interne avec revalidation complète (automatisations autorisées). */
    public HousekeeperPayoutRecord retryPayout(Long recordId, Long orgId) {
        return retryPayout(recordId, orgId, null);
    }

    /** Une décision interactive ne peut pas verser un montant différent de son aperçu. */
    public HousekeeperPayoutRecord retryPayout(Long recordId, Long orgId, RetryQuote expected) {
        var record = requireRetryRecord(recordId, orgId);
        if (record.getStatus() == Status.SENT || record.getStatus() == Status.PENDING) return record;
        var plan = prepareRetry(record, orgId);
        if (expected != null && (expected.amount() == null || expected.commissionAmount() == null
                || expected.amount().compareTo(plan.net()) != 0
                || expected.commissionAmount().compareTo(plan.commission()) != 0)) {
            throw new com.clenzy.exception.BaitlyPayoutNotReadyException(
                    "Le montant a changé. Vérifiez le nouvel aperçu avant de confirmer.");
        }
        int updated = recorder.requeueRecord(record.getId(), record.getStatus(), plan.net(), plan.commission());
        if (updated == 0) return recordRepository.findById(recordId).orElse(record);
        scheduleTransferAfterCommit(record.getId(), plan.intervention().getId(), plan.intervention().getTitle(),
                plan.net(), plan.config().getStripeAccountId(), plan.notificationSubject(), orgId);
        return recordRepository.findById(recordId).orElse(record);
    }

    private HousekeeperPayoutRecord requireRetryRecord(Long recordId, Long orgId) {
        var record = recordRepository.findById(recordId)
                .orElseThrow(() -> new NotFoundException("Versement non trouvé"));
        if (!orgId.equals(record.getOrganizationId()))
            throw new org.springframework.security.access.AccessDeniedException("Versement hors organisation");
        return record;
    }

    private record RetryPlan(Intervention intervention, HousekeeperPayoutConfig config,
                             String notificationSubject, BigDecimal net, BigDecimal commission) { }

    private RetryPlan prepareRetry(HousekeeperPayoutRecord record, Long orgId) {
        if ((record.getStatus() != Status.BLOCKED && record.getStatus() != Status.FAILED)
                || record.getStripeTransferId() != null || "RECONCILIATION_REQUIRED".equals(record.getFailureReason()))
            throw new com.clenzy.exception.BaitlyPayoutNotReadyException("Le transfert existant doit être rapproché avant toute relance.");
        // La décision s'appuie sur un état commité dont les relations nécessaires
        // sont chargées avant de sortir de la transaction de lecture.
        Intervention intervention = missionReader.load(record.getInterventionId(), orgId);
        if (!orgId.equals(intervention.getOrganizationId())) {
            throw new org.springframework.security.access.AccessDeniedException("Intervention hors organisation");
        }
        var recipient = beneficiaries.resolve(intervention.getId(), orgId).orElse(null);
        if (recipient == null || !record.beneficiary().equals(recipient.beneficiary())) {
            throw new com.clenzy.exception.BaitlyPayoutNotReadyException("Le bénéficiaire ou l'organisation de la mission a changé. Rapprochement requis.");
        }
        String blockingReason = payoutPolicy.blockingReason(intervention);
        if (blockingReason != null) {
            throw new com.clenzy.exception.BaitlyPayoutNotReadyException("Conditions de versement non réunies : " + blockingReason);
        }
        HousekeeperPayoutConfig config = payoutAccounts.resolve(intervention, recipient.beneficiary()).orElse(null);

        // Re-gate complet (la situation a pu évoluer : photo ajoutée, onboarding fini).
        if (!isProofComplete(intervention)
                || config == null || config.getStripeAccountId() == null || !config.isOnboardingCompleted()) {
            throw new com.clenzy.exception.BaitlyPayoutNotReadyException("Conditions du versement toujours non réunies (preuve/onboarding)");
        }
        BigDecimal gross = payoutPolicy.payableGross(intervention);
        if (gross == null || gross.compareTo(BigDecimal.ZERO) <= 0) {
            throw new com.clenzy.exception.BaitlyPayoutNotReadyException("Montant de versement non positif");
        }
        BigDecimal commission = commissionFor(gross, payoutPolicy.commissionCategory(intervention));
        BigDecimal net = gross.subtract(commission).setScale(2, RoundingMode.HALF_UP);
        if (net.compareTo(BigDecimal.ZERO) <= 0) {
            throw new com.clenzy.exception.BaitlyPayoutNotReadyException("Montant net non positif après commission");
        }

        return new RetryPlan(intervention, config, recipient.notificationSubject(), net, commission);
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


    /**
     * Commission de la catégorie « entretien » du commissionConfigs (Tarification).
     * Désactivée par défaut : absente ou {@code enabled=false} → zéro.
     */
    BigDecimal commissionFor(BigDecimal gross) {
        return commissionFor(gross, COMMISSION_CATEGORY);
    }

    BigDecimal commissionFor(BigDecimal gross, String category) {
        try {
            List<PricingConfigDto.CommissionConfig> configs =
                    pricingConfigService.getCurrentConfig().getCommissionConfigs();
            if (configs == null) return BigDecimal.ZERO;
            return configs.stream()
                    .filter(c -> category.equals(c.getCategory()) && c.isEnabled()
                            && c.getRate() != null && c.getRate() > 0)
                    .findFirst()
                    .map(c -> gross.multiply(BigDecimal.valueOf(c.getRate()))
                            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP))
                    .orElse(BigDecimal.ZERO);
        } catch (Exception e) {
            throw new IllegalStateException("Commission indisponible, versement suspendu.", e);
        }
    }


    /**
     * Programme le transfert Stripe APRÈS COMMIT de la transaction courante
     * (ou immédiatement si aucune transaction active — ex. retry admin hors tx).
     *
     * <p>Après commit, la transaction terminée reste liée au thread : le transfert est donc
     * exécuté en NOT_SUPPORTED. Sans cette suspension, les notifications du versement
     * (REQUIRED) rejoindraient la transaction commitée et ne seraient jamais écrites.</p>
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
                    outsideTransaction.executeWithoutResult(status -> transfer.run());
                }
            });
        } else {
            transfer.run();
        }
    }

    /**
     * Exécute le transfert Stripe (HORS transaction) puis persiste le résultat par
     * UPDATE CONDITIONNEL dans une nouvelle transaction. Le journal durable protège
     * aussi les relances après expiration de la clé d'idempotence Stripe.
     */
    void executeTransfer(Long recordId, Long interventionId, String title, BigDecimal net,
                         String stripeAccountId, String proKeycloakId, Long orgId) {
        try {
            // Versement Stripe Connect via l'adaptateur partagé (plus de types Stripe ici).
            // Le circuit hérité est partagé par tous les prestataires, avec une devise EUR explicite.
            HousekeeperPayoutRecord persisted = recordRepository.findById(recordId)
                    .orElseThrow(() -> new IllegalStateException("Versement prestataire introuvable."));
            if (!orgId.equals(persisted.getOrganizationId()) || !interventionId.equals(persisted.getInterventionId())
                    || persisted.getAmount().compareTo(net) != 0) {
                throw new IllegalStateException("Le versement prestataire ne correspond pas à la mission.");
            }
            String transferId = transferClient.createTransfer(new PayoutTransferInstruction(
                    orgId, com.clenzy.model.PayoutTransfer.Source.INTERVENTION, interventionId, persisted.getUserId(),
                    persisted.getBeneficiaryOrganizationId(), net, "EUR", stripeAccountId, "Versement prestation #" + interventionId));

            int updated = recorder.markSent(recordId, transferId);
            if (updated > 0 && proKeycloakId != null) {
                notificationService.send(proKeycloakId, NotificationKey.PAYOUT_SENT,
                        "Versement envoyé",
                        "Votre versement de " + net.stripTrailingZeros().toPlainString()
                                + " EUR pour la mission '" + title + "' a été envoyé.",
                        "/settings?tab=my-payouts-pro", orgId,
                        NotificationMetadata.of()
                                .interventionId(interventionId)
                                .amount(net, "EUR")
                                .build());
            }
            log.info("Payout intervention {} : transfert {} envoyé ({} EUR)", interventionId, transferId, net);
        } catch (PayoutFundsUnavailableException e) {
            recorder.markFailed(recordId, e.getMessage());
            notifyAdminsFailure(recordId, interventionId, title, net, e.getMessage());
        } catch (PayoutReconciliationRequiredException e) {
            notifyAdminsFailure(recordId, interventionId, title, net, e.getMessage());
            try {
                recorder.markReconciliationRequired(recordId);
            } catch (RuntimeException persistenceFailure) {
                // Le journal a déjà réservé l'ordre : même si ce statut local échoue,
                // il interdit une nouvelle émission et l'alerte doit rester tentée.
                e.addSuppressed(persistenceFailure);
                throw e;
            }
        } catch (StripeException e) {
            log.error("Payout intervention {} : transfert Stripe en échec : {}", interventionId, e.getMessage());
            recorder.markFailed(recordId, e.getMessage());
            notifyAdminsFailure(recordId, interventionId, title, net, e.getMessage());
        } catch (RuntimeException e) {
            // Le journal peut déjà contenir un transfert confirmé alors que markSent a échoué.
            notifyAdminsFailure(recordId, interventionId, title, net,
                    "Enregistrement du versement à rapprocher. Aucune réémission automatique.");
            throw e;
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
                    "Versement prestataire à vérifier",
                    "Le versement" + (amount != null ? " de " + amount.stripTrailingZeros().toPlainString() + " EUR" : "")
                            + " pour la mission '" + title + "' (intervention #" + interventionId
                            + ") nécessite une vérification : " + reason + ". Vérifiez son état avant toute relance.",
                    actionUrl);
        } catch (Exception e) {
            log.error("Notification PAYOUT_FAILED impossible pour l'intervention {} : {}", interventionId, e.getMessage());
        }
    }
}
