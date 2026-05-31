package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.model.ChannexSyncLog;
import com.clenzy.integration.channex.repository.ChannexSyncLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChannexSyncLogServiceTest {

    @Mock private ChannexSyncLogRepository repository;

    @InjectMocks
    private ChannexSyncLogService service;

    @Test
    void record_successCase_savesLogWithDurationAndFinishedAt() {
        UUID mappingId = UUID.randomUUID();
        Instant startedAt = Instant.now().minusSeconds(2);

        service.record(7L, 100L, mappingId,
            ChannexSyncLog.SyncType.PUSH_AVAILABILITY,
            ChannexSyncLog.Status.SUCCESS, 5, startedAt, null);

        ArgumentCaptor<ChannexSyncLog> captor = ArgumentCaptor.forClass(ChannexSyncLog.class);
        verify(repository).save(captor.capture());
        ChannexSyncLog saved = captor.getValue();
        assertEquals(7L, saved.getOrganizationId());
        assertEquals(100L, saved.getClenzyPropertyId());
        assertEquals(mappingId, saved.getMappingId());
        assertEquals(ChannexSyncLog.SyncType.PUSH_AVAILABILITY, saved.getSyncType());
        assertEquals(ChannexSyncLog.Status.SUCCESS, saved.getStatus());
        assertEquals(5, saved.getRecordCount());
        assertEquals(startedAt, saved.getStartedAt());
        assertNotNull(saved.getFinishedAt());
        assertTrue(saved.getDurationMs() >= 0);
        assertNull(saved.getErrorMessage());
    }

    @Test
    void record_nullStartedAt_usesCurrentInstant() {
        service.record(1L, 2L, null,
            ChannexSyncLog.SyncType.PULL_BOOKINGS,
            ChannexSyncLog.Status.SUCCESS, 0, null, null);

        ArgumentCaptor<ChannexSyncLog> captor = ArgumentCaptor.forClass(ChannexSyncLog.class);
        verify(repository).save(captor.capture());
        ChannexSyncLog saved = captor.getValue();
        assertNotNull(saved.getStartedAt());
        assertNotNull(saved.getFinishedAt());
    }

    @Test
    void record_errorMessageOver1000_isTruncated() {
        String longMessage = "x".repeat(1500);

        service.record(1L, 2L, null,
            ChannexSyncLog.SyncType.RESYNC_CONTENT,
            ChannexSyncLog.Status.FAIL, 0, Instant.now(), longMessage);

        ArgumentCaptor<ChannexSyncLog> captor = ArgumentCaptor.forClass(ChannexSyncLog.class);
        verify(repository).save(captor.capture());
        ChannexSyncLog saved = captor.getValue();
        assertNotNull(saved.getErrorMessage());
        assertEquals(1001, saved.getErrorMessage().length()); // 1000 chars + ellipsis
        assertTrue(saved.getErrorMessage().endsWith("…"));
    }

    @Test
    void record_errorMessageUnder1000_isStoredAsIs() {
        String message = "short error";

        service.record(1L, 2L, null,
            ChannexSyncLog.SyncType.PUSH_RATES,
            ChannexSyncLog.Status.FAIL, 0, Instant.now(), message);

        ArgumentCaptor<ChannexSyncLog> captor = ArgumentCaptor.forClass(ChannexSyncLog.class);
        verify(repository).save(captor.capture());
        ChannexSyncLog saved = captor.getValue();
        assertEquals(message, saved.getErrorMessage());
    }

    @Test
    void record_repositorySaveFails_swallowsException() {
        when(repository.save(any())).thenThrow(new RuntimeException("DB down"));

        // Must not throw
        assertDoesNotThrow(() -> service.record(1L, 2L, null,
            ChannexSyncLog.SyncType.PUSH_AVAILABILITY,
            ChannexSyncLog.Status.SUCCESS, 1, Instant.now(), null));
    }

    @Test
    void record_skippedStatus_persistedCorrectly() {
        service.record(7L, 100L, null,
            ChannexSyncLog.SyncType.PUSH_PROPERTY,
            ChannexSyncLog.Status.SKIPPED, 0, Instant.now(), null);

        ArgumentCaptor<ChannexSyncLog> captor = ArgumentCaptor.forClass(ChannexSyncLog.class);
        verify(repository).save(captor.capture());
        assertEquals(ChannexSyncLog.Status.SKIPPED, captor.getValue().getStatus());
    }
}
