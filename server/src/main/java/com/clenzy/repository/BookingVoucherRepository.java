package com.clenzy.repository;

import com.clenzy.model.BookingVoucher;
import com.clenzy.model.voucher.VoucherStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Repository pour {@link BookingVoucher}.
 *
 * <p>Multi-tenant via Hibernate {@code @Filter(name = "organizationFilter")}
 * applique automatiquement par le {@code TenantFilter}. Toutes les queries
 * derivees ({@code findByOrganizationIdAnd...}) sont donc deja scopees a
 * l'org courante.</p>
 */
@Repository
public interface BookingVoucherRepository extends JpaRepository<BookingVoucher, Long> {

    /**
     * Lookup d'un voucher par code (case-insensitive) pour une org donnee.
     * Utilise au moment ou le guest entre le code dans le booking engine.
     */
    @Query("""
        SELECT v FROM BookingVoucher v
        WHERE v.organizationId = :orgId
          AND UPPER(v.code) = UPPER(:code)
    """)
    Optional<BookingVoucher> findByOrgAndCodeIgnoreCase(
        @Param("orgId") Long orgId,
        @Param("code") String code
    );

    /**
     * Liste tous les vouchers d'une org filtres par statut, tri par date de
     * creation desc. Utilise par l'UI admin host pour le listing.
     */
    List<BookingVoucher> findByOrganizationIdAndStatusOrderByCreatedAtDesc(
        Long organizationId,
        VoucherStatus status
    );

    /**
     * Liste tous les vouchers d'une org (tous statuts), tri par date desc.
     */
    List<BookingVoucher> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    /**
     * Count rapide des vouchers d'une org par statut (evite charger les
     * entites pour un simple compteur — perf optimisation M3 du code review).
     */
    long countByOrganizationIdAndStatus(Long organizationId, VoucherStatus status);

    /**
     * Liste les vouchers AUTO_CAMPAIGN actuellement actifs pour une org.
     * Utilise par le {@code VoucherEngine} au calcul du quote pour appliquer
     * automatiquement les promos eligibles (sans saisie de code).
     */
    @Query("""
        SELECT v FROM BookingVoucher v
        WHERE v.organizationId = :orgId
          AND v.type = com.clenzy.model.voucher.VoucherType.AUTO_CAMPAIGN
          AND v.status = com.clenzy.model.voucher.VoucherStatus.ACTIVE
          AND (v.validFrom IS NULL OR v.validFrom <= :now)
          AND (v.validUntil IS NULL OR v.validUntil >= :now)
    """)
    List<BookingVoucher> findActiveAutoCampaigns(
        @Param("orgId") Long orgId,
        @Param("now") Instant now
    );

    /**
     * Liste les vouchers expires (valid_until passe) et encore actifs en base.
     * Utilise par le scheduler quotidien pour passer leur statut a EXPIRED.
     */
    @Query("""
        SELECT v FROM BookingVoucher v
        WHERE v.status = com.clenzy.model.voucher.VoucherStatus.ACTIVE
          AND v.validUntil IS NOT NULL
          AND v.validUntil < :now
    """)
    List<BookingVoucher> findExpiredButStillActive(@Param("now") Instant now);

    /**
     * Increment atomique du compteur {@code usageCount}.
     *
     * <p>Retourne le nombre de rows updated : 0 si le voucher a atteint son
     * {@code maxUsesTotal} (la condition WHERE bloque l'update), 1 sinon.
     * Sert pour eviter une race condition lors de l'application concurrente
     * du meme voucher par plusieurs guests.</p>
     *
     * <p>Pattern : {@code if (repo.tryIncrementUsage(id) == 0)
     * throw new VoucherLimitReachedException();}</p>
     */
    @Modifying
    @Query("""
        UPDATE BookingVoucher v
        SET v.usageCount = v.usageCount + 1
        WHERE v.id = :voucherId
          AND (v.maxUsesTotal IS NULL OR v.usageCount < v.maxUsesTotal)
    """)
    int tryIncrementUsage(@Param("voucherId") Long voucherId);
}
