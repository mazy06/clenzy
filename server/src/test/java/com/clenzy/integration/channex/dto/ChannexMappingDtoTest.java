package com.clenzy.integration.channex.dto;

import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ChannexMappingDtoTest {

    @Test
    void canonicalConstructor_setsAllAccessors() {
        UUID id = UUID.randomUUID();
        Instant lastSync = Instant.parse("2026-01-15T10:00:00Z");
        Instant created = Instant.parse("2026-01-10T00:00:00Z");
        Instant updated = Instant.parse("2026-01-15T10:00:00Z");

        ChannexMappingDto dto = new ChannexMappingDto(
                id,
                100L,
                200L,
                "cx-prop-1",
                "cx-room-1",
                "cx-rate-1",
                ChannexSyncStatus.ACTIVE,
                lastSync,
                null,
                created,
                updated
        );

        assertEquals(id, dto.id());
        assertEquals(100L, dto.organizationId());
        assertEquals(200L, dto.clenzyPropertyId());
        assertEquals("cx-prop-1", dto.channexPropertyId());
        assertEquals("cx-room-1", dto.channexRoomTypeId());
        assertEquals("cx-rate-1", dto.channexDefaultRatePlanId());
        assertEquals(ChannexSyncStatus.ACTIVE, dto.syncStatus());
        assertEquals(lastSync, dto.lastSyncAt());
        assertNull(dto.lastSyncError());
        assertEquals(created, dto.createdAt());
        assertEquals(updated, dto.updatedAt());
    }

    @Test
    void from_copiesAllFieldsFromEntity() {
        ChannexPropertyMapping entity = buildEntity(ChannexSyncStatus.ACTIVE, null);

        ChannexMappingDto dto = ChannexMappingDto.from(entity);

        assertEquals(entity.getId(), dto.id());
        assertEquals(50L, dto.organizationId());
        assertEquals(99L, dto.clenzyPropertyId());
        assertEquals("cx-prop-99", dto.channexPropertyId());
        assertEquals("cx-room-99", dto.channexRoomTypeId());
        assertEquals("cx-rate-99", dto.channexDefaultRatePlanId());
        assertEquals(ChannexSyncStatus.ACTIVE, dto.syncStatus());
        assertNotNull(dto.lastSyncAt());
        assertNull(dto.lastSyncError());
        assertNotNull(dto.createdAt());
        assertNotNull(dto.updatedAt());
    }

    @Test
    void from_propagatesErrorState() {
        ChannexPropertyMapping entity = buildEntity(ChannexSyncStatus.ERROR, "boom");

        ChannexMappingDto dto = ChannexMappingDto.from(entity);

        assertEquals(ChannexSyncStatus.ERROR, dto.syncStatus());
        assertEquals("boom", dto.lastSyncError());
    }

    @Test
    void from_pendingStatus() {
        ChannexPropertyMapping entity = buildEntity(ChannexSyncStatus.PENDING, null);

        ChannexMappingDto dto = ChannexMappingDto.from(entity);

        assertEquals(ChannexSyncStatus.PENDING, dto.syncStatus());
    }

    @Test
    void from_disabledStatus() {
        ChannexPropertyMapping entity = buildEntity(ChannexSyncStatus.DISABLED, null);

        ChannexMappingDto dto = ChannexMappingDto.from(entity);

        assertEquals(ChannexSyncStatus.DISABLED, dto.syncStatus());
    }

    @Test
    void equalsAndHashCode_recordSemantics() {
        UUID id = UUID.randomUUID();
        Instant t = Instant.parse("2026-01-15T10:00:00Z");
        ChannexMappingDto a = new ChannexMappingDto(id, 1L, 2L, "p", "r", "rp", ChannexSyncStatus.ACTIVE, t, null, t, t);
        ChannexMappingDto b = new ChannexMappingDto(id, 1L, 2L, "p", "r", "rp", ChannexSyncStatus.ACTIVE, t, null, t, t);
        ChannexMappingDto c = new ChannexMappingDto(UUID.randomUUID(), 1L, 2L, "p", "r", "rp", ChannexSyncStatus.ACTIVE, t, null, t, t);

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(a, c);
    }

    private ChannexPropertyMapping buildEntity(ChannexSyncStatus status, String error) {
        ChannexPropertyMapping m = new ChannexPropertyMapping();
        m.setId(UUID.randomUUID());
        m.setOrganizationId(50L);
        m.setClenzyPropertyId(99L);
        m.setChannexPropertyId("cx-prop-99");
        m.setChannexRoomTypeId("cx-room-99");
        m.setChannexDefaultRatePlanId("cx-rate-99");
        m.setSyncStatus(status);
        m.setLastSyncAt(Instant.parse("2026-01-15T10:00:00Z"));
        m.setLastSyncError(error);
        // createdAt/updatedAt n'ont pas de setters — via reflection
        ReflectionTestUtils.setField(m, "createdAt", Instant.parse("2026-01-01T00:00:00Z"));
        ReflectionTestUtils.setField(m, "updatedAt", Instant.parse("2026-01-15T10:00:00Z"));
        return m;
    }
}
