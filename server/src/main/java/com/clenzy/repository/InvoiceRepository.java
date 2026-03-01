package com.clenzy.repository;

import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    List<Invoice> findByOrganizationId(Long organizationId);

    List<Invoice> findByOrganizationIdAndStatus(Long organizationId, InvoiceStatus status);

    Optional<Invoice> findByOrganizationIdAndInvoiceNumber(Long organizationId, String invoiceNumber);

    Optional<Invoice> findByReservationId(Long reservationId);

    Optional<Invoice> findByPayoutId(Long payoutId);

    @Query("SELECT i FROM Invoice i WHERE i.organizationId = :orgId " +
           "AND i.invoiceDate BETWEEN :from AND :to " +
           "ORDER BY i.invoiceDate DESC")
    List<Invoice> findByOrganizationIdAndDateRange(
        @Param("orgId") Long organizationId,
        @Param("from") LocalDate from,
        @Param("to") LocalDate to
    );
}
