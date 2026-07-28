package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.fiscal.einvoicing.EInvoiceStatus;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.repository.EInvoiceSubmissionRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Ce qui a été produit mais n'est jamais arrivé.
 *
 * <p><b>Document non délivré</b> — le PDF est généré, numéroté, archivé, et
 * l'envoi a échoué. Côté destinataire, le document n'existe simplement pas ; on
 * ne l'apprend qu'au moment où il le réclame. Une facture, un contrat, un devis
 * dans ce cas est un impayé qui se prépare.</p>
 *
 * <p><b>Facture électronique rejetée</b> — l'administration fiscale a refusé la
 * transmission. C'est une obligation légale non remplie, et elle ne se voyait
 * nulle part.</p>
 *
 * <p>Les deux se relancent depuis la carte : c'est le seul geste attendu, et le
 * faire ailleurs supposait de savoir où chercher.</p>
 */
@Component
public class DocumentDeliveryActionSource implements ActionItemSource {

    /**
     * Au-delà, une relance n'a plus de sens : le destinataire a réclamé, ou le
     * document est devenu caduc.
     */
    private static final int LOOKBACK_DAYS = 30;

    private final DocumentGenerationRepository documentGenerationRepository;
    private final EInvoiceSubmissionRepository eInvoiceSubmissionRepository;

    public DocumentDeliveryActionSource(
            DocumentGenerationRepository documentGenerationRepository,
            EInvoiceSubmissionRepository eInvoiceSubmissionRepository) {
        this.documentGenerationRepository = documentGenerationRepository;
        this.eInvoiceSubmissionRepository = eInvoiceSubmissionRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.DOCUMENT_DELIVERY_FAILED, ActionItemKind.EINVOICE_FAILED);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        final List<ActionItemDto> items = new ArrayList<>();

        documentGenerationRepository.findUndeliveredForOrg(
                        ctx.organizationId(), ctx.nowDateTime().minusDays(LOOKBACK_DAYS))
                .stream()
                .map(document -> new ActionItemDto(
                        "document:" + document.getId(),
                        ActionItemKind.DOCUMENT_DELIVERY_FAILED,
                        "critical",
                        ActionItems.firstNonBlank(document.getFileName(),
                                document.getDocumentType() == null
                                        ? "Document" : document.getDocumentType().name()),
                        document.getEmailTo(),
                        document.getEmailTo(),
                        document.getId(),
                        null, null, null, null,
                        // La sous-nature dit à l'écran quel bouton proposer.
                        "DOCUMENT",
                        null))
                .forEach(items::add);

        eInvoiceSubmissionRepository.findFailedForOrg(
                        ctx.organizationId(), EInvoiceStatus.FAILED).stream()
                .map(submission -> new ActionItemDto(
                        "einvoice:" + submission.getId(),
                        ActionItemKind.EINVOICE_FAILED,
                        "critical",
                        "Facture " + submission.getInvoiceNumber(),
                        ActionItems.truncate(submission.getMessage(), ActionItems.EXCERPT_LENGTH),
                        null,
                        submission.getId(),
                        null, null, null, null,
                        "EINVOICE",
                        null))
                .forEach(items::add);

        return items;
    }
}
