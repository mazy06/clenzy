package com.clenzy.service;

import com.clenzy.config.GuideConfig;
import com.clenzy.dto.WelcomeGuidePublicDto;
import com.clenzy.dto.WelcomeGuideRequest;
import com.clenzy.model.*;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.WelcomeGuideEntryRepository;
import com.clenzy.repository.WelcomeGuideEventRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import org.springframework.data.domain.Sort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WelcomeGuideServiceTest {

    @Mock private WelcomeGuideRepository guideRepository;
    @Mock private WelcomeGuideTokenRepository tokenRepository;
    @Mock private WelcomeGuideEntryRepository entryRepository;
    @Mock private WelcomeGuideEventRepository eventRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private com.clenzy.repository.ReservationRepository reservationRepository;
    @Mock private CheckInInstructionsRepository checkInInstructionsRepository;
    @Mock private GuideConfig guideConfig;
    @Mock private com.clenzy.service.access.AccessCodeResolverService accessCodeResolverService;
    @Mock private OnlineCheckInService onlineCheckInService;
    @Mock private PhotoStorageService photoStorageService;
    @Mock private PropertyPhotoRepository propertyPhotoRepository;
    @Mock private com.clenzy.repository.ActivityAffiliateConfigRepository activityAffiliateConfigRepository;

    private WelcomeGuideService service;

    @BeforeEach
    void setUp() {
        service = new WelcomeGuideService(guideRepository, tokenRepository, entryRepository, eventRepository,
            propertyRepository, reservationRepository, checkInInstructionsRepository, guideConfig, accessCodeResolverService,
            onlineCheckInService, photoStorageService, propertyPhotoRepository, activityAffiliateConfigRepository,
            java.util.List.of());
    }

    @Test
    void createGuide_validInput_createsGuide() {
        Property property = new Property();
        property.setId(10L);
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

        WelcomeGuide saved = new WelcomeGuide();
        saved.setId(1L);
        saved.setProperty(property);
        saved.setTitle("Guide Riviera");
        when(guideRepository.save(any())).thenReturn(saved);
        com.clenzy.model.Reservation reservation = new com.clenzy.model.Reservation();
        when(reservationRepository.findCurrentOrNextByPropertyId(any(), any(), any()))
            .thenReturn(java.util.List.of(reservation));
        when(guideRepository.findByReservationId(any())).thenReturn(Optional.empty());

        WelcomeGuide result = service.createGuide(1L, new WelcomeGuideRequest(
            10L, "Guide Riviera", "fr", "[{\"type\":\"text\",\"title\":\"WiFi\"}]",
            "#FF0000", null, null, null, null, null, null, true, true, true, null, null, null, null), false);

        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getTitle()).isEqualTo("Guide Riviera");
        verify(guideRepository).save(any());
    }

    @Test
    void createGuide_propertyNotFound_throws() {
        when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createGuide(1L, new WelcomeGuideRequest(
            999L, "Test", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null), false))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createGuide_staffNullOrg_usesPropertyOrganization() {
        Property property = new Property();
        property.setId(10L);
        property.setOrganizationId(7L);
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
        when(guideRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        com.clenzy.model.Reservation reservation = new com.clenzy.model.Reservation();
        when(reservationRepository.findCurrentOrNextByPropertyId(any(), any(), any()))
            .thenReturn(java.util.List.of(reservation));
        when(guideRepository.findByReservationId(any())).thenReturn(Optional.empty());

        // Staff plateforme : contexte org null → l'org doit etre derivee du logement.
        WelcomeGuide result = service.createGuide(null, new WelcomeGuideRequest(
            10L, "Guide", "fr", "[]", null, null, null, null, null, null, null, null, null, null, null, null, null, null), false);

        assertThat(result.getOrganizationId()).isEqualTo(7L);
    }

    @Test
    void createGuide_propertyOrganizationWinsOverContext() {
        Property property = new Property();
        property.setId(10L);
        property.setOrganizationId(7L);
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
        when(guideRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        com.clenzy.model.Reservation reservation = new com.clenzy.model.Reservation();
        when(reservationRepository.findCurrentOrNextByPropertyId(any(), any(), any()))
            .thenReturn(java.util.List.of(reservation));
        when(guideRepository.findByReservationId(any())).thenReturn(Optional.empty());
        WelcomeGuide result = service.createGuide(99L, new WelcomeGuideRequest(
            10L, "Guide", "fr", "[]", null, null, null, null, null, null, null, null, null, null, null, null, null, null), false);

        assertThat(result.getOrganizationId()).isEqualTo(7L);
    }

    @Test
    void getPropertyPreviewData_hostOrgMatches_returnsData() {
        Property property = new Property();
        property.setId(10L);
        property.setOrganizationId(7L);
        property.setName("Le Loft");
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
        when(checkInInstructionsRepository.findByPropertyId(10L)).thenReturn(Optional.empty());

        var result = service.getPropertyPreviewData(10L, 7L);

        assertThat(result).isPresent();
        assertThat(result.get().property().name()).isEqualTo("Le Loft");
    }

    @Test
    void getPropertyPreviewData_hostOrgMismatch_returnsEmpty() {
        // Sécurité : un hôte ne doit jamais voir le logement (wifi/digicode) d'une autre org.
        Property property = new Property();
        property.setId(10L);
        property.setOrganizationId(7L);
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

        var result = service.getPropertyPreviewData(10L, 99L);

        assertThat(result).isEmpty();
    }

    @Test
    void getPropertyPreviewData_staffNullOrg_returnsCrossOrg() {
        Property property = new Property();
        property.setId(10L);
        property.setOrganizationId(7L);
        property.setName("Le Loft");
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
        when(checkInInstructionsRepository.findByPropertyId(10L)).thenReturn(Optional.empty());

        var result = service.getPropertyPreviewData(10L, null);

        assertThat(result).isPresent();
    }

    @Test
    void getAll_staffNullOrg_returnsAllGuidesCrossOrg() {
        when(guideRepository.findAll(any(Sort.class))).thenReturn(List.of(new WelcomeGuide()));

        List<WelcomeGuide> result = service.getAll(null);

        assertThat(result).hasSize(1);
        verify(guideRepository).findAll(any(Sort.class));
        verify(guideRepository, never()).findByOrganizationIdOrderByCreatedAtDesc(any());
    }

    @Test
    void getById_staffNullOrg_findsByIdCrossOrg() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(5L);
        when(guideRepository.findById(5L)).thenReturn(Optional.of(guide));

        Optional<WelcomeGuide> result = service.getById(5L, null);

        assertThat(result).isPresent();
        verify(guideRepository).findById(5L);
        verify(guideRepository, never()).findByIdAndOrganizationId(any(), any());
    }

    @Test
    void generateToken_staffNullOrg_usesGuideOrganization() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(1L);
        guide.setOrganizationId(3L);
        when(guideRepository.findById(1L)).thenReturn(Optional.of(guide));
        when(guideConfig.getManualTtlDays()).thenReturn(60);
        when(tokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Staff plateforme : orgId de contexte null → le token doit prendre l'org du livret (non-null).
        WelcomeGuideToken token = service.generateToken(1L, null, null);

        assertThat(token.getOrganizationId()).isEqualTo(3L);
    }

    @Test
    void getAccessPhotoBytes_keyInArrivalPhotos_returnsBytes() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setPublished(true);
        Property prop = new Property();
        prop.setId(1L);
        guide.setProperty(prop);
        WelcomeGuideToken tok = new WelcomeGuideToken();
        tok.setGuide(guide);
        tok.setExpiresAt(LocalDateTime.now().plusDays(1)); // valide (non revoque, sans resa)
        UUID token = UUID.randomUUID();
        when(tokenRepository.findByToken(token)).thenReturn(Optional.of(tok));
        CheckInInstructions ci = new CheckInInstructions();
        ci.setArrivalPhotos("[{\"key\":\"abc\",\"caption\":\"\"}]");
        when(checkInInstructionsRepository.findByPropertyId(1L)).thenReturn(Optional.of(ci));
        when(photoStorageService.retrieve("abc")).thenReturn(new byte[]{1, 2, 3});

        Optional<byte[]> result = service.getAccessPhotoBytes(token, "abc");

        assertThat(result).isPresent();
        assertThat(result.get()).hasSize(3);
    }

    @Test
    void getAccessPhotoBytes_keyNotInArrivalPhotos_returnsEmpty() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setPublished(true);
        Property prop = new Property();
        prop.setId(1L);
        guide.setProperty(prop);
        WelcomeGuideToken tok = new WelcomeGuideToken();
        tok.setGuide(guide);
        tok.setExpiresAt(LocalDateTime.now().plusDays(1));
        UUID token = UUID.randomUUID();
        when(tokenRepository.findByToken(token)).thenReturn(Optional.of(tok));
        CheckInInstructions ci = new CheckInInstructions();
        ci.setArrivalPhotos("[]"); // la cle n'appartient pas a ce livret
        when(checkInInstructionsRepository.findByPropertyId(1L)).thenReturn(Optional.of(ci));

        Optional<byte[]> result = service.getAccessPhotoBytes(token, "abc");

        assertThat(result).isEmpty();
        verify(photoStorageService, never()).retrieve(any());
    }

    @Test
    void updateGuide_updatesFields() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(1L);
        guide.setTitle("Old Title");
        guide.setPublished(false);

        when(guideRepository.findByIdAndOrganizationId(1L, 1L)).thenReturn(Optional.of(guide));
        when(guideRepository.save(any())).thenReturn(guide);

        WelcomeGuide result = service.updateGuide(1L, 1L, new WelcomeGuideRequest(
            null, "New Title", null, "[{\"type\":\"info\"}]", "#0000FF", null, null, null, null, null, true, null, null, null, null, null, null, null));

        assertThat(result.getTitle()).isEqualTo("New Title");
        assertThat(result.isPublished()).isTrue();
    }

    @Test
    void generateToken_noReservation_usesManualTtl() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(1L);
        when(guideRepository.findByIdAndOrganizationId(1L, 1L)).thenReturn(Optional.of(guide));
        when(guideConfig.getManualTtlDays()).thenReturn(60);
        when(tokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        WelcomeGuideToken result = service.generateToken(1L, 1L, null);

        assertThat(result.getGuide()).isEqualTo(guide);
        assertThat(result.getValidFrom()).isNotNull();
        assertThat(result.getExpiresAt()).isEqualTo(result.getValidFrom().plusDays(60));
        verify(tokenRepository).save(any());
    }

    @Test
    void generateToken_withReservation_bindsWindowToStayDates() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(1L);
        when(guideRepository.findByIdAndOrganizationId(1L, 1L)).thenReturn(Optional.of(guide));
        when(guideConfig.getLeadDays()).thenReturn(7);
        when(guideConfig.getGraceDays()).thenReturn(1);
        when(tokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Reservation reservation = new Reservation();
        reservation.setCheckIn(LocalDate.of(2026, 7, 10));
        reservation.setCheckOut(LocalDate.of(2026, 7, 17));

        WelcomeGuideToken result = service.generateToken(1L, 1L, reservation);

        assertThat(result.getValidFrom())
            .isEqualTo(LocalDate.of(2026, 7, 10).atStartOfDay().minusDays(7));
        assertThat(result.getExpiresAt())
            .isEqualTo(LocalDate.of(2026, 7, 17).atTime(LocalTime.MAX).plusDays(1));
        assertThat(result.isRevoked()).isFalse();
    }

    @Test
    void getPublicGuidePayload_validPublishedToken_returnsPayload() {
        UUID tokenValue = UUID.randomUUID();
        Property property = new Property();
        property.setId(99L);

        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(1L);
        guide.setTitle("Public Guide");
        guide.setProperty(property);
        guide.setPublished(true);
        Reservation reservation = new Reservation();
        reservation.setCheckOut(LocalDate.now().plusDays(3)); // séjour à venir → disponible
        guide.setReservation(reservation);

        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setToken(tokenValue);
        token.setGuide(guide);
        token.setExpiresAt(LocalDateTime.now().plusDays(3));

        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));
        when(checkInInstructionsRepository.findByPropertyId(99L)).thenReturn(Optional.empty());

        Optional<WelcomeGuidePublicDto> result = service.getPublicGuidePayload(tokenValue);

        assertThat(result).isPresent();
        assertThat(result.get().title()).isEqualTo("Public Guide");
        assertThat(result.get().practical()).isNull();
    }

    @Test
    void getPublicGuidePayload_expiredToken_returnsEmpty() {
        UUID tokenValue = UUID.randomUUID();
        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setToken(tokenValue);
        token.setExpiresAt(LocalDateTime.now().minusDays(1));

        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));

        assertThat(service.getPublicGuidePayload(tokenValue)).isEmpty();
    }

    @Test
    void getPublicGuidePayload_revokedToken_returnsEmpty() {
        UUID tokenValue = UUID.randomUUID();
        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setToken(tokenValue);
        token.setExpiresAt(LocalDateTime.now().plusDays(3));
        token.setRevoked(true);

        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));

        assertThat(service.getPublicGuidePayload(tokenValue)).isEmpty();
    }

    @Test
    void getPublicGuidePayload_unpublishedGuide_returnsEmpty() {
        UUID tokenValue = UUID.randomUUID();
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(1L);
        guide.setPublished(false);

        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setToken(tokenValue);
        token.setGuide(guide);
        token.setExpiresAt(LocalDateTime.now().plusDays(3));

        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));

        assertThat(service.getPublicGuidePayload(tokenValue)).isEmpty();
    }

    @Test
    void generateQrCode_returnsBytes() {
        byte[] qrCode = service.generateQrCode("https://app.clenzy.fr/guide/test", 200, 200);

        assertThat(qrCode).isNotNull();
        assertThat(qrCode.length).isGreaterThan(0);
        // PNG magic number: 0x89504E47
        assertThat(qrCode[0] & 0xFF).isEqualTo(0x89);
        assertThat(qrCode[1] & 0xFF).isEqualTo(0x50);
    }

    @Test
    void deleteGuide_existingGuide_deletesChildrenThenGuide() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(1L);
        when(guideRepository.findByIdAndOrganizationId(1L, 1L)).thenReturn(Optional.of(guide));

        service.deleteGuide(1L, 1L);

        // Les enfants (tokens, livre d'or, events) doivent etre purges AVANT le livret,
        // sinon la FK welcome_guide_tokens.guide_id bloque le DELETE (regression prod).
        var inOrder = inOrder(tokenRepository, entryRepository, eventRepository, guideRepository);
        inOrder.verify(tokenRepository).deleteByGuideId(1L);
        inOrder.verify(entryRepository).deleteByGuideId(1L);
        inOrder.verify(eventRepository).deleteByGuideId(1L);
        inOrder.verify(guideRepository).delete(guide);
    }

    @Test
    void getAll_returnsListForOrg() {
        WelcomeGuide g1 = new WelcomeGuide();
        g1.setId(1L);
        WelcomeGuide g2 = new WelcomeGuide();
        g2.setId(2L);
        when(guideRepository.findByOrganizationIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(g1, g2));

        List<WelcomeGuide> result = service.getAll(1L);

        assertThat(result).hasSize(2);
    }

    @Test
    void linkForReservation_publishedGuide_returnsLink() {
        Property property = new Property();
        property.setId(50L);

        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(3L);
        guide.setOrganizationId(1L);
        guide.setProperty(property);
        guide.setPublished(true);

        Guest guest = new Guest();
        guest.setLanguage("fr");

        Reservation reservation = new Reservation();
        reservation.setId(200L);
        reservation.setOrganizationId(1L);
        reservation.setProperty(property);
        reservation.setGuest(guest);

        when(guideRepository.findByPropertyIdAndLanguage(50L, "fr")).thenReturn(Optional.of(guide));
        when(tokenRepository.findByReservationId(200L)).thenReturn(List.of());
        when(guideConfig.getManualTtlDays()).thenReturn(60);
        when(guideConfig.getBaseUrl()).thenReturn("https://app.clenzy.fr/guide");
        when(tokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Optional<String> link = service.linkForReservation(reservation);

        assertThat(link).isPresent();
        assertThat(link.get()).startsWith("https://app.clenzy.fr/guide/");
    }

    @Test
    void linkForReservation_noPublishedGuide_returnsEmpty() {
        Property property = new Property();
        property.setId(50L);

        Reservation reservation = new Reservation();
        reservation.setId(200L);
        reservation.setOrganizationId(1L);
        reservation.setProperty(property);

        when(guideRepository.findByPropertyIdAndLanguage(50L, "fr")).thenReturn(Optional.empty());
        when(guideRepository.findByPropertyIdAndOrganizationId(50L, 1L)).thenReturn(List.of());

        assertThat(service.linkForReservation(reservation)).isEmpty();
    }

    @Test
    void getPublicGuidePayload_withDynamicAccessCode_overridesStatic() {
        UUID tokenValue = UUID.randomUUID();
        Property property = new Property();
        property.setId(99L);

        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(1L);
        guide.setTitle("Public Guide");
        guide.setProperty(property);
        guide.setPublished(true);

        Reservation reservation = new Reservation();
        reservation.setId(500L);
        guide.setReservation(reservation);

        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setToken(tokenValue);
        token.setGuide(guide);
        token.setReservation(reservation);
        token.setExpiresAt(LocalDateTime.now().plusDays(3));

        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));
        when(checkInInstructionsRepository.findByPropertyId(99L)).thenReturn(Optional.empty());
        when(accessCodeResolverService.existingAccessCode(500L)).thenReturn(Optional.of("482913"));

        Optional<WelcomeGuidePublicDto> result = service.getPublicGuidePayload(tokenValue);

        assertThat(result).isPresent();
        assertThat(result.get().practical()).isNotNull();
        assertThat(result.get().practical().accessCode()).isEqualTo("482913");
    }

    @Test
    void reviewLinkForReservation_publishedGuide_returnsLink() {
        Property property = new Property();
        property.setId(50L);

        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(3L);
        guide.setOrganizationId(1L);
        guide.setProperty(property);
        guide.setPublished(true);

        Reservation reservation = new Reservation();
        reservation.setId(200L);
        reservation.setOrganizationId(1L);
        reservation.setProperty(property);
        reservation.setCheckOut(LocalDate.of(2026, 7, 17));

        when(guideRepository.findByPropertyIdAndLanguage(50L, "fr")).thenReturn(Optional.of(guide));
        when(guideConfig.getReviewWindowDays()).thenReturn(14);
        when(guideConfig.getBaseUrl()).thenReturn("https://app.clenzy.fr/guide");
        when(tokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Optional<String> link = service.reviewLinkForReservation(reservation);

        assertThat(link).isPresent();
        assertThat(link.get()).startsWith("https://app.clenzy.fr/guide/");
    }
}
