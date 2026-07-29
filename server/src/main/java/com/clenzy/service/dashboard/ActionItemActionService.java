package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.dto.IssueDtos.DismissIssueRequest;
import com.clenzy.model.ActionItem;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.dto.PayoutRecapDto;
import com.clenzy.model.OutboxEvent;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.User;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.InterventionLifecycleService;
import com.clenzy.service.InterventionService;
import com.clenzy.service.PropertyTeamService;
import com.clenzy.util.InterventionTypeMatcher;
import com.clenzy.repository.OutboxEventRepository;
import com.clenzy.service.AccountingService;
import com.clenzy.service.IssueService;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.service.ReservationService;
import com.clenzy.service.messaging.AutomationEvaluationService;
import com.clenzy.service.OrganizationInvitationService;
import com.clenzy.service.SecurityDepositPaymentService;
import org.springframework.security.oauth2.jwt.Jwt;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.GuestMessageLog;
import com.clenzy.repository.ActionItemRepository;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.repository.GuestMessageLogRepository;
import com.clenzy.service.DocumentGenerationPipeline;
import com.clenzy.service.DocumentGenerationPipeline.GenerationCommand;
import com.clenzy.service.messaging.GuestMessagingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Les gestes qu'on peut faire depuis la carte d'une action, sans quitter le
 * tableau de bord.
 *
 * <p>Une file d'actions ne sert à rien si chaque ligne oblige à partir chercher
 * l'écran qui porte le geste — c'est-à-dire à savoir déjà ce que la file vient
 * de nous apprendre. Ce service est le point unique où ces gestes s'exécutent.</p>
 *
 * <p><b>Un point d'entrée, pas dix.</b> Chaque geste délègue au service métier
 * qui le porte réellement ; ici on ne fait que router, après avoir vérifié une
 * fois pour toutes que l'action appartient bien à l'organisation du demandeur.
 * Dix endpoints auraient signifié dix vérifications à ne pas oublier.</p>
 *
 * <p><b>Deux gestes ne sont pas de simples changements d'état</b>, et passent
 * par un chemin écrit pour eux :</p>
 *
 * <ul>
 *   <li><b>Confirmer une réservation</b> réserve les jours au calendrier et
 *       échoue si les dates sont déjà prises. Poser le statut à la main aurait
 *       produit exactement la surréservation que tout le reste du système
 *       s'emploie à éviter.</li>
 *   <li><b>Rejouer une automatisation</b> ne réexécute que la règle qui a
 *       échoué. Le point d'entrée habituel réévalue toutes les règles du
 *       déclencheur, et renverrait les messages de celles qui avaient
 *       abouti.</li>
 * </ul>
 *
 * <p><b>Aucun envoi n'est fait dans une transaction ouverte par ce service.</b>
 * Un envoi est un appel réseau : le tenir dans une transaction la garde ouverte
 * pendant toute sa durée, et une lenteur du fournisseur devient une saturation
 * du pool de connexions. Les lectures se suffisent de la transaction du
 * repository ; l'envoi gère la sienne, en aval.</p>
 */
@Service
public class ActionItemActionService {

    private static final Logger log = LoggerFactory.getLogger(ActionItemActionService.class);

    /** Duree du verrou anti double-clic : le temps qu'un geste aboutisse. */
    private static final Duration GESTURE_LOCK = Duration.ofSeconds(20);

    private final ActionItemRepository actionItemRepository;
    private final DocumentGenerationRepository documentGenerationRepository;
    private final GuestMessageLogRepository guestMessageLogRepository;
    private final DocumentGenerationPipeline documentGenerationPipeline;
    private final GuestMessagingService guestMessagingService;
    private final OutboxEventRepository outboxEventRepository;
    private final NoiseAlertService noiseAlertService;
    private final AccountingService accountingService;
    private final SecurityDepositPaymentService securityDepositPaymentService;
    private final OrganizationInvitationService invitationService;
    private final IssueService issueService;
    private final StringRedisTemplate redisTemplate;
    private final ReservationService reservationService;
    private final AutomationEvaluationService automationEvaluationService;
    private final InterventionRepository interventionRepository;
    private final InterventionService interventionService;
    private final PropertyTeamService propertyTeamService;
    private final InterventionLifecycleService interventionLifecycleService;
    private final OwnerPayoutRepository ownerPayoutRepository;
    private final UserRepository userRepository;
    private final OwnerPayoutConfigRepository ownerPayoutConfigRepository;
    private final ProviderExpenseRepository providerExpenseRepository;
    private final ReservationRepository reservationRepository;

    public ActionItemActionService(ActionItemRepository actionItemRepository,
                                  DocumentGenerationRepository documentGenerationRepository,
                                  GuestMessageLogRepository guestMessageLogRepository,
                                  DocumentGenerationPipeline documentGenerationPipeline,
                                  GuestMessagingService guestMessagingService,
                                  OutboxEventRepository outboxEventRepository,
                                  NoiseAlertService noiseAlertService,
                                  AccountingService accountingService,
                                  SecurityDepositPaymentService securityDepositPaymentService,
                                  OrganizationInvitationService invitationService,
                                  IssueService issueService,
                                  StringRedisTemplate redisTemplate,
                                  ReservationService reservationService,
                                  AutomationEvaluationService automationEvaluationService,
                                  InterventionRepository interventionRepository,
                                  InterventionService interventionService,
                                  PropertyTeamService propertyTeamService,
                                  InterventionLifecycleService interventionLifecycleService,
                                  OwnerPayoutRepository ownerPayoutRepository,
                                  UserRepository userRepository,
                                  OwnerPayoutConfigRepository ownerPayoutConfigRepository,
                                  ProviderExpenseRepository providerExpenseRepository,
                                  ReservationRepository reservationRepository) {
        this.ownerPayoutRepository = ownerPayoutRepository;
        this.userRepository = userRepository;
        this.ownerPayoutConfigRepository = ownerPayoutConfigRepository;
        this.providerExpenseRepository = providerExpenseRepository;
        this.reservationRepository = reservationRepository;
        this.interventionLifecycleService = interventionLifecycleService;
        this.interventionRepository = interventionRepository;
        this.interventionService = interventionService;
        this.propertyTeamService = propertyTeamService;
        this.redisTemplate = redisTemplate;
        this.reservationService = reservationService;
        this.automationEvaluationService = automationEvaluationService;
        this.outboxEventRepository = outboxEventRepository;
        this.noiseAlertService = noiseAlertService;
        this.accountingService = accountingService;
        this.securityDepositPaymentService = securityDepositPaymentService;
        this.invitationService = invitationService;
        this.issueService = issueService;
        this.actionItemRepository = actionItemRepository;
        this.documentGenerationRepository = documentGenerationRepository;
        this.guestMessageLogRepository = guestMessageLogRepository;
        this.documentGenerationPipeline = documentGenerationPipeline;
        this.guestMessagingService = guestMessagingService;
    }

    /**
     * Exécute le geste nommé sur cette action.
     *
     * <p>Rien n'est marqué « traité » ici : ce sont les services métier qui
     * changent l'état, et le balayage suivant fera disparaître la ligne. C'est
     * ce qui garantit qu'une ligne ne disparaît que si le geste a réellement
     * abouti.</p>
     *
     * @throws IllegalStateException si le geste ne s'applique pas à cette nature
     */
    public void act(Long actionItemId, Long orgId, String action, Jwt jwt) {
        act(actionItemId, orgId, action, null, jwt);
    }

    /**
     * Variante des gestes qui visent une cible choisie par l'utilisateur —
     * aujourd'hui l'assignation d'une intervention.
     */
    public void act(Long actionItemId, Long orgId, String action, Long assigneeTeamId, Jwt jwt) {
        act(actionItemId, orgId, action, assigneeTeamId, null, jwt);
    }

    /** Variante des gestes qui portent une date — la replanification. */
    public void act(Long actionItemId, Long orgId, String action,
                    Long assigneeTeamId, LocalDateTime scheduledAt, Jwt jwt) {
        // Un second clic, ou une re-soumission du navigateur, rejouerait le
        // geste. La plupart sont anodins a repeter — acquitter deux fois une
        // alerte ne change rien — mais renvoyer une invitation en cree une
        // NOUVELLE a chaque appel, et confirmer deux fois retraverse le moteur
        // de reservation. Le verrou couvre donc tous les gestes indistinctement.
        if (!claim(actionItemId, action)) {
            throw new IllegalStateException("Ce geste vient d'etre lance : laissez-lui le temps d'aboutir");
        }
        final ActionItem item = load(actionItemId, orgId);
        final ActionItemKind kind = ActionItemKind.valueOf(item.getKind());
        final Long target = item.getTargetId();

        switch (action) {
            case "retry" -> retry(actionItemId, orgId);
            case "acknowledge" -> requireKind(kind, ActionItemKind.NOISE_ALERT_UNACKNOWLEDGED, action)
                    .run(() -> noiseAlertService.acknowledge(target, orgId, jwt.getSubject(), null));
            case "approve" -> requireKind(kind, ActionItemKind.OWNER_PAYOUT_PENDING, action)
                    .run(() -> accountingService.approvePayout(target, orgId));
            // Passe par la couche Stripe et non par la seule mise a jour en base :
            // sans cela la caution serait dite « liberee » alors que l'argent
            // resterait bloque sur la carte du voyageur.
            case "release" -> requireKind(kind, ActionItemKind.DEPOSIT_STUCK, action)
                    .run(() -> securityDepositPaymentService.releaseHold(orgId, target));
            case "resendInvitation" -> requireKind(kind, ActionItemKind.INVITATION_EXPIRED, action)
                    .run(() -> invitationService.resendInvitation(orgId, target, jwt));
            case "convert" -> requireKind(kind, ActionItemKind.ISSUE_OPEN, action)
                    .run(() -> issueService.convert(target, jwt.getSubject()));
            case "dismiss" -> requireKind(kind, ActionItemKind.ISSUE_OPEN, action)
                    .run(() -> issueService.dismiss(target, new DismissIssueRequest(null)));
            case "replay" -> requireKind(kind, ActionItemKind.OUTBOX_DEAD_LETTER, action)
                    .run(() -> replayOutbox(target, orgId));
            // Confirmer passe par le controle de conflits de calendrier : un
            // simple changement de statut aurait produit la surreservation que
            // tout le reste du systeme s'emploie a eviter.
            case "confirm" -> requireKind(kind, ActionItemKind.RESERVATION_PENDING, action)
                    .run(() -> reservationService.confirm(target, jwt.getSubject()));
            // Rejeu CIBLE : `fireTrigger` reevaluerait toutes les regles du
            // declencheur et renverrait les messages de celles qui avaient abouti.
            case "replayAutomation" -> requireKind(kind, ActionItemKind.AUTOMATION_FAILED, action)
                    .run(() -> automationEvaluationService.replayExecution(target, orgId));
            case "assign" -> requireKind(kind, ActionItemKind.INTERVENTION_UNASSIGNED, action)
                    .run(() -> assignIntervention(target, assigneeTeamId, jwt));
            // Terminer DECLENCHE le paiement du prestataire (garde par la preuve
            // photo) : la carte l'annonce, ce n'est pas un simple changement de
            // statut.
            case "complete" -> requireKind(kind, ActionItemKind.INTERVENTION_OVERDUE, action)
                    .run(() -> completeIntervention(target, jwt));
            case "cancelIntervention" -> requireKind(kind, ActionItemKind.INTERVENTION_OVERDUE, action)
                    .run(() -> interventionLifecycleService.updateStatus(target, "CANCELLED", jwt));
            case "rescheduleIntervention" ->
                    requireKind(kind, ActionItemKind.INTERVENTION_OVERDUE, action)
                    .run(() -> interventionLifecycleService.reschedule(target, scheduledAt, jwt));
            default -> throw new IllegalStateException("Geste inconnu : " + action);
        }
    }

    /**
     * Reserve ce geste pour quelques secondes.
     *
     * <p>Les fournisseurs de messagerie n'offrent aucune cle d'idempotence —
     * l'email part par SMTP, qui n'en a pas la notion, et l'API WhatsApp de Meta
     * n'en expose pas. Ce verrou ne protege donc pas d'un doublon venu du
     * reseau, mais il elimine celui qui vient de chez nous : le double-clic.</p>
     *
     * <p>Court a dessein : il empeche la repetition immediate, pas une seconde
     * decision prise en connaissance de cause dix secondes plus tard.</p>
     */
    private boolean claim(Long actionItemId, String action) {
        return Boolean.TRUE.equals(redisTemplate.opsForValue()
                .setIfAbsent("action-item:act:" + actionItemId + ":" + action, "1", GESTURE_LOCK));
    }

    /**
     * Refuse un geste applique a la mauvaise nature.
     *
     * <p>Le nom du geste vient du client : sans ce controle, « liberer la
     * caution » envoye sur un identifiant d'invitation appellerait le service
     * des cautions avec un identifiant etranger.</p>
     */
    private static Runner requireKind(ActionItemKind actual, ActionItemKind expected, String action) {
        if (actual != expected) {
            throw new IllegalStateException(
                    "Le geste " + action + " ne s'applique pas a " + actual);
        }
        return Runnable::run;
    }

    /** Petit indirect pour que le refus precede l'execution, et non l'inverse. */
    @FunctionalInterface
    private interface Runner {
        void run(Runnable action);
    }

    /**
     * Équipes qui peuvent prendre cette intervention à sa date.
     *
     * <p>La suggestion vient du même mécanisme que les prestations : il ne
     * dépend que d'un logement et d'une date, pas du type d'objet. Les équipes
     * couvrant la zone sont proposées même quand elles sont occupées — une
     * liste vide ferait croire qu'il n'existe personne, ce qui est faux et
     * bloque.</p>
     */
    @Transactional(readOnly = true)
    public PropertyTeamService.AssignableTeams assignableTeams(Long actionItemId, Long orgId) {
        final ActionItem item = load(actionItemId, orgId);
        if (!ActionItemKind.INTERVENTION_UNASSIGNED.name().equals(item.getKind())) {
            throw new IllegalStateException("Cette action ne se resout pas par une assignation");
        }
        final Intervention intervention = interventionRepository.findById(item.getTargetId())
                .filter(i -> orgId.equals(i.getOrganizationId()))
                .orElseThrow(() -> new IllegalArgumentException("Intervention introuvable"));

        // Le type requis accompagne toujours la reponse : c'est quand la liste
        // est vide qu'il compte, et c'est la que l'ecran n'avait rien a dire.
        return new PropertyTeamService.AssignableTeams(
                propertyTeamService.findAssignableTeams(
                        intervention.getProperty() == null ? null : intervention.getProperty().getId(),
                        intervention.getScheduledDate(),
                        intervention.getEstimatedDurationHours(),
                        intervention.getType(),
                        orgId),
                InterventionTypeMatcher.requiredTeamType(intervention.getType()));
    }

    /**
     * Termine l'intervention, en franchissant l'étape intermédiaire si besoin.
     *
     * <p>Seul {@code IN_PROGRESS} peut passer à {@code COMPLETED} : une
     * intervention en retard restée {@code PENDING} — le cas le plus courant —
     * serait refusée. Or le sens réel du geste est « le travail a eu lieu »,
     * donc elle a bien commencé avant de finir. On franchit donc les deux
     * marches plutôt que de renvoyer une transition invalide à quelqu'un qui
     * constate un fait.</p>
     */
    private void completeIntervention(Long interventionId, Jwt jwt) {
        final Intervention intervention = interventionRepository.findById(interventionId)
                .orElseThrow(() -> new IllegalArgumentException("Intervention introuvable"));
        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            interventionLifecycleService.startIntervention(interventionId, jwt);
        }
        interventionLifecycleService.completeIntervention(interventionId, jwt);
    }

    /**
     * Ce qu'il faut savoir avant d'approuver un reversement.
     *
     * <p>Bénéficiaire, période, détail du calcul, moyen de versement et séjours
     * couverts. Le bouton portait un montant et rien d'autre : approuver
     * plusieurs milliers d'euros sans voir à qui ils vont ni ce qu'ils
     * recouvrent n'est pas une décision.</p>
     *
     * <p>Les montants viennent du reversement <b>tel qu'il a été figé</b>, pas
     * d'un recalcul : un récapitulatif qui recalcule peut afficher un total
     * différent de celui qu'on s'apprête à approuver.</p>
     */
    @Transactional(readOnly = true)
    public PayoutRecapDto payoutRecap(Long actionItemId, Long orgId) {
        final ActionItem item = load(actionItemId, orgId);
        if (!ActionItemKind.OWNER_PAYOUT_PENDING.name().equals(item.getKind())) {
            throw new IllegalStateException("Cette action n'est pas un reversement");
        }
        final OwnerPayout payout = ownerPayoutRepository.findById(item.getTargetId())
                .filter(p -> orgId.equals(p.getOrganizationId()))
                .orElseThrow(() -> new IllegalArgumentException("Reversement introuvable"));

        final User beneficiary = userRepository.findById(payout.getOwnerId()).orElse(null);
        final OwnerPayoutConfig config = ownerPayoutConfigRepository
                .findByOwnerIdAndOrgId(payout.getOwnerId(), orgId).orElse(null);

        return new PayoutRecapDto(
                payout.getId(),
                beneficiary == null ? null : fullName(beneficiary),
                beneficiary == null ? null : beneficiary.getEmail(),
                payout.getPeriodStart(),
                payout.getPeriodEnd(),
                payout.getGrossRevenue(),
                // Le taux est stocké en fraction ; l'écran parle en pourcentage.
                payout.getCommissionRate() == null ? null
                        : payout.getCommissionRate().multiply(java.math.BigDecimal.valueOf(100)),
                payout.getCommissionAmount(),
                payout.getExpenses(),
                payout.getNetAmount(),
                payout.getCurrency(),
                config == null || config.getPayoutMethod() == null
                        ? null : config.getPayoutMethod().name(),
                describeDestination(config),
                isDestinationReady(config),
                coveredStays(payout, orgId),
                includedExpenses(payout, orgId));
    }

    /** Les séjours dont le revenu compose ce reversement. */
    private List<PayoutRecapDto.CoveredStay> coveredStays(OwnerPayout payout, Long orgId) {
        return reservationRepository.findByOwnerIdAndDateRange(
                        payout.getOwnerId(), payout.getPeriodStart(), payout.getPeriodEnd(), orgId)
                .stream()
                .map(r -> new PayoutRecapDto.CoveredStay(
                        r.getId(),
                        r.getGuestName(),
                        ActionItems.propertyName(r.getProperty()),
                        r.getCheckIn(),
                        r.getCheckOut(),
                        r.getTotalPrice()))
                .toList();
    }

    /** Les dépenses déduites — liées au reversement lors de sa génération. */
    private List<PayoutRecapDto.IncludedExpense> includedExpenses(OwnerPayout payout, Long orgId) {
        return providerExpenseRepository.findByPayoutIdAndOrgId(payout.getId(), orgId).stream()
                .map(e -> new PayoutRecapDto.IncludedExpense(
                        e.getId(),
                        e.getDescription(),
                        e.getCategory() == null ? null : e.getCategory().name(),
                        e.getExpenseDate(),
                        e.getAmountTtc()))
                .toList();
    }

    /**
     * Le compte de destination, <b>masqué</b>.
     *
     * <p>Un IBAN est chiffré en base : l'afficher en entier sur un tableau de
     * bord n'apporte rien qu'un risque. Les quatre derniers caractères
     * suffisent à reconnaître le bon compte.</p>
     */
    private static String describeDestination(OwnerPayoutConfig config) {
        if (config == null) return null;
        if (config.getStripeConnectedAccountId() != null) {
            return "Compte Stripe " + last4(config.getStripeConnectedAccountId());
        }
        if (config.getIban() != null) return "IBAN ••••" + last4(config.getIban());
        return null;
    }

    /** Vrai si un virement peut réellement partir vers ce compte. */
    private static boolean isDestinationReady(OwnerPayoutConfig config) {
        if (config == null) return false;
        if (config.getStripeConnectedAccountId() != null) {
            return config.isStripeOnboardingComplete();
        }
        return config.getIban() != null;
    }

    private static String last4(String value) {
        return value.length() <= 4 ? value : value.substring(value.length() - 4);
    }

    private static String fullName(User user) {
        return java.util.stream.Stream.of(user.getFirstName(), user.getLastName())
                .filter(part -> part != null && !part.isBlank())
                .reduce((a, b) -> a + " " + b)
                .orElse(user.getEmail());
    }

    /** Confie l'intervention à l'équipe choisie. */
    private void assignIntervention(Long interventionId, Long teamId, Jwt jwt) {
        if (teamId == null) {
            throw new IllegalStateException("Aucune equipe choisie pour l'assignation");
        }
        interventionService.assign(interventionId, null, teamId, jwt);
    }

    /**
     * Remet un message perdu en file d'attente, <b>pour cette organisation</b>.
     *
     * <p>Le rejeu en masse existant ({@code SyncAdminService.bulkRetryOutbox})
     * ne filtre pas par organisation : il ne tient que par le {@code @PreAuthorize}
     * SUPER_ADMIN de son controller. L'appeler depuis un tableau de bord
     * d'organisation aurait permis de rejouer les messages d'une autre.</p>
     */
    private void replayOutbox(Long outboxEventId, Long orgId) {
        final OutboxEvent event = outboxEventRepository.findById(outboxEventId)
                .filter(e -> orgId.equals(e.getOrganizationId()))
                .orElseThrow(() -> new IllegalArgumentException("Message introuvable"));
        event.setStatus("PENDING");
        event.setRetryCount(0);
        outboxEventRepository.save(event);
        log.info("Message outbox {} remis en file pour org={}", outboxEventId, orgId);
    }

    /**
     * Réessaie l'envoi que cette action signale.
     *
     * <p>Rien n'est marqué « traité » ici : c'est l'envoi lui-même qui met à
     * jour l'état de l'objet, et le balayage suivant fera disparaître la ligne
     * si l'envoi a réussi. Annoncer le succès avant de l'avoir constaté
     * masquerait un second échec.</p>
     *
     * @throws IllegalStateException si cette nature ne sait pas être relancée
     */
    public void retry(Long actionItemId, Long orgId) {
        final ActionItem item = load(actionItemId, orgId);
        final ActionItemKind kind = ActionItemKind.valueOf(item.getKind());

        switch (kind) {
            case DOCUMENT_DELIVERY_FAILED -> retryDocument(item.getTargetId(), orgId);
            case GUEST_MESSAGE_FAILED -> retryGuestMessage(item.getTargetId(), orgId);
            default -> throw new IllegalStateException(
                    "Cette action ne se relance pas : " + kind);
        }
    }

    /**
     * Charge l'action et vérifie qu'elle appartient bien à l'organisation.
     *
     * <p>Pas de {@code @Transactional} ici, et c'est délibéré : cette méthode
     * est appelée depuis {@link #retry}, sur la même instance. Une annotation
     * ne passerait pas par le proxy Spring et serait silencieusement sans
     * effet — un piège classique qui donne l'illusion d'une transaction. Une
     * lecture unique n'en a de toute façon pas besoin : le repository ouvre la
     * sienne.</p>
     *
     * <p>La vérification d'organisation, elle, est indispensable :
     * {@code findById} contourne le filtre Hibernate, et un identifiant
     * d'action se devine.</p>
     */
    private ActionItem load(Long actionItemId, Long orgId) {
        final ActionItem item = actionItemRepository.findById(actionItemId)
                .orElseThrow(() -> new IllegalArgumentException("Action introuvable"));
        if (orgId == null || !orgId.equals(item.getOrganizationId())) {
            throw new AccessDeniedException("Action hors organisation");
        }
        return item;
    }

    /**
     * Régénère et renvoie le document.
     *
     * <p>{@code forceResend} est indispensable : sans lui, le pipeline
     * considère l'envoi déjà fait et ne repart pas — or c'est précisément parce
     * qu'il a échoué qu'on est là.</p>
     */
    private void retryDocument(Long documentId, Long orgId) {
        final DocumentGeneration document = documentGenerationRepository.findById(documentId)
                .filter(d -> orgId.equals(d.getOrganizationId()))
                .orElseThrow(() -> new IllegalArgumentException("Document introuvable"));

        documentGenerationPipeline.execute(new GenerationCommand(
                document.getTemplate(),
                document.getReferenceId(),
                document.getReferenceType(),
                document.getEmailTo(),
                true,
                document.getUserId(),
                document.getUserEmail(),
                orgId,
                null,
                true,
                null,
                null));
        log.info("Document {} renvoye a {}", documentId, document.getEmailTo());
    }

    /** Renvoie le message sur le <b>même canal</b> — courriel, SMS ou WhatsApp. */
    private void retryGuestMessage(Long messageLogId, Long orgId) {
        final GuestMessageLog message = guestMessageLogRepository.findById(messageLogId)
                .filter(m -> orgId.equals(m.getOrganizationId()))
                .orElseThrow(() -> new IllegalArgumentException("Message introuvable"));

        if (message.getReservationId() == null || message.getTemplateId() == null) {
            throw new IllegalStateException(
                    "Ce message ne peut pas etre rejoue : reservation ou modele absent");
        }
        guestMessagingService.sendMessage(message.getReservationId(), message.getTemplateId(),
                orgId, message.getChannel());
        log.info("Message {} rejoue sur le canal {}", messageLogId, message.getChannel());
    }
}
