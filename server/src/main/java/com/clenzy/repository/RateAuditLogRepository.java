package com.clenzy.repository;

import com.clenzy.model.RateAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public interface RateAuditLogRepository extends JpaRepository<RateAuditLog, Long> {

    /**
     * Historique des changements de prix pour une propriete et une date.
     */
    @Query("SELECT ral FROM RateAuditLog ral WHERE ral.propertyId = :propertyId " +
           "AND ral.date = :date ORDER BY ral.changedAt DESC")
    List<RateAuditLog> findByPropertyIdAndDate(
            @Param("propertyId") Long propertyId,
            @Param("date") LocalDate date);

    /**
     * Nettoyage des entries > 2 ans (exigence legale = conservation 2 ans minimum).
     * Appele periodiquement pour garder la table a taille raisonnable.
     *
     * @return nombre d'entries supprimees
     */
    @Modifying
    @Query("DELETE FROM RateAuditLog ral WHERE ral.changedAt < :threshold")
    int deleteOlderThan(@Param("threshold") LocalDateTime threshold);
}
