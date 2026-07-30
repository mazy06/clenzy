package com.clenzy.service;

import com.clenzy.dto.OwnerDashboardDto;
import com.clenzy.dto.OwnerPropertySummaryDto;
import com.clenzy.dto.OwnerStatementDto;
import com.clenzy.dto.OwnerStatementDto.StatementLineDto;
import com.clenzy.model.ManagementContract;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.commission.ManagementCommissionCalculator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Portail propriétaire : tableau de bord et relevé.
 *
 * <p>La commission affichée vient du {@link ManagementContract} du logement via
 * {@link ManagementCommissionCalculator} — le même calcul que la facture de commission
 * et que le virement. Elle valait auparavant 20 % en dur, ce qui promettait au
 * propriétaire une retenue sans rapport avec son contrat ni avec ce qui lui était
 * effectivement prélevé. Sans contrat actif, la commission affichée est nulle : c'est
 * aussi ce que le virement retient.</p>
 */
@Service
@Transactional(readOnly = true)
public class OwnerPortalService {

    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final GuestReviewRepository reviewRepository;
    private final ManagementContractService managementContractService;
    private final ManagementCommissionCalculator commissionCalculator;

    public OwnerPortalService(PropertyRepository propertyRepository,
                              ReservationRepository reservationRepository,
                              GuestReviewRepository reviewRepository,
                              ManagementContractService managementContractService,
                              ManagementCommissionCalculator commissionCalculator) {
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.reviewRepository = reviewRepository;
        this.managementContractService = managementContractService;
        this.commissionCalculator = commissionCalculator;
    }

    public OwnerDashboardDto getDashboard(Long ownerId, Long orgId) {
        // HP-02 : ne remonter que les biens du proprietaire DANS l'organisation courante.
        // findByOwnerId n'est PAS org-filtre -> sans ce filtre, un ownerId d'une autre org
        // exposerait des donnees cross-org (IDOR). Le statement, lui, filtre deja par orgId.
        List<Property> properties = propertyRepository.findByOwnerId(ownerId).stream()
                .filter(p -> orgId != null && orgId.equals(p.getOrganizationId()))
                .toList();
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
        // Somme des commissions par logement, et non taux × chiffre d'affaires global :
        // chaque logement a son contrat, donc son taux et sa base.
        BigDecimal totalCommissions = BigDecimal.ZERO;
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

            ManagementContract contract = managementContractService
                .getActiveContract(property.getId(), orgId).orElse(null);
            BigDecimal propCommission = commissionCalculator
                .ofAll(propReservations, contract).amount();

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
            totalCommissions = totalCommissions.add(propCommission);
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
        // Les séjours d'un relevé se répartissent sur quelques logements : on résout le
        // contrat une fois par logement plutôt qu'une fois par séjour.
        Map<Long, Optional<ManagementContract>> contractsByProperty = new HashMap<>();

        for (Reservation r : reservations) {
            BigDecimal amount = r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO;
            ManagementContract contract = contractsByProperty.computeIfAbsent(
                r.getProperty().getId(),
                propertyId -> managementContractService.getActiveContract(propertyId, orgId)
            ).orElse(null);
            BigDecimal commission = commissionCalculator.of(r, contract).amount();
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
