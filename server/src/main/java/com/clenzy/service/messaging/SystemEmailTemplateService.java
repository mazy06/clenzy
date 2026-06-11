package com.clenzy.service.messaging;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.SystemEmailTemplate;
import com.clenzy.repository.SystemEmailTemplateRepository;
import com.clenzy.util.EmailHtmlSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Source de verite des templates email systeme editables (table
 * {@code system_email_template}).
 *
 * <p>Remplace les 5 String.format hardcodes dans
 * {@code NoiseAlertNotificationService} et {@code EmailService}. Les services
 * appellent {@link #resolveSubject} et {@link #resolveBody} pour obtenir le
 * contenu effectif d'un template pour une org + langue donnee, avec fallback
 * systeme automatique.</p>
 *
 * <h3>Modele de resolution</h3>
 * Identique a
 * {@link com.clenzy.service.messaging.whatsapp.WhatsAppTemplateService} :
 * <pre>
 *   resolve(org=42, key="noise_alert_owner", lang="fr")
 *     1. Cherche un OVERRIDE pour org=42 (organization_id=42)
 *     2. Si pas d'override → fallback systeme (organization_id=NULL, is_system=true)
 *     3. Si rien → Optional.empty (template inconnu, caller decide quoi faire)
 * </pre>
 *
 * <h3>Variables dynamiques (pre-rendu Java)</h3>
 * Les templates {@code quote_request_internal} et {@code maintenance_request_internal}
 * utilisent les variables speciales {@code {detailsHtml}} et {@code {urgencyBanner}}
 * pre-rendues cote Java. C'est le caller (EmailService) qui injecte les valeurs
 * via {@link TemplateInterpolationService#replaceVariables} avant l'envoi.
 */
@Service
public class SystemEmailTemplateService {

    private static final Logger log = LoggerFactory.getLogger(SystemEmailTemplateService.class);

    private final SystemEmailTemplateRepository repository;

    public SystemEmailTemplateService(SystemEmailTemplateRepository repository) {
        this.repository = repository;
    }

    /**
     * Resout le template a utiliser pour une org + langue donnee, avec fallback
     * sur le template systeme global si pas d'override per-org.
     *
     * @param organizationId id de l'org (peut etre null pour les flows internes
     *                       sans contexte tenant, ex: notifications landing page
     *                       sans org rattachee — dans ce cas seul le systeme repond)
     * @param templateKey    cle logique (ex. "noise_alert_owner")
     * @param language       locale (ex. "fr")
     * @return template resolu (override org si existe, sinon systeme), ou empty
     */
    @Transactional(readOnly = true)
    public Optional<SystemEmailTemplate> resolve(Long organizationId, String templateKey, String language) {
        // organizationId peut etre null pour les flows globaux (landing page sans
        // org tenant). On passe -1 dans ce cas pour que la query ne matche aucun
        // override et tombe sur le systeme.
        Long effectiveOrgId = organizationId != null ? organizationId : -1L;
        List<SystemEmailTemplate> candidates = repository.findResolutionCandidates(
            templateKey, language, effectiveOrgId);
        return candidates.isEmpty() ? Optional.empty() : Optional.of(candidates.get(0));
    }

    /**
     * Liste tous les templates visibles par une org, deduplique par (key, lang)
     * en privilegiant l'override sur le systeme.
     *
     * <p>Structure de retour : {@code templateKey -> { language -> template }}
     * pour faciliter le rendu cote frontend.</p>
     */
    @Transactional(readOnly = true)
    public Map<String, Map<String, SystemEmailTemplate>> listGroupedForOrg(Long organizationId) {
        if (organizationId == null) {
            throw new IllegalArgumentException("organizationId requis pour listGroupedForOrg()");
        }
        List<SystemEmailTemplate> all = repository.findAllVisibleForOrg(organizationId);

        // Group par (key, lang) avec preference override > systeme.
        Map<String, Map<String, SystemEmailTemplate>> grouped = new LinkedHashMap<>();
        for (SystemEmailTemplate t : all) {
            grouped.computeIfAbsent(t.getTemplateKey(), k -> new LinkedHashMap<>())
                   .putIfAbsent(t.getLanguage(), t);
        }
        return grouped;
    }

    /**
     * Cree (ou met a jour) un override per-org pour un template systeme donne.
     *
     * @param organizationId id de l'org proprietaire de l'override
     * @param templateKey    cle logique
     * @param language       locale
     * @param newSubject     nouveau sujet (peut contenir des variables {nameVar})
     * @param newBody        nouveau corps plain text (wrappe en HTML cote serveur)
     * @return template apres save (avec id genere si nouveau)
     */
    @Transactional
    public SystemEmailTemplate upsertOverride(Long organizationId, String templateKey,
                                                String language, String newSubject, String newBody) {
        if (organizationId == null) {
            throw new IllegalArgumentException("organizationId requis pour upsertOverride()");
        }
        if (newSubject == null || newSubject.isBlank()) {
            throw new IllegalArgumentException("subject ne peut pas etre vide");
        }
        if (newSubject.length() > 255) {
            throw new IllegalArgumentException("subject depasse 255 caracteres : " + newSubject.length());
        }
        if (newBody == null || newBody.isBlank()) {
            throw new IllegalArgumentException("body ne peut pas etre vide");
        }
        if (newBody.length() > 100000) {
            throw new IllegalArgumentException(
                "body depasse 100000 caracteres (100KB) : " + newBody.length());
        }

        // Defense stored XSS : le body est emis dans des emails recus par des tiers
        // (owners, guests). Suppression des constructs dangereux (script/iframe/
        // object/embed, on*=, javascript:) AVANT stockage. Le rendu re-sanitise
        // par defense en profondeur (EmailWrapperService) pour couvrir les
        // overrides historiques anterieurs a ce correctif.
        String safeBody = EmailHtmlSanitizer.sanitize(newBody);
        if (safeBody.isBlank()) {
            throw new IllegalArgumentException(
                "body ne contient plus de contenu apres suppression du HTML dangereux");
        }

        Optional<SystemEmailTemplate> existing = repository
            .findByOrganizationIdAndTemplateKeyAndLanguage(organizationId, templateKey, language);

        if (existing.isPresent()) {
            SystemEmailTemplate override = existing.get();
            override.setSubject(newSubject);
            override.setBody(safeBody);
            // updated_at bumped par trigger DB + @PreUpdate
            return repository.save(override);
        }

        // Pas d'override existant → on cree un fork. Recupere le systeme pour
        // heriter recipientType, wrapperStyle et tracer le parent_template_id.
        SystemEmailTemplate system = repository.findSystemTemplate(templateKey, language)
            .orElseThrow(() -> new NotFoundException(
                "Aucun template systeme pour (" + templateKey + ", " + language + ")"));

        SystemEmailTemplate override = new SystemEmailTemplate(
            organizationId, templateKey, language, system.getRecipientType(),
            newSubject, safeBody, system.getWrapperStyle(), system.getId());
        log.info("Creation override email template org={} key={} lang={}",
            organizationId, templateKey, language);
        return repository.save(override);
    }

    /**
     * Supprime un override per-org → l'org retombe sur le template systeme.
     *
     * @throws NotFoundException si pas d'override pour ce (org, key, lang)
     * @throws AccessDeniedException si on tente de supprimer un template systeme
     */
    @Transactional
    public void removeOverride(Long organizationId, String templateKey, String language) {
        if (organizationId == null) {
            throw new IllegalArgumentException("organizationId requis pour removeOverride()");
        }
        SystemEmailTemplate override = repository
            .findByOrganizationIdAndTemplateKeyAndLanguage(organizationId, templateKey, language)
            .orElseThrow(() -> new NotFoundException(
                "Aucun override pour (" + templateKey + ", " + language + ") dans l'org " + organizationId));

        if (override.isSystem()) {
            throw new AccessDeniedException(
                "Impossible de supprimer un template systeme via removeOverride()");
        }

        log.info("Suppression override email template org={} key={} lang={}",
            organizationId, templateKey, language);
        repository.delete(override);
    }
}
