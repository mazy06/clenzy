package com.clenzy.integration.twilio.service;

import com.clenzy.integration.twilio.config.TwilioConfig;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.rest.verify.v2.service.Verification;
import com.twilio.rest.verify.v2.service.VerificationCheck;
import com.twilio.type.PhoneNumber;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Service d'appel a l'API Twilio.
 * Gere les envois SMS, WhatsApp et la verification OTP.
 *
 * Circuit breaker : toutes les methodes d'appel API sont protegees
 * par un circuit breaker pour eviter la cascade d'erreurs.
 */
@Service
@ConditionalOnProperty(name = "clenzy.twilio.account-sid")
public class TwilioApiService {

    private static final Logger log = LoggerFactory.getLogger(TwilioApiService.class);

    private final TwilioConfig config;

    public TwilioApiService(TwilioConfig config) {
        this.config = config;
    }

    @PostConstruct
    public void init() {
        if (config.isConfigured()) {
            Twilio.init(config.getAccountSid(), config.getAuthToken());
            log.info("Twilio SDK initialise (account: {}...)", config.getAccountSid().substring(0, 8));
        } else {
            log.warn("Twilio SDK non initialise : configuration incomplete");
        }
    }

    /**
     * Envoie un SMS via Twilio.
     *
     * @param to   Numero de telephone au format E.164 (ex: +33612345678)
     * @param body Contenu du message texte
     * @return SID du message envoye
     */
    @CircuitBreaker(name = "twilio-api", fallbackMethod = "sendSmsFallback")
    public String sendSms(String to, String body) {
        validatePhoneNumber(to);

        log.info("Envoi SMS Twilio vers {}", maskPhoneNumber(to));

        Message message = Message.creator(
                new PhoneNumber(to),
                config.getMessagingServiceSid(),
                body
        ).create();

        log.info("SMS envoye (SID: {}, status: {})", message.getSid(), message.getStatus());
        return message.getSid();
    }

    /**
     * Envoie un message WhatsApp via Twilio.
     *
     * @param to   Numero de telephone au format E.164
     * @param body Contenu du message
     * @return SID du message envoye
     */
    @CircuitBreaker(name = "twilio-api", fallbackMethod = "sendWhatsAppFallback")
    public String sendWhatsApp(String to, String body) {
        validatePhoneNumber(to);

        String whatsappTo = to.startsWith("whatsapp:") ? to : "whatsapp:" + to;
        String whatsappFrom = config.getWhatsappFrom();

        log.info("Envoi WhatsApp Twilio vers {}", maskPhoneNumber(to));

        Message message = Message.creator(
                new PhoneNumber(whatsappTo),
                new PhoneNumber(whatsappFrom),
                body
        ).create();

        log.info("WhatsApp envoye (SID: {}, status: {})", message.getSid(), message.getStatus());
        return message.getSid();
    }

    /**
     * Envoie un code OTP via Twilio Verify.
     *
     * @param to      Numero de telephone au format E.164
     * @param channel Canal de verification (sms, whatsapp, email)
     * @return Status de l'envoi
     */
    @CircuitBreaker(name = "twilio-api")
    public String sendOtp(String to, String channel) {
        validatePhoneNumber(to);

        Verification verification = Verification.creator(
                config.getVerifyServiceSid(),
                to,
                channel
        ).create();

        log.info("OTP envoye via {} vers {} (status: {})", channel, maskPhoneNumber(to), verification.getStatus());
        return verification.getStatus();
    }

    /**
     * Verifie un code OTP soumis par l'utilisateur.
     *
     * @param to   Numero de telephone au format E.164
     * @param code Code OTP saisi
     * @return true si le code est valide
     */
    @CircuitBreaker(name = "twilio-api")
    public boolean verifyOtp(String to, String code) {
        validatePhoneNumber(to);

        VerificationCheck check = VerificationCheck.creator(config.getVerifyServiceSid())
                .setTo(to)
                .setCode(code)
                .create();

        boolean valid = "approved".equals(check.getStatus());
        log.info("Verification OTP pour {} : {} (status: {})", maskPhoneNumber(to), valid ? "VALIDE" : "INVALIDE", check.getStatus());
        return valid;
    }

    // ─── Fallback methods ─────────────────────────────────────────────────────

    @SuppressWarnings("unused")
    private String sendSmsFallback(String to, String body, Throwable t) {
        log.error("Circuit breaker Twilio SMS ouvert — fallback pour {}: {}", maskPhoneNumber(to), t.getMessage());
        throw new RuntimeException("Service SMS temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private String sendWhatsAppFallback(String to, String body, Throwable t) {
        log.error("Circuit breaker Twilio WhatsApp ouvert — fallback pour {}: {}", maskPhoneNumber(to), t.getMessage());
        throw new RuntimeException("Service WhatsApp temporairement indisponible", t);
    }

    // ─── Validation helpers ───────────────────────────────────────────────────

    private void validatePhoneNumber(String phone) {
        if (phone == null || phone.isBlank()) {
            throw new IllegalArgumentException("Numero de telephone requis");
        }
        // Format E.164 : commence par + suivi de 7-15 chiffres
        String cleaned = phone.replaceFirst("^whatsapp:", "");
        if (!cleaned.matches("^\\+[1-9]\\d{6,14}$")) {
            throw new IllegalArgumentException("Numero de telephone invalide (format E.164 attendu) : " + maskPhoneNumber(phone));
        }
    }

    private String maskPhoneNumber(String phone) {
        if (phone == null || phone.length() < 6) return "***";
        return phone.substring(0, 4) + "****" + phone.substring(phone.length() - 2);
    }
}
