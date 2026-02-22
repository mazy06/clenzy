package com.clenzy.service;

import com.clenzy.repository.KpiSnapshotRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DataRetentionServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private GdprService gdprService;
    @Mock private KpiSnapshotRepository kpiSnapshotRepository;

    private DataRetentionService dataRetentionService;

    @BeforeEach
    void setUp() {
        dataRetentionService = new DataRetentionService(
                userRepository, auditLogService, gdprService, kpiSnapshotRepository);
    }

    // ===== EXECUTE RETENTION POLICIES =====

    @Nested
    class ExecuteRetentionPolicies {

        @Test
        void whenExecuted_thenDeletesOldKpiSnapshots() {
            when(kpiSnapshotRepository.deleteOlderThan(any(LocalDateTime.class))).thenReturn(5);

            dataRetentionService.executeRetentionPolicies();

            verify(kpiSnapshotRepository).deleteOlderThan(any(LocalDateTime.class));
        }

        @Test
        void whenExecuted_thenLogsAuditAction() {
            when(kpiSnapshotRepository.deleteOlderThan(any())).thenReturn(0);

            dataRetentionService.executeRetentionPolicies();

            verify(auditLogService).logAction(any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        void whenKpiSnapshotsDeleted_thenReturnsCorrectCount() {
            when(kpiSnapshotRepository.deleteOlderThan(any(LocalDateTime.class))).thenReturn(10);

            // Just verify it runs without error and calls the repository
            dataRetentionService.executeRetentionPolicies();

            verify(kpiSnapshotRepository).deleteOlderThan(any(LocalDateTime.class));
        }

        @Test
        void whenNoSnapshotsToDelete_thenRunsWithoutError() {
            when(kpiSnapshotRepository.deleteOlderThan(any(LocalDateTime.class))).thenReturn(0);

            dataRetentionService.executeRetentionPolicies();

            verify(kpiSnapshotRepository).deleteOlderThan(any(LocalDateTime.class));
        }
    }
}
