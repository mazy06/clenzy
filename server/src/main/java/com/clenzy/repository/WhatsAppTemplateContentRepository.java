package com.clenzy.repository;

import com.clenzy.model.WhatsAppTemplateContent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository des templates WhatsApp editables.
 *
 * <p>NB : pas de filtre Hibernate {@code @Filter("organizationFilter")} sur
 * {@link WhatsAppTemplateContent} car les templates systeme ({@code organization_id IS NULL})
 * doivent rester visibles pour TOUTES les orgs. La resolution org/systeme est
 * explicite dans chaque query ci-dessous (parametre {@code orgId}).</p>
 */
@Repository
public interface WhatsAppTemplateContentRepository extends JpaRepository<WhatsAppTemplateContent, Long> {

    /**
     * Resolution avec fallback : si l'org a un override pour {@code (key, lang)},
     * il gagne ; sinon le template systeme global. Retourne 0 ou 1 ligne.
     *
     * <p>L'ordre {@code CASE ... 0 ELSE 1} renvoie d'abord les overrides org
     * (organizationId = orgId), puis les systeme (organizationId IS NULL).
     * {@code LIMIT 1} ne garde que le premier.</p>
     */
    @Query("""
        SELECT t FROM WhatsAppTemplateContent t
        WHERE t.templateKey = :key
          AND t.language = :language
          AND (t.organizationId = :orgId OR t.organizationId IS NULL)
        ORDER BY CASE WHEN t.organizationId IS NULL THEN 1 ELSE 0 END
        """)
    List<WhatsAppTemplateContent> findResolutionCandidates(
        @Param("key") String key,
        @Param("language") String language,
        @Param("orgId") Long orgId
    );

    /**
     * Liste tous les templates visibles par l'org : systeme + overrides per-org.
     * Utilise par l'UI pour afficher la liste avec badge "Systeme" / "Personnalise".
     *
     * <p>Trie par templateKey puis language pour faciliter le regroupement
     * cote service. Les overrides org apparaissent en premier (mais le service
     * dedup par (key, lang) en gardant l'override).</p>
     */
    @Query("""
        SELECT t FROM WhatsAppTemplateContent t
        WHERE t.organizationId = :orgId OR t.organizationId IS NULL
        ORDER BY t.templateKey, t.language,
                 CASE WHEN t.organizationId IS NULL THEN 1 ELSE 0 END
        """)
    List<WhatsAppTemplateContent> findAllVisibleForOrg(@Param("orgId") Long orgId);

    /**
     * Cherche un override specifique pour une org. Utilise quand l'user veut
     * editer/supprimer son override (sans toucher au systeme).
     */
    Optional<WhatsAppTemplateContent> findByOrganizationIdAndTemplateKeyAndLanguage(
        Long organizationId, String templateKey, String language);

    /**
     * Cherche le template systeme parent pour une cle/langue donnee.
     * Utilise pour creer un override (le fork pointe vers le systeme parent
     * via {@code parent_template_id}).
     */
    @Query("""
        SELECT t FROM WhatsAppTemplateContent t
        WHERE t.organizationId IS NULL
          AND t.isSystem = true
          AND t.templateKey = :key
          AND t.language = :language
        """)
    Optional<WhatsAppTemplateContent> findSystemTemplate(
        @Param("key") String key,
        @Param("language") String language
    );

    /**
     * Liste TOUS les templates systeme (organizationId IS NULL).
     * Utilise par {@link com.clenzy.service.messaging.whatsapp.WhatsAppTemplateLoader}
     * pour exposer la liste des templates Clenzy de reference (sans tenir
     * compte des overrides org).
     */
    @Query("""
        SELECT t FROM WhatsAppTemplateContent t
        WHERE t.organizationId IS NULL AND t.isSystem = true
        ORDER BY t.templateKey, t.language
        """)
    List<WhatsAppTemplateContent> findAllSystemTemplates();
}
