package com.clenzy.integration.pricing.dto;

import com.clenzy.integration.pricing.model.PricingConnection;
import com.clenzy.integration.pricing.model.PricingProviderType;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class PricingConnectionStatusDtoTest {

    @Test
    void canonicalConstructor_setsAllAccessors() {
        Instant tested = Instant.parse("2026-01-15T10:00:00Z");
        Instant created = Instant.parse("2026-01-10T08:00:00Z");

        PricingConnectionStatusDto dto = new PricingConnectionStatusDto(
                true,
                PricingProviderType.PRICELABS,
                "https://api.pricelabs.co",
                "acct_123",
                "ACTIVE",
                tested,
                created
        );

        assertTrue(dto.connected());
        assertEquals(PricingProviderType.PRICELABS, dto.providerType());
        assertEquals("https://api.pricelabs.co", dto.serverUrl());
        assertEquals("acct_123", dto.accountIdentifier());
        assertEquals("ACTIVE", dto.status());
        assertEquals(tested, dto.lastTestedAt());
        assertEquals(created, dto.connectedAt());
    }

    @Test
    void notConnected_returnsDtoWithFalseAndNulls() {
        PricingConnectionStatusDto dto = PricingConnectionStatusDto.notConnected(PricingProviderType.BEYOND);

        assertFalse(dto.connected());
        assertEquals(PricingProviderType.BEYOND, dto.providerType());
        assertNull(dto.serverUrl());
        assertNull(dto.accountIdentifier());
        assertNull(dto.status());
        assertNull(dto.lastTestedAt());
        assertNull(dto.connectedAt());
    }

    @Test
    void notConnected_withWheelhouse() {
        PricingConnectionStatusDto dto = PricingConnectionStatusDto.notConnected(PricingProviderType.WHEELHOUSE);

        assertFalse(dto.connected());
        assertEquals(PricingProviderType.WHEELHOUSE, dto.providerType());
    }

    @Test
    void fromEntity_activeStatus_returnsConnectedTrue() {
        PricingConnection entity = buildEntity(PricingConnection.Status.ACTIVE);

        PricingConnectionStatusDto dto = PricingConnectionStatusDto.fromEntity(entity);

        assertTrue(dto.connected());
        assertEquals(PricingProviderType.PRICELABS, dto.providerType());
        assertEquals("https://api.pricelabs.co", dto.serverUrl());
        assertEquals("acct_42", dto.accountIdentifier());
        assertEquals("ACTIVE", dto.status());
        assertNotNull(dto.lastTestedAt());
    }

    @Test
    void fromEntity_errorStatus_returnsConnectedFalse() {
        PricingConnection entity = buildEntity(PricingConnection.Status.ERROR);

        PricingConnectionStatusDto dto = PricingConnectionStatusDto.fromEntity(entity);

        assertFalse(dto.connected());
        assertEquals("ERROR", dto.status());
    }

    @Test
    void fromEntity_revokedStatus_returnsConnectedFalse() {
        PricingConnection entity = buildEntity(PricingConnection.Status.REVOKED);

        PricingConnectionStatusDto dto = PricingConnectionStatusDto.fromEntity(entity);

        assertFalse(dto.connected());
        assertEquals("REVOKED", dto.status());
    }

    @Test
    void equalsAndHashCode_recordSemantics() {
        Instant t = Instant.parse("2026-01-15T10:00:00Z");
        PricingConnectionStatusDto a = new PricingConnectionStatusDto(true, PricingProviderType.BEYOND, "u", "id", "ACTIVE", t, t);
        PricingConnectionStatusDto b = new PricingConnectionStatusDto(true, PricingProviderType.BEYOND, "u", "id", "ACTIVE", t, t);
        PricingConnectionStatusDto c = new PricingConnectionStatusDto(false, PricingProviderType.BEYOND, "u", "id", "ACTIVE", t, t);

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(a, c);
    }

    @Test
    void toString_includesFields() {
        PricingConnectionStatusDto dto = PricingConnectionStatusDto.notConnected(PricingProviderType.PRICELABS);
        String s = dto.toString();
        assertNotNull(s);
        assertTrue(s.contains("PRICELABS") || s.contains("connected"));
    }

    private PricingConnection buildEntity(PricingConnection.Status status) {
        PricingConnection c = new PricingConnection();
        c.setProviderType(PricingProviderType.PRICELABS);
        c.setServerUrl("https://api.pricelabs.co");
        c.setAccountIdentifier("acct_42");
        c.setStatus(status);
        c.setLastTestedAt(Instant.parse("2026-01-20T12:00:00Z"));
        // createdAt n'a pas de setter public — set via reflection (sinon null en sortie de fromEntity)
        ReflectionTestUtils.setField(c, "createdAt", Instant.parse("2026-01-01T00:00:00Z"));
        return c;
    }
}
