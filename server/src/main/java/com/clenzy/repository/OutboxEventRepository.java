package com.clenzy.repository;

import com.clenzy.model.OutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {

    /**
     * Recupere les events PENDING par ordre de creation (FIFO).
     * Limite pour eviter de charger trop en memoire.
     */
    @Query("SELECT e FROM OutboxEvent e WHERE e.status = 'PENDING' " +
           "ORDER BY e.createdAt ASC")
    List<OutboxEvent> findPendingEvents();

    /**
     * Recupere les events FAILED avec moins de maxRetries tentatives.
     * Permet de reessayer les envois echoues.
     */
    @Query("SELECT e FROM OutboxEvent e WHERE e.status = 'FAILED' " +
           "AND e.retryCount < :maxRetries ORDER BY e.createdAt ASC")
    List<OutboxEvent> findRetryableEvents(@Param("maxRetries") int maxRetries);

    /**
     * Marque un event comme SENT.
     */
    @Modifying
    @Query("UPDATE OutboxEvent e SET e.status = 'SENT', e.sentAt = :sentAt " +
           "WHERE e.id = :id")
    int markAsSent(@Param("id") Long id, @Param("sentAt") LocalDateTime sentAt);

    /**
     * Marque un event comme FAILED avec le message d'erreur.
     */
    @Modifying
    @Query("UPDATE OutboxEvent e SET e.status = 'FAILED', " +
           "e.retryCount = e.retryCount + 1, e.errorMessage = :errorMessage " +
           "WHERE e.id = :id")
    int markAsFailed(@Param("id") Long id, @Param("errorMessage") String errorMessage);

    /**
     * Supprime les events envoyes avec succes et plus vieux que la date donnee.
     * Nettoyage periodique pour eviter la croissance illimitee de la table.
     */
    @Modifying
    @Query("DELETE FROM OutboxEvent e WHERE e.status = 'SENT' AND e.sentAt < :before")
    int deleteSentBefore(@Param("before") LocalDateTime before);
}
