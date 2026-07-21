package com.clenzy.booking.service;

import com.clenzy.dto.FunnelAnalyticsDto;
import com.clenzy.dto.FunnelAnalyticsDto.DailyPoint;
import com.clenzy.dto.FunnelAnalyticsDto.DeniedStay;
import com.clenzy.model.BookingFunnelEvent;
import com.clenzy.repository.BookingFunnelEventRepository;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Restitution du funnel booking engine (fondations RMS R1) : compteurs par étape,
 * série quotidienne, conversion (résas directes créées / recherches) et surtout la
 * <b>denied demand</b> — les séjours demandés sans disponibilité, triés par
 * fréquence : le signal « prix ou min-stay à revoir » qu'aucun scraper ne voit.
 */
@Service
public class BookingFunnelAnalyticsService {

    private static final int TOP_DENIED_LIMIT = 10;

    private final BookingFunnelEventRepository funnelRepository;
    private final ReservationRepository reservationRepository;

    public BookingFunnelAnalyticsService(BookingFunnelEventRepository funnelRepository,
                                         ReservationRepository reservationRepository) {
        this.funnelRepository = funnelRepository;
        this.reservationRepository = reservationRepository;
    }

    @Transactional(readOnly = true)
    public FunnelAnalyticsDto getAnalytics(Long orgId, LocalDate from, LocalDate to) {
        final LocalDateTime start = from.atStartOfDay();
        final LocalDateTime endExclusive = to.plusDays(1).atStartOfDay();

        final Map<String, Long> totals = new HashMap<>();
        funnelRepository.countByTypeBetween(orgId, start, endExclusive)
                .forEach(tc -> totals.put(tc.getEventType(), tc.getCount()));
        final long ok = totals.getOrDefault(BookingFunnelEvent.Type.SEARCH.name(), 0L);
        final long denied = totals.getOrDefault(BookingFunnelEvent.Type.SEARCH_NO_RESULT.name(), 0L);
        final long searches = ok + denied;
        final long views = totals.getOrDefault(BookingFunnelEvent.Type.VIEW_PROPERTY.name(), 0L);
        final long checkouts = totals.getOrDefault(BookingFunnelEvent.Type.CHECKOUT_START.name(), 0L);
        final long confirmed = reservationRepository.countDirectCreatedBetween(orgId, start, endExclusive);

        final Map<LocalDate, Map<String, Long>> dailyMap = new TreeMap<>();
        funnelRepository.countDailyByTypeBetween(orgId, start, endExclusive).forEach(row ->
                dailyMap.computeIfAbsent(row.getDay().toLocalDate(), d -> new HashMap<>())
                        .put(row.getEventType(), row.getCount()));
        final List<DailyPoint> daily = new ArrayList<>(dailyMap.size());
        dailyMap.forEach((date, counts) -> daily.add(new DailyPoint(date, counts)));

        final List<DeniedStay> topDenied = funnelRepository
                .topDeniedSearches(orgId, start, endExclusive, TOP_DENIED_LIMIT).stream()
                .map(d -> new DeniedStay(d.getCheckIn(), d.getCheckOut(), d.getGuests(), d.getCount()))
                .toList();

        return new FunnelAnalyticsDto(from, to,
                searches, denied, views, checkouts, confirmed,
                pct(confirmed, searches), pct(denied, searches),
                daily, topDenied);
    }

    private static Double pct(long value, long reference) {
        if (reference == 0L) {
            return null;
        }
        return Math.round(value * 1000.0 / reference) / 10.0;
    }
}
