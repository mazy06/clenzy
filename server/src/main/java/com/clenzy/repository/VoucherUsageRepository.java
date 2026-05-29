package com.clenzy.repository;

import com.clenzy.model.VoucherUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Repository pour {@link VoucherUsage} (audit + analytics).
 *
 * <p>Multi-tenant via Hibernate filter sur {@code organization_id}.</p>
 */
@Repository
public interface VoucherUsageRepository extends JpaRepository<VoucherUsage, Long> {

    /** Toutes les usages d'un voucher (analytics). */
    List<VoucherUsage> findByVoucherIdOrderByAppliedAtDesc(Long voucherId);

    /** Usage attache a une reservation (1:1 via unique index DB). */
    Optional<VoucherUsage> findByReservationId(Long reservationId);

    /**
     * Detection d'abus : combien de fois ce guest_email a utilise ce voucher.
     */
    long countByVoucherIdAndGuestEmail(Long voucherId, String guestEmail);

    /**
     * Aggregation pour le dashboard analytics par voucher :
     * total brut, total discount, total net, nb d'usages.
     */
    @Query("""
        SELECT new com.clenzy.repository.VoucherUsageRepository$VoucherStatsRow(
            COUNT(u),
            COALESCE(SUM(u.originalTotal), 0),
            COALESCE(SUM(u.discountApplied), 0),
            COALESCE(SUM(u.finalTotal), 0)
        )
        FROM VoucherUsage u
        WHERE u.voucherId = :voucherId
    """)
    VoucherStatsRow aggregateStatsByVoucher(@Param("voucherId") Long voucherId);

    /**
     * Aggregation cross-vouchers pour une org sur une periode (rapport global).
     */
    @Query("""
        SELECT new com.clenzy.repository.VoucherUsageRepository$VoucherStatsRow(
            COUNT(u),
            COALESCE(SUM(u.originalTotal), 0),
            COALESCE(SUM(u.discountApplied), 0),
            COALESCE(SUM(u.finalTotal), 0)
        )
        FROM VoucherUsage u
        WHERE u.organizationId = :orgId
          AND u.appliedAt >= :from
          AND u.appliedAt <= :to
    """)
    VoucherStatsRow aggregateOrgStats(
        @Param("orgId") Long orgId,
        @Param("from") Instant from,
        @Param("to") Instant to
    );

    /**
     * Top vouchers de l'org sur une periode, tries par CA brut desc.
     * Utilise pour le dashboard analytics ("top 5 campagnes performantes").
     *
     * <p>Note : la projection JPQL avec {@code new ...VoucherTopRow(...)}
     * impose que toutes les colonnes proviennent du GROUP BY ou d'aggregat.
     * On ramene voucher_id + somme + count, le service complete avec
     * voucherName/code via lookup separe sur BookingVoucherRepository.</p>
     */
    @Query("""
        SELECT new com.clenzy.repository.VoucherUsageRepository$VoucherTopRow(
            u.voucherId,
            COUNT(u),
            COALESCE(SUM(u.originalTotal), 0),
            COALESCE(SUM(u.discountApplied), 0),
            COALESCE(SUM(u.finalTotal), 0)
        )
        FROM VoucherUsage u
        WHERE u.organizationId = :orgId
          AND u.appliedAt >= :from
          AND u.appliedAt <= :to
        GROUP BY u.voucherId
        ORDER BY SUM(u.originalTotal) DESC
    """)
    List<VoucherTopRow> findTopVouchersByGross(
        @Param("orgId") Long orgId,
        @Param("from") Instant from,
        @Param("to") Instant to
    );

    /**
     * Row d'agregation pour les rapports analytics. Java record pour la
     * projection JPQL via {@code new com.clenzy.repository.VoucherUsageRepository$VoucherStatsRow(...)}.
     */
    record VoucherStatsRow(
        long usageCount,
        BigDecimal totalGross,
        BigDecimal totalDiscount,
        BigDecimal totalNet
    ) {}

    /** Variante pour la projection "top par voucher" (incluant voucherId). */
    record VoucherTopRow(
        Long voucherId,
        long usageCount,
        BigDecimal totalGross,
        BigDecimal totalDiscount,
        BigDecimal totalNet
    ) {}
}
