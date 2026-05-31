package com.clenzy.integration.channelmanager.dto;

import com.clenzy.integration.channelmanager.model.ChannelManagerConnection;
import com.clenzy.integration.channelmanager.model.ChannelManagerProviderType;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class ChannelManagerConnectionStatusDtoTest {

    @Test
    void canonicalConstructor_setsAllAccessors() {
        Instant tested = Instant.parse("2026-01-15T10:00:00Z");
        Instant created = Instant.parse("2026-01-10T08:00:00Z");

        ChannelManagerConnectionStatusDto dto = new ChannelManagerConnectionStatusDto(
                true,
                ChannelManagerProviderType.SITEMINDER,
                "https://api.siteminder.com",
                "acct_sm",
                "ACTIVE",
                tested,
                created
        );

        assertTrue(dto.connected());
        assertEquals(ChannelManagerProviderType.SITEMINDER, dto.providerType());
        assertEquals("https://api.siteminder.com", dto.serverUrl());
        assertEquals("acct_sm", dto.accountIdentifier());
        assertEquals("ACTIVE", dto.status());
        assertEquals(tested, dto.lastTestedAt());
        assertEquals(created, dto.connectedAt());
    }

    @Test
    void notConnected_returnsDtoWithFalseAndNulls() {
        ChannelManagerConnectionStatusDto dto = ChannelManagerConnectionStatusDto.notConnected(ChannelManagerProviderType.HOSTAWAY);

        assertFalse(dto.connected());
        assertEquals(ChannelManagerProviderType.HOSTAWAY, dto.providerType());
        assertNull(dto.serverUrl());
        assertNull(dto.accountIdentifier());
        assertNull(dto.status());
        assertNull(dto.lastTestedAt());
        assertNull(dto.connectedAt());
    }

    @Test
    void notConnected_forEachProvider() {
        for (ChannelManagerProviderType type : ChannelManagerProviderType.values()) {
            ChannelManagerConnectionStatusDto dto = ChannelManagerConnectionStatusDto.notConnected(type);
            assertFalse(dto.connected());
            assertEquals(type, dto.providerType());
        }
    }

    @Test
    void fromEntity_activeStatus_returnsConnectedTrue() {
        ChannelManagerConnection entity = buildEntity(ChannelManagerConnection.Status.ACTIVE);

        ChannelManagerConnectionStatusDto dto = ChannelManagerConnectionStatusDto.fromEntity(entity);

        assertTrue(dto.connected());
        assertEquals(ChannelManagerProviderType.CHANNEX, dto.providerType());
        assertEquals("https://api.channex.io", dto.serverUrl());
        assertEquals("acct_cx", dto.accountIdentifier());
        assertEquals("ACTIVE", dto.status());
    }

    @Test
    void fromEntity_nonActiveStatus_returnsConnectedFalse() {
        for (ChannelManagerConnection.Status status : ChannelManagerConnection.Status.values()) {
            if (status == ChannelManagerConnection.Status.ACTIVE) continue;
            ChannelManagerConnection entity = buildEntity(status);

            ChannelManagerConnectionStatusDto dto = ChannelManagerConnectionStatusDto.fromEntity(entity);

            assertFalse(dto.connected());
            assertEquals(status.name(), dto.status());
        }
    }

    @Test
    void equalsAndHashCode_recordSemantics() {
        Instant t = Instant.parse("2026-01-15T10:00:00Z");
        ChannelManagerConnectionStatusDto a = new ChannelManagerConnectionStatusDto(true, ChannelManagerProviderType.CHANNEX, "u", "id", "ACTIVE", t, t);
        ChannelManagerConnectionStatusDto b = new ChannelManagerConnectionStatusDto(true, ChannelManagerProviderType.CHANNEX, "u", "id", "ACTIVE", t, t);
        ChannelManagerConnectionStatusDto c = new ChannelManagerConnectionStatusDto(true, ChannelManagerProviderType.SITEMINDER, "u", "id", "ACTIVE", t, t);

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(a, c);
    }

    @Test
    void toString_includesFields() {
        ChannelManagerConnectionStatusDto dto = ChannelManagerConnectionStatusDto.notConnected(ChannelManagerProviderType.RENTALS_UNITED);
        String s = dto.toString();
        assertNotNull(s);
        assertTrue(s.contains("RENTALS_UNITED") || s.contains("connected"));
    }

    private ChannelManagerConnection buildEntity(ChannelManagerConnection.Status status) {
        ChannelManagerConnection c = new ChannelManagerConnection();
        c.setProviderType(ChannelManagerProviderType.CHANNEX);
        c.setServerUrl("https://api.channex.io");
        c.setAccountIdentifier("acct_cx");
        c.setStatus(status);
        c.setLastTestedAt(Instant.parse("2026-01-20T12:00:00Z"));
        ReflectionTestUtils.setField(c, "createdAt", Instant.parse("2026-01-01T00:00:00Z"));
        return c;
    }
}
