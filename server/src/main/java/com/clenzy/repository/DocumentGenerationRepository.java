package com.clenzy.repository;

import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.DocumentGenerationStatus;
import com.clenzy.model.DocumentType;
import com.clenzy.model.ReferenceType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DocumentGenerationRepository extends JpaRepository<DocumentGeneration, Long> {

    /**
     * Indique si un document de ce type a deja ete envoye par email (email_status =
     * 'SENT') a ce destinataire pour cette reference. Sert de garde d'idempotence :
     * un meme devis ne doit pas partir deux fois au prospect (envoi auto a la
     * soumission du formulaire + clic manuel "Generer PDF").
     *
     * <p>Requete NATIVE volontairement : elle contourne le Hibernate
     * {@code @Filter} tenant pour voir la generation faite en contexte public
     * (org du template) meme si l'admin qui declenche appartient a une autre org.
     * C'est un simple controle d'existence, sans fuite de donnees.</p>
     */
    @Query(value = """
            SELECT EXISTS (
                SELECT 1 FROM document_generations
                WHERE document_type = :docType
                  AND reference_type = :refType
                  AND reference_id = :refId
                  AND lower(email_to) = lower(:emailTo)
                  AND email_status = 'SENT'
            )
            """, nativeQuery = true)
    boolean existsSentEmailForReference(@Param("docType") String docType,
                                        @Param("refType") String refType,
                                        @Param("refId") Long refId,
                                        @Param("emailTo") String emailTo);

    Page<DocumentGeneration> findByDocumentTypeOrderByCreatedAtDesc(DocumentType type, Pageable pageable);

    Page<DocumentGeneration> findAllByOrderByCreatedAtDesc(Pageable pageable);

    // Audit 2026-07 F1-02 : historique scopé à l'organisation (le filtre Hibernate
    // est inerte en HTTP) — utilisé pour les rôles non platform-staff.
    Page<DocumentGeneration> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId, Pageable pageable);

    List<DocumentGeneration> findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(ReferenceType refType, Long refId);

    long countByStatus(DocumentGenerationStatus status);

    /** Echecs de generation recents de l'org (pastille du menu Documents). */
    long countByOrganizationIdAndStatusAndCreatedAtAfter(
        Long organizationId, DocumentGenerationStatus status, java.time.LocalDateTime since);

    // ─── Conformite NF ──────────────────────────────────────────────────────

    Optional<DocumentGeneration> findByLegalNumber(String legalNumber);

    Page<DocumentGeneration> findByLockedTrueAndDocumentTypeOrderByCreatedAtDesc(DocumentType type, Pageable pageable);

    long countByDocumentTypeAndLockedTrue(DocumentType type);

    long countByLockedTrue();

    long countByDocumentType(DocumentType type);
}
