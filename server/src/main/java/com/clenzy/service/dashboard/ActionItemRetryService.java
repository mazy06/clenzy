package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.ActionItem;
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
 * Relance d'un envoi qui a échoué, depuis la carte qui le signale.
 *
 * <p>Un document non délivré ou un message voyageur en échec appellent un seul
 * geste : réessayer. L'obliger à passer par l'écran des documents supposait de
 * savoir lequel avait échoué — c'est-à-dire de le savoir déjà.</p>
 *
 * <p><b>Aucun envoi n'est fait dans une transaction ouverte par ce service.</b>
 * Un envoi est un appel réseau : le tenir dans une transaction la garde ouverte
 * pendant toute sa durée, et une lenteur du fournisseur devient une saturation
 * du pool de connexions. Les lectures se suffisent de la transaction du
 * repository ; l'envoi gère la sienne, en aval.</p>
 */
@Service
public class ActionItemRetryService {

    private static final Logger log = LoggerFactory.getLogger(ActionItemRetryService.class);

    private final ActionItemRepository actionItemRepository;
    private final DocumentGenerationRepository documentGenerationRepository;
    private final GuestMessageLogRepository guestMessageLogRepository;
    private final DocumentGenerationPipeline documentGenerationPipeline;
    private final GuestMessagingService guestMessagingService;

    public ActionItemRetryService(ActionItemRepository actionItemRepository,
                                  DocumentGenerationRepository documentGenerationRepository,
                                  GuestMessageLogRepository guestMessageLogRepository,
                                  DocumentGenerationPipeline documentGenerationPipeline,
                                  GuestMessagingService guestMessagingService) {
        this.actionItemRepository = actionItemRepository;
        this.documentGenerationRepository = documentGenerationRepository;
        this.guestMessageLogRepository = guestMessageLogRepository;
        this.documentGenerationPipeline = documentGenerationPipeline;
        this.guestMessagingService = guestMessagingService;
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
