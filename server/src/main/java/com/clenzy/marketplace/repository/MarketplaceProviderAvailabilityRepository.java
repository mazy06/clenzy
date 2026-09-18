package com.clenzy.marketplace.repository;

import com.clenzy.marketplace.model.MarketplaceProviderAvailability;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

/** Brouillons de candidature et projection en lecture du calendrier canonique. */
public interface MarketplaceProviderAvailabilityRepository
        extends JpaRepository<MarketplaceProviderAvailability, Long> {

    @Query(value = "SELECT p.id FROM marketplace_providers p WHERE p.id IN :providerIds AND public.baitly_provider_weekly_restricted(p.id)", nativeQuery = true)
    List<Long> restrictedProviderIds(List<Long> providerIds);

    interface EffectiveSlot {
        Long getId();
        Long getProviderId();
        Short getDayOfWeek();
        java.time.LocalTime getStartTime();
        java.time.LocalTime getEndTime();
    }

    @Query(value = "SELECT w.id, w.provider_id AS providerId, w.day_of_week AS dayOfWeek, w.start_time AS startTime, w.end_time AS endTime "
        + "FROM public.baitly_provider_weekly(CAST(:providerIds AS bigint[])) w ORDER BY w.day_of_week, w.start_time", nativeQuery = true)
    List<EffectiveSlot> effectiveWeekly(Long[] providerIds);

}
