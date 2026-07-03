package com.clenzy.repository;

import com.clenzy.model.NoiseAlert;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface NoiseAlertRepository extends JpaRepository<NoiseAlert, Long> {

    /**
     * Derniere alerte pour cette propriete et cette severite — pour calcul de cooldown.
     */
    Optional<NoiseAlert> findFirstByPropertyIdAndSeverityOrderByCreatedAtDesc(
        Long propertyId, NoiseAlert.AlertSeverity severity);

    /**
     * Historique pagine des alertes d'une organisation.
     */
    @Query("SELECT a FROM NoiseAlert a LEFT JOIN FETCH a.property LEFT JOIN FETCH a.device " +
           "WHERE a.organizationId = :orgId ORDER BY a.createdAt DESC")
    Page<NoiseAlert> findByOrganizationId(@Param("orgId") Long orgId, Pageable pageable);

    /**
     * Historique pagine filtre par propriete.
     */
    @Query("SELECT a FROM NoiseAlert a LEFT JOIN FETCH a.property LEFT JOIN FETCH a.device " +
           "WHERE a.organizationId = :orgId AND a.propertyId = :propertyId ORDER BY a.createdAt DESC")
    Page<NoiseAlert> findByOrganizationIdAndPropertyId(
        @Param("orgId") Long orgId,
        @Param("propertyId") Long propertyId,
        Pageable pageable);

    /**
     * Historique pagine filtre par severite.
     */
    @Query("SELECT a FROM NoiseAlert a LEFT JOIN FETCH a.property LEFT JOIN FETCH a.device " +
           "WHERE a.organizationId = :orgId AND a.severity = :severity ORDER BY a.createdAt DESC")
    Page<NoiseAlert> findByOrganizationIdAndSeverity(
        @Param("orgId") Long orgId,
        @Param("severity") NoiseAlert.AlertSeverity severity,
        Pageable pageable);

    /**
     * Historique pagine filtre par propriete ET severite.
     */
    @Query("SELECT a FROM NoiseAlert a LEFT JOIN FETCH a.property LEFT JOIN FETCH a.device " +
           "WHERE a.organizationId = :orgId AND a.propertyId = :propertyId AND a.severity = :severity " +
           "ORDER BY a.createdAt DESC")
    Page<NoiseAlert> findByOrganizationIdAndPropertyIdAndSeverity(
        @Param("orgId") Long orgId,
        @Param("propertyId") Long propertyId,
        @Param("severity") NoiseAlert.AlertSeverity severity,
        Pageable pageable);

    /**
     * Nombre d'alertes non acquittees pour badge UI.
     */
    long countByOrganizationIdAndAcknowledgedFalse(Long organizationId);

    /**
     * Existe-t-il une alerte recente (dans la fenetre de cooldown) ?
     */
    @Query("SELECT COUNT(a) > 0 FROM NoiseAlert a " +
           "WHERE a.propertyId = :propertyId AND a.severity = :severity " +
           "AND a.createdAt > :since")
    boolean existsRecentAlert(
        @Param("propertyId") Long propertyId,
        @Param("severity") NoiseAlert.AlertSeverity severity,
        @Param("since") LocalDateTime since);

    /**
     * F6b — nombre d'alertes (toutes severites) sur la propriete depuis {@code since}.
     * Sert au seuil d'escalade (>=3 alertes / 24 h).
     */
    long countByPropertyIdAndCreatedAtAfter(Long propertyId, LocalDateTime since);

    /**
     * F6a — repli DB de l'idempotence Redis : un message voyageur (email ou
     * WhatsApp) a-t-il deja ete envoye pour cette propriete depuis {@code since} ?
     */
    @Query("SELECT COUNT(a) > 0 FROM NoiseAlert a " +
           "WHERE a.propertyId = :propertyId AND a.createdAt > :since " +
           "AND (a.notifiedGuest = true OR a.notifiedWhatsapp = true)")
    boolean existsGuestNotifiedSince(
        @Param("propertyId") Long propertyId,
        @Param("since") LocalDateTime since);
}
