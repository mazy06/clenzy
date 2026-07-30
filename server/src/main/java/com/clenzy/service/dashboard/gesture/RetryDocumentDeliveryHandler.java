package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.service.DocumentGenerationPipeline;
import com.clenzy.service.DocumentGenerationPipeline.GenerationCommand;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Régénérer et renvoyer un document dont l'envoi a échoué.
 *
 * <p>{@code forceResend} est indispensable : sans lui, le pipeline considère
 * l'envoi déjà fait et ne repart pas — or c'est précisément parce qu'il a
 * échoué qu'on est là.</p>
 *
 * <p>Rien n'est marqué « traité » : c'est l'envoi qui met à jour l'état du
 * document, et le balayage suivant fera disparaître la ligne s'il a abouti.
 * Annoncer le succès avant de l'avoir constaté masquerait un second échec.</p>
 */
@Component
public class RetryDocumentDeliveryHandler implements ActionGestureHandler {

    private static final Logger log = LoggerFactory.getLogger(RetryDocumentDeliveryHandler.class);

    private final DocumentGenerationRepository documentGenerationRepository;
    private final DocumentGenerationPipeline documentGenerationPipeline;

    public RetryDocumentDeliveryHandler(DocumentGenerationRepository documentGenerationRepository,
                                        DocumentGenerationPipeline documentGenerationPipeline) {
        this.documentGenerationRepository = documentGenerationRepository;
        this.documentGenerationPipeline = documentGenerationPipeline;
    }

    @Override
    public String action() {
        return "retry";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.DOCUMENT_DELIVERY_FAILED);
    }

    @Override
    public void handle(GestureContext context) {
        final Long orgId = context.orgId();
        final DocumentGeneration document = documentGenerationRepository.findById(context.targetId())
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
        log.info("Document {} renvoye a {}", document.getId(), document.getEmailTo());
    }
}
