package com.clenzy.service;

import com.clenzy.dto.MigrationJobDto;
import com.clenzy.model.MigrationJob;
import com.clenzy.model.MigrationJob.MigrationDataType;
import com.clenzy.model.MigrationJob.MigrationSource;
import com.clenzy.model.MigrationJob.MigrationStatus;
import com.clenzy.repository.MigrationJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class PmsMigrationService {

    private static final Logger log = LoggerFactory.getLogger(PmsMigrationService.class);

    private final MigrationJobRepository jobRepository;

    public PmsMigrationService(MigrationJobRepository jobRepository) {
        this.jobRepository = jobRepository;
    }

    public List<MigrationJobDto> getAllJobs(Long orgId) {
        return jobRepository.findAllByOrgId(orgId).stream()
            .map(MigrationJobDto::from)
            .toList();
    }

    public MigrationJobDto getJobById(Long id, Long orgId) {
        return jobRepository.findByIdAndOrgId(id, orgId)
            .map(MigrationJobDto::from)
            .orElseThrow(() -> new IllegalArgumentException("Migration job not found: " + id));
    }

    @Transactional
    public MigrationJobDto createJob(MigrationSource source, MigrationDataType dataType,
                                      String apiKey, String config, Long orgId) {
        MigrationJob job = new MigrationJob();
        job.setOrganizationId(orgId);
        job.setSource(source);
        job.setDataType(dataType);
        job.setSourceApiKey(apiKey);
        job.setSourceConfig(config);
        job.setStatus(MigrationStatus.PENDING);

        MigrationJob saved = jobRepository.save(job);
        log.info("Created migration job {} from {} for org {}", saved.getId(), source, orgId);
        return MigrationJobDto.from(saved);
    }

    @Transactional
    public MigrationJobDto startJob(Long id, Long orgId) {
        MigrationJob job = getEntity(id, orgId);

        if (job.getStatus() != MigrationStatus.PENDING) {
            throw new IllegalStateException("Can only start PENDING jobs, current: " + job.getStatus());
        }

        job.setStatus(MigrationStatus.IN_PROGRESS);
        job.setStartedAt(Instant.now());

        // Simuler la decouverte de records a importer
        int estimatedRecords = estimateRecords(job.getSource(), job.getDataType());
        job.setTotalRecords(estimatedRecords);

        MigrationJob saved = jobRepository.save(job);
        log.info("Started migration job {} from {}: {} estimated records",
            id, job.getSource(), estimatedRecords);
        return MigrationJobDto.from(saved);
    }

    @Transactional
    public MigrationJobDto updateProgress(Long id, Long orgId, int processed, int failed) {
        MigrationJob job = getEntity(id, orgId);
        job.setProcessedRecords(processed);
        job.setFailedRecords(failed);

        if (processed + failed >= job.getTotalRecords()) {
            job.setStatus(failed > 0 ? MigrationStatus.PARTIALLY_COMPLETED : MigrationStatus.COMPLETED);
            job.setCompletedAt(Instant.now());
        }

        MigrationJob saved = jobRepository.save(job);
        return MigrationJobDto.from(saved);
    }

    @Transactional
    public MigrationJobDto failJob(Long id, Long orgId, String errorMessage) {
        MigrationJob job = getEntity(id, orgId);
        job.setStatus(MigrationStatus.FAILED);
        job.setErrorLog(errorMessage);
        job.setCompletedAt(Instant.now());

        MigrationJob saved = jobRepository.save(job);
        log.error("Migration job {} failed: {}", id, errorMessage);
        return MigrationJobDto.from(saved);
    }

    public List<MigrationSource> getAvailableSources() {
        return List.of(MigrationSource.values());
    }

    private int estimateRecords(MigrationSource source, MigrationDataType dataType) {
        // Placeholder - en production, interrogerait l'API source pour compter
        return switch (dataType) {
            case PROPERTIES -> 10;
            case RESERVATIONS -> 100;
            case GUESTS -> 50;
            case RATES -> 200;
            case AVAILABILITY -> 365;
            case ALL -> 500;
        };
    }

    private MigrationJob getEntity(Long id, Long orgId) {
        return jobRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Migration job not found: " + id));
    }
}
