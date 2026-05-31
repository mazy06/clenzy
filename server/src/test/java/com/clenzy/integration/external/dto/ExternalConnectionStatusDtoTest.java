package com.clenzy.integration.external.dto;

import com.clenzy.integration.external.model.ExternalServiceConnection;
import com.clenzy.service.signature.SignatureProviderType;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class ExternalConnectionStatusDtoTest {

    @Test
    void canonicalConstructor_setsAllAccessors() {
        Instant tested = Instant.parse("2026-01-15T10:00:00Z");
        Instant created = Instant.parse("2026-01-10T08:00:00Z");

        ExternalConnectionStatusDto dto = new ExternalConnectionStatusDto(
                true,
                SignatureProviderType.YOUSIGN,
                "https://api.yousign.com",
                "user@example.com",
                "ACTIVE",
                tested,
                created
        );

        assertTrue(dto.connected());
        assertEquals(SignatureProviderType.YOUSIGN, dto.providerType());
        assertEquals("https://api.yousign.com", dto.serverUrl());
        assertEquals("user@example.com", dto.accountIdentifier());
        assertEquals("ACTIVE", dto.status());
        assertEquals(tested, dto.lastTestedAt());
        assertEquals(created, dto.connectedAt());
    }

    @Test
    void notConnected_returnsDtoWithFalseAndNulls() {
        ExternalConnectionStatusDto dto = ExternalConnectionStatusDto.notConnected(SignatureProviderType.DOCUSIGN);

        assertFalse(dto.connected());
        assertEquals(SignatureProviderType.DOCUSIGN, dto.providerType());
        assertNull(dto.serverUrl());
        assertNull(dto.accountIdentifier());
        assertNull(dto.status());
        assertNull(dto.lastTestedAt());
        assertNull(dto.connectedAt());
    }

    @Test
    void notConnected_forEachProvider() {
        for (SignatureProviderType type : SignatureProviderType.values()) {
            ExternalConnectionStatusDto dto = ExternalConnectionStatusDto.notConnected(type);
            assertFalse(dto.connected(), "Expected not connected for " + type);
            assertEquals(type, dto.providerType());
        }
    }

    @Test
    void fromEntity_activeStatus_returnsConnectedTrue() {
        ExternalServiceConnection entity = buildEntity(ExternalServiceConnection.Status.ACTIVE);

        ExternalConnectionStatusDto dto = ExternalConnectionStatusDto.fromEntity(entity);

        assertTrue(dto.connected());
        assertEquals(SignatureProviderType.YOUSIGN, dto.providerType());
        assertEquals("https://api.yousign.com", dto.serverUrl());
        assertEquals("acct_ext", dto.accountIdentifier());
        assertEquals("ACTIVE", dto.status());
        assertNotNull(dto.lastTestedAt());
        assertNotNull(dto.connectedAt());
    }

    @Test
    void fromEntity_nonActiveStatus_returnsConnectedFalse() {
        for (ExternalServiceConnection.Status status : ExternalServiceConnection.Status.values()) {
            if (status == ExternalServiceConnection.Status.ACTIVE) continue;
            ExternalServiceConnection entity = buildEntity(status);

            ExternalConnectionStatusDto dto = ExternalConnectionStatusDto.fromEntity(entity);

            assertFalse(dto.connected(), "Expected disconnected for status=" + status);
            assertEquals(status.name(), dto.status());
        }
    }

    @Test
    void equalsAndHashCode_recordSemantics() {
        Instant t = Instant.parse("2026-01-15T10:00:00Z");
        ExternalConnectionStatusDto a = new ExternalConnectionStatusDto(true, SignatureProviderType.YOUSIGN, "u", "id", "ACTIVE", t, t);
        ExternalConnectionStatusDto b = new ExternalConnectionStatusDto(true, SignatureProviderType.YOUSIGN, "u", "id", "ACTIVE", t, t);
        ExternalConnectionStatusDto c = new ExternalConnectionStatusDto(true, SignatureProviderType.DOCUSIGN, "u", "id", "ACTIVE", t, t);

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(a, c);
    }

    @Test
    void toString_includesFields() {
        ExternalConnectionStatusDto dto = ExternalConnectionStatusDto.notConnected(SignatureProviderType.YOUSIGN);
        String s = dto.toString();
        assertNotNull(s);
        assertTrue(s.contains("YOUSIGN") || s.contains("connected"));
    }

    private ExternalServiceConnection buildEntity(ExternalServiceConnection.Status status) {
        ExternalServiceConnection c = new ExternalServiceConnection();
        c.setProviderType(SignatureProviderType.YOUSIGN);
        c.setServerUrl("https://api.yousign.com");
        c.setAccountIdentifier("acct_ext");
        c.setStatus(status);
        c.setLastTestedAt(Instant.parse("2026-01-20T12:00:00Z"));
        c.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        return c;
    }
}
