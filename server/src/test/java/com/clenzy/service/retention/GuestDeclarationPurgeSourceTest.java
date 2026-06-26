package com.clenzy.service.retention;

import com.clenzy.repository.GuestDeclarationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GuestDeclarationPurgeSourceTest {

    private static final ZoneId UTC = ZoneOffset.UTC;
    private static final Instant CUTOFF = Instant.parse("2026-01-01T00:00:00Z");

    @Mock private GuestDeclarationRepository repository;

    private GuestDeclarationPurgeSource source() {
        return new GuestDeclarationPurgeSource(repository, UTC);
    }

    @Test
    void targetName_isPoliceRecords() {
        assertEquals("police-records", source().targetName());
    }

    @Test
    void countExpired_delegatesWithCutoffAsLocalDateTime() {
        when(repository.countByCreatedAtLessThanEqual(any())).thenReturn(42L);

        long count = source().countExpired(CUTOFF);

        assertEquals(42L, count);
        verify(repository).countByCreatedAtLessThanEqual(LocalDateTime.ofInstant(CUTOFF, UTC));
    }

    @Test
    void deleteExpiredBatch_boundedByLimitAndStableOrder_returnsDeletedCount() {
        when(repository.findIdsCreatedBefore(any(), any(Pageable.class)))
            .thenReturn(List.of(1L, 2L, 3L));

        int deleted = source().deleteExpiredBatch(CUTOFF, 500);

        assertEquals(3, deleted);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findIdsCreatedBefore(eq(LocalDateTime.ofInstant(CUTOFF, UTC)), pageable.capture());
        assertEquals(PageRequest.of(0, 500), pageable.getValue()); // borné par limit
        verify(repository).deleteAllByIdInBatch(List.of(1L, 2L, 3L));
    }

    @Test
    void deleteExpiredBatch_noCandidates_returnsZeroAndDeletesNothing() {
        when(repository.findIdsCreatedBefore(any(), any(Pageable.class))).thenReturn(List.of());

        int deleted = source().deleteExpiredBatch(CUTOFF, 500);

        assertEquals(0, deleted); // signal de fin pour le moteur (idempotent / repetable)
        verify(repository, never()).deleteAllByIdInBatch(any());
    }

    @Test
    void deleteExpiredBatch_nonPositiveLimit_noOp() {
        int deleted = source().deleteExpiredBatch(CUTOFF, 0);

        assertEquals(0, deleted);
        verify(repository, never()).findIdsCreatedBefore(any(), any());
        verify(repository, never()).deleteAllByIdInBatch(any());
    }
}
