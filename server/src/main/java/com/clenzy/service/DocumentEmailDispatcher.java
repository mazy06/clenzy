package com.clenzy.service;

import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentType;
import com.clenzy.model.ReferenceType;
import com.clenzy.repository.DocumentGenerationRepository;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Diffusion par email des documents generes : routage DEVIS prospect vs
 * document standard, garde d'idempotence (dedup 1 envoi par destinataire et
 * par document) et contenu par defaut.
 * <p>
 * Extrait de {@link DocumentGeneratorService} (refactor SRP) — comportement
 * strictement identique.
 */
@Component
public class DocumentEmailDispatcher {

    private final EmailService emailService;
    private final DocumentGenerationRepository generationRepository;

    public DocumentEmailDispatcher(EmailService emailService,
                                   DocumentGenerationRepository generationRepository) {
        this.emailService = emailService;
        this.generationRepository = generationRepository;
    }

    /**
     * Garde d'idempotence : ce document a-t-il deja ete envoye par email a ce
     * destinataire pour cette reference ? {@code forceResend=true} court-circuite
     * (bouton "Renvoyer" → toujours false).
     */
    public boolean isEmailAlreadySent(boolean forceResend, ReferenceType referenceType,
                                      Long referenceId, DocumentType documentType, String emailTo) {
        if (forceResend || referenceId == null || referenceType == null
                || emailTo == null || emailTo.isBlank()) {
            return false;
        }
        return generationRepository.existsSentEmailForReference(
                documentType.name(), referenceType.name(), referenceId, emailTo);
    }

    /**
     * Contenu par defaut (objet + corps plain text) du mail devis prospect, pour
     * preremplir l'editeur "Renvoyer" cote frontend.
     */
    public Map<String, String> getQuoteEmailDefaults() {
        return emailService.resolveQuoteEmailContent();
    }

    public void sendDocumentByEmail(DocumentTemplate template, String toEmail,
                                    String pdfFilename, byte[] pdfBytes,
                                    String emailSubject, String emailBody) {
        // Cas DEVIS envoye a un prospect : template email dedie "quote_to_prospect"
        // (wrapper Baitly). emailSubject/emailBody surchargent le contenu (editeur
        // "Renvoyer"). La copie interne pour l'equipe (info@) part dans un email
        // DEDIE et fiable, avec le PDF joint — remplace l'ancien CC-a-soi-meme
        // (souvent non delivre). Best-effort cote EmailService (ne fait pas echouer
        // l'envoi prospect deja realise).
        if (template.getDocumentType() == DocumentType.DEVIS) {
            emailService.sendQuoteToProspect(toEmail, pdfBytes, pdfFilename, emailSubject, emailBody);
            emailService.sendQuoteInternalCopy(toEmail, pdfBytes, pdfFilename);
            return;
        }

        String subject = template.getEmailSubject() != null && !template.getEmailSubject().isBlank()
                ? template.getEmailSubject()
                : "Votre document Clenzy — " + template.getDocumentType().getLabel();

        String body = template.getEmailBody() != null && !template.getEmailBody().isBlank()
                ? template.getEmailBody()
                : buildDefaultEmailBody(template.getDocumentType());

        emailService.sendDocumentEmail(toEmail, subject, body, pdfFilename, pdfBytes);
    }

    private String buildDefaultEmailBody(DocumentType type) {
        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>"
                + "<div style='font-family:Arial,sans-serif;max-width:680px;margin:0 auto;'>"
                + "<h2 style='color:#0f172a;'>Votre document Clenzy</h2>"
                + "<p>Bonjour,</p>"
                + "<p>Veuillez trouver ci-joint votre document : <strong>" + type.getLabel() + "</strong>.</p>"
                + "<p>Ce document a ete genere automatiquement par le systeme Clenzy.</p>"
                + "<p style='color:#64748b;font-size:13px;margin-top:24px;'>Cordialement,<br>L'equipe Clenzy</p>"
                + "</div></body></html>";
    }
}
