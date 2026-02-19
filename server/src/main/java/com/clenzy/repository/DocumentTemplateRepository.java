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

    List<DocumentTemplate> findByDocumentTypeOrderByVersionDesc(DocumentType documentType);

    List<DocumentTemplate> findAllByOrderByDocumentTypeAscVersionDesc();

    boolean existsByDocumentTypeAndActiveTrue(DocumentType documentType);

    @Modifying
    @Query("UPDATE DocumentTemplate t SET t.active = false WHERE t.documentType = :type AND t.id <> :excludeId AND t.organizationId = :orgId")
    void deactivateAllByTypeExcept(@Param("type") DocumentType type, @Param("excludeId") Long excludeId, @Param("orgId") Long orgId);
}
