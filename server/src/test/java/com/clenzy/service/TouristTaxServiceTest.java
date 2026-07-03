package com.clenzy.service;

import com.clenzy.dto.TouristTaxCalculationDto;
import com.clenzy.dto.TouristTaxConfigRequest;
import com.clenzy.dto.TouristTaxReportDto;
import com.clenzy.dto.TouristTaxReportLineDto;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.TouristTaxConfig;
import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.TouristTaxConfigRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TouristTaxServiceTest {

    @Mock private TouristTaxConfigRepository configRepository;
    @Mock private ReservationRepository reservationRepository;

    @InjectMocks
    private TouristTaxService service;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 100L;

    private TouristTaxConfig createConfig(TaxCalculationMode mode) {
        TouristTaxConfig config = new TouristTaxConfig();
        config.setId(1L);
        config.setOrganizationId(ORG_ID);
        config.setPropertyId(PROPERTY_ID);
        config.setCommuneName("Paris");
        config.setCommuneCode("75056");
        config.setCalculationMode(mode);
        config.setEnabled(true);
        return config;
    }

    /** Requête d'upsert avec uniquement les champs v1 legacy renseignés. */
    private static TouristTaxConfigRequest request(Long propertyId, String commune, String code,
                                                   TaxCalculationMode mode, BigDecimal ratePerPerson,
                                                   Integer childrenExemptUnder, Boolean enabled) {
        return new TouristTaxConfigRequest(propertyId, commune, code, mode, ratePerPerson,
            null, null, null, null, null, null, childrenExemptUnder, enabled);
    }

    private Reservation createReservation(int nights, int guests, String totalPrice) {
        Property property = new Property();
        property.setId(PROPERTY_ID);
        property.setName("Loft Baitly");
        Reservation reservation = new Reservation();
        reservation.setId(500L);
        reservation.setOrganizationId(ORG_ID);
        reservation.setProperty(property);
        reservation.setGuestName("Jean Dupont");
        reservation.setGuestCount(guests);
        reservation.setCheckIn(LocalDate.of(2026, 7, 1));
        reservation.setCheckOut(LocalDate.of(2026, 7, 1).plusDays(nights));
        reservation.setTotalPrice(new BigDecimal(totalPrice));
        return reservation;
    }

    // ─── calculate() (devis booking engine — comportement historique gelé) ──

    @Test
    void calculate_perPersonPerNight() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        config.setRatePerPerson(new BigDecimal("2.50"));
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        TouristTaxCalculationDto result = service.calculate(PROPERTY_ID, ORG_ID,
            3, 2, new BigDecimal("100.00"));

        assertNotNull(result);
        // 2.50 * 2 guests = 5.00 per night, * 3 nights = 15.00
        assertEquals(0, new BigDecimal("5.00").compareTo(result.taxPerNight()));
        assertEquals(0, new BigDecimal("15.00").compareTo(result.totalTax()));
        assertEquals(3, result.nights());
        assertEquals(2, result.guests());
    }

    @Test
    void calculate_percentageOfRate() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PERCENTAGE_OF_RATE);
        config.setPercentageRate(new BigDecimal("0.0500")); // 5%
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        TouristTaxCalculationDto result = service.calculate(PROPERTY_ID, ORG_ID,
            4, 2, new BigDecimal("200.00"));

        assertNotNull(result);
        // 5% of 200 = 10.00 per night, * 4 nights = 40.00
        assertEquals(0, new BigDecimal("10.00").compareTo(result.taxPerNight()));
        assertEquals(0, new BigDecimal("40.00").compareTo(result.totalTax()));
    }

    @Test
    void calculate_flatPerNight() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.FLAT_PER_NIGHT);
        config.setRatePerPerson(new BigDecimal("3.00"));
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        TouristTaxCalculationDto result = service.calculate(PROPERTY_ID, ORG_ID,
            5, 4, new BigDecimal("150.00"));

        assertNotNull(result);
        // 3.00 per night * 5 nights = 15.00
        assertEquals(0, new BigDecimal("3.00").compareTo(result.taxPerNight()));
        assertEquals(0, new BigDecimal("15.00").compareTo(result.totalTax()));
    }

    @Test
    void calculate_maxNightsCapped() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        config.setRatePerPerson(new BigDecimal("2.00"));
        config.setMaxNights(5);
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        TouristTaxCalculationDto result = service.calculate(PROPERTY_ID, ORG_ID,
            10, 1, new BigDecimal("100.00"));

        // Capped at 5 nights: 2.00 * 1 * 5 = 10.00
        assertEquals(5, result.nights());
        assertEquals(0, new BigDecimal("10.00").compareTo(result.totalTax()));
    }

    @Test
    void calculate_noConfig_returnsNull() {
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.empty());

        TouristTaxCalculationDto result = service.calculate(PROPERTY_ID, ORG_ID,
            3, 2, new BigDecimal("100.00"));

        assertNull(result);
    }

    @Test
    void calculate_disabledConfig_returnsNull() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        config.setEnabled(false);
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        TouristTaxCalculationDto result = service.calculate(PROPERTY_ID, ORG_ID,
            3, 2, new BigDecimal("100.00"));

        assertNull(result);
    }

    // ─── upsertConfig ────────────────────────────────────────────────────────

    @Test
    void upsertConfig_newConfig_forcesOrgFromTenant() {
        TouristTaxConfigRequest req = request(
            PROPERTY_ID, "Lyon", "69123", TaxCalculationMode.FLAT_PER_NIGHT,
            new BigDecimal("1.50"), 12, true);
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.empty());
        when(configRepository.save(any(TouristTaxConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        service.upsertConfig(req, ORG_ID);

        ArgumentCaptor<TouristTaxConfig> captor = ArgumentCaptor.forClass(TouristTaxConfig.class);
        verify(configRepository).save(captor.capture());
        assertEquals(ORG_ID, captor.getValue().getOrganizationId());
        assertEquals(PROPERTY_ID, captor.getValue().getPropertyId());
        assertNull(captor.getValue().getId()); // jamais d'id fourni par le client
        assertEquals("Lyon", captor.getValue().getCommuneName());
    }

    @Test
    void upsertConfig_existingByProperty_isUpdatedNotDuplicated() {
        // Une config existe deja pour (propertyId, orgId). On la met a jour
        // (pas de nouvel insert) — son id et son org restent ceux de la DB.
        TouristTaxConfig existing = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        existing.setId(42L);
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(existing));
        when(configRepository.save(any(TouristTaxConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        TouristTaxConfigRequest req = request(
            PROPERTY_ID, "Nice", null, TaxCalculationMode.FLAT_PER_NIGHT,
            new BigDecimal("2.00"), null, false);

        service.upsertConfig(req, ORG_ID);

        ArgumentCaptor<TouristTaxConfig> captor = ArgumentCaptor.forClass(TouristTaxConfig.class);
        verify(configRepository).save(captor.capture());
        assertEquals(42L, captor.getValue().getId());
        assertEquals(ORG_ID, captor.getValue().getOrganizationId());
        assertEquals("Nice", captor.getValue().getCommuneName());
        assertEquals(false, captor.getValue().getEnabled());
    }

    @Test
    void upsertConfig_nullPropertyId_upsertsOrgDefault() {
        // propertyId null = barème PAR DÉFAUT de l'org (résolu via findDefaultForOrg).
        when(configRepository.findDefaultForOrg(ORG_ID)).thenReturn(Optional.empty());
        when(configRepository.save(any(TouristTaxConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        TouristTaxConfigRequest req = request(
            null, "Marseille", "13055", TaxCalculationMode.PER_PERSON_PER_NIGHT,
            new BigDecimal("1.00"), null, true);

        TouristTaxConfig saved = service.upsertConfig(req, ORG_ID);

        assertNull(saved.getPropertyId());
        assertEquals(ORG_ID, saved.getOrganizationId());
        verify(configRepository).findDefaultForOrg(ORG_ID);
        verify(configRepository, never()).findByPropertyId(any(), any());
    }

    // ─── resolveConfig ───────────────────────────────────────────────────────

    @Test
    void resolveConfig_propertyOverride_winsOverOrgDefault() {
        TouristTaxConfig override = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(override));

        Optional<TouristTaxConfig> resolved = service.resolveConfig(PROPERTY_ID, ORG_ID);

        assertTrue(resolved.isPresent());
        assertEquals(PROPERTY_ID, resolved.get().getPropertyId());
        verify(configRepository, never()).findDefaultForOrg(any());
    }

    @Test
    void resolveConfig_noOverride_fallsBackToOrgDefault() {
        TouristTaxConfig orgDefault = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        orgDefault.setPropertyId(null);
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.empty());
        when(configRepository.findDefaultForOrg(ORG_ID)).thenReturn(Optional.of(orgDefault));

        Optional<TouristTaxConfig> resolved = service.resolveConfig(PROPERTY_ID, ORG_ID);

        assertTrue(resolved.isPresent());
        assertNull(resolved.get().getPropertyId());
    }

    @Test
    void resolveConfig_disabledOverride_isExplicitExemption_noFallback() {
        // Un override désactivé = exonération explicite du bien : on ne
        // retombe PAS sur le barème par défaut de l'org.
        TouristTaxConfig override = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        override.setEnabled(false);
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(override));

        assertTrue(service.resolveConfig(PROPERTY_ID, ORG_ID).isEmpty());
        verify(configRepository, never()).findDefaultForOrg(any());
    }

    // ─── computeForReservation ───────────────────────────────────────────────

    @Test
    void computeForReservation_fixedPerPersonNight() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        config.setRatePerPerson(new BigDecimal("2.50"));
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        Reservation reservation = createReservation(3, 2, "300.00");
        TouristTaxReportLineDto line = service.computeForReservation(reservation).orElseThrow();

        // 2.50 × 2 personnes × 3 nuits = 15.00, pas de surtaxe
        assertEquals(0, new BigDecimal("15.00").compareTo(line.taxAmount()));
        assertEquals(0, BigDecimal.ZERO.compareTo(line.surchargeAmount()));
        assertEquals(3, line.nights());
        assertEquals(2, line.taxablePersons());
        assertEquals("Paris", line.communeName());
    }

    @Test
    void computeForReservation_percentage_capNotReached() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PERCENTAGE_OF_RATE);
        config.setPercentageRate(new BigDecimal("0.0500")); // 5 %
        config.setCapPerPersonNight(new BigDecimal("4.60"));
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        // total 300 / 3 nuits = 100/nuit ; /2 pers = 50 ; ×5% = 2.50 < cap 4.60
        Reservation reservation = createReservation(3, 2, "300.00");
        TouristTaxReportLineDto line = service.computeForReservation(reservation).orElseThrow();

        // 2.50 × 2 × 3 = 15.00
        assertEquals(0, new BigDecimal("15.00").compareTo(line.taxAmount()));
    }

    @Test
    void computeForReservation_percentage_capReached() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PERCENTAGE_OF_RATE);
        config.setPercentageRate(new BigDecimal("0.0500")); // 5 %
        config.setCapPerPersonNight(new BigDecimal("4.60"));
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        // total 1200 / 3 nuits = 400/nuit ; /2 pers = 200 ; ×5% = 10.00 > cap 4.60
        Reservation reservation = createReservation(3, 2, "1200.00");
        TouristTaxReportLineDto line = service.computeForReservation(reservation).orElseThrow();

        // 4.60 × 2 × 3 = 27.60
        assertEquals(0, new BigDecimal("27.60").compareTo(line.taxAmount()));
    }

    @Test
    void computeForReservation_surcharges_appliedOnBase() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        config.setRatePerPerson(new BigDecimal("2.50"));
        config.setDepartmentalSurchargePct(new BigDecimal("10"));
        config.setRegionalSurchargePct(new BigDecimal("200"));
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        Reservation reservation = createReservation(3, 2, "300.00");
        TouristTaxReportLineDto line = service.computeForReservation(reservation).orElseThrow();

        // base 15.00 ; surtaxes (10+200)% = 31.50 ; total 46.50
        assertEquals(0, new BigDecimal("15.00").compareTo(line.baseAmount()));
        assertEquals(0, new BigDecimal("31.50").compareTo(line.surchargeAmount()));
        assertEquals(0, new BigDecimal("46.50").compareTo(line.taxAmount()));
    }

    @Test
    void computeForReservation_exemptMinors_noEffectWithGuestCountOnly() {
        // v1 : Reservation ne porte que guestCount (pas de ventilation
        // adultes/enfants) → exemptMinors est documenté SANS EFFET : les
        // personnes taxables restent guestCount.
        TouristTaxConfig config = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        config.setRatePerPerson(new BigDecimal("1.00"));
        config.setExemptMinors(true);
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        Reservation reservation = createReservation(2, 4, "400.00");
        TouristTaxReportLineDto line = service.computeForReservation(reservation).orElseThrow();

        assertEquals(4, line.taxablePersons());
        assertEquals(0, new BigDecimal("8.00").compareTo(line.taxAmount()));
    }

    @Test
    void computeForReservation_rounding_halfUpTwoDecimals() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        config.setRatePerPerson(new BigDecimal("0.55"));
        config.setDepartmentalSurchargePct(new BigDecimal("10"));
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));

        // base 0.55 × 3 × 3 = 4.95 ; surtaxe 0.495 → 0.50 (HALF_UP) ; total 5.45
        Reservation reservation = createReservation(3, 3, "300.00");
        TouristTaxReportLineDto line = service.computeForReservation(reservation).orElseThrow();

        assertEquals(0, new BigDecimal("0.50").compareTo(line.surchargeAmount()));
        assertEquals(0, new BigDecimal("5.45").compareTo(line.taxAmount()));
    }

    @Test
    void computeForReservation_noApplicableConfig_returnsEmpty() {
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.empty());
        when(configRepository.findDefaultForOrg(ORG_ID)).thenReturn(Optional.empty());

        assertTrue(service.computeForReservation(createReservation(3, 2, "300.00")).isEmpty());
    }

    @Test
    void computeForReservation_zeroNights_returnsEmpty() {
        Reservation reservation = createReservation(0, 2, "0.00");

        assertTrue(service.computeForReservation(reservation).isEmpty());
    }

    // ─── computeForPeriod ────────────────────────────────────────────────────

    @Test
    void computeForPeriod_sumsLines_andCountsMissingConfigs() {
        TouristTaxConfig config = createConfig(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        config.setRatePerPerson(new BigDecimal("2.00"));
        when(configRepository.findByPropertyId(PROPERTY_ID, ORG_ID)).thenReturn(Optional.of(config));
        when(configRepository.findDefaultForOrg(ORG_ID)).thenReturn(Optional.empty());

        Reservation covered = createReservation(2, 2, "200.00");   // 2.00×2×2 = 8.00
        Reservation uncovered = createReservation(2, 2, "200.00");
        uncovered.setId(501L);
        Property other = new Property();
        other.setId(999L);
        other.setName("Sans barème");
        uncovered.setProperty(other);
        when(configRepository.findByPropertyId(999L, ORG_ID)).thenReturn(Optional.empty());

        LocalDate from = LocalDate.of(2026, 7, 1);
        LocalDate to = LocalDate.of(2026, 7, 31);
        when(reservationRepository.findConfirmedByCheckOutRange(from, to, ORG_ID))
            .thenReturn(List.of(covered, uncovered));

        TouristTaxReportDto report = service.computeForPeriod(ORG_ID, from, to);

        assertEquals(1, report.reservationCount());
        assertEquals(1, report.missingConfigCount());
        assertEquals(0, new BigDecimal("8.00").compareTo(report.totalTax()));
    }

    @Test
    void computeForPeriod_invalidRange_throws() {
        assertThrows(IllegalArgumentException.class, () ->
            service.computeForPeriod(ORG_ID, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 7, 1)));
        verifyNoInteractions(reservationRepository);
    }

    // ─── computeForReservationId (tool assistant) ────────────────────────────

    @Test
    void computeForReservationId_otherOrg_treatedAsNotFound() {
        Reservation reservation = createReservation(3, 2, "300.00");
        reservation.setOrganizationId(2L); // autre org
        when(reservationRepository.findById(500L)).thenReturn(Optional.of(reservation));

        assertTrue(service.computeForReservationId(500L, ORG_ID).isEmpty());
        verifyNoInteractions(configRepository);
    }

    // ─── deleteConfig ────────────────────────────────────────────────────────

    @Test
    void deleteConfig_otherOrg_throws() {
        when(configRepository.findByIdAndOrganizationId(7L, ORG_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.deleteConfig(7L, ORG_ID));
        verify(configRepository, never()).delete(any());
    }
}
