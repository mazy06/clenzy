package com.clenzy.repository;

import com.clenzy.model.ReportDocument;
import com.clenzy.model.ReportDocumentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/** Acces aux rapports d'analyse generes. Toutes les lectures sont org-scopees. */
public interface ReportDocumentRepository extends JpaRepository<ReportDocument, Long> {

    Page<ReportDocument> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId, Pageable pageable);

    List<ReportDocument> findByOrganizationIdAndStatusOrderByCreatedAtDesc(
            Long organizationId, ReportDocumentStatus status);

    Optional<ReportDocument> findByOrganizationIdAndDocumentNumber(Long organizationId, String documentNumber);

    /**
     * Dernier numero attribue dans l'annee, pour la sequence {@code R-AAAA-NNNN}.
     *
     * <p>Le numero est tire par organisation ET par annee : deux organisations
     * ne partagent pas de sequence, et l'annee se relit dans le numero.</p>
     */
    @Query("""
            select max(d.documentNumber) from ReportDocument d
            where d.organizationId = :orgId and d.documentNumber like :prefix
            """)
    Optional<String> findLastNumber(@Param("orgId") Long orgId, @Param("prefix") String prefix);

    /**
     * Un rapport a-t-il deja ete ENVOYE pour ce proprietaire et cette periode ?
     *
     * <p>Idempotence de l'envoi automatique : le declencheur mensuel est
     * recurrent, et l'idempotence generique du moteur ne connait pas la
     * periode. Sans ce garde, une re-execution enverrait deux fois le meme
     * mois.</p>
     */
    boolean existsByOrganizationIdAndRecipientUserIdAndPeriodStartAndPeriodEndAndStatus(
            Long organizationId, Long recipientUserId,
            java.time.LocalDate periodStart, java.time.LocalDate periodEnd,
            ReportDocumentStatus status);

    /**
     * Rapport identique deja produit — meme empreinte de snapshot.
     *
     * <p>Evite de refacturer un commentaire IA pour des chiffres qui n'ont pas
     * bouge d'un iota.</p>
     */
    Optional<ReportDocument> findFirstByOrganizationIdAndSnapshotHashOrderByCreatedAtDesc(
            Long organizationId, String snapshotHash);
}
