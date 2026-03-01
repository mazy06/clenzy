package com.clenzy.service;

import com.clenzy.dto.MigrationJobDto;
import com.clenzy.model.MigrationJob;
import com.clenzy.model.MigrationJob.MigrationDataType;
import com.clenzy.model.MigrationJob.MigrationSource;
import com.clenzy.model.MigrationJob.MigrationStatus;
import com.clenzy.repository.MigrationJobRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PmsMigrationServiceTest {

    @Mock private MigrationJobRepository jobRepository;
    @InjectMocks private PmsMigrationService service;

    private static final Long ORG_ID = 1L;

    private MigrationJob createJob(MigrationStatus status) {
        MigrationJob j = new MigrationJob();
        j.setId(1L);
        j.setOrganizationId(ORG_ID);
        j.setSource(MigrationSource.GUESTY);
        j.setStatus(status);
        j.setDataType(MigrationDataType.ALL);
        j.setTotalRecords(100);
        j.setProcessedRecords(0);
        j.setFailedRecords(0);
        return j;
    }

    @Test
    void createJob_success() {
        when(jobRepository.save(any())).thenAnswer(inv -> {
            MigrationJob saved = inv.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        MigrationJobDto result = service.createJob(
            MigrationSource.LODGIFY, MigrationDataType.PROPERTIES,
            "api_key", null, ORG_ID);

        assertNotNull(result);
        assertEquals(MigrationSource.LODGIFY, result.source());
        assertEquals(MigrationStatus.PENDING, result.status());
        assertEquals(MigrationDataType.PROPERTIES, result.dataType());
    }

    @Test
    void startJob_success() {
        MigrationJob job = createJob(MigrationStatus.PENDING);
        when(jobRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(job));
        when(jobRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MigrationJobDto result = service.startJob(1L, ORG_ID);

        assertEquals(MigrationStatus.IN_PROGRESS, result.status());
        assertNotNull(result.startedAt());
        assertTrue(result.totalRecords() > 0);
    }

    @Test
    void startJob_notPending_throws() {
        MigrationJob job = createJob(MigrationStatus.IN_PROGRESS);
        when(jobRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(job));

        assertThrows(IllegalStateException.class, () -> service.startJob(1L, ORG_ID));
    }

    @Test
    void updateProgress_completesWhenDone() {
        MigrationJob job = createJob(MigrationStatus.IN_PROGRESS);
        when(jobRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(job));
        when(jobRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MigrationJobDto result = service.updateProgress(1L, ORG_ID, 100, 0);

        assertEquals(MigrationStatus.COMPLETED, result.status());
        assertNotNull(result.completedAt());
        assertEquals(100.0, result.progressPercent());
    }

    @Test
    void updateProgress_partiallyCompletedWithFailures() {
        MigrationJob job = createJob(MigrationStatus.IN_PROGRESS);
        when(jobRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(job));
        when(jobRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MigrationJobDto result = service.updateProgress(1L, ORG_ID, 90, 10);

        assertEquals(MigrationStatus.PARTIALLY_COMPLETED, result.status());
        assertEquals(10, result.failedRecords());
    }

    @Test
    void failJob_setsError() {
        MigrationJob job = createJob(MigrationStatus.IN_PROGRESS);
        when(jobRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(job));
        when(jobRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MigrationJobDto result = service.failJob(1L, ORG_ID, "API connection failed");

        assertEquals(MigrationStatus.FAILED, result.status());
        assertNotNull(result.completedAt());
    }

    @Test
    void getAvailableSources_returnsAll() {
        List<MigrationSource> sources = service.getAvailableSources();

        assertFalse(sources.isEmpty());
        assertTrue(sources.contains(MigrationSource.GUESTY));
        assertTrue(sources.contains(MigrationSource.LODGIFY));
        assertTrue(sources.contains(MigrationSource.CSV_IMPORT));
    }
}
