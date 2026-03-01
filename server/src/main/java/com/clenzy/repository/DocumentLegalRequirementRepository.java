package com.clenzy.repository;

import com.clenzy.model.DocumentLegalRequirement;
import com.clenzy.model.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentLegalRequirementRepository extends JpaRepository<DocumentLegalRequirement, Long> {

    // Legacy methods (backward compat — queries all countries)
    List<DocumentLegalRequirement> findByDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(DocumentType documentType);

    List<DocumentLegalRequirement> findAllByActiveTrueOrderByDocumentTypeAscDisplayOrderAsc();

    long countByDocumentTypeAndActiveTrue(DocumentType documentType);

    // Country-scoped methods
    List<DocumentLegalRequirement> findByCountryCodeAndDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(
            String countryCode, DocumentType documentType);

    List<DocumentLegalRequirement> findByCountryCodeAndActiveTrueOrderByDocumentTypeAscDisplayOrderAsc(
            String countryCode);

    long countByCountryCodeAndDocumentTypeAndActiveTrue(String countryCode, DocumentType documentType);
}
