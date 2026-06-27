package com.clenzy.booking.security;

import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Scoring de risque/fraude <b>léger et advisory</b> au checkout du booking engine public (P2).
 *
 * <p>Combine des signaux <b>non bloquants</b> disponibles côté serveur :</p>
 * <ul>
 *   <li><b>vélocité</b> : nombre de tentatives de checkout depuis la même IP / le même email sur une
 *       fenêtre courte (Redis {@code INCR} + {@code EXPIRE} atomique — pas de check-then-act) ;</li>
 *   <li><b>email jetable</b> : domaine présent dans la liste configurée ;</li>
 *   <li><b>montant atypique</b> : total <b>recalculé serveur</b> très supérieur à la moyenne des
 *       réservations passées de la propriété (jamais un montant venant du client) ;</li>
 *   <li><b>mismatch pays</b> (optionnel) : pays de l'IP ≠ pays déclaré, si les deux sont fournis.</li>
 * </ul>
 *
 * <p><b>Aucune décision de blocage maison</b> : le service ne fait que <i>scorer</i>. La décision
 * graduée (caution renforcée / revue / refus) est prise par l'appelant ({@code PublicBookingService})
 * et n'est appliquée qu'en mode enforcement — par défaut le service est inerte
 * ({@code clenzy.booking.fraud-scoring.enabled=false}) et le scoring n'est même pas calculé.
 * Stripe Radar (côté Stripe) reste alimenté en metadata par l'appelant et n'est pas dupliqué ici.</p>
 *
 * <p>Pattern Redis identique au {@link BookingPublicRateLimiter} : {@code fail-open} si Redis est
 * indisponible (la vélocité contribue simplement 0 point — jamais d'erreur côté guest).</p>
 */
@Service
public class BookingFraudScoringService {

    private static final Logger log = LoggerFactory.getLogger(BookingFraudScoringService.class);

    private static final String REDIS_PREFIX = "booking-fraud:";

    private final StringRedisTemplate redisTemplate;
    private final ReservationRepository reservationRepository;
    private final BookingFraudScoringProperties props;

    public BookingFraudScoringService(StringRedisTemplate redisTemplate,
                                      ReservationRepository reservationRepository,
                                      BookingFraudScoringProperties props) {
        this.redisTemplate = redisTemplate;
        this.reservationRepository = reservationRepository;
        this.props = props;
    }

    /** Vrai si le scoring est activé (sinon l'appelant ne doit même pas invoquer {@link #score}). */
    public boolean isEnabled() {
        return props.isEnabled();
    }

    /** Vrai si l'enforcement est activé (sinon advisory : score loggé/metadata, jamais de décision). */
    public boolean isEnforcement() {
        return props.isEnforcement();
    }

    /** Vrai si un checkout HIGH doit être refusé en enforcement (sinon : marqué pour revue). */
    public boolean isRefuseHighRisk() {
        return props.isRefuseHighRisk();
    }

    /**
     * Signaux d'entrée du scoring. Le montant ({@code serverTotal}) DOIT être le total recalculé serveur
     * (jamais un montant client). {@code ipCountry} / {@code declaredCountry} sont optionnels (mismatch
     * uniquement si les deux sont présents). {@code clientIp} sert au keying de la vélocité (résolu via
     * {@code ClientIpResolver} par l'appelant, jamais {@code X-Forwarded-For.split(",")[0]}).
     */
    public record FraudSignalInput(
            Long orgId,
            Long propertyId,
            String clientIp,
            String email,
            BigDecimal serverTotal,
            String ipCountry,
            String declaredCountry) {}

    /**
     * Calcule le score de risque à partir des signaux fournis. <b>À n'appeler que si {@link #isEnabled()}.</b>
     * Le comptage de vélocité a un effet de bord voulu (incrémente les compteurs Redis IP/email) : à
     * invoquer une fois par tentative de checkout.
     *
     * @return un {@link RiskAssessment} (jamais {@code null})
     */
    public RiskAssessment score(FraudSignalInput input) {
        int score = 0;
        List<String> reasons = new ArrayList<>();

        score += scoreVelocity(input, reasons);
        score += scoreDisposableEmail(input, reasons);
        score += scoreAtypicalAmount(input, reasons);
        score += scoreCountryMismatch(input, reasons);

        int bounded = Math.max(0, Math.min(100, score));
        RiskLevel level = levelFor(bounded);
        return new RiskAssessment(bounded, level, List.copyOf(reasons));
    }

    // ─── Signaux ─────────────────────────────────────────────────────────────────

    /**
     * Vélocité par IP et par email : INCR atomique du compteur dans la fenêtre, EXPIRE posé sur la
     * première incrémentation (pas de check-then-act). Au-delà du seuil, ajoute les points configurés.
     */
    private int scoreVelocity(FraudSignalInput input, List<String> reasons) {
        int points = 0;
        Duration window = Duration.ofMinutes(props.getVelocityWindowMinutes());

        if (input.clientIp() != null && !input.clientIp().isBlank()) {
            long ipCount = hitCount("ip:" + input.clientIp(), window);
            if (ipCount > props.getVelocityThreshold()) {
                points += props.getVelocityIpPoints();
                reasons.add("Vélocité IP élevée (" + ipCount + " tentatives / "
                    + props.getVelocityWindowMinutes() + " min)");
            }
        }
        if (input.email() != null && !input.email().isBlank()) {
            long emailCount = hitCount("email:" + input.email().toLowerCase(Locale.ROOT), window);
            if (emailCount > props.getVelocityThreshold()) {
                points += props.getVelocityEmailPoints();
                reasons.add("Vélocité email élevée (" + emailCount + " tentatives / "
                    + props.getVelocityWindowMinutes() + " min)");
            }
        }
        return points;
    }

    /**
     * Incrémente atomiquement le compteur de {@code suffix} sur la fenêtre. Fail-open : si Redis est
     * indisponible, retourne 0 (la vélocité ne contribue rien — jamais d'erreur côté guest).
     */
    private long hitCount(String suffix, Duration window) {
        try {
            String key = REDIS_PREFIX + suffix;
            Long current = redisTemplate.opsForValue().increment(key);
            if (current != null && current == 1L) {
                redisTemplate.expire(key, window);
            }
            return current != null ? current : 0L;
        } catch (Exception e) {
            log.warn("Fraud scoring — vélocité indisponible (Redis): {}", e.getMessage());
            return 0L;
        }
    }

    /** Email jetable : domaine présent dans la liste configurée (comparaison insensible à la casse). */
    private int scoreDisposableEmail(FraudSignalInput input, List<String> reasons) {
        String email = input.email();
        if (email == null) {
            return 0;
        }
        int at = email.lastIndexOf('@');
        if (at < 0 || at == email.length() - 1) {
            return 0;
        }
        String domain = email.substring(at + 1).trim().toLowerCase(Locale.ROOT);
        boolean disposable = props.getDisposableDomains().stream()
            .anyMatch(d -> d != null && d.trim().toLowerCase(Locale.ROOT).equals(domain));
        if (disposable) {
            reasons.add("Email jetable (" + domain + ")");
            return props.getDisposableEmailPoints();
        }
        return 0;
    }

    /**
     * Montant atypique : total <b>recalculé serveur</b> très supérieur à la moyenne des réservations
     * passées de la propriété (org-scopé). On compare {@code compareTo} (jamais {@code equals}). Aucune
     * baseline (propriété neuve) ⇒ pas de signal.
     */
    private int scoreAtypicalAmount(FraudSignalInput input, List<String> reasons) {
        BigDecimal serverTotal = input.serverTotal();
        if (serverTotal == null || serverTotal.compareTo(BigDecimal.ZERO) <= 0
                || input.propertyId() == null || input.orgId() == null) {
            return 0;
        }
        BigDecimal avg = reservationRepository.averageTotalPriceByProperty(input.propertyId(), input.orgId());
        if (avg == null || avg.compareTo(BigDecimal.ZERO) <= 0) {
            return 0;
        }
        BigDecimal threshold = avg.multiply(BigDecimal.valueOf(props.getAtypicalAmountMultiplier()));
        if (serverTotal.compareTo(threshold) > 0) {
            reasons.add("Montant atypique (total serveur " + serverTotal.toPlainString()
                + " > " + props.getAtypicalAmountMultiplier() + "× moyenne " + avg.toPlainString() + ")");
            return props.getAtypicalAmountPoints();
        }
        return 0;
    }

    /** Mismatch pays IP vs pays déclaré (uniquement si les deux sont fournis). */
    private int scoreCountryMismatch(FraudSignalInput input, List<String> reasons) {
        String ipCountry = input.ipCountry();
        String declared = input.declaredCountry();
        if (ipCountry == null || ipCountry.isBlank() || declared == null || declared.isBlank()) {
            return 0;
        }
        if (!ipCountry.trim().equalsIgnoreCase(declared.trim())) {
            reasons.add("Pays IP (" + ipCountry + ") ≠ pays déclaré (" + declared + ")");
            return props.getCountryMismatchPoints();
        }
        return 0;
    }

    private RiskLevel levelFor(int score) {
        if (score >= props.getHighThreshold()) {
            return RiskLevel.HIGH;
        }
        if (score >= props.getMediumThreshold()) {
            return RiskLevel.MEDIUM;
        }
        return RiskLevel.LOW;
    }
}
