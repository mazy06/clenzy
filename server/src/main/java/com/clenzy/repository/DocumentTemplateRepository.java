package com.clenzy.repository;

import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DocumentTemplateRepository extends JpaRepository<DocumentTemplate, Long> {

    Optional<DocumentTemplate> findByDocumentTypeAndActiveTrue(DocumentType documentType);

    @Query("SELECT t FROM DocumentTemplate t LEFT JOIN FETCH t.tags WHERE t.id = :id")
    Optional<DocumentTemplate> findByIdWithTags(@Param("id") Long id);

    List<DocumentTemplate> findByDocumentTypeOrderByVersionDesc(DocumentType documentType);

    @Query("SELECT DISTINCT t FROM DocumentTemplate t LEFT JOIN FETCH t.tags ORDER BY t.documentType ASC, t.version DESC")
    List<DocumentTemplate> findAllByOrderByDocumentTypeAscVersionDesc();

    /**
     * Templates visibles par une organisation : les siens, plus les modeles globaux
     * de la plateforme ({@code organizationId IS NULL}).
     *
     * <p>{@link #findAllByOrderByDocumentTypeAscVersionDesc()} rendait les templates de
     * TOUTES les organisations, exposant leurs {@code emailSubject}, {@code emailBody} et
     * {@code createdBy} a tout HOST (audit securite 2026-07-26, constat P1-18).
     */
    @Query("SELECT DISTINCT t FROM DocumentTemplate t LEFT JOIN FETCH t.tags "
         + "WHERE t.organizationId = :organizationId OR t.organizationId IS NULL "
         + "ORDER BY t.documentType ASC, t.version DESC")
    List<DocumentTemplate> findVisibleForOrganization(@Param("organizationId") Long organizationId);

    boolean existsByDocumentTypeAndActiveTrue(DocumentType documentType);

    @Modifying
    @Query("UPDATE DocumentTemplate t SET t.active = false WHERE t.documentType = :type AND t.id <> :excludeId AND t.organizationId = :orgId")
    void deactivateAllByTypeExcept(@Param("type") DocumentType type, @Param("excludeId") Long excludeId, @Param("orgId") Long orgId);
}
