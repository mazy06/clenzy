package com.clenzy.service;

import com.clenzy.dto.OwnerDashboardDto;
import com.clenzy.dto.OwnerStatementDto;
import com.clenzy.model.ManagementContract;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.commission.ManagementCommissionCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OwnerPortalServiceTest {

    @Mock private PropertyRepository propertyRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private GuestReviewRepository reviewRepository;
    @Mock private ManagementContractService managementContractService;
    /** Calculateur réel : c'est son arithmétique qu'on veut voir passer par le portail. */
    @Spy private ManagementCommissionCalculator commissionCalculator = new ManagementCommissionCalculator();

    @InjectMocks
    private OwnerPortalService service;

    private static final Long OWNER_ID = 10L;
    private static final Long ORG_ID = 1L;

    private Property property1;
    private Property property2;
    private Reservation reservation1;
    private Reservation reservation2;

    @BeforeEach
    void setUp() {
        property1 = new Property();
        property1.setId(100L);
        property1.setName("Beach House");
        property1.setOrganizationId(ORG_ID); // requis : getDashboard filtre par org (anti-IDOR)

        property2 = new Property();
        property2.setId(200L);
        property2.setName("Mountain Chalet");
        property2.setOrganizationId(ORG_ID);

        reservation1 = new Reservation();
        reservation1.setId(1L);
        reservation1.setProperty(property1);
        reservation1.setGuestName("John Doe");
        reservation1.setCheckIn(LocalDate.now().minusDays(5));
        reservation1.setCheckOut(LocalDate.now().plusDays(2));
        reservation1.setTotalPrice(new BigDecimal("500.00"));
        reservation1.setOrganizationId(ORG_ID);

        reservation2 = new Reservation();
        reservation2.setId(2L);
        reservation2.setProperty(property2);
        reservation2.setGuestName("Jane Smith");
        reservation2.setCheckIn(LocalDate.now().plusDays(10));
        reservation2.setCheckOut(LocalDate.now().plusDays(15));
        reservation2.setTotalPrice(new BigDecimal("800.00"));
        reservation2.setOrganizationId(ORG_ID);
    }

    /** Contrat de gestion au taux voulu, sur le brut. */
    private static ManagementContract contractAt(String rate) {
        ManagementContract c = new ManagementContract();
        c.setCommissionRate(new BigDecimal(rate));
        c.setCommissionBase(ManagementContract.CommissionBase.GROSS);
        return c;
    }

    @Test
    void getDashboard_noProperties_returnsEmpty() {
        when(propertyRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of());

        OwnerDashboardDto result = service.getDashboard(OWNER_ID, ORG_ID);

        assertEquals(0, result.totalProperties());
        assertEquals(BigDecimal.ZERO, result.totalRevenue());
    }

    @Test
    void getDashboard_withProperties_calculatesCorrectly() {
        when(propertyRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(property1, property2));
        when(reservationRepository.findByOwnerIdAndDateRange(eq(OWNER_ID), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(reservation1, reservation2));
        when(reviewRepository.averageRatingByPropertyId(100L, ORG_ID)).thenReturn(4.5);
        when(reviewRepository.averageRatingByPropertyId(200L, ORG_ID)).thenReturn(4.0);
        // Les 20 % viennent desormais du contrat, plus d'une constante du service.
        when(managementContractService.getActiveContract(100L, ORG_ID))
            .thenReturn(Optional.of(contractAt("0.20")));
        when(managementContractService.getActiveContract(200L, ORG_ID))
            .thenReturn(Optional.of(contractAt("0.20")));

        OwnerDashboardDto result = service.getDashboard(OWNER_ID, ORG_ID);

        assertEquals(2, result.totalProperties());
        assertEquals(0, new BigDecimal("1300.00").compareTo(result.totalRevenue()));
        // 20% commission
        assertEquals(0, new BigDecimal("260.00").compareTo(result.totalCommissions()));
        assertEquals(0, new BigDecimal("1040.00").compareTo(result.netRevenue()));
        assertEquals(2, result.properties().size());
    }

    /**
     * Changement visible : sans contrat actif, le portail affichait 20 % de commission
     * qui n'etaient prevus par aucun contrat et que le virement ne retenait pas. Il
     * affiche maintenant ce qui sera effectivement retenu, c'est-a-dire rien.
     */
    @Test
    void getDashboard_withoutContract_showsNoCommissionRatherThanAnInventedTwentyPercent() {
        when(propertyRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(property1));
        when(reservationRepository.findByOwnerIdAndDateRange(eq(OWNER_ID), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(reservation1));
        when(reviewRepository.averageRatingByPropertyId(100L, ORG_ID)).thenReturn(null);
        when(managementContractService.getActiveContract(100L, ORG_ID)).thenReturn(Optional.empty());

        OwnerDashboardDto result = service.getDashboard(OWNER_ID, ORG_ID);

        assertEquals(0, new BigDecimal("500.00").compareTo(result.totalRevenue()));
        assertEquals(0, BigDecimal.ZERO.compareTo(result.totalCommissions()));
        assertEquals(0, new BigDecimal("500.00").compareTo(result.netRevenue()));
    }

    @Test
    void getDashboard_countsActiveReservations() {
        when(propertyRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(property1));
        when(reservationRepository.findByOwnerIdAndDateRange(eq(OWNER_ID), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(reservation1)); // reservation1 is active (checkIn - 5 days, checkOut + 2 days)
        when(reviewRepository.averageRatingByPropertyId(eq(100L), eq(ORG_ID))).thenReturn(null);
        when(managementContractService.getActiveContract(100L, ORG_ID)).thenReturn(Optional.empty());

        OwnerDashboardDto result = service.getDashboard(OWNER_ID, ORG_ID);

        assertEquals(1, result.activeReservations());
    }

    @Test
    void getStatement_calculatesLinesCorrectly() {
        LocalDate from = LocalDate.now().minusMonths(1);
        LocalDate to = LocalDate.now().plusMonths(1);

        when(reservationRepository.findByOwnerIdAndDateRange(OWNER_ID, from, to, ORG_ID))
            .thenReturn(List.of(reservation1, reservation2));
        when(managementContractService.getActiveContract(100L, ORG_ID))
            .thenReturn(Optional.of(contractAt("0.20")));
        when(managementContractService.getActiveContract(200L, ORG_ID))
            .thenReturn(Optional.of(contractAt("0.20")));

        OwnerStatementDto result = service.getStatement(OWNER_ID, ORG_ID, from, to, "Test Owner");

        assertEquals("Test Owner", result.ownerName());
        assertEquals(2, result.lines().size());
        assertEquals(0, new BigDecimal("1300.00").compareTo(result.totalRevenue()));
        // 20% commission on 1300 = 260
        assertEquals(0, new BigDecimal("260.00").compareTo(result.totalCommissions()));
        assertEquals(0, new BigDecimal("1040.00").compareTo(result.netAmount()));
    }

    @Test
    void getStatement_noReservations_returnsEmptyStatement() {
        LocalDate from = LocalDate.now().minusMonths(1);
        LocalDate to = LocalDate.now().plusMonths(1);

        when(reservationRepository.findByOwnerIdAndDateRange(OWNER_ID, from, to, ORG_ID))
            .thenReturn(List.of());

        OwnerStatementDto result = service.getStatement(OWNER_ID, ORG_ID, from, to, "Test Owner");

        assertEquals(0, result.lines().size());
        assertEquals(0, BigDecimal.ZERO.compareTo(result.totalRevenue()));
        assertEquals(0, BigDecimal.ZERO.compareTo(result.netAmount()));
    }

    @Test
    void getStatement_lineTypesAreReservation() {
        LocalDate from = LocalDate.now().minusMonths(1);
        LocalDate to = LocalDate.now().plusMonths(1);

        when(reservationRepository.findByOwnerIdAndDateRange(OWNER_ID, from, to, ORG_ID))
            .thenReturn(List.of(reservation1));
        when(managementContractService.getActiveContract(100L, ORG_ID)).thenReturn(Optional.empty());

        OwnerStatementDto result = service.getStatement(OWNER_ID, ORG_ID, from, to, "Test Owner");

        assertEquals("RESERVATION", result.lines().get(0).type());
        assertTrue(result.lines().get(0).description().contains("John Doe"));
    }
}
