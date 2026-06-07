package com.clenzy.service;

import com.clenzy.config.GuideConfig;
import com.clenzy.dto.WelcomeGuidePublicDto;
import com.clenzy.model.*;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
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
    @Mock private PropertyRepository propertyRepository;
    @Mock private CheckInInstructionsRepository checkInInstructionsRepository;
    @Mock private GuideConfig guideConfig;
    @Mock private com.clenzy.service.access.AccessCodeResolverService accessCodeResolverService;
    @Mock private OnlineCheckInService onlineCheckInService;

    private WelcomeGuideService service;

    @BeforeEach
    void setUp() {
        service = new WelcomeGuideService(guideRepository, tokenRepository, propertyRepository,
            checkInInstructionsRepository, guideConfig, accessCodeResolverService, onlineCheckInService);
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

        WelcomeGuide result = service.createGuide(1L, 10L, "Guide Riviera",
            "fr", "[{\"type\":\"text\",\"title\":\"WiFi\"}]", "#FF0000", null, true, true, true, null, null);

        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getTitle()).isEqualTo("Guide Riviera");
        verify(guideRepository).save(any());
    }

    @Test
    void createGuide_propertyNotFound_throws() {
        when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createGuide(1L, 999L, "Test", null, null, null, null, null, null, null, null, null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateGuide_updatesFields() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(1L);
        guide.setTitle("Old Title");
        guide.setPublished(false);

        when(guideRepository.findByIdAndOrganizationId(1L, 1L)).thenReturn(Optional.of(guide));
        when(guideRepository.save(any())).thenReturn(guide);

        WelcomeGuide result = service.updateGuide(1L, 1L, "New Title",
            "[{\"type\":\"info\"}]", "#0000FF", null, true, null, null, null, null, null);

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
    void deleteGuide_existingGuide_deletes() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(1L);
        when(guideRepository.findByIdAndOrganizationId(1L, 1L)).thenReturn(Optional.of(guide));

        service.deleteGuide(1L, 1L);

        verify(guideRepository).delete(guide);
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
