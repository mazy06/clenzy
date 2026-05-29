package com.clenzy.service.messaging;

import com.clenzy.util.StringUtils;
import org.springframework.stereotype.Service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Applique un wrapper HTML uniforme aux templates email systeme.
 *
 * <p><b>Pourquoi un wrapper</b> : la migration 0156 a converti les bodies en
 * plain text editable (demande utilisateur "pas de HTML dans la construction").
 * L'editeur frontend manipule du texte brut. Mais l'email envoye doit avoir
 * un look professionnel cohérent (header brand, footer, styles). Ce service
 * fait la conversion plain text → HTML rich juste avant l'envoi SMTP.</p>
 *
 * <h3>Wrapper styles</h3>
 * <ul>
 *   <li>{@code NOTIFICATION_OWNER} : alerte au proprietaire — header colore selon
 *       severity ({severityColor} variable), titre "Notification Baitly"</li>
 *   <li>{@code NOTIFICATION_GUEST} : email voyageur — ton sobre, palette neutre,
 *       signature "L'equipe de gestion"</li>
 *   <li>{@code INVITATION} : email avec CTA — le {invitationLink} devient un
 *       bouton primary autogenere (le user ecrit juste {invitationLink} dans
 *       son texte plain, le wrapper transforme en bouton)</li>
 *   <li>{@code INTERNAL_FORM} : notification interne equipe (devis landing) —
 *       header degrade bleu/violet</li>
 *   <li>{@code INTERNAL_URGENT} : meme que INTERNAL_FORM mais header degrade
 *       orange (urgence)</li>
 * </ul>
 *
 * <h3>Convention markdown plain text → HTML</h3>
 * Le body plain text supporte un mini-markdown pour les emphases :
 * <ul>
 *   <li>{@code *gras*} → {@code <strong>gras</strong>}</li>
 *   <li>{@code _italique_} → {@code <em>italique</em>}</li>
 *   <li>Paragraphes : separes par double-newline → {@code <p>}</li>
 *   <li>Simple newline → {@code <br>}</li>
 *   <li>{@code [TEXTE → URL]} → bouton CTA (pour INVITATION uniquement)</li>
 * </ul>
 *
 * <p>Le HTML inject via les variables HTML-safe ({@code {detailsHtml}},
 * {@code {urgencyBanner}}) est preserve tel quel (deja interpole par
 * {@link TemplateInterpolationService}).</p>
 */
@Service
public class EmailWrapperService {

    private static final String BRAND_NAME = "Baitly";
    private static final String BRAND_PRIMARY = "#6B8A9A";

    /** Pattern pour le bouton CTA des emails invitation : [TEXTE → URL]. */
    private static final Pattern CTA_PATTERN = Pattern.compile("\\[([^\\]]+?)\\s*→\\s*(https?://[^\\]\\s]+)\\]");

    /**
     * Wrappe le body plain text (deja interpole) dans un template HTML complet.
     *
     * @param wrapperStyle  style de wrapper (cf. javadoc classe)
     * @param interpolatedBody  body apres interpolation des variables
     *                          (sauts de ligne preserves, markdown leger supporte)
     * @return HTML complet pret a etre envoye via {@code helper.setText(html, true)}
     */
    public String wrap(String wrapperStyle, String interpolatedBody) {
        String style = wrapperStyle != null ? wrapperStyle : "NOTIFICATION_OWNER";
        String bodyHtml = convertPlainTextToHtml(interpolatedBody, "INVITATION".equals(style));

        return switch (style) {
            case "NOTIFICATION_GUEST" -> wrapNotificationGuest(bodyHtml);
            case "INVITATION" -> wrapInvitation(bodyHtml);
            case "INTERNAL_FORM" -> wrapInternalForm(bodyHtml, false);
            case "INTERNAL_URGENT" -> wrapInternalForm(bodyHtml, true);
            default -> wrapNotificationOwner(bodyHtml);
        };
    }

    // ─── Conversion plain text → HTML ────────────────────────────────────────

    /**
     * Convertit le body plain text en HTML : paragraphes, markdown leger
     * ({@code *gras*}, {@code _italique_}), boutons CTA si invitation.
     *
     * <p>NB : les balises HTML deja presentes dans le texte (cas
     * {@code {detailsHtml}} interpole) sont preservees telles quelles. On ne
     * fait PAS d'escape global car certaines variables produisent du HTML
     * volontairement (cf. HTML_SAFE_VARIABLES dans
     * {@link TemplateInterpolationService}).</p>
     *
     * <p><b>Securite</b> : le body provient d'un super-admin Baitly ou d'un
     * host qui edite SON propre override. Pas d'input voyageur direct injecte.
     * Le risque d'XSS est interne (admin malveillant) — acceptable a ce stade.</p>
     */
    private String convertPlainTextToHtml(String text, boolean invitationMode) {
        if (text == null) return "";

        String html = text;

        // Boutons CTA : [TEXTE → URL] → <a class="cta">TEXTE</a>
        // Uniquement pour INVITATION pour eviter qu'un body devis genere
        // accidentellement un bouton.
        if (invitationMode) {
            html = CTA_PATTERN.matcher(html).replaceAll(matcher -> {
                String label = matcher.group(1).trim();
                String url = matcher.group(2).trim();
                return Matcher.quoteReplacement(buildCtaButton(label, url));
            });
        }

        // Markdown leger : *gras*, _italique_
        // Pattern non-greedy, evite de matcher a travers les newlines.
        html = html.replaceAll("\\*([^*\\n]+)\\*", "<strong>$1</strong>");
        html = html.replaceAll("_([^_\\n]+)_", "<em>$1</em>");

        // Decoupage en paragraphes : double-newline = nouveau <p>
        // Single newline = <br>. On preserve les blocs HTML deja presents.
        String[] paragraphs = html.split("\\n\\s*\\n");
        StringBuilder out = new StringBuilder();
        for (String p : paragraphs) {
            String trimmed = p.trim();
            if (trimmed.isEmpty()) continue;

            // Si le paragraphe commence deja par une balise block (<div>, <table>,
            // etc.) c'est qu'on a injecte {detailsHtml} ou {urgencyBanner} : on
            // l'inclut tel quel sans l'enrober dans <p>.
            if (isHtmlBlock(trimmed)) {
                out.append(trimmed).append('\n');
            } else {
                String withBr = trimmed.replace("\n", "<br>");
                out.append("<p style=\"margin:0 0 12px 0;line-height:1.5;color:#334155;\">")
                   .append(withBr)
                   .append("</p>\n");
            }
        }
        return out.toString();
    }

    private boolean isHtmlBlock(String s) {
        String lower = s.toLowerCase();
        return lower.startsWith("<div") || lower.startsWith("<table")
            || lower.startsWith("<section") || lower.startsWith("<article")
            || lower.startsWith("<header") || lower.startsWith("<footer")
            || lower.startsWith("<ul") || lower.startsWith("<ol")
            || lower.startsWith("<p ") || lower.startsWith("<p>");
    }

    private String buildCtaButton(String label, String url) {
        return "<div style=\"text-align:center;margin:24px 0;\">"
            + "<a href=\"" + StringUtils.escapeHtml(url) + "\""
            + " style=\"display:inline-block;padding:14px 32px;background:" + BRAND_PRIMARY
            + ";color:white;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;\">"
            + StringUtils.escapeHtml(label) + "</a></div>";
    }

    // ─── Wrappers HTML ───────────────────────────────────────────────────────

    /**
     * Header sobre Baitly + body + footer. Pour les alertes proprietaire.
     */
    private String wrapNotificationOwner(String bodyHtml) {
        return baseShell(
            BRAND_PRIMARY,
            "Notification " + BRAND_NAME,
            bodyHtml,
            "Cet email a été envoyé automatiquement par " + BRAND_NAME
                + ". Vous pouvez gérer vos préférences depuis votre tableau de bord."
        );
    }

    private String wrapNotificationGuest(String bodyHtml) {
        return baseShell(
            BRAND_PRIMARY,
            BRAND_NAME,
            bodyHtml,
            "Message envoyé depuis " + BRAND_NAME + " pour le compte de votre hébergeur."
        );
    }

    private String wrapInvitation(String bodyHtml) {
        return baseShell(
            BRAND_PRIMARY,
            "Invitation " + BRAND_NAME,
            bodyHtml,
            "Si vous n'avez pas demandé cette invitation, vous pouvez ignorer ce message."
        );
    }

    private String wrapInternalForm(String bodyHtml, boolean urgent) {
        String headerColor = urgent ? "#f97316" : BRAND_PRIMARY;
        String title = urgent ? "🔧 Notification interne — Maintenance" : "📋 Notification interne — Devis";
        return baseShell(
            headerColor,
            title,
            bodyHtml,
            "Email interne généré par le formulaire de la landing page " + BRAND_NAME + "."
        );
    }

    /**
     * Shell HTML commun : header colore + body + footer. Inline-styles only
     * (les clients email type Outlook/Gmail strippent les CSS classes externes).
     */
    private String baseShell(String headerColor, String headerTitle, String bodyHtml, String footerText) {
        return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>"
            + "<body style=\"margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;\">"
            + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"background:#f1f5f9;padding:32px 16px;\">"
            + "<tr><td align=\"center\">"
            + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"600\" style=\"max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);\">"
            // Header
            + "<tr><td style=\"background:" + StringUtils.escapeHtml(headerColor) + ";padding:24px 32px;\">"
            + "<h1 style=\"margin:0;color:#ffffff;font-size:18px;font-weight:600;letter-spacing:-0.01em;\">"
            + StringUtils.escapeHtml(headerTitle)
            + "</h1>"
            + "</td></tr>"
            // Body
            + "<tr><td style=\"padding:32px;\">"
            + bodyHtml
            + "</td></tr>"
            // Footer
            + "<tr><td style=\"padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;\">"
            + "<p style=\"margin:0;font-size:12px;color:#94a3b8;line-height:1.5;\">"
            + StringUtils.escapeHtml(footerText)
            + "</p>"
            + "</td></tr>"
            + "</table>"
            + "</td></tr>"
            + "</table></body></html>";
    }
}
