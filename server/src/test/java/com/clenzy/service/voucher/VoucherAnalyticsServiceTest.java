package com.clenzy.service.voucher;

import com.clenzy.dto.voucher.VoucherAnalyticsDto;
import com.clenzy.dto.voucher.VoucherStatsDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import com.clenzy.model.BookingVoucher;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.repository.BookingVoucherRepository;
import com.clenzy.repository.VoucherUsageRepository;
import com.clenzy.repository.VoucherUsageRepository.VoucherStatsRow;
import com.clenzy.repository.VoucherUsageRepository.VoucherTopRow;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires du {@link VoucherAnalyticsService}.
 *
 * <p>Couvre les calculs d'aggregation, le windowing par defaut (30 jours),
 * la limitation Top N, l'ownership cross-org, et les cas defensifs
 * (gross=0, valeurs nulles, voucher supprime).</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class VoucherAnalyticsServiceTest {

    @Mock private BookingVoucherRepository voucherRepo;
    @Mock private VoucherUsageRepository usageRepo;

    private VoucherAnalyticsService service;

    private static final Long ORG_ID = 100L;
    private static final Long OTHER_ORG_ID = 999L;
    private static final Long VOUCHER_ID = 42L;

    private final Instant NOW = Instant.parse("2026-06-01T12:00:00Z");
    private final Clock fixedClock = Clock.fixed(NOW, ZoneOffset.UTC);

    @BeforeEach
    void setUp() {
        service = new VoucherAnalyticsService(voucherRepo, usageRepo, fixedClock);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getOrgAnalytics
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getOrgAnalytics")
    class OrgAnalytics {

        @Test
        @DisplayName("Aucune usage : totaux a zero, topVouchers vide")
        void emptyUsages() {
            when(usageRepo.aggregateOrgStats(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(null);
            when(voucherRepo.countByOrganizationIdAndStatus(ORG_ID, VoucherStatus.ACTIVE)).thenReturn(3L);
            when(usageRepo.findTopVouchersByGross(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of());

            VoucherAnalyticsDto dto = service.getOrgAnalytics(ORG_ID, null, null);

            assertThat(dto.totalUsages()).isEqualTo(0L);
            assertThat(dto.totalGross()).isEqualByComparingTo("0.00");
            assertThat(dto.totalDiscount()).isEqualByComparingTo("0.00");
            assertThat(dto.totalNet()).isEqualByComparingTo("0.00");
            assertThat(dto.activeVouchersCount()).isEqualTo(3L);
            assertThat(dto.topVouchers()).isEmpty();
        }

        @Test
        @DisplayName("Fenetre par defaut : [now - 30j, now]")
        void defaultWindow30Days() {
            when(usageRepo.aggregateOrgStats(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(null);
            when(voucherRepo.countByOrganizationIdAndStatus(ORG_ID, VoucherStatus.ACTIVE)).thenReturn(0L);
            when(usageRepo.findTopVouchersByGross(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of());

            VoucherAnalyticsDto dto = service.getOrgAnalytics(ORG_ID, null, null);

            assertThat(dto.to()).isEqualTo(NOW);
            assertThat(dto.from()).isEqualTo(NOW.minus(30, ChronoUnit.DAYS));
        }

        @Test
        @DisplayName("Fenetre explicite : from/to passes directement")
        void explicitWindow() {
            Instant from = Instant.parse("2026-01-01T00:00:00Z");
            Instant to = Instant.parse("2026-03-31T23:59:59Z");
            when(usageRepo.aggregateOrgStats(ORG_ID, from, to)).thenReturn(null);
            when(voucherRepo.countByOrganizationIdAndStatus(ORG_ID, VoucherStatus.ACTIVE)).thenReturn(0L);
            when(usageRepo.findTopVouchersByGross(ORG_ID, from, to)).thenReturn(List.of());

            VoucherAnalyticsDto dto = service.getOrgAnalytics(ORG_ID, from, to);

            assertThat(dto.from()).isEqualTo(from);
            assertThat(dto.to()).isEqualTo(to);
        }

        @Test
        @DisplayName("Si seul `to` est null : to = now, from = to - 30j")
        void defaultToOnly() {
            Instant from = Instant.parse("2026-05-01T00:00:00Z");
            when(usageRepo.aggregateOrgStats(eq(ORG_ID), eq(from), eq(NOW))).thenReturn(null);
            when(voucherRepo.countByOrganizationIdAndStatus(ORG_ID, VoucherStatus.ACTIVE)).thenReturn(0L);
            when(usageRepo.findTopVouchersByGross(eq(ORG_ID), eq(from), eq(NOW))).thenReturn(List.of());

            VoucherAnalyticsDto dto = service.getOrgAnalytics(ORG_ID, from, null);

            assertThat(dto.from()).isEqualTo(from);
            assertThat(dto.to()).isEqualTo(NOW);
        }

        @Test
        @DisplayName("Si seul `from` est null : to = explicit, from = to - 30j")
        void defaultFromOnly() {
            Instant to = Instant.parse("2026-04-15T18:00:00Z");
            Instant expectedFrom = to.minus(30, ChronoUnit.DAYS);
            when(usageRepo.aggregateOrgStats(eq(ORG_ID), eq(expectedFrom), eq(to))).thenReturn(null);
            when(voucherRepo.countByOrganizationIdAndStatus(ORG_ID, VoucherStatus.ACTIVE)).thenReturn(0L);
            when(usageRepo.findTopVouchersByGross(eq(ORG_ID), eq(expectedFrom), eq(to)))
                .thenReturn(List.of());

            VoucherAnalyticsDto dto = service.getOrgAnalytics(ORG_ID, null, to);

            assertThat(dto.from()).isEqualTo(expectedFrom);
            assertThat(dto.to()).isEqualTo(to);
        }

        @Test
        @DisplayName("Totaux populates + arrondi 2 decimales HALF_UP")
        void populatedTotals() {
            VoucherStatsRow stats = new VoucherStatsRow(
                12L,
                new BigDecimal("1234.567"),
                new BigDecimal("123.4565"),
                new BigDecimal("1111.1105")
            );
            when(usageRepo.aggregateOrgStats(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(stats);
            when(voucherRepo.countByOrganizationIdAndStatus(ORG_ID, VoucherStatus.ACTIVE)).thenReturn(5L);
            when(usageRepo.findTopVouchersByGross(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of());

            VoucherAnalyticsDto dto = service.getOrgAnalytics(ORG_ID, null, null);

            assertThat(dto.totalUsages()).isEqualTo(12L);
            assertThat(dto.totalGross()).isEqualByComparingTo("1234.57");
            assertThat(dto.totalDiscount()).isEqualByComparingTo("123.46");
            assertThat(dto.totalNet()).isEqualByComparingTo("1111.11");
            assertThat(dto.activeVouchersCount()).isEqualTo(5L);
        }

        @Test
        @DisplayName("Stats avec valeurs nulles dans les SUM (defensif) -> 0.00")
        void nullSums() {
            VoucherStatsRow stats = new VoucherStatsRow(0L, null, null, null);
            when(usageRepo.aggregateOrgStats(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(stats);
            when(voucherRepo.countByOrganizationIdAndStatus(ORG_ID, VoucherStatus.ACTIVE)).thenReturn(0L);
            when(usageRepo.findTopVouchersByGross(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of());

            VoucherAnalyticsDto dto = service.getOrgAnalytics(ORG_ID, null, null);

            assertThat(dto.totalGross()).isEqualByComparingTo("0.00");
            assertThat(dto.totalDiscount()).isEqualByComparingTo("0.00");
            assertThat(dto.totalNet()).isEqualByComparingTo("0.00");
        }

        @Test
        @DisplayName("Top vouchers : Top N batch lookup, calcul avg discount pct")
        void topVouchersPopulated() {
            when(usageRepo.aggregateOrgStats(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(new VoucherStatsRow(10L,
                    new BigDecimal("3000"), new BigDecimal("600"), new BigDecimal("2400")));
            when(voucherRepo.countByOrganizationIdAndStatus(ORG_ID, VoucherStatus.ACTIVE)).thenReturn(2L);

            VoucherTopRow row1 = new VoucherTopRow(
                1L, 5L, new BigDecimal("2000"), new BigDecimal("400"), new BigDecimal("1600"));
            VoucherTopRow row2 = new VoucherTopRow(
                2L, 5L, new BigDecimal("1000"), new BigDecimal("200"), new BigDecimal("800"));
            when(usageRepo.findTopVouchersByGross(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(row1, row2));

            BookingVoucher v1 = new BookingVoucher();
            v1.setId(1L);
            v1.setName("Summer Sale");
            v1.setCode("SUMMER25");
            BookingVoucher v2 = new BookingVoucher();
            v2.setId(2L);
            v2.setName("Last Minute");
            v2.setCode("LASTMIN");
            when(voucherRepo.findAllById(List.of(1L, 2L))).thenReturn(List.of(v1, v2));

            VoucherAnalyticsDto dto = service.getOrgAnalytics(ORG_ID, null, null);

            assertThat(dto.topVouchers()).hasSize(2);
            VoucherStatsDto top1 = dto.topVouchers().get(0);
            assertThat(top1.voucherId()).isEqualTo(1L);
            assertThat(top1.voucherName()).isEqualTo("Summer Sale");
            assertThat(top1.voucherCode()).isEqualTo("SUMMER25");
            assertThat(top1.usageCount()).isEqualTo(5L);
            assertThat(top1.totalGross()).isEqualByComparingTo("2000.00");
            assertThat(top1.totalDiscount()).isEqualByComparingTo("400.00");
            assertThat(top1.totalNet()).isEqualByComparingTo("1600.00");
            // 400 / 2000 * 100 = 20.00
            assertThat(top1.avgDiscountPct()).isEqualByComparingTo("20.00");
        }

        @Test
        @DisplayName("Top vouchers limite a 5 (TOP_VOUCHERS_LIMIT)")
        void topVouchersLimitedToFive() {
            when(usageRepo.aggregateOrgStats(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(null);
            when(voucherRepo.countByOrganizationIdAndStatus(ORG_ID, VoucherStatus.ACTIVE)).thenReturn(0L);

            // Repo retourne 8 rows, le service limite a 5
            List<VoucherTopRow> rows = List.of(
                new VoucherTopRow(1L, 1L, BigDecimal.TEN, BigDecimal.ONE, BigDecimal.TEN),
                new VoucherTopRow(2L, 1L, BigDecimal.TEN, BigDecimal.ONE, BigDecimal.TEN),
                new VoucherTopRow(3L, 1L, BigDecimal.TEN, BigDecimal.ONE, BigDecimal.TEN),
                new VoucherTopRow(4L, 1L, BigDecimal.TEN, BigDecimal.ONE, BigDecimal.TEN),
                new VoucherTopRow(5L, 1L, BigDecimal.TEN, BigDecimal.ONE, BigDecimal.TEN),
                new VoucherTopRow(6L, 1L, BigDecimal.TEN, BigDecimal.ONE, BigDecimal.TEN),
                new VoucherTopRow(7L, 1L, BigDecimal.TEN, BigDecimal.ONE, BigDecimal.TEN),
                new VoucherTopRow(8L, 1L, BigDecimal.TEN, BigDecimal.ONE, BigDecimal.TEN)
            );
            when(usageRepo.findTopVouchersByGross(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(rows);
            // Le batch lookup ne demande QUE les 5 premiers ids
            when(voucherRepo.findAllById(List.of(1L, 2L, 3L, 4L, 5L))).thenReturn(List.of());

            VoucherAnalyticsDto dto = service.getOrgAnalytics(ORG_ID, null, null);

            assertThat(dto.topVouchers()).hasSize(5);
            assertThat(dto.topVouchers()).extracting(VoucherStatsDto::voucherId)
                .containsExactly(1L, 2L, 3L, 4L, 5L);
        }

        @Test
        @DisplayName("Voucher supprime entre l'aggregation et le lookup -> name '(deleted)'")
        void deletedVoucherFallback() {
            when(usageRepo.aggregateOrgStats(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(null);
            when(voucherRepo.countByOrganizationIdAndStatus(ORG_ID, VoucherStatus.ACTIVE)).thenReturn(0L);

            VoucherTopRow row = new VoucherTopRow(
                42L, 3L, new BigDecimal("300"), new BigDecimal("60"), new BigDecimal("240"));
            when(usageRepo.findTopVouchersByGross(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(row));
            // voucher 42 deleted entre temps : findAllById renvoie vide
            when(voucherRepo.findAllById(List.of(42L))).thenReturn(List.of());

            VoucherAnalyticsDto dto = service.getOrgAnalytics(ORG_ID, null, null);

            assertThat(dto.topVouchers()).hasSize(1);
            VoucherStatsDto orphan = dto.topVouchers().get(0);
            assertThat(orphan.voucherId()).isEqualTo(42L);
            assertThat(orphan.voucherName()).isEqualTo("(deleted)");
            assertThat(orphan.voucherCode()).isNull();
            assertThat(orphan.usageCount()).isEqualTo(3L);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getVoucherStats
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getVoucherStats")
    class VoucherStats {

        @Test
        @DisplayName("Happy path : retourne stats du voucher avec name+code+pct calcule")
        void happyPath() {
            BookingVoucher v = new BookingVoucher();
            v.setId(VOUCHER_ID);
            v.setOrganizationId(ORG_ID);
            v.setName("Welcome Promo");
            v.setCode("WELCOME20");
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(v));

            VoucherStatsRow stats = new VoucherStatsRow(
                4L,
                new BigDecimal("1000"),
                new BigDecimal("200"),
                new BigDecimal("800")
            );
            when(usageRepo.aggregateStatsByVoucher(VOUCHER_ID)).thenReturn(stats);

            VoucherStatsDto dto = service.getVoucherStats(VOUCHER_ID, ORG_ID);

            assertThat(dto.voucherId()).isEqualTo(VOUCHER_ID);
            assertThat(dto.voucherName()).isEqualTo("Welcome Promo");
            assertThat(dto.voucherCode()).isEqualTo("WELCOME20");
            assertThat(dto.usageCount()).isEqualTo(4L);
            assertThat(dto.totalGross()).isEqualByComparingTo("1000.00");
            assertThat(dto.totalDiscount()).isEqualByComparingTo("200.00");
            assertThat(dto.totalNet()).isEqualByComparingTo("800.00");
            // 200/1000*100 = 20.00
            assertThat(dto.avgDiscountPct()).isEqualByComparingTo("20.00");
        }

        @Test
        @DisplayName("Aucune usage : tous totaux a 0, pct=0 (gross=0 guard)")
        void noUsages() {
            BookingVoucher v = new BookingVoucher();
            v.setId(VOUCHER_ID);
            v.setOrganizationId(ORG_ID);
            v.setName("Empty Promo");
            v.setCode("EMPTY");
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(v));
            when(usageRepo.aggregateStatsByVoucher(VOUCHER_ID)).thenReturn(null);

            VoucherStatsDto dto = service.getVoucherStats(VOUCHER_ID, ORG_ID);

            assertThat(dto.usageCount()).isEqualTo(0L);
            assertThat(dto.totalGross()).isEqualByComparingTo("0.00");
            assertThat(dto.totalDiscount()).isEqualByComparingTo("0.00");
            assertThat(dto.totalNet()).isEqualByComparingTo("0.00");
            assertThat(dto.avgDiscountPct()).isEqualByComparingTo("0.00");
        }

        @Test
        @DisplayName("Voucher inexistant -> NotFoundException (404, fix M-NEW-1)")
        void notFound() {
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getVoucherStats(VOUCHER_ID, ORG_ID))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("introuvable");
            verify(usageRepo, never()).aggregateStatsByVoucher(anyLong());
        }

        @Test
        @DisplayName("Voucher d'une autre org -> UnauthorizedException (403, fix M-NEW-1)")
        void crossOrgAccessDenied() {
            BookingVoucher v = new BookingVoucher();
            v.setId(VOUCHER_ID);
            v.setOrganizationId(OTHER_ORG_ID);
            v.setName("Other Org Voucher");
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(v));

            assertThatThrownBy(() -> service.getVoucherStats(VOUCHER_ID, ORG_ID))
                .isInstanceOf(UnauthorizedException.class);
            verify(usageRepo, never()).aggregateStatsByVoucher(anyLong());
        }

        @Test
        @DisplayName("Arrondi pct correct : 1/3 = 33.33 (HALF_UP)")
        void roundingHalfUp() {
            BookingVoucher v = new BookingVoucher();
            v.setId(VOUCHER_ID);
            v.setOrganizationId(ORG_ID);
            v.setName("X");
            v.setCode("X");
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(v));

            VoucherStatsRow stats = new VoucherStatsRow(
                1L,
                new BigDecimal("300"),
                new BigDecimal("100"),
                new BigDecimal("200")
            );
            when(usageRepo.aggregateStatsByVoucher(VOUCHER_ID)).thenReturn(stats);

            VoucherStatsDto dto = service.getVoucherStats(VOUCHER_ID, ORG_ID);
            // 100/300*100 = 33.333... → 33.33
            assertThat(dto.avgDiscountPct()).isEqualByComparingTo("33.33");
        }

        @Test
        @DisplayName("discount=0 gross>0 -> pct=0 sans NPE")
        void zeroDiscountNonZeroGross() {
            BookingVoucher v = new BookingVoucher();
            v.setId(VOUCHER_ID);
            v.setOrganizationId(ORG_ID);
            v.setName("X");
            v.setCode("X");
            when(voucherRepo.findById(VOUCHER_ID)).thenReturn(Optional.of(v));

            VoucherStatsRow stats = new VoucherStatsRow(
                1L,
                new BigDecimal("100"),
                BigDecimal.ZERO,
                new BigDecimal("100")
            );
            when(usageRepo.aggregateStatsByVoucher(VOUCHER_ID)).thenReturn(stats);

            VoucherStatsDto dto = service.getVoucherStats(VOUCHER_ID, ORG_ID);
            assertThat(dto.avgDiscountPct()).isEqualByComparingTo("0.00");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // computeDiscountPct (via integration tests sur computeTopVouchers)
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("computeDiscountPct (via topVouchers)")
    class ComputeDiscountPct {

        @Test
        @DisplayName("gross=0 dans top row -> pct=0 (guard division par 0)")
        void zeroGrossNoNpe() {
            when(usageRepo.aggregateOrgStats(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(null);
            when(voucherRepo.countByOrganizationIdAndStatus(ORG_ID, VoucherStatus.ACTIVE)).thenReturn(0L);

            VoucherTopRow row = new VoucherTopRow(
                1L, 0L, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
            when(usageRepo.findTopVouchersByGross(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(row));
            BookingVoucher v = new BookingVoucher();
            v.setId(1L);
            v.setName("Z");
            v.setCode("Z");
            when(voucherRepo.findAllById(List.of(1L))).thenReturn(List.of(v));

            VoucherAnalyticsDto dto = service.getOrgAnalytics(ORG_ID, null, null);
            assertThat(dto.topVouchers()).hasSize(1);
            assertThat(dto.topVouchers().get(0).avgDiscountPct()).isEqualByComparingTo("0.00");
        }

        @Test
        @DisplayName("discount null + gross null dans top row -> pct=0 (defensif)")
        void nullValuesInRow() {
            when(usageRepo.aggregateOrgStats(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(null);
            when(voucherRepo.countByOrganizationIdAndStatus(ORG_ID, VoucherStatus.ACTIVE)).thenReturn(0L);

            VoucherTopRow row = new VoucherTopRow(1L, 0L, null, null, null);
            when(usageRepo.findTopVouchersByGross(eq(ORG_ID), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(row));
            when(voucherRepo.findAllById(List.of(1L))).thenReturn(List.of());

            VoucherAnalyticsDto dto = service.getOrgAnalytics(ORG_ID, null, null);
            VoucherStatsDto top = dto.topVouchers().get(0);
            assertThat(top.totalGross()).isEqualByComparingTo("0.00");
            assertThat(top.totalDiscount()).isEqualByComparingTo("0.00");
            assertThat(top.totalNet()).isEqualByComparingTo("0.00");
            assertThat(top.avgDiscountPct()).isEqualByComparingTo("0.00");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor coverage (Clock par defaut)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Constructeur sans Clock utilise systemUTC (smoke test : pas de NPE au boot)")
    void defaultConstructorUsesSystemClock() {
        VoucherAnalyticsService prod = new VoucherAnalyticsService(voucherRepo, usageRepo);
        when(usageRepo.aggregateOrgStats(eq(ORG_ID), any(Instant.class), any(Instant.class)))
            .thenReturn(null);
        when(voucherRepo.countByOrganizationIdAndStatus(ORG_ID, VoucherStatus.ACTIVE)).thenReturn(0L);
        when(usageRepo.findTopVouchersByGross(eq(ORG_ID), any(Instant.class), any(Instant.class)))
            .thenReturn(List.of());

        VoucherAnalyticsDto dto = prod.getOrgAnalytics(ORG_ID, null, null);
        // La fenetre est now (real clock) ± 30 j ; verifier qu'elle a ~30 j d'amplitude
        long deltaDays = ChronoUnit.DAYS.between(dto.from(), dto.to());
        Assertions.assertThat(deltaDays).isEqualTo(30L);
    }
}
