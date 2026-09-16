package com.clenzy.repository;

import com.clenzy.model.ProviderTariff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** Prix publics ; les services contrôlent l'identité de tout écrivain. */
public interface ProviderTariffRepository extends JpaRepository<ProviderTariff, Long> {
    List<ProviderTariff> findByUserIdOrderByServiceKeyAsc(Long userId);
    List<ProviderTariff> findByUserIdIn(Collection<Long> userIds);
    Optional<ProviderTariff> findByUserIdAndServiceKey(Long userId, String serviceKey);

    @Query(value = "SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('baitly:tariff:user:' || CAST(:userId AS text), 0))", nativeQuery = true)
    int lockUser(Long userId);

    @Query(value = """
        SELECT EXISTS(SELECT 1 FROM users WHERE id=:userId AND organization_id=:orgId)
            OR EXISTS(SELECT 1 FROM organization_members WHERE user_id=:userId AND organization_id=:orgId)
        """, nativeQuery = true)
    boolean belongsToOrganization(Long userId, Long orgId);

    @Query(value = """
        SELECT DISTINCT t.user_id FROM provider_tariffs t
        WHERE t.enabled AND t.service_key IN :keys
          AND (EXISTS (SELECT 1 FROM users u WHERE u.id=t.user_id AND u.organization_id=:orgId)
            OR EXISTS (SELECT 1 FROM organization_members m WHERE m.user_id=t.user_id AND m.organization_id=:orgId))
        """, nativeQuery = true)
    List<Long> findOfferingInOrganization(Long orgId, Collection<String> keys);
}
