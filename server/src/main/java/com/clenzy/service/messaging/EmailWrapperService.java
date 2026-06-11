package com.clenzy.service.messaging;

import com.clenzy.util.EmailHtmlSanitizer;
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
        // Defense en profondeur stored XSS : les overrides per-org de templates
        // sont editables via l'API ; on supprime au rendu tout construct dangereux
        // (script/iframe/object/embed, on*=, javascript:) — couvre aussi les
        // overrides stockes avant la sanitisation au stockage. Les blocs HTML
        // trusted ({detailsHtml}, {urgencyBanner}) n'en contiennent pas et
        // restent intacts (suppression ciblee, pas de reformatage).
        String safeBody = EmailHtmlSanitizer.sanitize(interpolatedBody);
        String bodyHtml = convertPlainTextToHtml(safeBody, "INVITATION".equals(style));

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
     * <p><b>Securite</b> : le body est sanitise par {@link EmailHtmlSanitizer}
     * dans {@link #wrap} avant d'arriver ici (suppression script/iframe/on*=/
     * javascript:) — l'ecriture des overrides est par ailleurs restreinte aux
     * roles d'administration d'org cote controller.</p>
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

        // Markdown leger : **gras** (standard) puis *gras* (legacy), _italique_.
        // Le double-asterisque est traite EN PREMIER pour que "**texte**" rende
        // <strong>texte</strong> et non "*<strong>texte</strong>*".
        // Patterns non-greedy, sans newline ni asterisque interne.
        html = html.replaceAll("\\*\\*([^*\\n]+?)\\*\\*", "<strong>$1</strong>");
        html = html.replaceAll("\\*([^*\\n]+?)\\*", "<strong>$1</strong>");
        html = html.replaceAll("_([^_\\n]+?)_", "<em>$1</em>");

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
                out.append(renderParagraph(trimmed));
            }
        }
        return out.toString();
    }

    /**
     * Rend un paragraphe plain text en HTML. Detecte les listes a puces (lignes
     * commencant par "• ", "- " ou "– ") et les regroupe en {@code <ul><li>} ; le
     * reste devient un {@code <p>} avec {@code <br>} pour les retours simples.
     * Permet d'avoir des vraies listes a puces dans les emails (instructions,
     * regles de la maison, checklist de depart) plutot qu'un bloc "<br>•".
     */
    private String renderParagraph(String paragraph) {
        String[] lines = paragraph.split("\n");
        StringBuilder out = new StringBuilder();
        StringBuilder text = new StringBuilder();   // lignes de texte accumulees
        StringBuilder items = new StringBuilder();  // <li> accumules

        for (String rawLine : lines) {
            String line = rawLine.trim();
            String bullet = stripBulletMarker(line);
            if (bullet != null) {
                flushText(out, text);
                items.append("<li style=\"margin:0 0 4px 0;\">").append(bullet).append("</li>");
            } else {
                flushList(out, items);
                if (line.isEmpty()) continue;
                if (text.length() > 0) text.append("<br>");
                text.append(line);
            }
        }
        flushText(out, text);
        flushList(out, items);
        return out.toString();
    }

    private void flushText(StringBuilder out, StringBuilder text) {
        if (text.length() == 0) return;
        out.append("<p style=\"margin:0 0 12px 0;line-height:1.6;color:#334155;\">")
           .append(text).append("</p>\n");
        text.setLength(0);
    }

    private void flushList(StringBuilder out, StringBuilder items) {
        if (items.length() == 0) return;
        out.append("<ul style=\"margin:0 0 14px 0;padding-left:22px;line-height:1.6;color:#334155;\">")
           .append(items).append("</ul>\n");
        items.setLength(0);
    }

    /**
     * Retourne le contenu d'une ligne de liste sans son marqueur ("• ", "‣ ",
     * "- ", "– "), ou {@code null} si la ligne n'est pas une puce.
     */
    private String stripBulletMarker(String line) {
        if (line.startsWith("• ")) return line.substring(2).trim();
        if (line.startsWith("‣ ")) return line.substring(2).trim();
        if (line.startsWith("- ")) return line.substring(2).trim();
        if (line.startsWith("– ")) return line.substring(2).trim();
        if (line.startsWith("•"))  return line.substring(1).trim();
        return null;
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
        // CTA minimaliste : padding compact, font-size reduit, border-radius leger.
        // Vise un look "premium SaaS" plutot que "marketing oversized".
        return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\""
            + " style=\"margin:28px auto;\"><tr><td style=\"border-radius:6px;background:"
            + BRAND_PRIMARY + ";\">"
            + "<a href=\"" + StringUtils.escapeHtml(url) + "\""
            + " style=\"display:inline-block;padding:11px 22px;background:" + BRAND_PRIMARY
            + ";color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;"
            + "font-weight:600;letter-spacing:0.01em;\">"
            + StringUtils.escapeHtml(label) + "</a></td></tr></table>";
    }

    // ─── Wrappers HTML ───────────────────────────────────────────────────────

    /**
     * Header sobre Baitly + body + footer. Pour les alertes proprietaire.
     */
    private String wrapNotificationOwner(String bodyHtml) {
        return baseShell(
            "Notification",
            bodyHtml,
            "Email automatique de " + BRAND_NAME + ". Tu peux gerer tes preferences depuis ton tableau de bord."
        );
    }

    private String wrapNotificationGuest(String bodyHtml) {
        return baseShell(
            "Message",
            bodyHtml,
            "Envoye depuis " + BRAND_NAME + " pour le compte de votre hebergeur."
        );
    }

    private String wrapInvitation(String bodyHtml) {
        return baseShell(
            "Invitation",
            bodyHtml,
            "Si tu n'attendais pas cette invitation, ignore simplement ce message."
        );
    }

    private String wrapInternalForm(String bodyHtml, boolean urgent) {
        String subtitle = urgent ? "Maintenance urgente" : "Demande de devis";
        return baseShell(
            subtitle,
            bodyHtml,
            "Email interne genere par le formulaire de la landing page " + BRAND_NAME + "."
        );
    }

    /**
     * Shell HTML minimaliste : wordmark Baitly + sous-titre fin + body + footer.
     *
     * <p>Design editorial sobre — pas d'image, pas de bandeau colore. Le brand
     * se manifeste uniquement par le wordmark typo et l'accent couleur sur le
     * CTA. Optimise pour la lisibilite (16px) sur mobile + desktop.</p>
     *
     * <p>Inline-styles only (Outlook/Gmail strippent les CSS classes externes).</p>
     */
    private String baseShell(String subtitle, String bodyHtml, String footerText) {
        return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\">"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            + "<meta name=\"color-scheme\" content=\"light\">"
            + "<meta name=\"supported-color-schemes\" content=\"light\">"
            + "</head>"
            + "<body style=\"margin:0;padding:0;background:#f8fafc;"
            + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;"
            + "color:#0f172a;-webkit-font-smoothing:antialiased;\">"
            + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\""
            + " width=\"100%\" style=\"background:#f8fafc;padding:48px 16px;\">"
            + "<tr><td align=\"center\">"
            + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\""
            + " width=\"560\" style=\"max-width:560px;background:#ffffff;border-radius:8px;"
            + "border:1px solid #e2e8f0;\">"

            // Header : wordmark Baitly + sous-titre
            + "<tr><td style=\"padding:36px 40px 24px 40px;border-bottom:1px solid #f1f5f9;\">"
            + "<div style=\"font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;"
            + "line-height:1;\">"
            + BRAND_NAME
            + "<span style=\"color:" + BRAND_PRIMARY + ";\">.</span>"
            + "</div>"
            + "<div style=\"margin-top:6px;font-size:11px;font-weight:500;text-transform:uppercase;"
            + "letter-spacing:0.12em;color:#94a3b8;\">"
            + StringUtils.escapeHtml(subtitle)
            + "</div>"
            + "</td></tr>"

            // Body : padding genereux, font-size 15px, line-height 1.6
            + "<tr><td style=\"padding:32px 40px 12px 40px;font-size:15px;line-height:1.6;color:#334155;\">"
            + bodyHtml
            + "</td></tr>"

            // Footer : ultra-discret, font-size 11px, gris pale
            + "<tr><td style=\"padding:20px 40px 28px 40px;border-top:1px solid #f1f5f9;\">"
            + "<p style=\"margin:0;font-size:11px;color:#94a3b8;line-height:1.6;\">"
            + StringUtils.escapeHtml(footerText)
            + "</p>"
            + "</td></tr>"

            + "</table>"
            + "</td></tr>"
            + "</table></body></html>";
    }
}
