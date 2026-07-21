package com.clenzy.repository;

import com.clenzy.model.OutboxEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {

    /**
     * Recupere les events PENDING par ordre de creation (FIFO), bornes par le
     * Pageable : pendant une panne Kafka le backlog peut atteindre des dizaines
     * de milliers de lignes — sans borne, chaque tick du relay chargeait TOUT
     * en memoire dans une transaction.
     */
    @Query("SELECT e FROM OutboxEvent e WHERE e.status = 'PENDING' " +
           "ORDER BY e.createdAt ASC")
    List<OutboxEvent> findPendingEvents(Pageable pageable);

    /**
     * Recupere les events FAILED avec moins de maxRetries tentatives,
     * bornes par le Pageable (meme raison que findPendingEvents).
     */
    @Query("SELECT e FROM OutboxEvent e WHERE e.status = 'FAILED' " +
           "AND e.retryCount < :maxRetries ORDER BY e.createdAt ASC")
    List<OutboxEvent> findRetryableEvents(@Param("maxRetries") int maxRetries, Pageable pageable);

    /**
     * Plus ancien event d'un statut donne — pour les stats (age du backlog)
     * sans charger le backlog entier.
     */
    Optional<OutboxEvent> findFirstByStatusOrderByCreatedAtAsc(String status);

    /**
     * Marque un event comme SENT. Transaction courte autonome : appele depuis
     * les callbacks Kafka du relay, HORS transaction englobante.
     */
    @Transactional
    @Modifying
    @Query("UPDATE OutboxEvent e SET e.status = 'SENT', e.sentAt = :sentAt " +
           "WHERE e.id = :id")
    int markAsSent(@Param("id") Long id, @Param("sentAt") LocalDateTime sentAt);

    /**
     * Marque un event comme FAILED avec le message d'erreur. Transaction
     * courte autonome (cf. markAsSent).
     */
    @Transactional
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

    // ── Admin queries (cross-org, SUPER_ADMIN only) ─────────────────────────

    /**
     * Tous les events outbox pagines, plus recents en premier.
     */
    @Query("SELECT e FROM OutboxEvent e ORDER BY e.createdAt DESC")
    Page<OutboxEvent> findAllPaged(Pageable pageable);

    /**
     * Count par status (pour stats dashboard).
     */
    @Query("SELECT COUNT(e) FROM OutboxEvent e WHERE e.status = :status")
    long countByStatusStr(@Param("status") String status);

    /**
     * Recherche filtree par status et topic.
     */
    @Query("SELECT e FROM OutboxEvent e " +
           "WHERE (:status IS NULL OR e.status = :status) " +
           "AND (:topic IS NULL OR e.topic = :topic) ORDER BY e.createdAt DESC")
    Page<OutboxEvent> findFiltered(
            @Param("status") String status,
            @Param("topic") String topic,
            Pageable pageable);
}
