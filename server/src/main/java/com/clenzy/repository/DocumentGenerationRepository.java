package com.clenzy.repository;

import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.DocumentGenerationStatus;
import com.clenzy.model.DocumentType;
import com.clenzy.model.ReferenceType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentGenerationRepository extends JpaRepository<DocumentGeneration, Long> {

    Page<DocumentGeneration> findByDocumentTypeOrderByCreatedAtDesc(DocumentType type, Pageable pageable);

    Page<DocumentGeneration> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<DocumentGeneration> findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(ReferenceType refType, Long refId);

    long countByStatus(DocumentGenerationStatus status);

    // ─── Conformite NF ──────────────────────────────────────────────────────

    Optional<DocumentGeneration> findByLegalNumber(String legalNumber);

    Page<DocumentGeneration> findByLockedTrueAndDocumentTypeOrderByCreatedAtDesc(DocumentType type, Pageable pageable);

    long countByDocumentTypeAndLockedTrue(DocumentType type);

    long countByLockedTrue();

    long countByDocumentType(DocumentType type);
}
