package com.clenzy.service.messaging.whatsapp;

import java.util.Map;

/**
 * Definition d'un template WhatsApp standard Clenzy, parsee depuis
 * {@code resources/whatsapp-templates/{key}.yaml} au boot par
 * {@link WhatsAppTemplateLoader}.
 *
 * <p>Les templates sont submitted automatiquement a Meta apres un signup
 * Embedded reussi par {@link MetaTemplateProvisioner}. Chaque template
 * est multi-langue (FR/EN/AR) — Meta cree une entree par langue, l'host
 * choisit laquelle utiliser via {@code OrgWhatsAppTemplate.template_language}.</p>
 *
 * <h3>Categories Meta</h3>
 * <ul>
 *   <li>{@code UTILITY} : transactionnel (~$0.022/conv FR). Default Clenzy.</li>
 *   <li>{@code MARKETING} : promo (~$0.069/conv FR). Pas utilise en v1.</li>
 *   <li>{@code AUTHENTICATION} : OTP (~$0.032/conv FR). Pas utilise.</li>
 * </ul>
 *
 * @param key cle logique stable (ex: "booking_confirmation"), utilisee comme
 *            template_key dans {@code org_whatsapp_templates} et comme
 *            prefixe du nom Meta ("clenzy_booking_confirmation_v1")
 * @param category category Meta — toujours UTILITY en v1
 * @param languages map locale -> body (locale au format Meta : fr_FR, en_US, ar_AR)
 */
public record WhatsAppTemplateDefinition(
    String key,
    String category,
    Map<String, LanguageBody> languages
) {

    /**
     * Body d'un template pour une langue donnee. Pour MVP, on supporte
     * uniquement les templates type "body texte avec parametres {{1}}, {{2}}".
     * Pas de header media, pas de footer, pas de boutons interactifs
     * (a ajouter en v2 selon les besoins specifiques).
     */
    public record LanguageBody(String body) {}

    /**
     * Nom du template tel que Meta le voit (lowercase, snake_case,
     * prefixe Clenzy + version pour permettre des bumps non-breaking).
     */
    public String metaTemplateName() {
        return "clenzy_" + key + "_v1";
    }
}
