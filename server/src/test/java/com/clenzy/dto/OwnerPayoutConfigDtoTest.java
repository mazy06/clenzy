package com.clenzy.dto;

import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class OwnerPayoutConfigDtoTest {

    // --- Canonical record accessors ---

    @Test
    void canonicalConstructor_exposesAllFields() {
        Instant created = Instant.parse("2026-01-01T00:00:00Z");
        Instant updated = Instant.parse("2026-02-01T00:00:00Z");
        Instant expires = Instant.parse("2026-04-01T00:00:00Z");

        OwnerPayoutConfigDto dto = new OwnerPayoutConfigDto(
                1L, 42L, PayoutMethod.STRIPE_CONNECT, "acct_123", true,
                "FR76 **** **** **** **** *** 0189", "BNPAFRPP", "Jean Dupont",
                true, false, "GOCARDLESS", true, expires, created, updated
        );

        assertEquals(1L, dto.id());
        assertEquals(42L, dto.ownerId());
        assertEquals(PayoutMethod.STRIPE_CONNECT, dto.payoutMethod());
        assertEquals("acct_123", dto.stripeConnectedAccountId());
        assertTrue(dto.stripeOnboardingComplete());
        assertEquals("FR76 **** **** **** **** *** 0189", dto.maskedIban());
        assertEquals("BNPAFRPP", dto.bic());
        assertEquals("Jean Dupont", dto.bankAccountHolder());
        assertTrue(dto.verified());
        assertFalse(dto.wiseConfigured());
        assertEquals("GOCARDLESS", dto.openBankingProvider());
        assertTrue(dto.openBankingConsentActive());
        assertEquals(expires, dto.openBankingConsentExpiresAt());
        assertEquals(created, dto.createdAt());
        assertEquals(updated, dto.updatedAt());
    }

    // --- empty() factory ---

    @Test
    void empty_setsOwnerIdAndManualDefaults() {
        OwnerPayoutConfigDto dto = OwnerPayoutConfigDto.empty(99L);

        assertNull(dto.id());
        assertEquals(99L, dto.ownerId());
        assertEquals(PayoutMethod.MANUAL, dto.payoutMethod());
        assertNull(dto.stripeConnectedAccountId());
        assertFalse(dto.stripeOnboardingComplete());
        assertNull(dto.maskedIban());
        assertNull(dto.bic());
        assertNull(dto.bankAccountHolder());
        assertFalse(dto.verified());
        assertFalse(dto.wiseConfigured());
        assertNull(dto.openBankingProvider());
        assertFalse(dto.openBankingConsentActive());
        assertNull(dto.openBankingConsentExpiresAt());
        assertNull(dto.createdAt());
        assertNull(dto.updatedAt());
    }

    // --- from(entity) — IBAN masking + wise + open banking flags ---

    @Test
    void from_withFullIbanAndWiseRecipient_masksIbanAndMarksWiseConfigured() {
        OwnerPayoutConfig entity = baseEntity();
        entity.setIban("FR7630006000011234567890189");
        entity.setBic("BNPAFRPP");
        entity.setBankAccountHolder("Holder");
        entity.setVerified(true);
        entity.setWiseRecipientId("wr_42");

        OwnerPayoutConfigDto dto = OwnerPayoutConfigDto.from(entity);

        assertNotNull(dto.maskedIban());
        assertTrue(dto.maskedIban().contains("*"), "IBAN must be masked");
        assertTrue(dto.maskedIban().startsWith("FR76"));
        assertTrue(dto.maskedIban().endsWith("0189"));
        assertEquals("BNPAFRPP", dto.bic());
        assertEquals("Holder", dto.bankAccountHolder());
        assertTrue(dto.verified());
        assertTrue(dto.wiseConfigured());
    }

    @Test
    void from_withNullIban_returnsNullMaskedIban() {
        OwnerPayoutConfig entity = baseEntity();
        entity.setIban(null);

        OwnerPayoutConfigDto dto = OwnerPayoutConfigDto.from(entity);

        assertNull(dto.maskedIban());
    }

    @Test
    void from_withBlankWiseRecipientId_isNotWiseConfigured() {
        OwnerPayoutConfig entity = baseEntity();
        entity.setWiseRecipientId("   ");

        OwnerPayoutConfigDto dto = OwnerPayoutConfigDto.from(entity);

        assertFalse(dto.wiseConfigured());
    }

    @Test
    void from_withNullWiseRecipientId_isNotWiseConfigured() {
        OwnerPayoutConfig entity = baseEntity();
        entity.setWiseRecipientId(null);

        OwnerPayoutConfigDto dto = OwnerPayoutConfigDto.from(entity);

        assertFalse(dto.wiseConfigured());
    }

    @Test
    void from_withValidConsentAndNoExpiry_isOpenBankingActive() {
        OwnerPayoutConfig entity = baseEntity();
        entity.setOpenBankingConsentId("consent_xyz");
        entity.setOpenBankingConsentExpiresAt(null);

        OwnerPayoutConfigDto dto = OwnerPayoutConfigDto.from(entity);

        assertTrue(dto.openBankingConsentActive());
    }

    @Test
    void from_withValidConsentAndFutureExpiry_isOpenBankingActive() {
        OwnerPayoutConfig entity = baseEntity();
        entity.setOpenBankingConsentId("consent_xyz");
        entity.setOpenBankingConsentExpiresAt(Instant.now().plusSeconds(3600));

        OwnerPayoutConfigDto dto = OwnerPayoutConfigDto.from(entity);

        assertTrue(dto.openBankingConsentActive());
    }

    @Test
    void from_withExpiredConsent_isNotOpenBankingActive() {
        OwnerPayoutConfig entity = baseEntity();
        entity.setOpenBankingConsentId("consent_xyz");
        entity.setOpenBankingConsentExpiresAt(Instant.now().minusSeconds(3600));

        OwnerPayoutConfigDto dto = OwnerPayoutConfigDto.from(entity);

        assertFalse(dto.openBankingConsentActive());
    }

    @Test
    void from_withBlankConsentId_isNotOpenBankingActive() {
        OwnerPayoutConfig entity = baseEntity();
        entity.setOpenBankingConsentId("   ");

        OwnerPayoutConfigDto dto = OwnerPayoutConfigDto.from(entity);

        assertFalse(dto.openBankingConsentActive());
    }

    @Test
    void from_withNullConsentId_isNotOpenBankingActive() {
        OwnerPayoutConfig entity = baseEntity();
        entity.setOpenBankingConsentId(null);

        OwnerPayoutConfigDto dto = OwnerPayoutConfigDto.from(entity);

        assertFalse(dto.openBankingConsentActive());
    }

    // --- Record equality ---

    @Test
    void records_equalityByValue() {
        OwnerPayoutConfigDto a = OwnerPayoutConfigDto.empty(7L);
        OwnerPayoutConfigDto b = OwnerPayoutConfigDto.empty(7L);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    @Test
    void records_inequalityByOwnerId() {
        OwnerPayoutConfigDto a = OwnerPayoutConfigDto.empty(7L);
        OwnerPayoutConfigDto b = OwnerPayoutConfigDto.empty(8L);
        assertNotEquals(a, b);
    }

    // --- Helpers ---

    private OwnerPayoutConfig baseEntity() {
        OwnerPayoutConfig entity = new OwnerPayoutConfig();
        entity.setId(1L);
        entity.setOrganizationId(10L);
        entity.setOwnerId(42L);
        entity.setPayoutMethod(PayoutMethod.STRIPE_CONNECT);
        entity.setStripeConnectedAccountId("acct_abc");
        entity.setStripeOnboardingComplete(true);
        entity.setOpenBankingProvider("GOCARDLESS");
        return entity;
    }
}
