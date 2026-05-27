package com.clenzy.scheduler;

import com.clenzy.model.PropertyElasticityEstimate;
import com.clenzy.repository.PropertyElasticityEstimateRepository;
import com.clenzy.repository.PropertyElasticityEstimateRepository.PropertyTenantRow;
import com.clenzy.service.agent.simulation.EmpiricalElasticityEstimator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ElasticityRecomputeSchedulerTest {

    private PropertyElasticityEstimateRepository repository;
    private EmpiricalElasticityEstimator estimator;

    @BeforeEach
    void setUp() {
        repository = mock(PropertyElasticityEstimateRepository.class);
        estimator = mock(EmpiricalElasticityEstimator.class);
    }

    @Test
    void runOnce_disabled_returnsZero() {
        ElasticityRecomputeScheduler scheduler = new ElasticityRecomputeScheduler(
                repository, estimator, false);

        assertEquals(0, scheduler.runOnce());
        verifyNoInteractions(repository);
        verifyNoInteractions(estimator);
    }

    @Test
    void runOnce_listFails_returnsZero_doesNotThrow() {
        when(repository.listActivePropertyIds()).thenThrow(new RuntimeException("DB down"));
        ElasticityRecomputeScheduler scheduler = new ElasticityRecomputeScheduler(
                repository, estimator, true);

        assertEquals(0, scheduler.runOnce());
        verifyNoInteractions(estimator);
    }

    @Test
    void runOnce_upsertsEstimate_whenEstimatorReturnsValue() {
        when(repository.listActivePropertyIds())
                .thenReturn(List.of(new PropertyTenantRow(11L, 1L)));
        when(estimator.estimate(1L, 11L))
                .thenReturn(Optional.of(new EmpiricalElasticityEstimator.ElasticityEstimate(0.65, 5)));
        when(repository.findByPropertyId(11L)).thenReturn(Optional.empty());
        when(repository.save(any(PropertyElasticityEstimate.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ElasticityRecomputeScheduler scheduler = new ElasticityRecomputeScheduler(
                repository, estimator, true);

        assertEquals(1, scheduler.runOnce());
        ArgumentCaptor<PropertyElasticityEstimate> cap =
                ArgumentCaptor.forClass(PropertyElasticityEstimate.class);
        verify(repository).save(cap.capture());
        assertEquals(11L, cap.getValue().getPropertyId());
        assertEquals(0.65, cap.getValue().getElasticityValue(), 0.0001);
        assertEquals(5, cap.getValue().getSampleSize());
    }

    @Test
    void runOnce_skipsWhenEstimatorReturnsEmpty() {
        when(repository.listActivePropertyIds())
                .thenReturn(List.of(new PropertyTenantRow(11L, 1L)));
        when(estimator.estimate(1L, 11L)).thenReturn(Optional.empty());

        ElasticityRecomputeScheduler scheduler = new ElasticityRecomputeScheduler(
                repository, estimator, true);

        assertEquals(0, scheduler.runOnce());
        verify(repository, never()).save(any());
    }

    @Test
    void runOnce_updatesExistingEstimate_keepsId() {
        when(repository.listActivePropertyIds())
                .thenReturn(List.of(new PropertyTenantRow(11L, 1L)));
        when(estimator.estimate(1L, 11L))
                .thenReturn(Optional.of(new EmpiricalElasticityEstimator.ElasticityEstimate(0.9, 7)));
        PropertyElasticityEstimate existing = new PropertyElasticityEstimate(11L, 0.4, 3);
        existing.setId(99L);
        when(repository.findByPropertyId(11L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ElasticityRecomputeScheduler scheduler = new ElasticityRecomputeScheduler(
                repository, estimator, true);

        scheduler.runOnce();
        ArgumentCaptor<PropertyElasticityEstimate> cap =
                ArgumentCaptor.forClass(PropertyElasticityEstimate.class);
        verify(repository).save(cap.capture());
        // L'entite existante doit etre re-utilisee (id conserve)
        assertEquals(99L, cap.getValue().getId());
        assertEquals(0.9, cap.getValue().getElasticityValue(), 0.0001);
        assertEquals(7, cap.getValue().getSampleSize());
    }

    @Test
    void runOnce_estimatorThrowsOnOneProperty_continuesWithOthers() {
        when(repository.listActivePropertyIds()).thenReturn(List.of(
                new PropertyTenantRow(11L, 1L),
                new PropertyTenantRow(22L, 2L)
        ));
        when(estimator.estimate(1L, 11L))
                .thenThrow(new RuntimeException("kaboom"));
        when(estimator.estimate(2L, 22L))
                .thenReturn(Optional.of(new EmpiricalElasticityEstimator.ElasticityEstimate(0.5, 4)));
        when(repository.findByPropertyId(22L)).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ElasticityRecomputeScheduler scheduler = new ElasticityRecomputeScheduler(
                repository, estimator, true);

        // 1 upsertee, 1 skipped — la boucle n'a pas casse
        assertEquals(1, scheduler.runOnce());
    }

    @Test
    void runWeekly_delegatesToRunOnce() {
        ElasticityRecomputeScheduler scheduler = new ElasticityRecomputeScheduler(
                repository, estimator, false);
        scheduler.runWeekly();
        // Disabled → verifie qu'on ne touche pas le repository
        verifyNoInteractions(repository);
    }
}
