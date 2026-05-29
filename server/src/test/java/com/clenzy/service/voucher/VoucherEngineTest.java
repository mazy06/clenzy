package com.clenzy.service.voucher;

import com.clenzy.model.BookingVoucher;
import com.clenzy.model.VoucherUsage;
import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.model.voucher.VoucherType;
import com.clenzy.repository.BookingVoucherRepository;
import com.clenzy.repository.VoucherPropertyScopeRepository;
import com.clenzy.repository.VoucherUsageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires du {@link VoucherEngine}.
 *
 * <p>Couvrent les regles metier critiques :
 * <ul>
 *   <li>Validation : tous les codes d'erreur {@link VoucherValidationError}</li>
 *   <li>Calcul : PERCENTAGE / FIXED_AMOUNT (FREE_NIGHTS hors V1)</li>
 *   <li>Concurrence : race sur {@code max_uses_total} via tryIncrement</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class VoucherEngineTest {

    @Mock private BookingVoucherRepository voucherRepo;
    @Mock private VoucherPropertyScopeRepository scopeRepo;
    @Mock private VoucherUsageRepository usageRepo;

    private VoucherEngine engine;

    /** Clock fixe pour des tests deterministes (toutes les Instant relatives au "now" suivant). */
    private final Instant NOW = Instant.parse("2026-06-01T12:00:00Z");
    private final Clock fixedClock = Clock.fixed(NOW, ZoneOffset.UTC);

    private static final Long ORG_ID = 100L;
    private static final Long PROPERTY_ID = 200L;
    private static final Long VOUCHER_ID = 42L;

    @BeforeEach
    void setUp() {
        engine = new VoucherEngine(voucherRepo, scopeRepo, usageRepo, fixedClock);
    }

    private BookingVoucher activeVoucher(String code) {
        BookingVoucher v = new BookingVoucher();
        v.setId(VOUCHER_ID);
        v.setOrganizationId(ORG_ID);
        v.setCode(code);
        v.setType(VoucherType.MANUAL_CODE);
        v.setDiscountType(VoucherDiscountType.PERCENTAGE);
        v.setDiscountValue(new BigDecimal("20"));
        v.setStatus(VoucherStatus.ACTIVE);
        v.setChannelScope(VoucherChannelScope.ALL);
        v.setUsageCount(0);
        v.setMaxUsesPerGuest(null);
        v.setName("Test voucher");
        return v;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VALIDATION — codes d'erreur
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("validate")
    class Validate {

        @Test
        @DisplayName("INVALID_INPUT si code null/blank ou inputs manquants")
        void invalidInputs() {
            assertInvalid(engine.validate(ORG_ID, null, PROPERTY_ID, 3, BigDecimal.TEN, "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.INVALID_INPUT);
            assertInvalid(engine.validate(ORG_ID, "  ", PROPERTY_ID, 3, BigDecimal.TEN, "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.INVALID_INPUT);
            assertInvalid(engine.validate(ORG_ID, "X", PROPERTY_ID, 0, BigDecimal.TEN, "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.INVALID_INPUT);
            assertInvalid(engine.validate(ORG_ID, "X", PROPERTY_ID, 3, BigDecimal.ZERO, "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.INVALID_INPUT);
        }

        @Test
        @DisplayName("NOT_FOUND quand le code n'existe pas")
        void notFound() {
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20")).thenReturn(Optional.empty());
            var result = engine.validate(ORG_ID, "WELCOME20", PROPERTY_ID, 3, BigDecimal.TEN, "g@x", VoucherChannelScope.ALL);
            assertInvalid(result, VoucherValidationError.NOT_FOUND);
        }

        @Test
        @DisplayName("DRAFT_NOT_ACTIVE quand le voucher est en draft")
        void draftNotActive() {
            BookingVoucher v = activeVoucher("WELCOME20");
            v.setStatus(VoucherStatus.DRAFT);
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20")).thenReturn(Optional.of(v));
            assertInvalid(engine.validate(ORG_ID, "WELCOME20", PROPERTY_ID, 3, BigDecimal.TEN, "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.DRAFT_NOT_ACTIVE);
        }

        @Test
        @DisplayName("PAUSED rejette les vouchers temporairement desactives")
        void paused() {
            BookingVoucher v = activeVoucher("WELCOME20");
            v.setStatus(VoucherStatus.PAUSED);
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20")).thenReturn(Optional.of(v));
            assertInvalid(engine.validate(ORG_ID, "WELCOME20", PROPERTY_ID, 3, BigDecimal.TEN, "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.PAUSED);
        }

        @Test
        @DisplayName("EXPIRED quand le statut EXPIRED")
        void expiredByStatus() {
            BookingVoucher v = activeVoucher("WELCOME20");
            v.setStatus(VoucherStatus.EXPIRED);
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20")).thenReturn(Optional.of(v));
            assertInvalid(engine.validate(ORG_ID, "WELCOME20", PROPERTY_ID, 3, BigDecimal.TEN, "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.EXPIRED);
        }

        @Test
        @DisplayName("NOT_YET_ACTIVE si valid_from > now")
        void notYetActive() {
            BookingVoucher v = activeVoucher("WELCOME20");
            v.setValidFrom(NOW.plusSeconds(3600));
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20")).thenReturn(Optional.of(v));
            assertInvalid(engine.validate(ORG_ID, "WELCOME20", PROPERTY_ID, 3, BigDecimal.TEN, "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.NOT_YET_ACTIVE);
        }

        @Test
        @DisplayName("EXPIRED si valid_until < now")
        void expiredByDate() {
            BookingVoucher v = activeVoucher("WELCOME20");
            v.setValidUntil(NOW.minusSeconds(60));
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20")).thenReturn(Optional.of(v));
            assertInvalid(engine.validate(ORG_ID, "WELCOME20", PROPERTY_ID, 3, BigDecimal.TEN, "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.EXPIRED);
        }

        @Test
        @DisplayName("CHANNEL_NOT_ALLOWED quand channel mismatch (non ALL)")
        void channelMismatch() {
            BookingVoucher v = activeVoucher("WELCOME20");
            v.setChannelScope(VoucherChannelScope.WHATSAPP);
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20")).thenReturn(Optional.of(v));
            assertInvalid(engine.validate(ORG_ID, "WELCOME20", PROPERTY_ID, 3, BigDecimal.TEN, "g@x", VoucherChannelScope.BOOKING_ENGINE),
                VoucherValidationError.CHANNEL_NOT_ALLOWED);
        }

        @Test
        @DisplayName("PROPERTY_NOT_IN_SCOPE quand scope defini et property absente")
        void propertyNotInScope() {
            BookingVoucher v = activeVoucher("WELCOME20");
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20")).thenReturn(Optional.of(v));
            when(scopeRepo.countByVoucherId(VOUCHER_ID)).thenReturn(2L);
            when(scopeRepo.existsByVoucherIdAndPropertyId(VOUCHER_ID, PROPERTY_ID)).thenReturn(false);
            assertInvalid(engine.validate(ORG_ID, "WELCOME20", PROPERTY_ID, 3, BigDecimal.TEN, "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.PROPERTY_NOT_IN_SCOPE);
        }

        @Test
        @DisplayName("MIN_STAY_NOT_MET quand stayNights < minStayNights")
        void minStay() {
            BookingVoucher v = activeVoucher("WELCOME20");
            v.setMinStayNights(5);
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20")).thenReturn(Optional.of(v));
            when(scopeRepo.countByVoucherId(VOUCHER_ID)).thenReturn(0L);
            assertInvalid(engine.validate(ORG_ID, "WELCOME20", PROPERTY_ID, 3, BigDecimal.TEN, "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.MIN_STAY_NOT_MET);
        }

        @Test
        @DisplayName("MAX_STAY_EXCEEDED quand stayNights > maxStayNights")
        void maxStay() {
            BookingVoucher v = activeVoucher("WELCOME20");
            v.setMaxStayNights(7);
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20")).thenReturn(Optional.of(v));
            when(scopeRepo.countByVoucherId(VOUCHER_ID)).thenReturn(0L);
            assertInvalid(engine.validate(ORG_ID, "WELCOME20", PROPERTY_ID, 14, new BigDecimal("500"), "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.MAX_STAY_EXCEEDED);
        }

        @Test
        @DisplayName("MIN_TOTAL_NOT_MET quand subtotal < minTotalAmount")
        void minTotal() {
            BookingVoucher v = activeVoucher("WELCOME20");
            v.setMinTotalAmount(new BigDecimal("200"));
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20")).thenReturn(Optional.of(v));
            when(scopeRepo.countByVoucherId(VOUCHER_ID)).thenReturn(0L);
            assertInvalid(engine.validate(ORG_ID, "WELCOME20", PROPERTY_ID, 3, new BigDecimal("100"), "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.MIN_TOTAL_NOT_MET);
        }

        @Test
        @DisplayName("USAGE_LIMIT_REACHED quand usageCount >= maxUsesTotal")
        void globalCap() {
            BookingVoucher v = activeVoucher("WELCOME20");
            v.setMaxUsesTotal(100);
            v.setUsageCount(100);
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20")).thenReturn(Optional.of(v));
            when(scopeRepo.countByVoucherId(VOUCHER_ID)).thenReturn(0L);
            assertInvalid(engine.validate(ORG_ID, "WELCOME20", PROPERTY_ID, 3, BigDecimal.TEN, "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.USAGE_LIMIT_REACHED);
        }

        @Test
        @DisplayName("GUEST_LIMIT_REACHED quand le guest a deja utilise maxUsesPerGuest fois")
        void guestCap() {
            BookingVoucher v = activeVoucher("WELCOME20");
            v.setMaxUsesPerGuest(1);
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "WELCOME20")).thenReturn(Optional.of(v));
            when(scopeRepo.countByVoucherId(VOUCHER_ID)).thenReturn(0L);
            when(usageRepo.countByVoucherIdAndGuestEmail(VOUCHER_ID, "g@x")).thenReturn(1L);
            assertInvalid(engine.validate(ORG_ID, "WELCOME20", PROPERTY_ID, 3, BigDecimal.TEN, "g@x", VoucherChannelScope.ALL),
                VoucherValidationError.GUEST_LIMIT_REACHED);
        }

        @Test
        @DisplayName("Valid quand toutes les regles passent")
        void happyPath() {
            BookingVoucher v = activeVoucher("WELCOME20");
            // L'engine passe code.trim() au repo (UPPER comparison est cote repo).
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "welcome20")).thenReturn(Optional.of(v));
            when(scopeRepo.countByVoucherId(VOUCHER_ID)).thenReturn(0L);
            var result = engine.validate(ORG_ID, "welcome20", PROPERTY_ID, 3,
                new BigDecimal("501"), "g@x", VoucherChannelScope.BOOKING_ENGINE);
            assertThat(result).isInstanceOf(VoucherValidationResult.Valid.class);
            assertThat(((VoucherValidationResult.Valid) result).voucher().getId()).isEqualTo(VOUCHER_ID);
        }

        @Test
        @DisplayName("Code lookup est case-insensitive (trim + UPPER au niveau du repo)")
        void caseInsensitive() {
            BookingVoucher v = activeVoucher("WELCOME20");
            when(voucherRepo.findByOrgAndCodeIgnoreCase(ORG_ID, "welcome20")).thenReturn(Optional.of(v));
            when(scopeRepo.countByVoucherId(VOUCHER_ID)).thenReturn(0L);
            var result = engine.validate(ORG_ID, "  welcome20  ", PROPERTY_ID, 3,
                new BigDecimal("100"), null, VoucherChannelScope.ALL);
            assertThat(result).isInstanceOf(VoucherValidationResult.Valid.class);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CALCUL DU DISCOUNT
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("apply")
    class Apply {

        @Test
        @DisplayName("PERCENTAGE applique correctement (20% sur 501 = 100.20)")
        void percentage() {
            BookingVoucher v = activeVoucher("WELCOME20");
            v.setDiscountValue(new BigDecimal("20"));
            VoucherApplyResult r = engine.apply(v, new BigDecimal("501.00"), 3);
            assertThat(r.originalTotal()).isEqualByComparingTo("501.00");
            assertThat(r.discountApplied()).isEqualByComparingTo("100.20");
            assertThat(r.finalTotal()).isEqualByComparingTo("400.80");
            assertThat(r.voucherCode()).isEqualTo("WELCOME20");
            assertThat(r.voucherId()).isEqualTo(VOUCHER_ID);
        }

        @Test
        @DisplayName("PERCENTAGE arrondit HALF_UP (33% sur 100 = 33.00)")
        void percentageRounding() {
            BookingVoucher v = activeVoucher("X");
            v.setDiscountValue(new BigDecimal("33.333"));
            VoucherApplyResult r = engine.apply(v, new BigDecimal("100"), 1);
            assertThat(r.discountApplied()).isEqualByComparingTo("33.33");
        }

        @Test
        @DisplayName("FIXED_AMOUNT deduit montant fixe")
        void fixedAmount() {
            BookingVoucher v = activeVoucher("X");
            v.setDiscountType(VoucherDiscountType.FIXED_AMOUNT);
            v.setDiscountValue(new BigDecimal("50"));
            VoucherApplyResult r = engine.apply(v, new BigDecimal("200"), 2);
            assertThat(r.discountApplied()).isEqualByComparingTo("50.00");
            assertThat(r.finalTotal()).isEqualByComparingTo("150.00");
        }

        @Test
        @DisplayName("FIXED_AMOUNT clampe a subtotal si > (final >= 0)")
        void fixedAmountClamped() {
            BookingVoucher v = activeVoucher("X");
            v.setDiscountType(VoucherDiscountType.FIXED_AMOUNT);
            v.setDiscountValue(new BigDecimal("500"));
            VoucherApplyResult r = engine.apply(v, new BigDecimal("200"), 2);
            assertThat(r.discountApplied()).isEqualByComparingTo("200.00");
            assertThat(r.finalTotal()).isEqualByComparingTo("0.00");
        }

        @Test
        @DisplayName("FREE_NIGHTS renvoie 0 en V1 (degradation gracieuse)")
        void freeNightsV1() {
            BookingVoucher v = activeVoucher("X");
            v.setDiscountType(VoucherDiscountType.FREE_NIGHTS);
            v.setDiscountValue(new BigDecimal("2"));
            VoucherApplyResult r = engine.apply(v, new BigDecimal("300"), 5);
            assertThat(r.discountApplied()).isEqualByComparingTo("0.00");
            assertThat(r.finalTotal()).isEqualByComparingTo("300.00");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ENREGISTREMENT (audit + counter)
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("recordUsage")
    class RecordUsage {

        @Test
        @DisplayName("Increment OK + insert audit (happy path)")
        void happyPath() {
            BookingVoucher v = activeVoucher("WELCOME20");
            VoucherApplyResult applied = new VoucherApplyResult(
                v.getId(), v.getCode(),
                new BigDecimal("500.00"), new BigDecimal("100.00"), new BigDecimal("400.00")
            );
            when(voucherRepo.tryIncrementUsage(VOUCHER_ID)).thenReturn(1);
            when(usageRepo.save(any(VoucherUsage.class))).thenAnswer(inv -> inv.getArgument(0));

            Optional<VoucherUsage> result = engine.recordUsage(
                v, 999L, ORG_ID, PROPERTY_ID, applied, "g@x", "BOOKING_ENGINE");

            assertThat(result).isPresent();
            verify(voucherRepo).tryIncrementUsage(VOUCHER_ID);
            verify(usageRepo).save(any(VoucherUsage.class));
            assertThat(result.get().getDiscountApplied()).isEqualByComparingTo("100.00");
            assertThat(result.get().getReservationId()).isEqualTo(999L);
        }

        @Test
        @DisplayName("Race max_uses_total : tryIncrement=0 -> empty + pas d'audit")
        void raceCondition() {
            BookingVoucher v = activeVoucher("WELCOME20");
            VoucherApplyResult applied = new VoucherApplyResult(
                v.getId(), v.getCode(),
                new BigDecimal("500.00"), new BigDecimal("100.00"), new BigDecimal("400.00")
            );
            when(voucherRepo.tryIncrementUsage(VOUCHER_ID)).thenReturn(0);

            Optional<VoucherUsage> result = engine.recordUsage(
                v, 999L, ORG_ID, PROPERTY_ID, applied, "g@x", "BOOKING_ENGINE");

            assertThat(result).isEmpty();
            verify(voucherRepo).tryIncrementUsage(VOUCHER_ID);
            verify(usageRepo, never()).save(any(VoucherUsage.class));
        }

        @Test
        @DisplayName("appliedVia null -> default BOOKING_ENGINE")
        void defaultAppliedVia() {
            BookingVoucher v = activeVoucher("WELCOME20");
            VoucherApplyResult applied = new VoucherApplyResult(
                v.getId(), v.getCode(),
                new BigDecimal("100.00"), new BigDecimal("10.00"), new BigDecimal("90.00")
            );
            when(voucherRepo.tryIncrementUsage(VOUCHER_ID)).thenReturn(1);
            when(usageRepo.save(any(VoucherUsage.class))).thenAnswer(inv -> inv.getArgument(0));

            Optional<VoucherUsage> result = engine.recordUsage(
                v, 999L, ORG_ID, PROPERTY_ID, applied, null, null);

            assertThat(result).isPresent();
            assertThat(result.get().getAppliedVia()).isEqualTo("BOOKING_ENGINE");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // findApplicableAutoCampaigns
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("findApplicableAutoCampaigns")
    class AutoCampaigns {

        @Test
        @DisplayName("filtre les campagnes : scope vide (= all properties) ou property listee")
        void filtersByScope() {
            BookingVoucher noScope = activeVoucher("A");
            noScope.setId(1L);
            noScope.setType(VoucherType.AUTO_CAMPAIGN);
            BookingVoucher withScopeMatch = activeVoucher("B");
            withScopeMatch.setId(2L);
            withScopeMatch.setType(VoucherType.AUTO_CAMPAIGN);
            BookingVoucher withScopeNoMatch = activeVoucher("C");
            withScopeNoMatch.setId(3L);
            withScopeNoMatch.setType(VoucherType.AUTO_CAMPAIGN);

            when(voucherRepo.findActiveAutoCampaigns(eq(ORG_ID), any(Instant.class)))
                .thenReturn(List.of(noScope, withScopeMatch, withScopeNoMatch));
            when(scopeRepo.countByVoucherId(1L)).thenReturn(0L);
            when(scopeRepo.countByVoucherId(2L)).thenReturn(1L);
            when(scopeRepo.existsByVoucherIdAndPropertyId(2L, PROPERTY_ID)).thenReturn(true);
            when(scopeRepo.countByVoucherId(3L)).thenReturn(1L);
            when(scopeRepo.existsByVoucherIdAndPropertyId(3L, PROPERTY_ID)).thenReturn(false);

            List<BookingVoucher> result = engine.findApplicableAutoCampaigns(ORG_ID, PROPERTY_ID);
            assertThat(result).extracting(BookingVoucher::getId).containsExactly(1L, 2L);
        }

        @Test
        @DisplayName("inputs null -> liste vide (defensif)")
        void nullInputs() {
            assertThat(engine.findApplicableAutoCampaigns(null, PROPERTY_ID)).isEmpty();
            assertThat(engine.findApplicableAutoCampaigns(ORG_ID, null)).isEmpty();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper
    // ─────────────────────────────────────────────────────────────────────────

    private void assertInvalid(VoucherValidationResult result, VoucherValidationError expected) {
        assertThat(result).isInstanceOf(VoucherValidationResult.Invalid.class);
        assertThat(((VoucherValidationResult.Invalid) result).reason()).isEqualTo(expected);
    }
}
