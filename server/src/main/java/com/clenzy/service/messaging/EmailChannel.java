package com.clenzy.service.messaging;

import com.clenzy.model.MessageChannelType;
import com.clenzy.util.StringUtils;
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

    @Value("${clenzy.mail.from:info@clenzy.fr}")
    private String fromAddress;

    public EmailChannel(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSender = mailSenderProvider.getIfAvailable();
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
            helper.setText(request.htmlBody(), true);

            mailSender.send(message);

            String messageId = message.getMessageID();
            log.info("Email envoye a {} (subject={})", request.recipientEmail(), request.subject());
            return MessageDeliveryResult.success(messageId);
        } catch (Exception e) {
            log.error("Erreur envoi email a {}: {}", request.recipientEmail(), e.getMessage());
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
