package com.clenzy.repository;

import com.clenzy.model.ReconciliationRun;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReconciliationRunRepository extends JpaRepository<ReconciliationRun, Long> {

    /**
     * Tous les runs pagines, plus recents en premier.
     */
    @Query("SELECT r FROM ReconciliationRun r ORDER BY r.startedAt DESC")
    Page<ReconciliationRun> findRecentPaged(Pageable pageable);

    /**
     * Runs pour une propriete donnee, plus recents en premier.
     */
    @Query("SELECT r FROM ReconciliationRun r WHERE r.propertyId = :propertyId ORDER BY r.startedAt DESC")
    Page<ReconciliationRun> findByPropertyIdPaged(@Param("propertyId") Long propertyId, Pageable pageable);

    /**
     * Runs par statut, plus recents en premier.
     */
    @Query("SELECT r FROM ReconciliationRun r WHERE r.status = :status ORDER BY r.startedAt DESC")
    Page<ReconciliationRun> findByStatusPaged(@Param("status") String status, Pageable pageable);

    /**
     * Nombre de runs par statut.
     */
    @Query("SELECT COUNT(r) FROM ReconciliationRun r WHERE r.status = :status")
    long countByStatus(@Param("status") String status);

    /**
     * Runs filtres (propertyId et/ou status optionnels).
     */
    @Query("SELECT r FROM ReconciliationRun r " +
           "WHERE (:propertyId IS NULL OR r.propertyId = :propertyId) " +
           "AND (:status IS NULL OR r.status = :status) " +
           "ORDER BY r.startedAt DESC")
    Page<ReconciliationRun> findFiltered(@Param("propertyId") Long propertyId,
                                         @Param("status") String status,
                                         Pageable pageable);

    /**
     * Derniers runs pour une propriete et un channel.
     */
    @Query("SELECT r FROM ReconciliationRun r WHERE r.propertyId = :propertyId " +
           "AND r.channel = :channel ORDER BY r.startedAt DESC")
    List<ReconciliationRun> findLatestByPropertyAndChannel(@Param("propertyId") Long propertyId,
                                                            @Param("channel") String channel,
                                                            Pageable pageable);
}
