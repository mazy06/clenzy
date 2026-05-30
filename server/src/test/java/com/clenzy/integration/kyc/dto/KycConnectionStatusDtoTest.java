package com.clenzy.integration.kyc.dto;

import com.clenzy.integration.kyc.model.KycConnection;
import com.clenzy.integration.kyc.model.KycProviderType;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class KycConnectionStatusDtoTest {

    @Test
    void canonicalConstructor_setsAllAccessors() {
        Instant tested = Instant.parse("2026-01-15T10:00:00Z");
        Instant created = Instant.parse("2026-01-10T08:00:00Z");

        KycConnectionStatusDto dto = new KycConnectionStatusDto(
                true,
                KycProviderType.SUMSUB,
                "https://api.sumsub.com",
                "merchant_xyz",
                "ACTIVE",
                tested,
                created
        );

        assertTrue(dto.connected());
        assertEquals(KycProviderType.SUMSUB, dto.providerType());
        assertEquals("https://api.sumsub.com", dto.serverUrl());
        assertEquals("merchant_xyz", dto.accountIdentifier());
        assertEquals("ACTIVE", dto.status());
        assertEquals(tested, dto.lastTestedAt());
        assertEquals(created, dto.connectedAt());
    }

    @Test
    void notConnected_returnsDtoWithFalseAndNulls() {
        KycConnectionStatusDto dto = KycConnectionStatusDto.notConnected(KycProviderType.VERIFF);

        assertFalse(dto.connected());
        assertEquals(KycProviderType.VERIFF, dto.providerType());
        assertNull(dto.serverUrl());
        assertNull(dto.accountIdentifier());
        assertNull(dto.status());
        assertNull(dto.lastTestedAt());
        assertNull(dto.connectedAt());
    }

    @Test
    void notConnected_withOnfido() {
        KycConnectionStatusDto dto = KycConnectionStatusDto.notConnected(KycProviderType.ONFIDO);

        assertFalse(dto.connected());
        assertEquals(KycProviderType.ONFIDO, dto.providerType());
    }

    @Test
    void fromEntity_activeStatus_returnsConnectedTrue() {
        KycConnection entity = buildEntity(KycConnection.Status.ACTIVE);

        KycConnectionStatusDto dto = KycConnectionStatusDto.fromEntity(entity);

        assertTrue(dto.connected());
        assertEquals(KycProviderType.SUMSUB, dto.providerType());
        assertEquals("https://api.sumsub.com", dto.serverUrl());
        assertEquals("acct_kyc", dto.accountIdentifier());
        assertEquals("ACTIVE", dto.status());
        assertNotNull(dto.lastTestedAt());
    }

    @Test
    void fromEntity_errorStatus_returnsConnectedFalse() {
        KycConnection entity = buildEntity(KycConnection.Status.ERROR);

        KycConnectionStatusDto dto = KycConnectionStatusDto.fromEntity(entity);

        assertFalse(dto.connected());
        assertEquals("ERROR", dto.status());
    }

    @Test
    void fromEntity_revokedStatus_returnsConnectedFalse() {
        KycConnection entity = buildEntity(KycConnection.Status.REVOKED);

        KycConnectionStatusDto dto = KycConnectionStatusDto.fromEntity(entity);

        assertFalse(dto.connected());
        assertEquals("REVOKED", dto.status());
    }

    @Test
    void equalsAndHashCode_recordSemantics() {
        Instant t = Instant.parse("2026-01-15T10:00:00Z");
        KycConnectionStatusDto a = new KycConnectionStatusDto(true, KycProviderType.VERIFF, "u", "id", "ACTIVE", t, t);
        KycConnectionStatusDto b = new KycConnectionStatusDto(true, KycProviderType.VERIFF, "u", "id", "ACTIVE", t, t);
        KycConnectionStatusDto c = new KycConnectionStatusDto(true, KycProviderType.ONFIDO, "u", "id", "ACTIVE", t, t);

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(a, c);
    }

    @Test
    void toString_includesFields() {
        KycConnectionStatusDto dto = KycConnectionStatusDto.notConnected(KycProviderType.SUMSUB);
        String s = dto.toString();
        assertNotNull(s);
        assertTrue(s.contains("SUMSUB") || s.contains("connected"));
    }

    private KycConnection buildEntity(KycConnection.Status status) {
        KycConnection c = new KycConnection();
        c.setProviderType(KycProviderType.SUMSUB);
        c.setServerUrl("https://api.sumsub.com");
        c.setAccountIdentifier("acct_kyc");
        c.setStatus(status);
        c.setLastTestedAt(Instant.parse("2026-01-20T12:00:00Z"));
        ReflectionTestUtils.setField(c, "createdAt", Instant.parse("2026-01-01T00:00:00Z"));
        return c;
    }
}
