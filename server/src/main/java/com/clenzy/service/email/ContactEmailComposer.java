package com.clenzy.service.email;

import com.clenzy.util.StringUtils;
import org.springframework.stereotype.Component;

/**
 * Contenu metier des emails du module Contact (messages inbox/sent/reply) :
 * rendu HTML du corps du message.
 *
 * <p>Extrait de {@code EmailService} (G2) — rendu strictement identique.
 * La couche transport (MIME, normalisation des headers, pieces jointes)
 * reste dans {@code EmailService} ; le contenu metier contact vit ici.</p>
 */
@Component
public class ContactEmailComposer {

    /**
     * Corps HTML du message contact. {@code messageText} est de l'input user :
     * echappe via {@link StringUtils#escapeHtml(String)} puis les sauts de
     * ligne convertis en {@code <br>}.
     */
    public String renderContactHtmlBody(String toName, String replyToName, String messageText) {
        String safeToName = StringUtils.firstNonBlank(toName, "destinataire");
        String safeReplyToName = StringUtils.firstNonBlank(replyToName, "expediteur");
        String escapedMessage = StringUtils.escapeHtml(messageText).replace("\n", "<br>");

        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>"
                + "<div style='font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#1e293b;'>"
                + "<h2 style='margin:0 0 16px 0;color:#0f172a;'>Nouveau message Clenzy</h2>"
                + "<p style='margin:0 0 12px 0;'>Bonjour " + StringUtils.escapeHtml(safeToName) + ",</p>"
                + "<div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px;'>"
                + escapedMessage
                + "</div>"
                + "<p style='margin:0;color:#64748b;font-size:13px;'>Ce message vous a ete envoye par "
                + StringUtils.escapeHtml(safeReplyToName)
                + " via le module Contact Clenzy.</p>"
                + "</div></body></html>";
    }
}
