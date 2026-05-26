package com.clenzy.service.agent.briefing;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.User;
import com.clenzy.model.WhatsAppConfig;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.messaging.EmailChannel;
import com.clenzy.service.messaging.MessageDeliveryRequest;
import com.clenzy.service.messaging.MessageDeliveryResult;
import com.clenzy.service.messaging.WhatsAppApiService;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Dispatch d'un briefing compose vers les 3 canaux configures par l'user :
 * in-app (notification persistee), email (HTML via JavaMailSender/Brevo),
 * WhatsApp (template approuve via Graph API).
 *
 * <p>Chaque canal est independant — un echec sur l'un ne bloque pas les autres.
 * On retourne la liste des canaux effectivement delivres pour journalisation
 * dans {@code assistant_briefing_log}.</p>
 *
 * <p>Limitations canal :
 * <ul>
 *   <li>email : best-effort, retourne false si l'user n'a pas d'email ou si
 *       le mailer n'est pas configure</li>
 *   <li>whatsapp : necessite un {@code WhatsAppConfig} actif sur l'org et un
 *       {@code phoneNumber} sur l'user. On utilise un template pre-approuve
 *       ({@code "engagement_update"} par defaut, override via property)</li>
 * </ul>
 */
@Service
public class BriefingDelivery {

    private static final Logger log = LoggerFactory.getLogger(BriefingDelivery.class);

    public static final String CHANNEL_IN_APP = "in_app";
    public static final String CHANNEL_EMAIL = "email";
    public static final String CHANNEL_WHATSAPP = "whatsapp";

    /** Nombre max de caracteres du body envoye dans le mail (truncate apres). */
    private static final int EMAIL_BODY_MAX_CHARS = 12_000;
    /** Template WhatsApp pre-approuve par defaut. Override via configuration future. */
    private static final String WHATSAPP_TEMPLATE_DEFAULT = "engagement_update";

    private final NotificationService notificationService;
    private final EmailChannel emailChannel;
    private final WhatsAppApiService whatsAppApiService;
    private final UserRepository userRepository;
    private final WhatsAppConfigRepository whatsAppConfigRepository;

    public BriefingDelivery(NotificationService notificationService,
                              EmailChannel emailChannel,
                              WhatsAppApiService whatsAppApiService,
                              UserRepository userRepository,
                              WhatsAppConfigRepository whatsAppConfigRepository) {
        this.notificationService = notificationService;
        this.emailChannel = emailChannel;
        this.whatsAppApiService = whatsAppApiService;
        this.userRepository = userRepository;
        this.whatsAppConfigRepository = whatsAppConfigRepository;
    }

    /**
     * Dispatch un briefing aux canaux demandes par l'user. Chaque canal est
     * isole : echec d'un canal n'empeche pas les autres.
     *
     * @return liste des canaux effectivement delivres (pour journalisation)
     */
    public List<String> dispatch(BriefingComposer.BriefingResult result,
                                   String keycloakId,
                                   Long organizationId,
                                   List<String> requestedChannels) {
        if (result == null) return List.of();
        List<String> delivered = new ArrayList<>();

        // Resolution unique de l'user pour eviter les requetes repetees
        Optional<User> userOpt = userRepository.findByKeycloakId(keycloakId);

        for (String channel : requestedChannels) {
            try {
                boolean ok = switch (channel) {
                    case CHANNEL_IN_APP -> sendInApp(result, keycloakId, organizationId);
                    case CHANNEL_EMAIL -> sendEmail(result, userOpt);
                    case CHANNEL_WHATSAPP -> sendWhatsApp(result, userOpt, organizationId);
                    default -> {
                        log.warn("Canal de briefing inconnu : {}", channel);
                        yield false;
                    }
                };
                if (ok) delivered.add(channel);
            } catch (Exception e) {
                log.warn("Briefing dispatch canal '{}' echoue pour user {} : {}",
                        channel, keycloakId, e.getMessage());
            }
        }

        return delivered;
    }

    // ─── In-app ──────────────────────────────────────────────────────────────

    private boolean sendInApp(BriefingComposer.BriefingResult result,
                                String keycloakId, Long organizationId) {
        String actionUrl = result.conversationId() != null
                ? "/assistant/conversations/" + result.conversationId()
                : "/assistant";
        String body = excerpt(result.body(), 240);
        try {
            notificationService.send(
                    keycloakId,
                    NotificationKey.BRIEFING_READY,
                    result.shortTitle(),
                    body,
                    actionUrl,
                    organizationId);
            return true;
        } catch (Exception e) {
            log.warn("In-app briefing notify failed for {} : {}", keycloakId, e.getMessage());
            return false;
        }
    }

    // ─── Email ───────────────────────────────────────────────────────────────

    private boolean sendEmail(BriefingComposer.BriefingResult result, Optional<User> userOpt) {
        if (!emailChannel.isAvailable()) {
            log.debug("Briefing email skipped : EmailChannel pas disponible");
            return false;
        }
        if (userOpt.isEmpty() || userOpt.get().getEmail() == null
                || userOpt.get().getEmail().isBlank()) {
            log.debug("Briefing email skipped : user ou email manquant");
            return false;
        }
        User user = userOpt.get();
        String body = result.body();
        if (body == null) body = "";
        if (body.length() > EMAIL_BODY_MAX_CHARS) {
            body = body.substring(0, EMAIL_BODY_MAX_CHARS) + "\n\n[...tronque...]";
        }
        String html = buildEmailHtml(result.shortTitle(), body);
        MessageDeliveryRequest request = new MessageDeliveryRequest(
                user.getEmail(),
                null,
                fullName(user),
                "[Clenzy] " + result.shortTitle(),
                html,
                body,
                "fr"
        );
        MessageDeliveryResult res = emailChannel.send(request);
        if (!res.success()) {
            log.warn("Briefing email send failed for {} : {}", user.getKeycloakId(), res.errorMessage());
        }
        return res.success();
    }

    /**
     * Template MJML-inspire mais inline pour eviter d'introduire un nouveau
     * builder. Conserve la structure title + body markdown converti en
     * <pre>-wrap simple — le LLM produit deja du markdown lisible.
     */
    private String buildEmailHtml(String title, String body) {
        String safeTitle = StringUtils.escapeHtml(title);
        String safeBody = StringUtils.escapeHtml(body)
                .replace("\n", "<br/>");
        return "<!doctype html><html><body style=\"font-family:Helvetica,Arial,sans-serif;"
                + "max-width:640px;margin:0 auto;padding:24px;color:#1f2937;\">"
                + "<h2 style=\"color:#6B8A9A;font-weight:600;margin:0 0 16px;\">"
                + safeTitle + "</h2>"
                + "<div style=\"line-height:1.55;font-size:14px;\">" + safeBody + "</div>"
                + "<hr style=\"border:none;border-top:1px solid #E5E7EB;margin:24px 0;\"/>"
                + "<p style=\"color:#6B7280;font-size:12px;\">"
                + "Tu peux modifier ou desactiver ces briefings depuis "
                + "<a href=\"/settings?tab=ai\" style=\"color:#6B8A9A;\">tes parametres</a>."
                + "</p></body></html>";
    }

    private static String fullName(User user) {
        String first = user.getFirstName() != null ? user.getFirstName() : "";
        String last = user.getLastName() != null ? user.getLastName() : "";
        String composed = (first + " " + last).trim();
        return composed.isEmpty() ? null : composed;
    }

    // ─── WhatsApp ────────────────────────────────────────────────────────────

    private boolean sendWhatsApp(BriefingComposer.BriefingResult result,
                                   Optional<User> userOpt, Long organizationId) {
        if (userOpt.isEmpty() || userOpt.get().getPhoneNumber() == null
                || userOpt.get().getPhoneNumber().isBlank()) {
            log.debug("Briefing whatsapp skipped : pas de numero de telephone");
            return false;
        }
        Optional<WhatsAppConfig> configOpt = whatsAppConfigRepository.findByOrganizationId(organizationId);
        if (configOpt.isEmpty() || !configOpt.get().isEnabled()) {
            log.debug("Briefing whatsapp skipped : pas de WhatsAppConfig actif pour org {}", organizationId);
            return false;
        }
        try {
            // Template pre-approuve (ex: "engagement_update") — params sont
            // gerees cote template Meta. Pour personnaliser, on envoie d'abord
            // le template, puis un message texte court avec le lien — mais
            // WhatsApp Business API n'autorise un message texte que SUITE a
            // une interaction recente. On reste donc minimaliste : template only.
            String result1 = whatsAppApiService.sendTemplateMessage(
                    configOpt.get(),
                    userOpt.get().getPhoneNumber(),
                    WHATSAPP_TEMPLATE_DEFAULT,
                    "fr");
            return result1 != null;
        } catch (Exception e) {
            log.warn("Briefing whatsapp failed for user {} : {}",
                    userOpt.get().getKeycloakId(), e.getMessage());
            return false;
        }
    }

    private static String excerpt(String text, int max) {
        if (text == null) return "";
        String trimmed = text.replaceAll("\\s+", " ").trim();
        if (trimmed.length() <= max) return trimmed;
        return trimmed.substring(0, max - 1) + "…";
    }
}
