package com.clenzy.service.pricing;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionPhoto;
import com.clenzy.repository.InterventionPhotoRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.pricing.HousekeeperScoreService.HousekeeperScore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.LongStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Score qualité housekeeper (Moteur Ménage 3D) :
 * score = round(proofRate × min(1, completedCount/5) × 100), fenêtre 30 jours.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HousekeeperScoreServiceTest {

    private static final Long USER_ID = 42L;
    private static final Long ORG_ID = 7L;

    @Mock private InterventionRepository interventionRepository;
    @Mock private InterventionPhotoRepository interventionPhotoRepository;

    private HousekeeperScoreService service;

    @BeforeEach
    void setUp() {
        service = new HousekeeperScoreService(interventionRepository, interventionPhotoRepository);
    }

    private List<Intervention> interventions(long... ids) {
        return LongStream.of(ids).mapToObj(id -> {
            Intervention i = new Intervention();
            i.setId(id);
            return i;
        }).toList();
    }

    /**
     * Stub de la requete batch (1 requete IN pour tout le lot — audit perf
     * 2026-07-21) : IDs interroges → IDs ayant au moins une photo AFTER.
     */
    private void proofsFor(List<Long> queriedIds, List<Long> idsWithProof) {
        when(interventionPhotoRepository.findInterventionIdsWithPhase(
                eq(queriedIds), eq(InterventionPhoto.PhotoPhase.AFTER), eq(ORG_ID)))
                .thenReturn(idsWithProof);
    }

    @Test
    void whenNoCompletedMissions_thenScoreIsZero() {
        when(interventionRepository.findCompletedCleaningsSince(anyLong(), anyLong(), anyCollection(), any()))
                .thenReturn(List.of());

        assertThat(service.computeScore(USER_ID, ORG_ID)).isEqualTo(HousekeeperScore.empty());
    }

    @Test
    void whenNullIds_thenEmptyScoreWithoutQuery() {
        assertThat(service.computeScore(null, ORG_ID)).isEqualTo(HousekeeperScore.empty());
        assertThat(service.computeScore(USER_ID, null)).isEqualTo(HousekeeperScore.empty());
    }

    @Test
    void whenOnePerfectMission_thenVolumeFactorCapsScore() {
        // 1 mission avec preuve : proofRate=1 mais volumeFactor=1/5 → score 20, pas 100.
        when(interventionRepository.findCompletedCleaningsSince(anyLong(), anyLong(), anyCollection(), any()))
                .thenReturn(interventions(1L));
        proofsFor(List.of(1L), List.of(1L));

        HousekeeperScore score = service.computeScore(USER_ID, ORG_ID);

        assertThat(score.score()).isEqualTo(20);
        assertThat(score.completedCount()).isEqualTo(1);
        assertThat(score.proofRate()).isEqualTo(1.0);
    }

    @Test
    void whenFivePerfectMissions_thenFullScore() {
        when(interventionRepository.findCompletedCleaningsSince(anyLong(), anyLong(), anyCollection(), any()))
                .thenReturn(interventions(1L, 2L, 3L, 4L, 5L));
        proofsFor(List.of(1L, 2L, 3L, 4L, 5L), List.of(1L, 2L, 3L, 4L, 5L));

        assertThat(service.computeScore(USER_ID, ORG_ID).score()).isEqualTo(100);
    }

    @Test
    void whenPartialProof_thenProofRateWeighted() {
        // 5 missions, 3 avec preuve : proofRate=0.6, volumeFactor=1 → 60.
        when(interventionRepository.findCompletedCleaningsSince(anyLong(), anyLong(), anyCollection(), any()))
                .thenReturn(interventions(1L, 2L, 3L, 4L, 5L));
        proofsFor(List.of(1L, 2L, 3L, 4L, 5L), List.of(1L, 2L, 3L));

        HousekeeperScore score = service.computeScore(USER_ID, ORG_ID);

        assertThat(score.score()).isEqualTo(60);
        assertThat(score.proofRate()).isEqualTo(0.6);
    }

    @Test
    void whenComputing_thenWindowIsThirtyDays() {
        when(interventionRepository.findCompletedCleaningsSince(anyLong(), anyLong(), anyCollection(), any()))
                .thenReturn(List.of());
        LocalDateTime before = LocalDateTime.now().minusDays(30).minusMinutes(1);

        service.computeScore(USER_ID, ORG_ID);

        verify(interventionRepository).findCompletedCleaningsSince(
                eq(USER_ID), eq(ORG_ID), anyCollection(),
                org.mockito.ArgumentMatchers.argThat(since ->
                        since.isAfter(before) && since.isBefore(LocalDateTime.now().minusDays(29))));
    }
}
