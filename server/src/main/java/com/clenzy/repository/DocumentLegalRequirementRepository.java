package com.clenzy.repository;

import com.clenzy.model.DocumentLegalRequirement;
import com.clenzy.model.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentLegalRequirementRepository extends JpaRepository<DocumentLegalRequirement, Long> {

    List<DocumentLegalRequirement> findByDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(DocumentType documentType);

    List<DocumentLegalRequirement> findAllByActiveTrueOrderByDocumentTypeAscDisplayOrderAsc();

    long countByDocumentTypeAndActiveTrue(DocumentType documentType);
}
