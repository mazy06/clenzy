package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.dto.IssueDtos.DismissIssueRequest;
import com.clenzy.model.ActionItem;
import com.clenzy.model.OutboxEvent;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

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
    private final ReservationService reservationService;
    private final AutomationEvaluationService automationEvaluationService;

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
                                  ReservationService reservationService,
                                  AutomationEvaluationService automationEvaluationService) {
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
            default -> throw new IllegalStateException("Geste inconnu : " + action);
        }
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
