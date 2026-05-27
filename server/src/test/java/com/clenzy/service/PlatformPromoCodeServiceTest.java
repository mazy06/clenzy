package com.clenzy.service;

import com.clenzy.model.PlatformPromoCode;
import com.clenzy.repository.PlatformPromoCodeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlatformPromoCodeServiceTest {

    @Mock private PlatformPromoCodeRepository repository;
    private PlatformPromoCodeService service;

    /** Clock fige a une date stable pour des tests deterministes. */
    private final Clock fixedClock = Clock.fixed(
            Instant.parse("2026-05-27T10:00:00Z"), ZoneOffset.UTC);

    @BeforeEach
    void setUp() {
        service = new PlatformPromoCodeService(repository, fixedClock);
    }

    private PlatformPromoCode build(String code, int percent, Integer maxUses, Integer usedCount) {
        var promo = new PlatformPromoCode(code, PlatformPromoCode.DiscountType.PERCENTAGE, percent);
        promo.setId(42L);
        promo.setMaxUses(maxUses);
        promo.setUsedCount(usedCount);
        promo.setActive(true);
        return promo;
    }

    @Nested
    @DisplayName("validate")
    class Validate {

        @Test
        @DisplayName("returns empty for null or blank code")
        void whenNullOrBlank_thenEmpty() {
            assertThat(service.validate(null)).isEmpty();
            assertThat(service.validate("")).isEmpty();
            assertThat(service.validate("   ")).isEmpty();
            verify(repository, never()).findByCodeIgnoreCase(anyString());
        }

        @Test
        @DisplayName("returns empty when code not found")
        void whenNotFound_thenEmpty() {
            when(repository.findByCodeIgnoreCase("WELCOME")).thenReturn(Optional.empty());
            assertThat(service.validate("WELCOME")).isEmpty();
        }

        @Test
        @DisplayName("returns empty when code is inactive")
        void whenInactive_thenEmpty() {
            var promo = build("WELCOME", 20, null, 0);
            promo.setActive(false);
            when(repository.findByCodeIgnoreCase("WELCOME")).thenReturn(Optional.of(promo));
            assertThat(service.validate("WELCOME")).isEmpty();
        }

        @Test
        @DisplayName("returns empty when quota is exhausted")
        void whenQuotaExhausted_thenEmpty() {
            var promo = build("WELCOME", 20, 10, 10); // maxUses=10, usedCount=10
            when(repository.findByCodeIgnoreCase("WELCOME")).thenReturn(Optional.of(promo));
            assertThat(service.validate("WELCOME")).isEmpty();
        }

        @Test
        @DisplayName("returns empty when current time is before validFrom")
        void whenBeforeValidFrom_thenEmpty() {
            var promo = build("WELCOME", 20, null, 0);
            // fixedClock = 2026-05-27, validFrom = future
            promo.setValidFrom(LocalDateTime.of(2026, 6, 1, 0, 0));
            when(repository.findByCodeIgnoreCase("WELCOME")).thenReturn(Optional.of(promo));
            assertThat(service.validate("WELCOME")).isEmpty();
        }

        @Test
        @DisplayName("returns empty when current time is after validUntil")
        void whenAfterValidUntil_thenEmpty() {
            var promo = build("WELCOME", 20, null, 0);
            promo.setValidUntil(LocalDateTime.of(2026, 5, 1, 0, 0)); // past
            when(repository.findByCodeIgnoreCase("WELCOME")).thenReturn(Optional.of(promo));
            assertThat(service.validate("WELCOME")).isEmpty();
        }

        @Test
        @DisplayName("returns the promo when valid and unlimited uses")
        void whenValidUnlimited_thenReturned() {
            var promo = build("WELCOME", 20, null, 999); // maxUses=null donc illimite
            when(repository.findByCodeIgnoreCase("WELCOME")).thenReturn(Optional.of(promo));
            assertThat(service.validate("WELCOME")).contains(promo);
        }

        @Test
        @DisplayName("normalizes input (trim) and does case-insensitive lookup")
        void whenLowerCaseWithWhitespace_thenLookupNormalized() {
            var promo = build("WELCOME", 20, null, 0);
            when(repository.findByCodeIgnoreCase("welcome")).thenReturn(Optional.of(promo));
            assertThat(service.validate("  welcome  ")).contains(promo);
        }
    }

    @Nested
    @DisplayName("tryConsume")
    class TryConsume {

        @Test
        @DisplayName("returns true when atomic update succeeds")
        void whenSuccess_thenTrue() {
            when(repository.tryIncrementUsedCount(42L)).thenReturn(1);
            assertThat(service.tryConsume(42L)).isTrue();
        }

        @Test
        @DisplayName("returns false when atomic update fails (race or deactivated)")
        void whenZeroRowsUpdated_thenFalse() {
            when(repository.tryIncrementUsedCount(42L)).thenReturn(0);
            assertThat(service.tryConsume(42L)).isFalse();
        }
    }

    @Nested
    @DisplayName("PromoCode.applyTo")
    class ApplyDiscount {

        @Test
        @DisplayName("PERCENTAGE applies correct discount")
        void whenPercentage_thenAppliesPercent() {
            var promo = new PlatformPromoCode("X", PlatformPromoCode.DiscountType.PERCENTAGE, 25);
            assertThat(promo.applyTo(10000)).isEqualTo(7500); // -25% sur 100€
        }

        @Test
        @DisplayName("PERCENTAGE 100% reduces to 0")
        void whenHundredPercent_thenZero() {
            var promo = new PlatformPromoCode("X", PlatformPromoCode.DiscountType.PERCENTAGE, 100);
            assertThat(promo.applyTo(10000)).isEqualTo(0);
        }

        @Test
        @DisplayName("FIXED subtracts the value")
        void whenFixed_thenSubtracts() {
            var promo = new PlatformPromoCode("X", PlatformPromoCode.DiscountType.FIXED, 500); // -5€
            assertThat(promo.applyTo(10000)).isEqualTo(9500);
        }

        @Test
        @DisplayName("FIXED greater than amount clamps to 0")
        void whenFixedGreaterThanAmount_thenZero() {
            var promo = new PlatformPromoCode("X", PlatformPromoCode.DiscountType.FIXED, 99999);
            assertThat(promo.applyTo(1000)).isEqualTo(0);
        }
    }
}
