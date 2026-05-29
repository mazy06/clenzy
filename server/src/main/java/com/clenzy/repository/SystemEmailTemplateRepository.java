package com.clenzy.repository;

import com.clenzy.model.SystemEmailTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository des templates email systeme editables.
 *
 * <p>Memes patterns que {@link WhatsAppTemplateContentRepository} : pas de
 * filtre Hibernate {@code @Filter("organizationFilter")} car les templates
 * systeme ({@code organization_id IS NULL}) doivent rester visibles pour
 * TOUTES les orgs. La resolution org/systeme est explicite dans les queries
 * ci-dessous via le parametre {@code orgId}.</p>
 */
@Repository
public interface SystemEmailTemplateRepository extends JpaRepository<SystemEmailTemplate, Long> {

    /**
     * Resolution avec fallback : si l'org a un override pour {@code (key, lang)},
     * il gagne ; sinon le template systeme global. Retourne 0 ou 1 ligne.
     */
    @Query("""
        SELECT t FROM SystemEmailTemplate t
        WHERE t.templateKey = :key
          AND t.language = :language
          AND (t.organizationId = :orgId OR t.organizationId IS NULL)
        ORDER BY CASE WHEN t.organizationId IS NULL THEN 1 ELSE 0 END
        """)
    List<SystemEmailTemplate> findResolutionCandidates(
        @Param("key") String key,
        @Param("language") String language,
        @Param("orgId") Long orgId
    );

    /**
     * Liste tous les templates visibles par l'org : systeme + overrides per-org.
     * Utilise par l'UI pour afficher la liste avec badge "Systeme" / "Personnalise".
     */
    @Query("""
        SELECT t FROM SystemEmailTemplate t
        WHERE t.organizationId = :orgId OR t.organizationId IS NULL
        ORDER BY t.templateKey, t.language,
                 CASE WHEN t.organizationId IS NULL THEN 1 ELSE 0 END
        """)
    List<SystemEmailTemplate> findAllVisibleForOrg(@Param("orgId") Long orgId);

    /**
     * Cherche un override specifique pour une org.
     */
    Optional<SystemEmailTemplate> findByOrganizationIdAndTemplateKeyAndLanguage(
        Long organizationId, String templateKey, String language);

    /**
     * Cherche le template systeme parent (pour creer un override avec
     * parent_template_id correct).
     */
    @Query("""
        SELECT t FROM SystemEmailTemplate t
        WHERE t.organizationId IS NULL
          AND t.isSystem = true
          AND t.templateKey = :key
          AND t.language = :language
        """)
    Optional<SystemEmailTemplate> findSystemTemplate(
        @Param("key") String key,
        @Param("language") String language
    );
}
