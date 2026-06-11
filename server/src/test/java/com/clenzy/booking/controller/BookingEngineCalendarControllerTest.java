package com.clenzy.booking.controller;

import com.clenzy.booking.dto.AvailabilityRequestDto;
import com.clenzy.booking.dto.AvailabilityResponseDto;
import com.clenzy.booking.dto.CalendarAvailabilityResponseDto;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.booking.service.BookingEngineCalendarService;
import com.clenzy.booking.service.BookingEngineConfigService;
import com.clenzy.booking.service.PublicBookingService;
import com.clenzy.model.Organization;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingEngineCalendarControllerTest {

    @Mock private BookingEngineCalendarService calendarService;
    @Mock private TenantContext tenantContext;
    @Mock private PublicBookingService publicBookingService;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private BookingEngineConfigRepository configRepository;

    private BookingEngineCalendarController controller;

    @BeforeEach
    void setUp() {
        // Pattern Vague A : service de resolution REEL construit au-dessus des mocks
        // (organizationRepository + configRepository) pour conserver la couverture e2e.
        BookingEngineConfigService configService = new BookingEngineConfigService(
            configRepository, organizationRepository, tenantContext);
        controller = new BookingEngineCalendarController(
            calendarService, tenantContext, publicBookingService, configService);
        lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
    }

    @Test
    void getAvailability_validRange_callsService() {
        LocalDate today = LocalDate.now();
        LocalDate from = today.plusDays(10);
        LocalDate to = today.plusDays(20);
        CalendarAvailabilityResponseDto dto = mock(CalendarAvailabilityResponseDto.class);
        when(calendarService.getCalendarAvailability(eq(7L), eq(from), eq(to), isNull(), isNull()))
            .thenReturn(dto);

        ResponseEntity<CalendarAvailabilityResponseDto> response =
            controller.getAvailability(from, to, null, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(dto, response.getBody());
    }

    @Test
    void getAvailability_fromInPast_clampsToToday() {
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(30);
        LocalDate to = today.plusDays(10);
        CalendarAvailabilityResponseDto dto = mock(CalendarAvailabilityResponseDto.class);

        ArgumentCaptor<LocalDate> fromCaptor = ArgumentCaptor.forClass(LocalDate.class);
        when(calendarService.getCalendarAvailability(eq(7L), fromCaptor.capture(), any(), any(), any()))
            .thenReturn(dto);

        controller.getAvailability(from, to, null, null);

        assertEquals(today, fromCaptor.getValue());
    }

    @Test
    void getAvailability_rangeBeyond6Months_caps() {
        LocalDate today = LocalDate.now();
        LocalDate from = today;
        LocalDate to = today.plusYears(2);
        CalendarAvailabilityResponseDto dto = mock(CalendarAvailabilityResponseDto.class);

        ArgumentCaptor<LocalDate> toCaptor = ArgumentCaptor.forClass(LocalDate.class);
        when(calendarService.getCalendarAvailability(eq(7L), any(), toCaptor.capture(), any(), any()))
            .thenReturn(dto);

        controller.getAvailability(from, to, null, null);

        // Effective to should be today + 6 months (less than `to`)
        assertEquals(today.plusMonths(6), toCaptor.getValue());
    }

    @Test
    void getAvailability_withTypesAndGuests_forwardsFilters() {
        LocalDate today = LocalDate.now();
        LocalDate from = today.plusDays(5);
        LocalDate to = today.plusDays(15);
        CalendarAvailabilityResponseDto dto = mock(CalendarAvailabilityResponseDto.class);
        when(calendarService.getCalendarAvailability(eq(7L), eq(from), eq(to),
            eq(List.of("APARTMENT")), eq(4))).thenReturn(dto);

        ResponseEntity<CalendarAvailabilityResponseDto> response =
            controller.getAvailability(from, to, List.of("APARTMENT"), 4);

        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    @Test
    void checkAvailability_enabledConfig_callsService() {
        AvailabilityRequestDto request = mock(AvailabilityRequestDto.class);
        Organization org = mock(Organization.class);
        when(organizationRepository.findById(7L)).thenReturn(Optional.of(org));

        BookingEngineConfig enabledConfig = mock(BookingEngineConfig.class);
        when(enabledConfig.isEnabled()).thenReturn(true);
        when(configRepository.findAllByOrganizationId(7L)).thenReturn(List.of(enabledConfig));

        AvailabilityResponseDto availability = mock(AvailabilityResponseDto.class);
        when(publicBookingService.checkAvailability(any(), eq(request))).thenReturn(availability);

        ResponseEntity<AvailabilityResponseDto> response = controller.checkAvailability(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(availability, response.getBody());
    }

    @Test
    void checkAvailability_orgMissing_throws() {
        AvailabilityRequestDto request = mock(AvailabilityRequestDto.class);
        when(organizationRepository.findById(7L)).thenReturn(Optional.empty());

        IllegalStateException ex = assertThrows(IllegalStateException.class,
            () -> controller.checkAvailability(request));
        assertTrue(ex.getMessage().contains("Organisation"));
    }

    @Test
    void checkAvailability_bookingEngineDisabled_throws() {
        AvailabilityRequestDto request = mock(AvailabilityRequestDto.class);
        when(organizationRepository.findById(7L)).thenReturn(Optional.of(mock(Organization.class)));

        BookingEngineConfig disabledConfig = mock(BookingEngineConfig.class);
        when(disabledConfig.isEnabled()).thenReturn(false);
        when(configRepository.findAllByOrganizationId(7L)).thenReturn(List.of(disabledConfig));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
            () -> controller.checkAvailability(request));
        assertTrue(ex.getMessage().contains("desactive"));
    }

    @Test
    void checkAvailability_noConfigs_throws() {
        AvailabilityRequestDto request = mock(AvailabilityRequestDto.class);
        when(organizationRepository.findById(7L)).thenReturn(Optional.of(mock(Organization.class)));
        when(configRepository.findAllByOrganizationId(7L)).thenReturn(List.of());

        assertThrows(IllegalStateException.class, () -> controller.checkAvailability(request));
    }
}
