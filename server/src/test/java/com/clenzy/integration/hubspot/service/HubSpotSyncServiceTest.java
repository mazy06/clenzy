package com.clenzy.integration.hubspot.service;

import com.clenzy.integration.hubspot.dto.HubSpotContactDto;
import com.clenzy.integration.hubspot.dto.HubSpotDealDto;
import com.clenzy.model.Guest;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link HubSpotSyncService}.
 *
 * <h2>Focus</h2>
 * <ul>
 *   <li>syncGuestToContact : guest existant -> DTO bien rempli, appel API, log</li>
 *   <li>syncGuestToContact : guest manquant -> IllegalArgumentException</li>
 *   <li>syncReservationToDeal : reservation existante -> DTO bien rempli, appel API</li>
 *   <li>syncReservationToDeal : reservation manquante -> IllegalArgumentException</li>
 *   <li>Champs null (totalPrice, checkOut) -> defauts "0"/null sans NPE</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class HubSpotSyncServiceTest {

    @Mock
    private HubSpotApiService hubSpotApiService;

    @Mock
    private GuestRepository guestRepository;

    @Mock
    private ReservationRepository reservationRepository;

    private HubSpotSyncService service;

    @BeforeEach
    void setUp() {
        service = new HubSpotSyncService(hubSpotApiService, guestRepository, reservationRepository);
    }

    // ─── syncGuestToContact ──────────────────────────────────────────────

    @Test
    @DisplayName("syncGuestToContact builds DTO with guest fields and calls API")
    void syncGuestToContact_existingGuest_buildsDtoAndCalls() {
        Guest guest = new Guest();
        guest.setEmail("jane@example.com");
        guest.setFirstName("Jane");
        guest.setLastName("Doe");
        guest.setPhone("+33612345678");

        when(guestRepository.findById(42L)).thenReturn(Optional.of(guest));
        when(hubSpotApiService.createOrUpdateContact(any(HubSpotContactDto.class)))
                .thenReturn("hs-contact-001");

        service.syncGuestToContact(42L, 7L);

        ArgumentCaptor<HubSpotContactDto> captor = ArgumentCaptor.forClass(HubSpotContactDto.class);
        verify(hubSpotApiService).createOrUpdateContact(captor.capture());

        HubSpotContactDto dto = captor.getValue();
        assertThat(dto.email()).isEqualTo("jane@example.com");
        assertThat(dto.firstName()).isEqualTo("Jane");
        assertThat(dto.lastName()).isEqualTo("Doe");
        assertThat(dto.phone()).isEqualTo("+33612345678");
        assertThat(dto.company()).isNull();
        assertThat(dto.properties())
                .containsEntry("clenzy_guest_id", "42")
                .containsEntry("clenzy_org_id", "7");
    }

    @Test
    @DisplayName("syncGuestToContact throws IllegalArgumentException when guest not found")
    void syncGuestToContact_guestNotFound_throws() {
        when(guestRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.syncGuestToContact(99L, 7L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("99");
        verify(hubSpotApiService, never()).createOrUpdateContact(any());
    }

    @Test
    @DisplayName("syncGuestToContact propagates null email/firstName/lastName/phone")
    void syncGuestToContact_nullFields_preservedInDto() {
        Guest guest = new Guest();
        // All fields null
        when(guestRepository.findById(15L)).thenReturn(Optional.of(guest));
        when(hubSpotApiService.createOrUpdateContact(any())).thenReturn("hs-1");

        service.syncGuestToContact(15L, 3L);

        ArgumentCaptor<HubSpotContactDto> captor = ArgumentCaptor.forClass(HubSpotContactDto.class);
        verify(hubSpotApiService).createOrUpdateContact(captor.capture());
        HubSpotContactDto dto = captor.getValue();
        assertThat(dto.email()).isNull();
        assertThat(dto.firstName()).isNull();
        assertThat(dto.lastName()).isNull();
        assertThat(dto.phone()).isNull();
    }

    // ─── syncReservationToDeal ───────────────────────────────────────────

    @Test
    @DisplayName("syncReservationToDeal builds DTO with reservation fields and calls API")
    void syncReservationToDeal_existingReservation_buildsDealAndCalls() {
        Reservation reservation = new Reservation();
        reservation.setTotalPrice(BigDecimal.valueOf(450.50));
        reservation.setCheckOut(LocalDate.of(2026, 6, 15));

        when(reservationRepository.findById(123L)).thenReturn(Optional.of(reservation));
        when(hubSpotApiService.createDeal(any(HubSpotDealDto.class))).thenReturn("hs-deal-987");

        service.syncReservationToDeal(123L, 9L);

        ArgumentCaptor<HubSpotDealDto> captor = ArgumentCaptor.forClass(HubSpotDealDto.class);
        verify(hubSpotApiService).createDeal(captor.capture());

        HubSpotDealDto deal = captor.getValue();
        assertThat(deal.dealName()).isEqualTo("Reservation #123");
        assertThat(deal.amount()).isEqualTo("450.5");
        assertThat(deal.stage()).isEqualTo("appointmentscheduled");
        assertThat(deal.pipeline()).isEqualTo("default");
        assertThat(deal.closeDate()).isEqualTo("2026-06-15");
        assertThat(deal.contactId()).isNull();
        assertThat(deal.properties())
                .containsEntry("clenzy_reservation_id", "123")
                .containsEntry("clenzy_org_id", "9");
    }

    @Test
    @DisplayName("syncReservationToDeal with null totalPrice uses '0'")
    void syncReservationToDeal_nullTotalPrice_defaultsToZero() {
        Reservation reservation = new Reservation();
        // totalPrice null
        reservation.setCheckOut(LocalDate.of(2026, 1, 1));

        when(reservationRepository.findById(55L)).thenReturn(Optional.of(reservation));
        when(hubSpotApiService.createDeal(any(HubSpotDealDto.class))).thenReturn("hs-deal-x");

        service.syncReservationToDeal(55L, 1L);

        ArgumentCaptor<HubSpotDealDto> captor = ArgumentCaptor.forClass(HubSpotDealDto.class);
        verify(hubSpotApiService).createDeal(captor.capture());
        assertThat(captor.getValue().amount()).isEqualTo("0");
    }

    @Test
    @DisplayName("syncReservationToDeal with null checkOut sets closeDate=null")
    void syncReservationToDeal_nullCheckOut_closeDateNull() {
        Reservation reservation = new Reservation();
        reservation.setTotalPrice(BigDecimal.valueOf(100));
        // checkOut null
        when(reservationRepository.findById(77L)).thenReturn(Optional.of(reservation));
        when(hubSpotApiService.createDeal(any(HubSpotDealDto.class))).thenReturn("hs-deal-y");

        service.syncReservationToDeal(77L, 2L);

        ArgumentCaptor<HubSpotDealDto> captor = ArgumentCaptor.forClass(HubSpotDealDto.class);
        verify(hubSpotApiService).createDeal(captor.capture());
        assertThat(captor.getValue().closeDate()).isNull();
    }

    @Test
    @DisplayName("syncReservationToDeal throws IllegalArgumentException when reservation not found")
    void syncReservationToDeal_reservationNotFound_throws() {
        when(reservationRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.syncReservationToDeal(999L, 3L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("999");
        verify(hubSpotApiService, never()).createDeal(any());
    }
}
