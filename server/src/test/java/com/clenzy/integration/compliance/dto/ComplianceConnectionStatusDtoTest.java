package com.clenzy.integration.compliance.dto;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class ComplianceConnectionStatusDtoTest {

    @Test
    void canonicalConstructor_setsAllAccessors() {
        Instant tested = Instant.parse("2026-01-15T10:00:00Z");
        Instant created = Instant.parse("2026-01-10T08:00:00Z");

        ComplianceConnectionStatusDto dto = new ComplianceConnectionStatusDto(
                true,
                ComplianceProviderType.CHEKIN,
                "https://api.chekin.com",
                "acct_chekin",
                "ACTIVE",
                tested,
                created
        );

        assertTrue(dto.connected());
        assertEquals(ComplianceProviderType.CHEKIN, dto.providerType());
        assertEquals("https://api.chekin.com", dto.serverUrl());
        assertEquals("acct_chekin", dto.accountIdentifier());
        assertEquals("ACTIVE", dto.status());
        assertEquals(tested, dto.lastTestedAt());
        assertEquals(created, dto.connectedAt());
    }

    @Test
    void notConnected_returnsDtoWithFalseAndNulls() {
        ComplianceConnectionStatusDto dto = ComplianceConnectionStatusDto.notConnected(ComplianceProviderType.POLICE_MA);

        assertFalse(dto.connected());
        assertEquals(ComplianceProviderType.POLICE_MA, dto.providerType());
        assertNull(dto.serverUrl());
        assertNull(dto.accountIdentifier());
        assertNull(dto.status());
        assertNull(dto.lastTestedAt());
        assertNull(dto.connectedAt());
    }

    @Test
    void notConnected_forEachProvider() {
        for (ComplianceProviderType type : ComplianceProviderType.values()) {
            ComplianceConnectionStatusDto dto = ComplianceConnectionStatusDto.notConnected(type);
            assertFalse(dto.connected());
            assertEquals(type, dto.providerType());
        }
    }

    @Test
    void fromEntity_activeStatus_returnsConnectedTrue() {
        ComplianceConnection entity = buildEntity(ComplianceConnection.Status.ACTIVE);

        ComplianceConnectionStatusDto dto = ComplianceConnectionStatusDto.fromEntity(entity);

        assertTrue(dto.connected());
        assertEquals(ComplianceProviderType.CHEKIN, dto.providerType());
        assertEquals("https://api.chekin.com", dto.serverUrl());
        assertEquals("acct_42", dto.accountIdentifier());
        assertEquals("ACTIVE", dto.status());
    }

    @Test
    void fromEntity_errorStatus_returnsConnectedFalse() {
        ComplianceConnection entity = buildEntity(ComplianceConnection.Status.ERROR);

        ComplianceConnectionStatusDto dto = ComplianceConnectionStatusDto.fromEntity(entity);

        assertFalse(dto.connected());
        assertEquals("ERROR", dto.status());
    }

    @Test
    void fromEntity_revokedStatus_returnsConnectedFalse() {
        ComplianceConnection entity = buildEntity(ComplianceConnection.Status.REVOKED);

        ComplianceConnectionStatusDto dto = ComplianceConnectionStatusDto.fromEntity(entity);

        assertFalse(dto.connected());
        assertEquals("REVOKED", dto.status());
    }

    @Test
    void equalsAndHashCode_recordSemantics() {
        Instant t = Instant.parse("2026-01-15T10:00:00Z");
        ComplianceConnectionStatusDto a = new ComplianceConnectionStatusDto(true, ComplianceProviderType.CHEKIN, "u", "id", "ACTIVE", t, t);
        ComplianceConnectionStatusDto b = new ComplianceConnectionStatusDto(true, ComplianceProviderType.CHEKIN, "u", "id", "ACTIVE", t, t);
        ComplianceConnectionStatusDto c = new ComplianceConnectionStatusDto(true, ComplianceProviderType.ABSHER_KSA, "u", "id", "ACTIVE", t, t);

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(a, c);
    }

    @Test
    void toString_includesFields() {
        ComplianceConnectionStatusDto dto = ComplianceConnectionStatusDto.notConnected(ComplianceProviderType.ABSHER_KSA);
        String s = dto.toString();
        assertNotNull(s);
        assertTrue(s.contains("ABSHER_KSA") || s.contains("connected"));
    }

    private ComplianceConnection buildEntity(ComplianceConnection.Status status) {
        ComplianceConnection c = new ComplianceConnection();
        c.setProviderType(ComplianceProviderType.CHEKIN);
        c.setServerUrl("https://api.chekin.com");
        c.setAccountIdentifier("acct_42");
        c.setStatus(status);
        c.setLastTestedAt(Instant.parse("2026-01-20T12:00:00Z"));
        ReflectionTestUtils.setField(c, "createdAt", Instant.parse("2026-01-01T00:00:00Z"));
        return c;
    }
}
