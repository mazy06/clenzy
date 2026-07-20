package com.clenzy.service;

import com.clenzy.dto.BookingCurveDto;
import com.clenzy.dto.BookingCurvePointDto;
import com.clenzy.dto.PaceMonthDto;
import com.clenzy.dto.PaceSummaryDto;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Analytics on-the-books (fondations RMS R1) : pace, pickup et booking curve.
 *
 * <p>L'OTB à une date passée S est <b>reconstruit</b> depuis {@code reservations}
 * (aucun snapshot requis) : une réservation compte à S si {@code created_at <= S}
 * et ({@code cancelled_at} null ou {@code > S}). Le same-time-last-year est décalé
 * de <b>364 jours</b> (52 semaines) pour comparer un samedi à un samedi.</p>
 *
 * <p>Pattern {@code PropertyPerformanceService} : un seul fetch JPQL de la fenêtre
 * (org-scope strict, owner/propriété optionnels), agrégats en mémoire — le cœur du
 * calcul est statique et testable sans base.</p>
 */
@Service
public class PaceAnalyticsService {

    /** Décalage STLY en jours : 52 semaines, aligne les jours de semaine. */
    static final int STLY_SHIFT_DAYS = 364;
    /** Portée maximale de la booking curve avant le début du mois de séjour. */
    static final int CURVE_MAX_LEAD_DAYS = 180;
    /** Pas des points de la booking curve. */
    static final int CURVE_STEP_DAYS = 7;

    private final ReservationRepository reservationRepository;
    private final PropertyRepository propertyRepository;
    private final Clock clock;

    public PaceAnalyticsService(ReservationRepository reservationRepository,
                                PropertyRepository propertyRepository,
                                Clock clock) {
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
        this.clock = clock;
    }

    /**
     * Pace des {@code months} prochains mois de séjour (mois courant inclus) :
     * OTB, STLY, pickup 7/28 j, occupation on-the-books.
     */
    @Transactional(readOnly = true)
    public PaceSummaryDto getSummary(Long orgId, String ownerKc, int months, Long propertyId) {
        final LocalDateTime now = LocalDateTime.now(clock);
        final YearMonth firstMonth = YearMonth.from(now.toLocalDate());
        final LocalDate windowStart = firstMonth.atDay(1);
        final LocalDate windowEndExclusive = firstMonth.plusMonths(months).atDay(1);

        final List<Reservation> current = reservationRepository.findOverlappingWindowForPace(
                windowStart, windowEndExclusive, orgId, ownerKc, propertyId);
        final List<Reservation> lastYear = reservationRepository.findOverlappingWindowForPace(
                windowStart.minusDays(STLY_SHIFT_DAYS), windowEndExclusive.minusDays(STLY_SHIFT_DAYS),
                orgId, ownerKc, propertyId);

        final long activeProperties = propertyId != null
                ? 1L
                : propertyRepository.countForDashboardByStatus(orgId, ownerKc, PropertyStatus.ACTIVE);

        final List<PaceMonthDto> lines = new ArrayList<>(months);
        for (int i = 0; i < months; i++) {
            final YearMonth month = firstMonth.plusMonths(i);
            final LocalDate mStart = month.atDay(1);
            final LocalDate mEnd = month.plusMonths(1).atDay(1);

            final Otb otb = aggregateOtb(current, mStart, mEnd, now);
            final Otb otb7 = aggregateOtb(current, mStart, mEnd, now.minusDays(7));
            final Otb otb28 = aggregateOtb(current, mStart, mEnd, now.minusDays(28));
            final Otb stly = aggregateOtb(lastYear,
                    mStart.minusDays(STLY_SHIFT_DAYS), mEnd.minusDays(STLY_SHIFT_DAYS),
                    now.minusDays(STLY_SHIFT_DAYS));

            final long availableNights = activeProperties * month.lengthOfMonth();
            lines.add(new PaceMonthDto(
                    month.toString(),
                    otb.nights(),
                    otb.revenue(),
                    stly.nights(),
                    pctDelta(otb.nights(), stly.nights()),
                    otb.nights() - otb7.nights(),
                    otb.nights() - otb28.nights(),
                    occupancyPct(otb.nights(), availableNights)));
        }
        return new PaceSummaryDto(now.toLocalDate(), activeProperties, lines);
    }

    /**
     * Booking curve d'un mois de séjour : OTB vu chaque semaine de J-180 au début
     * du mois (borné à aujourd'hui), avec la courbe STLY au même lead-time.
     */
    @Transactional(readOnly = true)
    public BookingCurveDto getBookingCurve(Long orgId, String ownerKc, YearMonth month, Long propertyId) {
        final LocalDateTime now = LocalDateTime.now(clock);
        final LocalDate mStart = month.atDay(1);
        final LocalDate mEnd = month.plusMonths(1).atDay(1);

        final List<Reservation> current = reservationRepository.findOverlappingWindowForPace(
                mStart, mEnd, orgId, ownerKc, propertyId);
        final List<Reservation> lastYear = reservationRepository.findOverlappingWindowForPace(
                mStart.minusDays(STLY_SHIFT_DAYS), mEnd.minusDays(STLY_SHIFT_DAYS),
                orgId, ownerKc, propertyId);

        final List<BookingCurvePointDto> points = new ArrayList<>();
        for (int lead = CURVE_MAX_LEAD_DAYS; lead >= 0; lead -= CURVE_STEP_DAYS) {
            final LocalDateTime snapshot = mStart.atStartOfDay().minusDays(lead);
            if (snapshot.isAfter(now)) {
                continue;
            }
            points.add(curvePoint(current, lastYear, mStart, mEnd, lead, snapshot));
        }
        // Point « aujourd'hui » si le mois n'a pas encore commencé (lead intermédiaire).
        if (now.isBefore(mStart.atStartOfDay())) {
            final int lead = (int) ChronoUnit.DAYS.between(now.toLocalDate(), mStart);
            if (points.isEmpty() || points.get(points.size() - 1).daysBeforeMonthStart() != lead) {
                points.add(curvePoint(current, lastYear, mStart, mEnd, lead, now));
            }
        }
        return new BookingCurveDto(month.toString(), points);
    }

    private BookingCurvePointDto curvePoint(List<Reservation> current, List<Reservation> lastYear,
                                            LocalDate mStart, LocalDate mEnd,
                                            int lead, LocalDateTime snapshot) {
        final Otb otb = aggregateOtb(current, mStart, mEnd, snapshot);
        final Otb stly = aggregateOtb(lastYear,
                mStart.minusDays(STLY_SHIFT_DAYS), mEnd.minusDays(STLY_SHIFT_DAYS),
                snapshot.minusDays(STLY_SHIFT_DAYS));
        return new BookingCurvePointDto(lead, otb.nights(), stly.nights());
    }

    // ── Cœur de calcul (statique, testable sans base) ───────────────────────

    /** Nuits + revenu proratisé on-the-books d'une fenêtre [start, endExclusive) vus à {@code snapshot}. */
    static Otb aggregateOtb(List<Reservation> reservations,
                            LocalDate start, LocalDate endExclusive,
                            LocalDateTime snapshot) {
        long nights = 0L;
        BigDecimal revenue = BigDecimal.ZERO;
        for (Reservation r : reservations) {
            if (!activeAt(r, snapshot)) {
                continue;
            }
            final LocalDate s = r.getCheckIn().isBefore(start) ? start : r.getCheckIn();
            final LocalDate e = r.getCheckOut().isBefore(endExclusive) ? r.getCheckOut() : endExclusive;
            final long overlap = Math.max(0L, ChronoUnit.DAYS.between(s, e));
            if (overlap == 0L) {
                continue;
            }
            final long totalNights = Math.max(1L, ChronoUnit.DAYS.between(r.getCheckIn(), r.getCheckOut()));
            nights += overlap;
            final BigDecimal price = r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO;
            revenue = revenue.add(price
                    .multiply(BigDecimal.valueOf(overlap))
                    .divide(BigDecimal.valueOf(totalNights), 2, RoundingMode.HALF_UP));
        }
        return new Otb(nights, revenue);
    }

    /**
     * La réservation était-elle « au livre » à l'instant S ? Créée avant S, et pas
     * encore annulée à S. Garde-fou : une annulée sans cancelled_at (ne devrait
     * pas exister après le backfill 0349) ne compte jamais.
     */
    static boolean activeAt(Reservation r, LocalDateTime snapshot) {
        if (r.getCreatedAt() == null || r.getCreatedAt().isAfter(snapshot)) {
            return false;
        }
        if (r.getCancelledAt() != null) {
            return r.getCancelledAt().isAfter(snapshot);
        }
        return !"cancelled".equalsIgnoreCase(r.getStatus());
    }

    private static Double pctDelta(long value, long reference) {
        if (reference == 0L) {
            return null;
        }
        return Math.round((value - reference) * 1000.0 / reference) / 10.0;
    }

    private static Double occupancyPct(long nights, long availableNights) {
        if (availableNights <= 0L) {
            return null;
        }
        return Math.min(100.0, Math.round(nights * 1000.0 / availableNights) / 10.0);
    }

    /** Agrégat on-the-books d'une fenêtre : nuits + revenu proratisé. */
    record Otb(long nights, BigDecimal revenue) {
    }
}
