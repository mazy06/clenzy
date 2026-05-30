package com.clenzy.integration.channex.dto;

import com.clenzy.integration.channex.model.ChannexSyncLog;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ChannexSyncLogDtoTest {

    @Test
    void canonicalConstructor_setsAllAccessors() {
        UUID mappingId = UUID.randomUUID();
        Instant started = Instant.parse("2026-01-15T10:00:00Z");
        Instant finished = Instant.parse("2026-01-15T10:00:05Z");

        ChannexSyncLogDto dto = new ChannexSyncLogDto(
                42L,
                100L,
                mappingId,
                ChannexSyncLog.SyncType.PUSH_AVAILABILITY,
                ChannexSyncLog.Status.SUCCESS,
                5,
                1234L,
                null,
                started,
                finished
        );

        assertEquals(42L, dto.id());
        assertEquals(100L, dto.clenzyPropertyId());
        assertEquals(mappingId, dto.mappingId());
        assertEquals(ChannexSyncLog.SyncType.PUSH_AVAILABILITY, dto.syncType());
        assertEquals(ChannexSyncLog.Status.SUCCESS, dto.status());
        assertEquals(5, dto.recordCount());
        assertEquals(1234L, dto.durationMs());
        assertNull(dto.errorMessage());
        assertEquals(started, dto.startedAt());
        assertEquals(finished, dto.finishedAt());
    }

    @Test
    void from_copiesAllFields() {
        ChannexSyncLog log = buildLog("oops");

        ChannexSyncLogDto dto = ChannexSyncLogDto.from(log);

        assertEquals(7L, dto.id());
        assertEquals(200L, dto.clenzyPropertyId());
        assertEquals(log.getMappingId(), dto.mappingId());
        assertEquals(ChannexSyncLog.SyncType.PUSH_RATES, dto.syncType());
        assertEquals(ChannexSyncLog.Status.FAIL, dto.status());
        assertEquals(3, dto.recordCount());
        assertEquals(500L, dto.durationMs());
        assertEquals("oops", dto.errorMessage());
        assertNotNull(dto.startedAt());
        assertNotNull(dto.finishedAt());
    }

    @Test
    void from_truncatesErrorMessageLongerThan500Chars() {
        String longErr = "x".repeat(501);
        ChannexSyncLog log = buildLog(longErr);

        ChannexSyncLogDto dto = ChannexSyncLogDto.from(log);

        // 500 char + ellipsis suffix
        assertEquals(501, dto.errorMessage().length());
        assertTrue(dto.errorMessage().endsWith("…"));
    }

    @Test
    void from_doesNotTruncateAtExactly500Chars() {
        String borderErr = "y".repeat(500);
        ChannexSyncLog log = buildLog(borderErr);

        ChannexSyncLogDto dto = ChannexSyncLogDto.from(log);

        assertEquals(500, dto.errorMessage().length());
        assertFalse(dto.errorMessage().endsWith("…"));
    }

    @Test
    void from_handlesNullErrorMessage() {
        ChannexSyncLog log = buildLog(null);

        ChannexSyncLogDto dto = ChannexSyncLogDto.from(log);

        assertNull(dto.errorMessage());
    }

    @Test
    void from_handlesShortErrorMessage() {
        ChannexSyncLog log = buildLog("short");

        ChannexSyncLogDto dto = ChannexSyncLogDto.from(log);

        assertEquals("short", dto.errorMessage());
    }

    @Test
    void equalsAndHashCode_recordSemantics() {
        Instant t = Instant.parse("2026-01-15T10:00:00Z");
        UUID m = UUID.randomUUID();
        ChannexSyncLogDto a = new ChannexSyncLogDto(1L, 2L, m, ChannexSyncLog.SyncType.PULL_BOOKINGS, ChannexSyncLog.Status.SUCCESS, 0, 0L, null, t, t);
        ChannexSyncLogDto b = new ChannexSyncLogDto(1L, 2L, m, ChannexSyncLog.SyncType.PULL_BOOKINGS, ChannexSyncLog.Status.SUCCESS, 0, 0L, null, t, t);
        ChannexSyncLogDto c = new ChannexSyncLogDto(2L, 2L, m, ChannexSyncLog.SyncType.PULL_BOOKINGS, ChannexSyncLog.Status.SUCCESS, 0, 0L, null, t, t);

        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(a, c);
    }

    private ChannexSyncLog buildLog(String errorMessage) {
        ChannexSyncLog log = new ChannexSyncLog();
        log.setId(7L);
        log.setClenzyPropertyId(200L);
        log.setMappingId(UUID.randomUUID());
        log.setSyncType(ChannexSyncLog.SyncType.PUSH_RATES);
        log.setStatus(ChannexSyncLog.Status.FAIL);
        log.setRecordCount(3);
        log.setDurationMs(500L);
        log.setErrorMessage(errorMessage);
        log.setStartedAt(Instant.parse("2026-01-15T10:00:00Z"));
        log.setFinishedAt(Instant.parse("2026-01-15T10:00:01Z"));
        return log;
    }
}
