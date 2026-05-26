package com.clenzy.service.agent.simulation;

import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Estime l'elasticite prix-demande d'une propriete a partir de l'historique 12
 * mois de reservations.
 *
 * <h3>Methode</h3>
 * Regression brute sur des paires mois-a-mois :
 * <ol>
 *   <li>Bucketise les reservations confirmees par mois calendaire.</li>
 *   <li>Pour chaque mois : ADR = revenue / nuits ; occupancy = nuits / jours du mois.</li>
 *   <li>Construit les paires (delta_adr_pct, delta_occ_pct) entre mois consecutifs.</li>
 *   <li>Filtre les paires non-significatives (|delta_adr_pct| < {@value #MIN_PRICE_DELTA_PCT}).</li>
 *   <li>Si N >= {@value #MIN_SAMPLE_SIZE} paires significatives : elasticite =
 *       moyenne(-delta_occ / delta_adr). Clamp dans [{@value #MIN_ELASTICITY},
 *       {@value #MAX_ELASTICITY}].</li>
 *   <li>Sinon : {@link Optional#empty()} → le caller utilise le default 0.5.</li>
 * </ol>
 *
 * <h3>Limites assumees</h3>
 * <ul>
 *   <li>Pas de controle de la saisonnalite (un pic d'occupation en juillet n'est
 *       pas du a une variation de prix). Pour ameliorer : comparer mois N a
 *       mois N annee precedente.</li>
 *   <li>Pas de moindres carres : moyenne arithmetique des ratios. C'est volontaire
 *       — sur 12 mois max on a 11 paires, les LSQ n'apportent rien.</li>
 *   <li>Pas de detection d'outliers : un mois exceptionnel peut biaiser. Le clamp
 *       final agit comme garde-fou grossier.</li>
 * </ul>
 */
@Service
public class EmpiricalElasticityEstimator {

    private static final Logger log = LoggerFactory.getLogger(EmpiricalElasticityEstimator.class);

    private static final int HISTORY_MONTHS = 12;
    private static final int MIN_SAMPLE_SIZE = 3;
    /** Sous ce seuil de variation de prix, la paire n'est pas exploitable (bruit). */
    private static final double MIN_PRICE_DELTA_PCT = 0.02;
    /** Bornes industrie pour une elasticite de location courte duree. */
    private static final double MIN_ELASTICITY = 0.1;
    private static final double MAX_ELASTICITY = 1.5;

    private final ReservationRepository reservationRepository;

    public EmpiricalElasticityEstimator(ReservationRepository reservationRepository) {
        this.reservationRepository = reservationRepository;
    }

    /**
     * Calcule l'elasticite empirique pour une propriete.
     *
     * @param organizationId org de la propriete (filtre tenant)
     * @param propertyId     propriete cible
     * @return l'estimation enrichie du sample size, ou empty si pas assez de donnees
     */
    @Transactional(readOnly = true)
    public Optional<ElasticityEstimate> estimate(Long organizationId, Long propertyId) {
        if (organizationId == null || propertyId == null) return Optional.empty();

        LocalDate today = LocalDate.now();
        LocalDate windowFrom = today.minusMonths(HISTORY_MONTHS).withDayOfMonth(1);

        List<Reservation> reservations;
        try {
            reservations = reservationRepository.findByPropertyIdsAndDateRange(
                    List.of(propertyId), windowFrom, today, organizationId);
        } catch (Exception e) {
            log.warn("EmpiricalElasticityEstimator: reservations lookup failed for property {} : {}",
                    propertyId, e.getMessage());
            return Optional.empty();
        }
        if (reservations.isEmpty()) return Optional.empty();

        Map<YearMonth, MonthlyAggregate> byMonth = bucketByMonth(reservations, windowFrom, today);
        if (byMonth.size() < 2) return Optional.empty();

        List<Pair> pairs = buildConsecutivePairs(byMonth);
        if (pairs.size() < MIN_SAMPLE_SIZE) {
            log.debug("EmpiricalElasticityEstimator: propertyId={} only {} significant pairs, need {}",
                    propertyId, pairs.size(), MIN_SAMPLE_SIZE);
            return Optional.empty();
        }

        double sumElasticity = 0.0;
        int usedPairs = 0;
        for (Pair p : pairs) {
            // Defense en profondeur : le filtre buildConsecutivePairs garantit
            // |deltaAdrPct| >= MIN_PRICE_DELTA_PCT, mais on garde un garde-fou
            // explicite pour eviter Infinity/NaN si la precision flottante fait
            // glisser une paire pile sur 0.
            if (p.deltaAdrPct == 0.0) continue;
            // elasticite = -dOcc/dPrice (positif par convention industrie)
            sumElasticity += (-p.deltaOccPct / p.deltaAdrPct);
            usedPairs++;
        }
        if (usedPairs < MIN_SAMPLE_SIZE) {
            log.debug("EmpiricalElasticityEstimator: propertyId={} only {} non-zero pairs after final guard",
                    propertyId, usedPairs);
            return Optional.empty();
        }
        double avg = sumElasticity / usedPairs;
        double clamped = Math.max(MIN_ELASTICITY, Math.min(MAX_ELASTICITY, avg));

        log.debug("EmpiricalElasticityEstimator: propertyId={} elasticity={} from {} pairs",
                propertyId, clamped, usedPairs);
        return Optional.of(new ElasticityEstimate(clamped, usedPairs));
    }

    /**
     * Aggrege les reservations par mois calendaire. Un sejour qui chevauche
     * plusieurs mois est pro-rate au prorata des nuits dans chaque mois.
     */
    private Map<YearMonth, MonthlyAggregate> bucketByMonth(List<Reservation> reservations,
                                                              LocalDate from, LocalDate to) {
        Map<YearMonth, MonthlyAggregate> map = new LinkedHashMap<>();
        // Pre-initialise les mois pour avoir occupancy=0 quand aucune resa
        YearMonth cursor = YearMonth.from(from);
        YearMonth end = YearMonth.from(to);
        while (!cursor.isAfter(end)) {
            map.put(cursor, new MonthlyAggregate(cursor));
            cursor = cursor.plusMonths(1);
        }

        for (Reservation r : reservations) {
            if (r.getCheckIn() == null || r.getCheckOut() == null) continue;
            if ("cancelled".equalsIgnoreCase(r.getStatus())) continue;
            long totalNights = ChronoUnit.DAYS.between(r.getCheckIn(), r.getCheckOut());
            if (totalNights <= 0) continue;

            BigDecimal pricePerNight = (r.getTotalPrice() != null && r.getTotalPrice().signum() > 0)
                    ? r.getTotalPrice().divide(BigDecimal.valueOf(totalNights), 4, RoundingMode.HALF_UP)
                    : null;

            LocalDate cursorDate = r.getCheckIn();
            while (cursorDate.isBefore(r.getCheckOut())) {
                YearMonth ym = YearMonth.from(cursorDate);
                MonthlyAggregate bucket = map.get(ym);
                if (bucket != null) {
                    bucket.bookedNights++;
                    if (pricePerNight != null) {
                        bucket.revenue = bucket.revenue.add(pricePerNight);
                    }
                }
                cursorDate = cursorDate.plusDays(1);
            }
        }
        return map;
    }

    /**
     * Construit les paires (delta_adr_pct, delta_occ_pct) entre mois consecutifs.
     * Filtre les paires non-exploitables : prix non significativement different,
     * mois sans aucune nuit, ADR nul.
     */
    private List<Pair> buildConsecutivePairs(Map<YearMonth, MonthlyAggregate> byMonth) {
        List<MonthlyAggregate> ordered = new java.util.ArrayList<>(byMonth.values());
        List<Pair> pairs = new java.util.ArrayList<>(ordered.size());
        for (int i = 1; i < ordered.size(); i++) {
            MonthlyAggregate prev = ordered.get(i - 1);
            MonthlyAggregate curr = ordered.get(i);
            if (prev.bookedNights == 0 || curr.bookedNights == 0) continue;

            double prevAdr = prev.adr();
            double currAdr = curr.adr();
            if (prevAdr <= 0.0) continue;
            double deltaAdrPct = (currAdr - prevAdr) / prevAdr;
            if (Math.abs(deltaAdrPct) < MIN_PRICE_DELTA_PCT) continue;

            double prevOcc = prev.occupancy();
            double currOcc = curr.occupancy();
            if (prevOcc <= 0.0) continue;
            double deltaOccPct = (currOcc - prevOcc) / prevOcc;

            pairs.add(new Pair(deltaAdrPct, deltaOccPct));
        }
        return pairs;
    }

    /** Resultat exploitable par SimulationService et le scheduler. */
    public record ElasticityEstimate(double elasticity, int sampleSize) {}

    private record Pair(double deltaAdrPct, double deltaOccPct) {}

    /** Agregat mensuel — package-private pour faciliter les tests. */
    static final class MonthlyAggregate {
        final YearMonth month;
        long bookedNights;
        BigDecimal revenue = BigDecimal.ZERO;

        MonthlyAggregate(YearMonth month) { this.month = month; }

        double adr() {
            if (bookedNights <= 0) return 0.0;
            return revenue.divide(BigDecimal.valueOf(bookedNights), 2, RoundingMode.HALF_UP).doubleValue();
        }

        double occupancy() {
            int daysInMonth = month.lengthOfMonth();
            return Math.max(0.0, Math.min(1.0, (double) bookedNights / daysInMonth));
        }
    }
}
