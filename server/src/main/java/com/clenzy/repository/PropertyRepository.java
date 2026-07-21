package com.clenzy.repository;

import com.clenzy.model.Property;
import com.clenzy.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.QueryHint;
import java.util.List;

public interface PropertyRepository extends JpaRepository<Property, Long>, JpaSpecificationExecutor<Property> {
    List<Property> findByOwner(User owner);
    List<Property> findByOwnerId(Long ownerId);

    /** Logements d'une org dans un statut donné (ex. ACTIVE) — classement performance. */
    List<Property> findByOrganizationIdAndStatus(Long organizationId, com.clenzy.model.PropertyStatus status);

    /** Tous les logements d'une org (yield v1 : liste des bornes plancher/plafond). */
    List<Property> findByOrganizationId(Long organizationId);

    /**
     * Top logements par volume d'interventions + coût cumulé (Rapports Baitly).
     * LEFT JOIN : les logements sans intervention apparaissent avec 0 (parité
     * avec l'ancien calcul client). Coût = réel, repli devis. La limite (top N)
     * vient du {@code Pageable}. Lignes {@code [String name, Long count, BigDecimal cost]}.
     */
    @Query("SELECT p.name, COUNT(i), COALESCE(SUM(COALESCE(i.actualCost, i.estimatedCost, 0)), 0) "
        + "FROM Property p LEFT JOIN Intervention i ON i.property.id = p.id AND i.organizationId = :orgId "
        + "WHERE p.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR p.owner.keycloakId = :ownerKc) "
        + "GROUP BY p.id, p.name "
        + "ORDER BY COUNT(i) DESC")
    List<Object[]> topByInterventionCountForReport(
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Proprietes sans coordonnees GPS — utilise par le service de retro-geocodage
     * pour combler les donnees manquantes (creees avant l'introduction de Nominatim).
     */
    @Query("SELECT p FROM Property p WHERE p.latitude IS NULL OR p.longitude IS NULL")
    List<Property> findAllWithoutCoordinates();

    /**
     * Proprietes d'une org qui ont des amenities OTA brutes non encore mappees.
     * Utilise par {@code AmenityManagementService} pour l'agregation
     * "unmapped" et le reprocess.
     */
    @Query("SELECT p FROM Property p "
        + "WHERE p.organizationId = :orgId "
        + "AND p.otaRawAmenities IS NOT NULL "
        + "AND p.otaRawAmenities <> ''")
    List<Property> findByOrgWithRawAmenities(@Param("orgId") Long orgId);
    
    /**
     * Requête optimisée avec FETCH JOIN pour éviter les N+1
     */
    @Query("""
        SELECT p FROM Property p
        LEFT JOIN FETCH p.owner
        WHERE p.owner.keycloakId = :ownerKeycloakId
        AND p.organizationId = :orgId
        """)
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.readOnly", value = "true")
    })
    List<Property> findByOwnerKeycloakIdWithRelations(@Param("ownerKeycloakId") String ownerKeycloakId, @Param("orgId") Long orgId);
    
    /**
     * Requête pour les propriétés avec managers (optimisée)
     */
    @Query("""
        SELECT p FROM Property p
        LEFT JOIN FETCH p.owner
        WHERE p.owner.keycloakId = :ownerKeycloakId
        AND p.organizationId = :orgId
        """)
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Property> findWithManagersByOwnerKeycloakId(@Param("ownerKeycloakId") String ownerKeycloakId, @Param("orgId") Long orgId);
    
    /**
     * Requête pour compter les propriétés (sans charger les données)
     */
    @Query("SELECT COUNT(p) FROM Property p WHERE p.owner.keycloakId = :ownerKeycloakId AND p.organizationId = :orgId")
    long countByOwnerKeycloakId(@Param("ownerKeycloakId") String ownerKeycloakId, @Param("orgId") Long orgId);

    long countByOrganizationId(Long organizationId);

    /**
     * Compteurs du dashboard overview (org-scope, owner optionnel pour HOST) :
     * total / par statut / par statut créés avant une date (calcul de croissance).
     */
    @Query("SELECT COUNT(p) FROM Property p WHERE p.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR p.owner.keycloakId = :ownerKc)")
    long countForDashboard(@Param("orgId") Long orgId, @Param("ownerKc") String ownerKc);

    @Query("SELECT COUNT(p) FROM Property p WHERE p.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR p.owner.keycloakId = :ownerKc) AND p.status = :status")
    long countForDashboardByStatus(@Param("orgId") Long orgId, @Param("ownerKc") String ownerKc,
                                   @Param("status") com.clenzy.model.PropertyStatus status);

    @Query("SELECT COUNT(p) FROM Property p WHERE p.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR p.owner.keycloakId = :ownerKc) AND p.status = :status "
        + "AND p.createdAt < :cutoff")
    long countForDashboardByStatusCreatedBefore(@Param("orgId") Long orgId, @Param("ownerKc") String ownerKc,
                                                @Param("status") com.clenzy.model.PropertyStatus status,
                                                @Param("cutoff") java.time.LocalDateTime cutoff);

    /**
     * Liste les identifiants distincts des proprietaires qui possedent au moins
     * une propriete dans l'organisation. Utilise pour la generation batch de
     * reversements en fin de mois et le releve proprietaire mensuel automatique
     * (OwnerStatementScheduler, F9a).
     */
    @Query("SELECT DISTINCT p.owner.id FROM Property p WHERE p.organizationId = :orgId AND p.owner IS NOT NULL")
    List<Long> findDistinctOwnerIdsByOrgId(@Param("orgId") Long orgId);
    
    /**
     * Requête pour les IDs seulement (pour les vérifications d'existence)
     */
    @Query("SELECT p.id FROM Property p WHERE p.owner.keycloakId = :ownerKeycloakId AND p.organizationId = :orgId")
    List<Long> findIdsByOwnerKeycloakId(@Param("ownerKeycloakId") String ownerKeycloakId, @Param("orgId") Long orgId);
    
    /**
     * Requête optimisée avec FETCH JOIN pour charger la propriété avec son owner
     * Évite les LazyInitializationException
     */
    @Query("SELECT p FROM Property p LEFT JOIN FETCH p.owner WHERE p.id = :id AND p.organizationId = :orgId")
    java.util.Optional<Property> findByIdWithOwner(@Param("id") Long id, @Param("orgId") Long orgId);

    /**
     * Variante sans filtre organization — pour le staff plateforme (SUPER_ADMIN, SUPER_MANAGER)
     * qui doit acceder a toutes les proprietes, toutes orgs confondues.
     */
    @Query("SELECT p FROM Property p LEFT JOIN FETCH p.owner WHERE p.id = :id")
    java.util.Optional<Property> findByIdWithOwnerNoOrgFilter(@Param("id") Long id);

    // ─── Booking Engine (public) ─────────────────────────────────────────────────

    /**
     * Proprietes visibles dans le Booking Engine public.
     * Filtre : ACTIVE + bookingEngineVisible = true + organisation donnee.
     */
    @Query("""
        SELECT p FROM Property p
        LEFT JOIN FETCH p.photos
        WHERE p.organizationId = :orgId
          AND p.status = com.clenzy.model.PropertyStatus.ACTIVE
          AND p.bookingEngineVisible = true
        ORDER BY p.name
        """)
    @QueryHints(@QueryHint(name = "org.hibernate.readOnly", value = "true"))
    List<Property> findBookingEngineVisible(@Param("orgId") Long orgId);

    /**
     * Detail d'une propriete visible dans le Booking Engine.
     */
    @Query("""
        SELECT p FROM Property p
        LEFT JOIN FETCH p.photos
        WHERE p.id = :id
          AND p.organizationId = :orgId
          AND p.status = com.clenzy.model.PropertyStatus.ACTIVE
          AND p.bookingEngineVisible = true
        """)
    @QueryHints(@QueryHint(name = "org.hibernate.readOnly", value = "true"))
    java.util.Optional<Property> findBookingEngineProperty(@Param("id") Long id, @Param("orgId") Long orgId);
}


