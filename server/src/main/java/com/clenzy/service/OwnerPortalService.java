package com.clenzy.service;

import com.clenzy.dto.OwnerDashboardDto;
import com.clenzy.dto.OwnerPropertySummaryDto;
import com.clenzy.dto.OwnerStatementDto;
import com.clenzy.dto.OwnerStatementDto.StatementLineDto;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class OwnerPortalService {

    private static final BigDecimal DEFAULT_COMMISSION_RATE = new BigDecimal("0.20"); // 20%

    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final GuestReviewRepository reviewRepository;

    public OwnerPortalService(PropertyRepository propertyRepository,
                              ReservationRepository reservationRepository,
                              GuestReviewRepository reviewRepository) {
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.reviewRepository = reviewRepository;
    }

    public OwnerDashboardDto getDashboard(Long ownerId, Long orgId) {
        List<Property> properties = propertyRepository.findByOwnerId(ownerId);
        if (properties.isEmpty()) {
            return new OwnerDashboardDto(ownerId, 0, 0, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, 0.0, 0.0, Map.of(), List.of());
        }

        LocalDate now = LocalDate.now();
        LocalDate yearStart = now.withDayOfYear(1);
        LocalDate yearEnd = now.withMonth(12).withDayOfMonth(31);

        List<Reservation> reservations = reservationRepository.findByOwnerIdAndDateRange(
            ownerId, yearStart, yearEnd, orgId);

        BigDecimal totalRevenue = BigDecimal.ZERO;
        int activeReservations = 0;
        double totalRating = 0;
        int ratingCount = 0;
        List<OwnerPropertySummaryDto> propertySummaries = new ArrayList<>();
        Map<String, BigDecimal> revenueByMonth = new TreeMap<>();

        for (Property property : properties) {
            List<Reservation> propReservations = reservations.stream()
                .filter(r -> r.getProperty().getId().equals(property.getId()))
                .toList();

            BigDecimal propRevenue = propReservations.stream()
                .map(Reservation::getTotalPrice)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal propCommission = propRevenue.multiply(DEFAULT_COMMISSION_RATE)
                .setScale(2, RoundingMode.HALF_UP);

            // Active reservations (current)
            activeReservations += (int) propReservations.stream()
                .filter(r -> !r.getCheckIn().isAfter(now) && !r.getCheckOut().isBefore(now))
                .count();

            // Occupancy rate
            long daysInPeriod = ChronoUnit.DAYS.between(yearStart, now.isBefore(yearEnd) ? now : yearEnd);
            long bookedDays = propReservations.stream()
                .mapToLong(r -> {
                    LocalDate start = r.getCheckIn().isBefore(yearStart) ? yearStart : r.getCheckIn();
                    LocalDate end = r.getCheckOut().isAfter(now) ? now : r.getCheckOut();
                    return Math.max(0, ChronoUnit.DAYS.between(start, end));
                })
                .sum();
            double occupancy = daysInPeriod > 0 ? (double) bookedDays / daysInPeriod * 100 : 0;

            // Average rating
            Double avgRating = reviewRepository.averageRatingByPropertyId(property.getId(), orgId);

            totalRevenue = totalRevenue.add(propRevenue);
            if (avgRating != null) {
                totalRating += avgRating;
                ratingCount++;
            }

            // Revenue by month
            for (Reservation r : propReservations) {
                String month = YearMonth.from(r.getCheckIn()).toString();
                revenueByMonth.merge(month,
                    r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO,
                    BigDecimal::add);
            }

            propertySummaries.add(new OwnerPropertySummaryDto(
                property.getId(), property.getName(), propReservations.size(),
                propRevenue, propCommission,
                propRevenue.subtract(propCommission),
                Math.round(occupancy * 10.0) / 10.0,
                avgRating
            ));
        }

        BigDecimal totalCommissions = totalRevenue.multiply(DEFAULT_COMMISSION_RATE)
            .setScale(2, RoundingMode.HALF_UP);
        double averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

        return new OwnerDashboardDto(
            ownerId, properties.size(), activeReservations,
            totalRevenue, totalCommissions, totalRevenue.subtract(totalCommissions),
            Math.round(averageRating * 10.0) / 10.0,
            Math.round(averageRating * 10.0) / 10.0,
            revenueByMonth, propertySummaries
        );
    }

    public OwnerStatementDto getStatement(Long ownerId, Long orgId, LocalDate from, LocalDate to, String ownerName) {
        List<Reservation> reservations = reservationRepository.findByOwnerIdAndDateRange(ownerId, from, to, orgId);

        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalCommissions = BigDecimal.ZERO;
        List<StatementLineDto> lines = new ArrayList<>();

        for (Reservation r : reservations) {
            BigDecimal amount = r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO;
            BigDecimal commission = amount.multiply(DEFAULT_COMMISSION_RATE).setScale(2, RoundingMode.HALF_UP);
            BigDecimal net = amount.subtract(commission);

            totalRevenue = totalRevenue.add(amount);
            totalCommissions = totalCommissions.add(commission);

            lines.add(new StatementLineDto(
                r.getCheckIn(),
                "Reservation " + r.getGuestName() + " (" + r.getCheckIn() + " - " + r.getCheckOut() + ")",
                r.getProperty().getName(),
                "RESERVATION",
                amount, commission, net
            ));
        }

        return new OwnerStatementDto(
            ownerId, ownerName, from, to,
            totalRevenue, totalCommissions, BigDecimal.ZERO,
            totalRevenue.subtract(totalCommissions),
            lines
        );
    }
}
