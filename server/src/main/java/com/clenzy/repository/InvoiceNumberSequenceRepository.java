package com.clenzy.repository;

import com.clenzy.model.InvoiceNumberSequence;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InvoiceNumberSequenceRepository extends JpaRepository<InvoiceNumberSequence, Long> {

    Optional<InvoiceNumberSequence> findByOrganizationIdAndCurrentYear(Long organizationId, Integer currentYear);

    /**
     * Obtient la sequence avec un verrou pessimiste pour eviter les doublons
     * lors de la generation concurrente de numeros de facture.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM InvoiceNumberSequence s WHERE s.organizationId = :orgId AND s.currentYear = :year")
    Optional<InvoiceNumberSequence> findAndLock(
        @Param("orgId") Long organizationId,
        @Param("year") Integer currentYear
    );
}
