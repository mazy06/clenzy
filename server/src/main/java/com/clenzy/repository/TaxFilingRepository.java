package com.clenzy.repository;

import com.clenzy.model.TaxFiling;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TaxFilingRepository extends JpaRepository<TaxFiling, Long> {

    Optional<TaxFiling> findByOrganizationIdAndPeriodStart(Long organizationId, LocalDate periodStart);

    Optional<TaxFiling> findByIdAndOrganizationId(Long id, Long organizationId);

    List<TaxFiling> findByOrganizationIdOrderByPeriodStartDesc(Long organizationId);

    /** Transition CAS DUE → FILED (jamais de check-then-act — règle audit n°8). */
    @Modifying
    @Query("UPDATE TaxFiling f SET f.status = com.clenzy.model.TaxFiling.Status.FILED, "
            + "f.filedAt = :at, f.paymentReference = COALESCE(:reference, f.paymentReference) "
            + "WHERE f.id = :id AND f.organizationId = :orgId "
            + "AND f.status = com.clenzy.model.TaxFiling.Status.DUE")
    int markFiled(@Param("id") Long id, @Param("orgId") Long orgId,
                  @Param("at") Instant at, @Param("reference") String reference);

    /** Transition CAS FILED → PAID. */
    @Modifying
    @Query("UPDATE TaxFiling f SET f.status = com.clenzy.model.TaxFiling.Status.PAID, "
            + "f.paidAt = :at, f.paymentReference = COALESCE(:reference, f.paymentReference) "
            + "WHERE f.id = :id AND f.organizationId = :orgId "
            + "AND f.status = com.clenzy.model.TaxFiling.Status.FILED")
    int markPaid(@Param("id") Long id, @Param("orgId") Long orgId,
                 @Param("at") Instant at, @Param("reference") String reference);
}
