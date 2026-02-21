package com.clenzy.service;

import com.clenzy.model.BookingRestriction;
import com.clenzy.repository.BookingRestrictionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Moteur de validation des restrictions de reservation.
 *
 * Valide qu'une reservation respecte toutes les contraintes :
 * - min_stay / max_stay : duree de sejour
 * - closed_to_arrival : check-in interdit certains jours
 * - closed_to_departure : check-out interdit certains jours
 * - advance_notice_days : preavis minimum avant le check-in
 * - days_of_week : restriction par jour de la semaine
 *
 * La restriction avec la priorite la plus haute s'applique.
 * Si aucune restriction n'est definie, tout est autorise.
 */
@Service
@Transactional(readOnly = true)
public class RestrictionEngine {

    private static final Logger log = LoggerFactory.getLogger(RestrictionEngine.class);

    private final BookingRestrictionRepository restrictionRepository;

    public RestrictionEngine(BookingRestrictionRepository restrictionRepository) {
        this.restrictionRepository = restrictionRepository;
    }

    /**
     * Valide les restrictions pour une reservation.
     *
     * @param propertyId propriete cible
     * @param checkIn    date de check-in (inclus)
     * @param checkOut   date de check-out (exclus)
     * @param orgId      organisation du tenant
     * @return resultat de validation avec eventuelles violations
     */
    public ValidationResult validate(Long propertyId, LocalDate checkIn, LocalDate checkOut, Long orgId) {
        List<String> violations = new ArrayList<>();
        long nights = ChronoUnit.DAYS.between(checkIn, checkOut);

        // Charger les restrictions applicables (overlap avec la plage de reservation)
        List<BookingRestriction> restrictions = restrictionRepository.findApplicable(
                propertyId, checkIn, checkOut, orgId);

        // Tri par priorite DESC (la plus prioritaire en premier)
        restrictions.sort(Comparator.comparingInt(BookingRestriction::getPriority).reversed());

        for (BookingRestriction r : restrictions) {
            // Verifier que la restriction s'applique au jour de check-in
            if (!r.appliesTo(checkIn)) continue;

            // 1. Sejour minimum
            if (r.getMinStay() != null && nights < r.getMinStay()) {
                violations.add("Sejour minimum " + r.getMinStay() + " nuit(s) requis (demande : " + nights + ")");
            }

            // 2. Sejour maximum
            if (r.getMaxStay() != null && nights > r.getMaxStay()) {
                violations.add("Sejour maximum " + r.getMaxStay() + " nuit(s) autorise (demande : " + nights + ")");
            }

            // 3. Arrivee fermee
            if (Boolean.TRUE.equals(r.getClosedToArrival())) {
                violations.add("Arrivee interdite le " + checkIn);
            }

            // 4. Depart ferme
            if (Boolean.TRUE.equals(r.getClosedToDeparture())) {
                violations.add("Depart interdit le " + checkOut);
            }

            // 5. Preavis minimum
            if (r.getAdvanceNoticeDays() != null) {
                long daysBeforeArrival = ChronoUnit.DAYS.between(LocalDate.now(), checkIn);
                if (daysBeforeArrival < r.getAdvanceNoticeDays()) {
                    violations.add("Preavis de " + r.getAdvanceNoticeDays()
                            + " jour(s) requis (disponible dans " + daysBeforeArrival + " jour(s))");
                }
            }

            // Seule la restriction la plus prioritaire s'applique
            break;
        }

        if (!violations.isEmpty()) {
            log.debug("RestrictionEngine: {} violation(s) pour propriete {} [{}, {}): {}",
                    violations.size(), propertyId, checkIn, checkOut, violations);
        }

        return violations.isEmpty()
                ? ValidationResult.valid()
                : ValidationResult.invalid(violations);
    }

    // ================================================================
    // Resultat de validation
    // ================================================================

    /**
     * Resultat de validation immutable.
     */
    public static class ValidationResult {
        private final boolean valid;
        private final List<String> violations;

        private ValidationResult(boolean valid, List<String> violations) {
            this.valid = valid;
            this.violations = violations;
        }

        public static ValidationResult valid() {
            return new ValidationResult(true, List.of());
        }

        public static ValidationResult invalid(List<String> violations) {
            return new ValidationResult(false, List.copyOf(violations));
        }

        public boolean isValid() { return valid; }
        public List<String> getViolations() { return violations; }
    }
}
