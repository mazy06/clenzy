package com.clenzy.repository;

import com.clenzy.model.ProviderDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProviderDocumentRepository extends JpaRepository<ProviderDocument, Long> {

    /** Justificatifs d'un intervenant, du plus recent au plus ancien. */
    List<ProviderDocument> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * Justificatifs d'un intervenant pour un TYPE donne. Les depots successifs
     * sont conserves : on ne remplace pas une piece, on en ajoute une nouvelle
     * — l'historique fait partie de la preuve.
     */
    List<ProviderDocument> findByUserIdAndDocumentTypeOrderByCreatedAtDesc(
            Long userId, ProviderDocument.DocumentType documentType);
}
