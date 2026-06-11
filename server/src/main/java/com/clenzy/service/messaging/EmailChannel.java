package com.clenzy.service.messaging;

import com.clenzy.model.MessageChannelType;
import com.clenzy.util.EmailHtmlSanitizer;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Canal d'envoi email pour la messagerie guest.
 * Utilise JavaMailSender (Brevo SMTP) pour envoyer des emails HTML aux voyageurs.
 */
@Service
public class EmailChannel implements MessageChannel {

    private static final Logger log = LoggerFactory.getLogger(EmailChannel.class);

    private final JavaMailSender mailSender;
    private final EmailWrapperService emailWrapperService;

    @Value("${clenzy.mail.from:info@clenzy.fr}")
    private String fromAddress;

    public EmailChannel(ObjectProvider<JavaMailSender> mailSenderProvider,
                        EmailWrapperService emailWrapperService) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.emailWrapperService = emailWrapperService;
        if (this.mailSender == null) {
            log.warn("EmailChannel: JavaMailSender non configure, canal email desactive");
        }
    }

    @Override
    public MessageChannelType getChannelType() {
        return MessageChannelType.EMAIL;
    }

    @Override
    public boolean isAvailable() {
        return mailSender != null;
    }

    @Override
    public MessageDeliveryResult send(MessageDeliveryRequest request) {
        if (!isAvailable()) {
            return MessageDeliveryResult.failure("JavaMailSender non configure");
        }
        if (request.recipientEmail() == null || request.recipientEmail().isBlank()) {
            return MessageDeliveryResult.failure("Email du destinataire manquant");
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromAddress);
            helper.setTo(request.recipientEmail());
            helper.setSubject(sanitizeHeaderValue(request.subject()));
            // Le corps interpole arrive en texte/markdown (sauts de ligne, **gras**,
            // listes a puces). On l'habille dans le template HTML guest (header Baitly,
            // paragraphes, listes, footer) pour un rendu email professionnel.
            // Exception : un document HTML COMPLET (ex. briefing deja rendu par son propre
            // template) n'est pas re-wrappe — le wrapper le corromprait (double-wrap).
            // Securite (Z7-SEC-03) : cette branche court-circuitait toute protection ;
            // un template de message guest commencant par <html (corps host-editable,
            // non echappe par TemplateInterpolationService) partait verbatim au voyageur.
            // On applique donc la MEME sanitisation que le wrapper (EmailHtmlSanitizer,
            // utilise par EmailWrapperService.wrap) : allowlist jsoup ecartant les
            // constructs dangereux (script/iframe/object/embed, handlers on*=, URLs
            // javascript:). Le HTML legitime (briefings) est conserve mais re-serialise
            // par jsoup (entites echappees, attributs normalises, wrapper html/body retire).
            String body = request.htmlBody() != null ? request.htmlBody() : "";
            String trimmed = body.stripLeading().toLowerCase();
            String html = (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html"))
                    ? EmailHtmlSanitizer.sanitize(body)
                    : emailWrapperService.wrap("NOTIFICATION_GUEST", body);
            helper.setText(html, true);

            mailSender.send(message);

            String messageId = message.getMessageID();
            log.info("Email envoye a {} (subject={})", request.recipientEmail(), request.subject());
            return MessageDeliveryResult.success(messageId);
        } catch (Exception e) {
            log.error("Erreur envoi email a {}: {}", request.recipientEmail(), e.getMessage(), e);
            return MessageDeliveryResult.failure(e.getMessage());
        }
    }

    /**
     * Nettoie les caracteres de controle dans les en-tetes email
     * pour prevenir l'injection d'en-tetes.
     */
    private String sanitizeHeaderValue(String value) {
        if (value == null) return "";
        return value.replaceAll("[\\r\\n]", " ").trim();
    }
}
