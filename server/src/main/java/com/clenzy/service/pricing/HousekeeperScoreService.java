package com.clenzy.service.pricing;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionPhoto;
import com.clenzy.model.InterventionType;
import com.clenzy.repository.InterventionPhotoRepository;
import com.clenzy.repository.InterventionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Score qualité d'un prestataire ménage (Moteur Ménage 3D) — calculé À LA VOLÉE
 * sur une fenêtre glissante de 30 jours, aucune table.
 *
 * <p><b>Formule (simple, documentée, évolutive)</b> :
 * {@code score = round(proofRate × volumeFactor × 100)} où
 * <ul>
 *   <li>{@code proofRate} = part des missions ménage COMPLÉTÉES des 30 derniers
 *       jours ayant ≥ 1 photo AFTER persistée (même critère de preuve que le
 *       payout 3B) ;</li>
 *   <li>{@code volumeFactor = min(1, completedCount / 5)} — pondération de volume :
 *       une seule mission parfaite ne donne pas 100 (5 missions = plein régime).</li>
 * </ul>
 * Zéro mission sur la fenêtre → score 0 (pas de note, pas de malus caché).</p>
 */
@Service
public class HousekeeperScoreService {

    /** Fenêtre glissante du score (jours). */
    static final int WINDOW_DAYS = 30;
    /** Volume de missions au-delà duquel le facteur de volume est plein (=1). */
    static final int FULL_VOLUME_COUNT = 5;

    private static final List<String> CLEANING_TYPES = List.of(
            InterventionType.CLEANING.name(),
            InterventionType.EXPRESS_CLEANING.name(),
            InterventionType.DEEP_CLEANING.name());

    /** Score + composantes (exposé « Mes tarifs » pro + vue admin). */
    public record HousekeeperScore(int score, int completedCount, double proofRate) {
        public static HousekeeperScore empty() {
            return new HousekeeperScore(0, 0, 0.0);
        }
    }

    private final InterventionRepository interventionRepository;
    private final InterventionPhotoRepository interventionPhotoRepository;

    public HousekeeperScoreService(InterventionRepository interventionRepository,
                                   InterventionPhotoRepository interventionPhotoRepository) {
        this.interventionRepository = interventionRepository;
        this.interventionPhotoRepository = interventionPhotoRepository;
    }

    @Transactional(readOnly = true)
    public HousekeeperScore computeScore(Long userId, Long orgId) {
        if (userId == null || orgId == null) {
            return HousekeeperScore.empty();
        }
        List<Intervention> completed = interventionRepository.findCompletedCleaningsSince(
                userId, orgId, CLEANING_TYPES, LocalDateTime.now().minusDays(WINDOW_DAYS));
        if (completed.isEmpty()) {
            return HousekeeperScore.empty();
        }

        long withProof = completed.stream()
                .filter(i -> !interventionPhotoRepository.findByInterventionIdAndPhaseOrderByCreatedAtAsc(
                        i.getId(), InterventionPhoto.PhotoPhase.AFTER, orgId).isEmpty())
                .count();

        double proofRate = (double) withProof / completed.size();
        double volumeFactor = Math.min(1.0, (double) completed.size() / FULL_VOLUME_COUNT);
        int score = (int) Math.round(proofRate * volumeFactor * 100);
        return new HousekeeperScore(score, completed.size(), proofRate);
    }
}
