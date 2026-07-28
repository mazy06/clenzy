package com.clenzy.repository;

import com.clenzy.model.EInvoiceSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

/**
 * Suivi des soumissions d'e-invoicing (CLZ-P0-04). Idempotence par (org, numero de facture).
 */
@Repository
public interface EInvoiceSubmissionRepository extends JpaRepository<EInvoiceSubmission, Long> {

    Optional<EInvoiceSubmission> findByOrganizationIdAndInvoiceNumber(Long organizationId, String invoiceNumber);

    boolean existsByOrganizationIdAndInvoiceNumber(Long organizationId, String invoiceNumber);

    /**
     * Factures électroniques rejetées par l'administration.
     *
     * <p>Obligation légale non remplie : la facture existe côté client mais
     * n'a jamais été transmise. L'échec n'était consigné que dans une colonne
     * que personne ne consulte.</p>
     */
    @Query("""
            SELECT s FROM EInvoiceSubmission s
            WHERE s.organizationId = :orgId
              AND s.status = com.clenzy.model.EInvoiceStatus.FAILED
            ORDER BY s.updatedAt DESC
            """)
    List<EInvoiceSubmission> findFailedForOrg(@Param("orgId") Long orgId);
}
