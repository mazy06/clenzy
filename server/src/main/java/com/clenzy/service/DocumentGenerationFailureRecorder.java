package com.clenzy.service;

import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.DocumentGenerationStatus;
import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentType;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.ReferenceType;
import com.clenzy.repository.DocumentGenerationRepository;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persiste durablement les echecs de generation de document.
 * <p>
 * <b>Pourquoi un bean separe avec {@code REQUIRES_NEW} ?</b>
 * <p>
 * {@code DocumentGeneratorService.generateFromEvent} est {@code @Transactional} et
 * <b>re-jette</b> l'exception en cas d'echec (necessaire pour declencher le retry Kafka
 * dans {@code DocumentEventService}). Or, re-jeter l'exception fait <b>rollback</b> la
 * transaction du caller — donc toute ligne {@code DocumentGeneration} marquee FAILED et
 * sauvee dans cette meme transaction serait <b>annulee</b>. Resultat historique : les
 * echecs etaient <b>toujours silencieux</b>, aucune ligne FAILED n'apparaissait jamais en
 * bas de l'ecran "Messagerie OTA" alors qu'un formulaire de devis avait bien ete recu.
 * <p>
 * En isolant l'ecriture dans une transaction {@code REQUIRES_NEW} (nouvelle connexion,
 * suspend la transaction du caller), la ligne FAILED est <b>committee independamment</b> :
 * elle survit au rollback du caller, l'exception continue de se propager (retry Kafka
 * preserve), et l'echec devient <b>visible</b> cote UI + notification admin.
 * <p>
 * Le bean est distinct de {@code DocumentGeneratorService} car l'auto-invocation d'une
 * methode {@code @Transactional} passe par {@code this} et <b>contourne le proxy Spring</b> :
 * la semantique {@code REQUIRES_NEW} ne s'appliquerait pas.
 */
@Component
public class DocumentGenerationFailureRecorder {

    private static final Logger log = LoggerFactory.getLogger(DocumentGenerationFailureRecorder.class);

    /** Garde-fou anti-message geant dans la notification (la colonne error_message est TEXT). */
    private static final int MAX_NOTIFICATION_LENGTH = 500;

    private final DocumentGenerationRepository generationRepository;
    private final NotificationService notificationService;
    private final EntityManager entityManager;

    public DocumentGenerationFailureRecorder(DocumentGenerationRepository generationRepository,
                                             NotificationService notificationService,
                                             EntityManager entityManager) {
        this.generationRepository = generationRepository;
        this.notificationService = notificationService;
        this.entityManager = entityManager;
    }

    /**
     * Insere une nouvelle ligne {@link DocumentGeneration} en statut FAILED + notifie les
     * admins/managers, dans une transaction independante (committee meme si le caller rollback).
     * <p>
     * On <b>insere une nouvelle ligne</b> plutot que d'UPDATE la ligne GENERATING existante :
     * en {@code REQUIRES_NEW} (isolation READ_COMMITTED) la ligne GENERATING — non committee
     * par la transaction suspendue du caller — est <b>invisible</b> ici.
     *
     * @param templateId  id du template (peut etre null en Mode A : aucun template actif).
     *                    Resolu via {@code getReference} (proxy lazy, pas de SELECT) pour
     *                    poser la FK sans charger l'entite ni risquer un detached-entity.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(DocumentType documentType, Long referenceId, ReferenceType referenceType,
                              Long organizationId, Long templateId, String emailTo,
                              String errorMessage, int generationTimeMs) {
        try {
            DocumentTemplate templateRef = templateId != null
                    ? entityManager.getReference(DocumentTemplate.class, templateId)
                    : null;

            DocumentGeneration failed = DocumentGeneration.builder()
                    .template(templateRef)
                    .documentType(documentType)
                    .referenceId(referenceId)
                    .referenceType(referenceType)
                    .userId("system")
                    .userEmail("system")
                    .status(DocumentGenerationStatus.FAILED)
                    .emailTo(emailTo)
                    .build();
            failed.setOrganizationId(organizationId);
            failed.setErrorMessage(errorMessage);
            failed.setGenerationTimeMs(generationTimeMs);
            failed = generationRepository.save(failed);

            String label = documentType != null ? documentType.getLabel() : "Document";
            notificationService.notifyAdminsAndManagers(
                    NotificationKey.DOCUMENT_GENERATION_FAILED,
                    "Echec generation document",
                    label + " : " + truncate(errorMessage),
                    "/documents?tab=history&highlight=" + failed.getId(),
                    organizationId
            );

            log.info("Echec de generation persiste (FAILED) : type={}, refId={}, orgId={}",
                    documentType, referenceId, organizationId);
        } catch (Exception persistEx) {
            // Ne jamais masquer l'exception metier d'origine : on log et on laisse le caller
            // re-jeter l'exception initiale (le retry Kafka reste pilote par celle-ci).
            log.error("Impossible de persister l'echec de generation (type={}, refId={}) : {}",
                    documentType, referenceId, persistEx.getMessage(), persistEx);
        }
    }

    private static String truncate(String message) {
        if (message == null) {
            return "(aucun detail)";
        }
        return message.length() <= MAX_NOTIFICATION_LENGTH
                ? message
                : message.substring(0, MAX_NOTIFICATION_LENGTH) + "…";
    }
}
