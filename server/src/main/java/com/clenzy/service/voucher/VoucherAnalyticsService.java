package com.clenzy.service.voucher;

import com.clenzy.dto.voucher.VoucherAnalyticsDto;
import com.clenzy.dto.voucher.VoucherStatsDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import com.clenzy.model.BookingVoucher;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.repository.BookingVoucherRepository;
import com.clenzy.repository.VoucherUsageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service d'analytics pour les {@link BookingVoucher}.
 *
 * <p>Read-only. Aggrege les {@code voucher_usage} sur une periode pour
 * alimenter le dashboard "Marketing" cote PMS host.</p>
 */
@Service
@Transactional(readOnly = true)
public class VoucherAnalyticsService {

    private static final int TOP_VOUCHERS_LIMIT = 5;
    private static final int DEFAULT_WINDOW_DAYS = 30;

    private final BookingVoucherRepository voucherRepo;
    private final VoucherUsageRepository usageRepo;
    private final Clock clock;

    // Constructeur unique → injection Spring auto, pas de @Autowired
    // (regle CLAUDE.md Code Quality §1 DIP).
    public VoucherAnalyticsService(
        BookingVoucherRepository voucherRepo,
        VoucherUsageRepository usageRepo
    ) {
        this(voucherRepo, usageRepo, Clock.systemUTC());
    }

    /** Constructeur visible pour les tests (Clock mock). */
    VoucherAnalyticsService(
        BookingVoucherRepository voucherRepo,
        VoucherUsageRepository usageRepo,
        Clock clock
    ) {
        this.voucherRepo = voucherRepo;
        this.usageRepo = usageRepo;
        this.clock = clock;
    }

    /**
     * Aggregation org-level. Si {@code from}/{@code to} sont null, utilise
     * les 30 derniers jours par defaut.
     */
    public VoucherAnalyticsDto getOrgAnalytics(Long orgId, Instant from, Instant to) {
        Instant now = Instant.now(clock);
        Instant effectiveTo = to != null ? to : now;
        Instant effectiveFrom = from != null ? from : effectiveTo.minus(DEFAULT_WINDOW_DAYS, ChronoUnit.DAYS);

        var stats = usageRepo.aggregateOrgStats(orgId, effectiveFrom, effectiveTo);
        // Compteur via count SQL (fix M3) au lieu de charger toutes les entites.
        long activeCount = voucherRepo.countByOrganizationIdAndStatus(orgId, VoucherStatus.ACTIVE);

        List<VoucherStatsDto> topVouchers = computeTopVouchers(orgId, effectiveFrom, effectiveTo);

        return new VoucherAnalyticsDto(
            effectiveFrom,
            effectiveTo,
            stats != null ? stats.usageCount() : 0L,
            scale(stats != null ? stats.totalGross() : BigDecimal.ZERO),
            scale(stats != null ? stats.totalDiscount() : BigDecimal.ZERO),
            scale(stats != null ? stats.totalNet() : BigDecimal.ZERO),
            activeCount,
            topVouchers
        );
    }

    /**
     * Stats detaillees pour un voucher specifique (la periode du voucher est
     * implicite : toutes les usages depuis la creation). Verifie l'ownership
     * de l'org avant de retourner.
     */
    public VoucherStatsDto getVoucherStats(Long voucherId, Long orgId) {
        // Fix M-NEW-1 : exceptions metier dediees -> codes HTTP coherents via
        // GlobalExceptionHandler (404 NotFound vs 403 Unauthorized vs 500
        // genere par IllegalArgumentException).
        BookingVoucher v = voucherRepo.findById(voucherId)
            .orElseThrow(() -> new NotFoundException(
                "Voucher " + voucherId + " introuvable"));
        if (!v.getOrganizationId().equals(orgId)) {
            throw new UnauthorizedException(
                "Voucher " + voucherId + " n'appartient pas a cette organisation");
        }

        var stats = usageRepo.aggregateStatsByVoucher(voucherId);
        return new VoucherStatsDto(
            v.getId(),
            v.getName(),
            v.getCode(),
            stats != null ? stats.usageCount() : 0L,
            scale(stats != null ? stats.totalGross() : BigDecimal.ZERO),
            scale(stats != null ? stats.totalDiscount() : BigDecimal.ZERO),
            scale(stats != null ? stats.totalNet() : BigDecimal.ZERO),
            computeDiscountPct(
                stats != null ? stats.totalDiscount() : BigDecimal.ZERO,
                stats != null ? stats.totalGross() : BigDecimal.ZERO
            )
        );
    }

    /**
     * Top N vouchers sur la periode. Pour chaque row d'aggregation, lookup
     * du voucher entity pour recuperer name + code (limite l'overhead via
     * un seul findAllById batch).
     */
    private List<VoucherStatsDto> computeTopVouchers(Long orgId, Instant from, Instant to) {
        var topRows = usageRepo.findTopVouchersByGross(orgId, from, to);
        if (topRows.isEmpty()) return List.of();

        // Limit a TOP_VOUCHERS_LIMIT
        var limited = topRows.stream().limit(TOP_VOUCHERS_LIMIT).toList();
        var voucherIds = limited.stream().map(r -> r.voucherId()).toList();

        // Batch lookup pour name + code (1 SQL au lieu de N).
        Map<Long, BookingVoucher> voucherById = voucherRepo.findAllById(voucherIds).stream()
            .collect(Collectors.toMap(BookingVoucher::getId, v -> v));

        return limited.stream().map(row -> {
            BookingVoucher v = voucherById.get(row.voucherId());
            return new VoucherStatsDto(
                row.voucherId(),
                v != null ? v.getName() : "(deleted)",
                v != null ? v.getCode() : null,
                row.usageCount(),
                scale(row.totalGross()),
                scale(row.totalDiscount()),
                scale(row.totalNet()),
                computeDiscountPct(row.totalDiscount(), row.totalGross())
            );
        }).toList();
    }

    private BigDecimal scale(BigDecimal v) {
        return v != null ? v.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2);
    }

    /** {@code discount / gross * 100}, ou 0 si {@code gross == 0} (defensif). */
    private BigDecimal computeDiscountPct(BigDecimal discount, BigDecimal gross) {
        if (gross == null || gross.signum() == 0) return BigDecimal.ZERO.setScale(2);
        if (discount == null) return BigDecimal.ZERO.setScale(2);
        return discount.multiply(BigDecimal.valueOf(100))
            .divide(gross, 2, RoundingMode.HALF_UP);
    }
}
