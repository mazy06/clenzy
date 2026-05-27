package com.clenzy.repository;

import com.clenzy.model.KbDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface KbDocumentRepository extends JpaRepository<KbDocument, Long> {

    /**
     * Resolution d'un doc par chemin source + scope org (NULL = global).
     * Utilisee a l'ingestion pour upsert (replace si meme source_path).
     */
    @Query("SELECT d FROM KbDocument d WHERE d.sourcePath = :sourcePath "
            + "AND ((d.organizationId IS NULL AND :orgId IS NULL) "
            + "OR d.organizationId = :orgId)")
    Optional<KbDocument> findBySourcePathAndOrg(@Param("sourcePath") String sourcePath,
                                                 @Param("orgId") Long orgId);

    /**
     * Liste les docs visibles par une org : docs globaux (org_id NULL) +
     * docs specifiques a l'org demandee.
     */
    @Query("SELECT d FROM KbDocument d WHERE d.organizationId IS NULL "
            + "OR d.organizationId = :orgId ORDER BY d.updatedAt DESC")
    List<KbDocument> findVisibleByOrg(@Param("orgId") Long orgId);
}
