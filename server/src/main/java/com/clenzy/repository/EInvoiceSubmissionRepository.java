package com.clenzy.repository;

import com.clenzy.model.EInvoiceSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Suivi des soumissions d'e-invoicing (CLZ-P0-04). Idempotence par (org, numero de facture).
 */
@Repository
public interface EInvoiceSubmissionRepository extends JpaRepository<EInvoiceSubmission, Long> {

    Optional<EInvoiceSubmission> findByOrganizationIdAndInvoiceNumber(Long organizationId, String invoiceNumber);

    boolean existsByOrganizationIdAndInvoiceNumber(Long organizationId, String invoiceNumber);
}
