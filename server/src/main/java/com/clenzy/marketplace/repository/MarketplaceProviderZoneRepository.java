package com.clenzy.marketplace.repository;

import com.clenzy.marketplace.model.MarketplaceProviderZone;
import org.springframework.data.jpa.repository.*;
import java.util.List;

/** Zones canoniques de la personne et brouillons non activés. */
public interface MarketplaceProviderZoneRepository extends JpaRepository<MarketplaceProviderZone, Long> {
    interface EffectiveZone {
        Long getId();
        Long getProviderId();
        String getCountryCode();
        String getDepartment();
        String getArrondissement();
        String getCity();
        String getPostalCode();
        Integer getRadiusKm();
        boolean isPrimary();
    }
    @Query("SELECT z.id AS id, p.id AS providerId, z.countryCode AS countryCode, z.department AS department, "
        + "z.arrondissement AS arrondissement, z.city AS city, z.postalCode AS postalCode, z.radiusKm AS radiusKm, z.primary AS primary "
        + "FROM MarketplaceProvider p JOIN MarketplaceProviderZone z ON "
        + "(z.userId = p.userId OR (p.userId IS NULL AND z.provider = p)) "
        + "WHERE p.id IN :providerIds ORDER BY z.primary DESC, z.city, z.id")
    List<EffectiveZone> effectiveZones(List<Long> providerIds);

    @Query(value = "SELECT public.baitly_provider_accepts_property(:providerId,:type)", nativeQuery = true)
    boolean acceptsProperty(Long providerId, String type);

    interface CoverageOwner { Long getId(); Long getUserId(); }

    @Query(value = "SELECT id, user_id AS userId FROM marketplace_providers WHERE id=:providerId FOR SHARE", nativeQuery = true)
    java.util.Optional<CoverageOwner> lockCoverageOwner(Long providerId);

    @Query(value = "SELECT public.baitly_provider_covers(:providerId, :country, :department, :arrondissement, :city)", nativeQuery = true)
    boolean covers(Long providerId, String country, String department, String arrondissement, String city);

    List<MarketplaceProviderZone> findByUserIdOrderByIdAsc(Long userId);
    boolean existsByUserId(Long userId);

    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM MarketplaceProviderZone z WHERE z.userId = :userId")
    void deleteIndividualZones(Long userId);

    @Query(value = "SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('baitly:coverage:user:' || CAST(:userId AS text), 0))", nativeQuery = true)
    Integer lockIndividual(Long userId);

    @Modifying
    @Query(value = "INSERT INTO individual_coverage_profiles(user_id) VALUES (:userId) ON CONFLICT DO NOTHING", nativeQuery = true)
    void initializeIndividual(Long userId);

    @Query("SELECT DISTINCT z.city FROM MarketplaceProviderZone z WHERE z.city IS NOT NULL ORDER BY z.city")
    List<String> findDistinctCities();

    /** Couple (prestataire, logement) : la zone du prestataire couvre le logement (règle d'affectation). */
    interface PropertyCoverage { Long getProviderId(); Long getPropertyId(); }

    // Même jointure de zones effectives et même règle que baitly_provider_covers, appliquées
    // d'un bloc aux logements de l'organisation plutôt qu'un appel par couple.
    String PROPERTY_COVERAGE = "SELECT DISTINCT pr.id AS providerId, p.id AS propertyId FROM properties p "
        + "JOIN marketplace_provider_zones z ON public.baitly_zone_covers(z.country_code, z.department, z.arrondissement, "
        + "z.city, COALESCE(NULLIF(trim(p.country_code), ''), 'FR'), p.department, p.arrondissement, p.city) "
        + "JOIN marketplace_providers pr ON (z.user_id = pr.user_id OR (pr.user_id IS NULL AND z.provider_id = pr.id)) "
        + "WHERE p.organization_id = :orgId AND p.status <> 'ARCHIVED'";

    @Query(value = PROPERTY_COVERAGE, nativeQuery = true)
    List<PropertyCoverage> coverageForOrganization(Long orgId);

    @Query(value = PROPERTY_COVERAGE + " AND pr.id = :providerId", nativeQuery = true)
    List<PropertyCoverage> coverageForProvider(Long providerId, Long orgId);
}
