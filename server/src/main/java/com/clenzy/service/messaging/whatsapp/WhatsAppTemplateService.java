package com.clenzy.service.messaging.whatsapp;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.WhatsAppTemplateContent;
import com.clenzy.repository.WhatsAppTemplateContentRepository;
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
 * Source de verite des templates WhatsApp editables (table {@code whatsapp_template_content}).
 *
 * <p>Remplace l'ancien chargement YAML statique de {@link WhatsAppTemplateLoader}.
 * Les services consommateurs (envoi WhatsApp, MetaTemplateProvisioner) appellent
 * {@link #resolve} pour obtenir le contenu effectif d'un template pour une org +
 * langue donnee, avec fallback systeme automatique.</p>
 *
 * <h3>Modele de resolution</h3>
 * <pre>
 *   resolve(org=42, key="checkin_instructions", lang="fr_FR")
 *     1. Cherche un OVERRIDE pour org=42 (organization_id=42)
 *     2. Si pas d'override → fallback systeme (organization_id=NULL, is_system=true)
 *     3. Si rien → Optional.empty (template inconnu, caller decide quoi faire)
 * </pre>
 *
 * <h3>Operations d'edition</h3>
 * <ul>
 *   <li>{@link #upsertOverride} : cree ou met a jour un override per-org (fork du systeme)</li>
 *   <li>{@link #removeOverride} : supprime l'override → retour au defaut systeme</li>
 * </ul>
 *
 * <h3>Contraintes de securite</h3>
 * Les templates systeme ({@code is_system=true}) ne peuvent jamais etre modifies
 * ou supprimes par une org. Toute tentative leve {@link AccessDeniedException}.
 * Seuls les SUPER_ADMIN peuvent toucher aux templates systeme via un endpoint
 * admin dedie (a venir, hors scope MVP).
 */
@Service
public class WhatsAppTemplateService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppTemplateService.class);

    private final WhatsAppTemplateContentRepository repository;

    public WhatsAppTemplateService(WhatsAppTemplateContentRepository repository) {
        this.repository = repository;
    }

    /**
     * Resout le template a utiliser pour une org + langue donnee, avec fallback
     * sur le template systeme global si pas d'override per-org.
     *
     * @param organizationId id de l'org (non null — on n'a pas de cas "global query"
     *                       cote envoi : envoyer un message implique forcement une org)
     * @param templateKey    cle logique (ex. "checkin_instructions")
     * @param language       locale Meta (ex. "fr_FR")
     * @return template resolu (override org si existe, sinon systeme), ou empty si
     *         aucun template (cas anormal : seed devrait fournir le systeme)
     */
    @Transactional(readOnly = true)
    public Optional<WhatsAppTemplateContent> resolve(Long organizationId, String templateKey, String language) {
        if (organizationId == null) {
            throw new IllegalArgumentException("organizationId requis pour resolve()");
        }
        List<WhatsAppTemplateContent> candidates = repository.findResolutionCandidates(
            templateKey, language, organizationId);
        return candidates.isEmpty() ? Optional.empty() : Optional.of(candidates.get(0));
    }

    /**
     * Liste tous les templates visibles par une org, deduplique par (key, lang)
     * en privilegiant l'override sur le systeme. Garde aussi l'origine pour que
     * l'UI affiche un badge "Systeme" vs "Personnalise".
     *
     * <p>Structure de retour : ordered map {@code templateKey -> { language -> template }}
     * pour faciliter le rendu cote frontend (1 ligne par template, 3 colonnes pour
     * les langues).</p>
     */
    @Transactional(readOnly = true)
    public Map<String, Map<String, WhatsAppTemplateContent>> listGroupedForOrg(Long organizationId) {
        if (organizationId == null) {
            throw new IllegalArgumentException("organizationId requis pour listGroupedForOrg()");
        }
        List<WhatsAppTemplateContent> all = repository.findAllVisibleForOrg(organizationId);

        // Group par (key, lang). Le ORDER BY de la query place les overrides org
        // AVANT les systeme pour le meme (key, lang), donc le premier put() pose
        // l'override et les putIfAbsent suivants gardent l'override en place.
        Map<String, Map<String, WhatsAppTemplateContent>> grouped = new LinkedHashMap<>();
        for (WhatsAppTemplateContent t : all) {
            grouped.computeIfAbsent(t.getTemplateKey(), k -> new LinkedHashMap<>())
                   .putIfAbsent(t.getLanguage(), t);
        }
        return grouped;
    }

    /**
     * Cree (ou met a jour) un override per-org pour un template systeme donne.
     *
     * <p>Si un override existe deja → update son {@code body_named} + {@code updated_at}.
     * Sinon → cree une nouvelle ligne {@code organization_id=org, is_system=false,
     * parent_template_id=<id du systeme>}.</p>
     *
     * @param organizationId id de l'org proprietaire de l'override
     * @param templateKey    cle logique
     * @param language       locale Meta
     * @param newBody        nouveau contenu au format nomme
     * @return template apres save (avec id genere si nouveau)
     */
    @Transactional
    public WhatsAppTemplateContent upsertOverride(Long organizationId, String templateKey,
                                                    String language, String newBody) {
        if (organizationId == null) {
            throw new IllegalArgumentException("organizationId requis pour upsertOverride()");
        }
        if (newBody == null || newBody.isBlank()) {
            throw new IllegalArgumentException("body_named ne peut pas etre vide");
        }
        if (newBody.length() > 1024) {
            // Aligne sur la contrainte SQL CHECK + limite Meta body component.
            throw new IllegalArgumentException(
                "body_named depasse 1024 caracteres (limite Meta) : " + newBody.length());
        }

        Optional<WhatsAppTemplateContent> existing = repository
            .findByOrganizationIdAndTemplateKeyAndLanguage(organizationId, templateKey, language);

        if (existing.isPresent()) {
            WhatsAppTemplateContent override = existing.get();
            override.setBodyNamed(newBody);
            // updated_at est bumped par le trigger DB + @PreUpdate
            return repository.save(override);
        }

        // Pas d'override existant → on cree un fork. On recupere le systeme parent
        // pour heriter de la category (UTILITY/MARKETING/AUTHENTICATION) et tracer
        // le lien pour le bouton "Restaurer le defaut".
        WhatsAppTemplateContent system = repository.findSystemTemplate(templateKey, language)
            .orElseThrow(() -> new NotFoundException(
                "Aucun template systeme pour (" + templateKey + ", " + language + ")"));

        WhatsAppTemplateContent override = new WhatsAppTemplateContent(
            organizationId, templateKey, language, system.getCategory(), newBody, system.getId());
        log.info("Creation override WhatsApp template org={} key={} lang={}",
            organizationId, templateKey, language);
        return repository.save(override);
    }

    /**
     * Supprime un override per-org → l'org retombe sur le template systeme au
     * prochain {@link #resolve}.
     *
     * @throws AccessDeniedException si on tente de supprimer un template systeme
     * @throws NotFoundException si pas d'override pour ce (org, key, lang)
     */
    @Transactional
    public void removeOverride(Long organizationId, String templateKey, String language) {
        if (organizationId == null) {
            throw new IllegalArgumentException("organizationId requis pour removeOverride()");
        }
        WhatsAppTemplateContent override = repository
            .findByOrganizationIdAndTemplateKeyAndLanguage(organizationId, templateKey, language)
            .orElseThrow(() -> new NotFoundException(
                "Aucun override pour (" + templateKey + ", " + language + ") dans l'org " + organizationId));

        // Defense en profondeur : si quelqu'un a marque is_system=true sur une
        // ligne avec organization_id non nul (incoherent vs la CHECK SQL),
        // on refuse quand meme la suppression.
        if (override.isSystem()) {
            throw new AccessDeniedException(
                "Impossible de supprimer un template systeme via removeOverride()");
        }

        log.info("Suppression override WhatsApp template org={} key={} lang={}",
            organizationId, templateKey, language);
        repository.delete(override);
    }

    /**
     * Garde-fou : verifie qu'une ligne n'est PAS un template systeme. Utilise par
     * les controllers avant d'autoriser une edition. Sert de couche de defense
     * supplementaire au-dessus du flag {@code is_system}.
     */
    public void assertEditable(WhatsAppTemplateContent template, Long requesterOrgId) {
        if (template.isSystem()) {
            throw new AccessDeniedException(
                "Le template " + template.getTemplateKey() + " est un template systeme Clenzy, non modifiable.");
        }
        if (template.getOrganizationId() == null || !template.getOrganizationId().equals(requesterOrgId)) {
            throw new AccessDeniedException(
                "Ce template ne vous appartient pas (org " + template.getOrganizationId() + ").");
        }
    }
}
