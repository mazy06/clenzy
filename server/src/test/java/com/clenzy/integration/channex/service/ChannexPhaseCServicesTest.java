package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Phase C — applications (C1), availability rules par canal (C3),
 * Google readiness (C4), reporting Booking.com (C5).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Channex Phase C services")
class ChannexPhaseCServicesTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Mock private ChannexClient channexClient;
    @Mock private ChannexPropertyMappingRepository mappingRepository;

    private ChannexPropertyMapping mapping;

    @BeforeEach
    void setUp() {
        mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setOrganizationId(42L);
        mapping.setClenzyPropertyId(100L);
        mapping.setChannexPropertyId("chx-1");
        mapping.setChannexRoomTypeId("rt-1");
        mapping.setChannexDefaultRatePlanId("rp-1");
    }

    private static JsonNode json(String content) {
        try {
            return JSON.readTree(content);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Nested
    @DisplayName("C1 — ChannexApplicationsService")
    class Applications {

        @Test
        @DisplayName("listInstalled filtre sur la property Channex mappee")
        void listInstalledFiltersByProperty() {
            var service = new ChannexApplicationsService(channexClient, mappingRepository);
            when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
            when(channexClient.listInstalledApplications()).thenReturn(List.of(
                json("{\"id\":\"inst-1\",\"attributes\":{\"property_id\":\"chx-1\",\"application_code\":\"booking_crs\"}}"),
                json("{\"id\":\"inst-2\",\"attributes\":{\"property_id\":\"chx-OTHER\",\"application_code\":\"channex_messages\"}}")
            ));

            var installed = service.listInstalled(100L, 42L);

            assertThat(installed).hasSize(1);
            assertThat(installed.get(0).code()).isEqualTo("booking_crs");
            assertThat(installed.get(0).installationId()).isEqualTo("inst-1");
        }

        @Test
        @DisplayName("uninstall d'une installation etrangere -> AccessDeniedException")
        void uninstallForeignInstallationDenied() {
            var service = new ChannexApplicationsService(channexClient, mappingRepository);
            when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
            when(channexClient.listInstalledApplications()).thenReturn(List.of(
                json("{\"id\":\"inst-2\",\"attributes\":{\"property_id\":\"chx-OTHER\",\"application_code\":\"x\"}}")
            ));

            assertThatThrownBy(() -> service.uninstall(100L, 42L, "inst-2"))
                .isInstanceOf(AccessDeniedException.class);
            verify(channexClient, never()).uninstallApplication(anyString());
        }

        @Test
        @DisplayName("install passe par la property Channex du mapping")
        void installUsesMappedProperty() {
            var service = new ChannexApplicationsService(channexClient, mappingRepository);
            when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
            when(channexClient.installApplication("chx-1", "booking_crs")).thenReturn("inst-9");

            String id = service.install(100L, 42L, "booking_crs");

            assertThat(id).isEqualTo("inst-9");
        }
    }

    @Nested
    @DisplayName("C3 — ChannexAvailabilityRuleService")
    class AvailabilityRules {

        @Test
        @DisplayName("closeChannels construit un close_out sur le room type mappe")
        void closeChannelsBuildsCloseOut() {
            var service = new ChannexAvailabilityRuleService(channexClient, mappingRepository);
            when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
            when(channexClient.createChannelAvailabilityRule(any())).thenReturn("rule-1");

            String ruleId = service.closeChannels(100L, 42L,
                new ChannexAvailabilityRuleService.CloseChannelRequest(
                    "Coupure Airbnb", List.of("channel-abb"),
                    LocalDate.of(2026, 12, 24), LocalDate.of(2026, 12, 26), null));

            assertThat(ruleId).isEqualTo("rule-1");
            @SuppressWarnings("unchecked")
            ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
            verify(channexClient).createChannelAvailabilityRule(captor.capture());
            assertThat(captor.getValue())
                .containsEntry("type", "close_out")
                .containsEntry("property_id", "chx-1")
                .containsEntry("affected_channels", List.of("channel-abb"))
                .containsEntry("affected_room_types", List.of("rt-1"))
                .containsEntry("start_date", "2026-12-24")
                .containsEntry("end_date", "2026-12-26");
        }

        @Test
        @DisplayName("closeChannels sans canal -> IllegalArgumentException")
        void closeChannelsRequiresChannels() {
            var service = new ChannexAvailabilityRuleService(channexClient, mappingRepository);

            assertThatThrownBy(() -> service.closeChannels(100L, 42L,
                new ChannexAvailabilityRuleService.CloseChannelRequest(
                    null, List.of(), LocalDate.now(), LocalDate.now().plusDays(1), null)))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("deleteRule d'une regle etrangere -> AccessDeniedException")
        void deleteForeignRuleDenied() {
            var service = new ChannexAvailabilityRuleService(channexClient, mappingRepository);
            when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
            when(channexClient.listChannelAvailabilityRules("chx-1")).thenReturn(List.of());

            assertThatThrownBy(() -> service.deleteRule(100L, 42L, "rule-foreign"))
                .isInstanceOf(AccessDeniedException.class);
            verify(channexClient, never()).deleteChannelAvailabilityRule(anyString());
        }
    }

    @Nested
    @DisplayName("C4 — ChannexGoogleReadinessService")
    class GoogleReadiness {

        @Mock private PropertyRepository propertyRepository;
        @Mock private PropertyPhotoRepository photoRepository;

        @Test
        @DisplayName("propriete complete + 8 photos Channex -> checks auto OK, manuels listes")
        void completePropertyPassesAutoChecks() {
            var service = new ChannexGoogleReadinessService(mappingRepository,
                propertyRepository, photoRepository, channexClient);

            Property property = new Property();
            property.setId(100L);
            property.setOrganizationId(42L);
            property.setCountryCode("MA");
            property.setAddress("12 rue Exemple");
            property.setCity("Marrakech");
            property.setPostalCode("40000");
            property.setTimezone("Africa/Casablanca");
            property.setLatitude(new BigDecimal("31.62"));
            property.setLongitude(new BigDecimal("-7.98"));
            property.setDescription("Bel appartement");
            com.clenzy.model.User owner = new com.clenzy.model.User();
            owner.setPhoneNumber("+212600000000");
            property.setOwner(owner);

            when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
            when(photoRepository.findByPropertyIdOrderBySortOrderAsc(100L)).thenReturn(List.of());
            when(channexClient.fetchPhotosForProperty("chx-1")).thenReturn(
                java.util.Collections.nCopies(8,
                    new com.clenzy.integration.channex.dto.ChannexPhotoDto(
                        "p", "https://x/p.jpg", 1, null, "photo", "chx-1", null)));

            var report = service.check(100L, 42L);

            assertThat(report.readyAutoChecks()).isTrue();
            assertThat(report.checks()).anyMatch(c -> c.code().equals("photos_min_8") && c.ok());
            assertThat(report.checks()).anyMatch(c -> c.code().equals("channel_counts") && c.manual());
        }

        @Test
        @DisplayName("geo manquante -> readyAutoChecks=false")
        void missingGeoFails() {
            var service = new ChannexGoogleReadinessService(mappingRepository,
                propertyRepository, photoRepository, channexClient);

            Property property = new Property();
            property.setId(100L);
            property.setOrganizationId(42L);
            property.setCountryCode("FR");

            when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
            when(photoRepository.findByPropertyIdOrderBySortOrderAsc(100L)).thenReturn(List.of());
            when(channexClient.fetchPhotosForProperty("chx-1")).thenReturn(List.of());

            var report = service.check(100L, 42L);

            assertThat(report.readyAutoChecks()).isFalse();
            assertThat(report.checks()).anyMatch(c -> c.code().equals("geo") && !c.ok());
        }
    }

    @Nested
    @DisplayName("C5 — ChannexBookingReportingService")
    class Reporting {

        @Mock private ReservationRepository reservationRepository;

        private Reservation channexReservation() {
            Property property = new Property();
            property.setId(100L);
            property.setOrganizationId(42L);
            Reservation r = new Reservation();
            r.setId(555L);
            r.setOrganizationId(42L);
            r.setProperty(property);
            r.setExternalUid("channex:booking-bdc-1");
            return r;
        }

        @Test
        @DisplayName("no-show : resolution du booking Channex depuis externalUid + appel")
        void noShowResolvesBookingId() {
            var service = new ChannexBookingReportingService(channexClient, reservationRepository);
            when(reservationRepository.findById(555L)).thenReturn(Optional.of(channexReservation()));

            var result = service.reportNoShow(555L, 42L, true);

            assertThat(result.channexBookingId()).isEqualTo("booking-bdc-1");
            verify(channexClient).reportNoShow("booking-bdc-1", true);
        }

        @Test
        @DisplayName("resa NON Channex (directe) -> IllegalStateException, aucun appel")
        void directReservationRejected() {
            var service = new ChannexBookingReportingService(channexClient, reservationRepository);
            Reservation direct = channexReservation();
            direct.setExternalUid(null);
            when(reservationRepository.findById(555L)).thenReturn(Optional.of(direct));

            assertThatThrownBy(() -> service.reportInvalidCard(555L, 42L))
                .isInstanceOf(IllegalStateException.class);
            verify(channexClient, never()).reportInvalidCard(anyString());
        }

        @Test
        @DisplayName("resa d'une autre org -> AccessDeniedException (audit n°3)")
        void crossOrgDenied() {
            var service = new ChannexBookingReportingService(channexClient, reservationRepository);
            when(reservationRepository.findById(555L)).thenReturn(Optional.of(channexReservation()));

            assertThatThrownBy(() -> service.cancelDueInvalidCard(555L, 999L))
                .isInstanceOf(AccessDeniedException.class);
            verify(channexClient, never()).cancelDueInvalidCard(anyString());
        }
    }
}
