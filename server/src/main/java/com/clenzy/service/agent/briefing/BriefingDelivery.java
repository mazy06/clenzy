package com.clenzy.service.agent.briefing;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.OrgWhatsAppTemplate;
import com.clenzy.model.User;
import com.clenzy.model.WhatsAppConfig;
import com.clenzy.repository.OrgWhatsAppTemplateRepository;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
    /** Template WhatsApp pre-approuve par defaut (fallback si pas d'override per-org). */
    private static final String WHATSAPP_TEMPLATE_DEFAULT = "engagement_update";
    private static final String WHATSAPP_TEMPLATE_DEFAULT_LANG = "fr";
    /** Cle logique du briefing dans org_whatsapp_templates. */
    static final String WHATSAPP_TEMPLATE_KEY_BRIEFING = "briefing";

    private final NotificationService notificationService;
    private final EmailChannel emailChannel;
    private final WhatsAppApiService whatsAppApiService;
    private final UserRepository userRepository;
    private final WhatsAppConfigRepository whatsAppConfigRepository;
    private final OrgWhatsAppTemplateRepository orgWaTemplateRepository;
    private final EmailTemplateLoader emailTemplateLoader;

    public BriefingDelivery(NotificationService notificationService,
                              EmailChannel emailChannel,
                              WhatsAppApiService whatsAppApiService,
                              UserRepository userRepository,
                              WhatsAppConfigRepository whatsAppConfigRepository,
                              OrgWhatsAppTemplateRepository orgWaTemplateRepository,
                              EmailTemplateLoader emailTemplateLoader) {
        this.notificationService = notificationService;
        this.emailChannel = emailChannel;
        this.whatsAppApiService = whatsAppApiService;
        this.userRepository = userRepository;
        this.whatsAppConfigRepository = whatsAppConfigRepository;
        this.orgWaTemplateRepository = orgWaTemplateRepository;
        this.emailTemplateLoader = emailTemplateLoader;
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
        String ctaUrl = result.conversationId() != null
                ? "/assistant/conversations/" + result.conversationId()
                : "/assistant";
        String html = buildEmailHtml(result.shortTitle(), body, ctaUrl);
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
     * Construit le HTML via le template {@code email-templates/briefing.html}.
     * Si le template n'est pas chargeable (fichier absent en runtime), tombe
     * sur un HTML inline minimaliste pour ne pas casser l'envoi.
     */
    String buildEmailHtml(String title, String body) {
        return buildEmailHtml(title, body, "/assistant");
    }

    String buildEmailHtml(String title, String body, String ctaUrl) {
        String safeTitle = StringUtils.escapeHtml(title);
        String safeBody = StringUtils.escapeHtml(body).replace("\n", "<br/>");
        String safeCtaUrl = StringUtils.escapeHtml(ctaUrl != null ? ctaUrl : "/assistant");

        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("title", safeTitle);
        vars.put("subtitle", "Synthese strategique automatique");
        vars.put("body", safeBody);
        vars.put("ctaUrl", safeCtaUrl);
        vars.put("ctaLabel", "Ouvrir dans l'assistant");
        String rendered = emailTemplateLoader.renderBriefing(vars);
        if (rendered != null) return rendered;

        // Fallback minimaliste si le template n'a pas pu etre charge
        return "<!doctype html><html><body style=\"font-family:Helvetica,Arial,sans-serif;"
                + "max-width:640px;margin:0 auto;padding:24px;color:#1f2937;\">"
                + "<h2 style=\"color:#6B8A9A;\">" + safeTitle + "</h2>"
                + "<div style=\"line-height:1.55;font-size:14px;\">" + safeBody + "</div>"
                + "</body></html>";
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

        // Lookup du template custom per-org, fallback default applicatif
        TemplateResolution tpl = resolveWhatsAppTemplate(organizationId);
        try {
            String response = whatsAppApiService.sendTemplateMessage(
                    configOpt.get(),
                    userOpt.get().getPhoneNumber(),
                    tpl.name,
                    tpl.language);
            return response != null;
        } catch (Exception e) {
            log.warn("Briefing whatsapp failed for user {} : {}",
                    userOpt.get().getKeycloakId(), e.getMessage());
            return false;
        }
    }

    /**
     * Resolution du couple {@code (template_name, language)} pour le briefing :
     * d'abord le mapping per-org sur la cle "briefing", sinon le default
     * applicatif ({@code engagement_update}). Echec silencieux : si le repo
     * casse, on prend le default — un briefing reste mieux qu'aucun.
     */
    TemplateResolution resolveWhatsAppTemplate(Long organizationId) {
        try {
            Optional<OrgWhatsAppTemplate> override = orgWaTemplateRepository
                    .findByOrganizationIdAndTemplateKey(organizationId, WHATSAPP_TEMPLATE_KEY_BRIEFING);
            if (override.isPresent()) {
                return new TemplateResolution(
                        override.get().getTemplateName(),
                        override.get().getTemplateLanguage(),
                        TemplateSource.ORG_OVERRIDE);
            }
        } catch (Exception e) {
            log.debug("WA template lookup failed for org {} : {}", organizationId, e.getMessage());
        }
        return new TemplateResolution(WHATSAPP_TEMPLATE_DEFAULT, WHATSAPP_TEMPLATE_DEFAULT_LANG,
                TemplateSource.DEFAULT);
    }

    /** Package-private — visible aux tests pour valider le routing. */
    record TemplateResolution(String name, String language, TemplateSource source) {}

    enum TemplateSource { ORG_OVERRIDE, DEFAULT }

    private static String excerpt(String text, int max) {
        if (text == null) return "";
        String trimmed = text.replaceAll("\\s+", " ").trim();
        if (trimmed.length() <= max) return trimmed;
        return trimmed.substring(0, max - 1) + "…";
    }
}
