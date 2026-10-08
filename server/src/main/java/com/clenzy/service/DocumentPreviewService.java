package com.clenzy.service;

import com.clenzy.exception.DocumentGenerationException;
import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentType;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Service;

/** Aperçu autonome : seuls le modèle et un jeu fictif sont lus, jamais un dossier métier. */
@Service
public class DocumentPreviewService {
    private final BaitlyPdfEngine engine;
    private final DocumentTemplateRenderer renderer;
    private final InvoicePdfService invoices;

    public DocumentPreviewService(BaitlyPdfEngine engine, DocumentTemplateRenderer renderer, InvoicePdfService invoices) {
        this.engine = engine;
        this.renderer = renderer;
        this.invoices = invoices;
    }

    public byte[] generatePreview(DocumentTemplate template) {
        try {
            if (template.getDocumentType() == DocumentType.FACTURE) return invoices.preview();
            var context = BaitlyPreviewData.context();
            renderer.fillMissingTags(template, context, true);
            byte[] html = renderer.fillTemplate(renderer.resolveTemplateContent(template), context);
            return engine.html(BaitlyPreviewData.watermark(new String(html, StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new DocumentGenerationException("Impossible de generer la previsualisation du modèle", e);
        }
    }
}
