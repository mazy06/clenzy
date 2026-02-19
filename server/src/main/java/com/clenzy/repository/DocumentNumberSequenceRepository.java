package com.clenzy.repository;

import com.clenzy.model.DocumentNumberSequence;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface DocumentNumberSequenceRepository extends JpaRepository<DocumentNumberSequence, Long> {

    /**
     * Recherche la sequence avec verrouillage pessimiste (SELECT ... FOR UPDATE).
     * Garantit l'absence de trous dans la numerotation meme en concurrence.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM DocumentNumberSequence s WHERE s.documentType = :documentType AND s.year = :year AND s.organizationId = :orgId")
    Optional<DocumentNumberSequence> findByDocumentTypeAndYearForUpdate(@Param("documentType") String documentType, @Param("year") Integer year, @Param("orgId") Long orgId);

    Optional<DocumentNumberSequence> findByDocumentTypeAndYear(String documentType, Integer year);
}
