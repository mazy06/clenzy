package com.clenzy.repository;

import com.clenzy.model.CalendarCommand;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CalendarCommandRepository extends JpaRepository<CalendarCommand, Long> {

    /**
     * Historique des commandes pour une propriete (plus recentes en premier).
     */
    @Query("SELECT cc FROM CalendarCommand cc WHERE cc.propertyId = :propertyId " +
           "ORDER BY cc.executedAt DESC")
    List<CalendarCommand> findByPropertyIdOrderByExecutedAtDesc(
            @Param("propertyId") Long propertyId);

    /**
     * Historique des commandes pour une reservation specifique.
     */
    @Query("SELECT cc FROM CalendarCommand cc WHERE cc.reservationId = :reservationId " +
           "ORDER BY cc.executedAt DESC")
    List<CalendarCommand> findByReservationId(
            @Param("reservationId") Long reservationId);
}
