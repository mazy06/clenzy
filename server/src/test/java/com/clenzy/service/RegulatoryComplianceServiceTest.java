package com.clenzy.service;

import com.clenzy.dto.RegulatoryComplianceDto;
import com.clenzy.dto.RegulatoryConfigRequest;
import com.clenzy.model.Property;
import com.clenzy.model.RegulatoryConfig;
import com.clenzy.model.RegulatoryConfig.RegulatoryType;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RegulatoryConfigRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegulatoryComplianceServiceTest {

    @Mock private RegulatoryConfigRepository configRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private PropertyRepository propertyRepository;
    @InjectMocks private RegulatoryComplianceService service;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 100L;

    private RegulatoryConfig createAlurConfig(int maxDays) {
        RegulatoryConfig c = new RegulatoryConfig();
        c.setId(1L);
        c.setOrganizationId(ORG_ID);
        c.setPropertyId(PROPERTY_ID);
        c.setRegulatoryType(RegulatoryType.ALUR_120_DAYS);
        c.setMaxDaysPerYear(maxDays);
        c.setRegistrationNumber("REG-2025-001");
        c.setIsEnabled(true);
        return c;
    }

    private Reservation createReservation(LocalDate checkIn, LocalDate checkOut) {
        Reservation r = new Reservation();
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        return r;
    }

    private Property createProperty() {
        Property p = new Property();
        p.setName("Apartment Paris 11e");
        return p;
    }

    @Test
    void checkAlurCompliance_compliant() {
        RegulatoryConfig config = createAlurConfig(120);
        when(configRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.ALUR_120_DAYS, ORG_ID))
            .thenReturn(Optional.of(config));
        when(reservationRepository.findByPropertyIdsAndDateRange(eq(List.of(PROPERTY_ID)), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(
                createReservation(LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 10)),
                createReservation(LocalDate.of(2025, 7, 1), LocalDate.of(2025, 7, 15))
            ));
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(createProperty()));

        RegulatoryComplianceDto result = service.checkAlurCompliance(PROPERTY_ID, ORG_ID, 2025);

        assertEquals(23, result.daysRented()); // 9 + 14
        assertTrue(result.isCompliant());
        assertEquals(97, result.daysRemaining());
        assertNull(result.alertMessage());
    }

    @Test
    void checkAlurCompliance_exceeded() {
        RegulatoryConfig config = createAlurConfig(120);
        when(configRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.ALUR_120_DAYS, ORG_ID))
            .thenReturn(Optional.of(config));
        // Simule 130 jours loues (une seule grosse reservation)
        when(reservationRepository.findByPropertyIdsAndDateRange(eq(List.of(PROPERTY_ID)), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(
                createReservation(LocalDate.of(2025, 1, 1), LocalDate.of(2025, 5, 11)) // 130 jours
            ));
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(createProperty()));

        RegulatoryComplianceDto result = service.checkAlurCompliance(PROPERTY_ID, ORG_ID, 2025);

        assertEquals(130, result.daysRented());
        assertFalse(result.isCompliant());
        assertEquals(0, result.daysRemaining());
        assertNotNull(result.alertMessage());
        assertTrue(result.alertMessage().contains("DEPASSEMENT"));
    }

    @Test
    void checkAlurCompliance_warning() {
        RegulatoryConfig config = createAlurConfig(120);
        when(configRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.ALUR_120_DAYS, ORG_ID))
            .thenReturn(Optional.of(config));
        // 105 jours
        when(reservationRepository.findByPropertyIdsAndDateRange(eq(List.of(PROPERTY_ID)), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(
                createReservation(LocalDate.of(2025, 1, 1), LocalDate.of(2025, 4, 16)) // 105 jours
            ));
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(createProperty()));

        RegulatoryComplianceDto result = service.checkAlurCompliance(PROPERTY_ID, ORG_ID, 2025);

        assertEquals(105, result.daysRented());
        assertTrue(result.isCompliant());
        assertNotNull(result.alertMessage());
        assertTrue(result.alertMessage().contains("ATTENTION"));
    }

    @Test
    void checkAlurCompliance_noConfig_usesDefault() {
        when(configRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.ALUR_120_DAYS, ORG_ID))
            .thenReturn(Optional.empty());
        when(reservationRepository.findByPropertyIdsAndDateRange(eq(List.of(PROPERTY_ID)), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of());
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(createProperty()));

        RegulatoryComplianceDto result = service.checkAlurCompliance(PROPERTY_ID, ORG_ID, 2025);

        assertEquals(120, result.maxDays()); // Default
        assertEquals(0, result.daysRented());
        assertTrue(result.isCompliant());
    }

    @Test
    void wouldExceedAlurLimit_yes() {
        RegulatoryConfig config = createAlurConfig(120);
        when(configRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.ALUR_120_DAYS, ORG_ID))
            .thenReturn(Optional.of(config));
        // Already 110 days
        when(reservationRepository.findByPropertyIdsAndDateRange(eq(List.of(PROPERTY_ID)), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(
                createReservation(LocalDate.of(2025, 1, 1), LocalDate.of(2025, 4, 21)) // 110 days
            ));
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(createProperty()));

        boolean exceeds = service.wouldExceedAlurLimit(PROPERTY_ID, ORG_ID,
            LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 15)); // +14 = 124

        assertTrue(exceeds);
    }

    @Test
    void wouldExceedAlurLimit_no() {
        RegulatoryConfig config = createAlurConfig(120);
        when(configRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.ALUR_120_DAYS, ORG_ID))
            .thenReturn(Optional.of(config));
        when(reservationRepository.findByPropertyIdsAndDateRange(eq(List.of(PROPERTY_ID)), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(
                createReservation(LocalDate.of(2025, 1, 1), LocalDate.of(2025, 3, 12)) // 70 days
            ));
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(createProperty()));

        boolean exceeds = service.wouldExceedAlurLimit(PROPERTY_ID, ORG_ID,
            LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 15)); // +14 = 84

        assertFalse(exceeds);
    }

    @Test
    void upsertConfig_newConfig_forcesOrgFromTenant() {
        RegulatoryConfigRequest request = new RegulatoryConfigRequest(
            PROPERTY_ID, RegulatoryType.ALUR_120_DAYS, true, "REG-2025-XYZ",
            120, "FR", "75056", "note");
        when(configRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.ALUR_120_DAYS, ORG_ID))
            .thenReturn(Optional.empty());
        when(configRepository.save(any(RegulatoryConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        service.upsertConfig(request, ORG_ID);

        ArgumentCaptor<RegulatoryConfig> captor = ArgumentCaptor.forClass(RegulatoryConfig.class);
        verify(configRepository).save(captor.capture());
        assertEquals(ORG_ID, captor.getValue().getOrganizationId());
        assertEquals(PROPERTY_ID, captor.getValue().getPropertyId());
        assertEquals(RegulatoryType.ALUR_120_DAYS, captor.getValue().getRegulatoryType());
        assertNull(captor.getValue().getId()); // jamais d'id fourni par le client
        assertEquals("REG-2025-XYZ", captor.getValue().getRegistrationNumber());
    }

    @Test
    void upsertConfig_existingByPropertyAndType_isUpdatedNotDuplicated() {
        RegulatoryConfig existing = createAlurConfig(120);
        existing.setId(77L);
        when(configRepository.findByPropertyAndType(PROPERTY_ID, RegulatoryType.ALUR_120_DAYS, ORG_ID))
            .thenReturn(Optional.of(existing));
        when(configRepository.save(any(RegulatoryConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        RegulatoryConfigRequest request = new RegulatoryConfigRequest(
            PROPERTY_ID, RegulatoryType.ALUR_120_DAYS, false, "REG-UPDATED",
            90, "FR", "69123", "maj");

        service.upsertConfig(request, ORG_ID);

        ArgumentCaptor<RegulatoryConfig> captor = ArgumentCaptor.forClass(RegulatoryConfig.class);
        verify(configRepository).save(captor.capture());
        assertEquals(77L, captor.getValue().getId());
        assertEquals(ORG_ID, captor.getValue().getOrganizationId());
        assertEquals("REG-UPDATED", captor.getValue().getRegistrationNumber());
        assertEquals(90, captor.getValue().getMaxDaysPerYear());
        assertEquals(false, captor.getValue().getIsEnabled());
    }

    @Test
    void upsertConfig_missingRequiredKeys_throws() {
        RegulatoryConfigRequest request = new RegulatoryConfigRequest(
            null, null, true, null, 120, "FR", null, null);

        assertThrows(IllegalArgumentException.class, () -> service.upsertConfig(request, ORG_ID));
        verify(configRepository, never()).save(any());
    }
}
