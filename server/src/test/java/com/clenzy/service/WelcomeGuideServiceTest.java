package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
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

    private WelcomeGuideService service;

    @BeforeEach
    void setUp() {
        service = new WelcomeGuideService(guideRepository, tokenRepository, propertyRepository);
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
            "fr", "[{\"type\":\"text\",\"title\":\"WiFi\"}]", "#FF0000", null);

        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getTitle()).isEqualTo("Guide Riviera");
        verify(guideRepository).save(any());
    }

    @Test
    void createGuide_propertyNotFound_throws() {
        when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createGuide(1L, 999L, "Test", null, null, null, null))
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
            "[{\"type\":\"info\"}]", "#0000FF", null, true);

        assertThat(result.getTitle()).isEqualTo("New Title");
        assertThat(result.isPublished()).isTrue();
    }

    @Test
    void generateToken_createsTokenWithExpiry() {
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(1L);
        when(guideRepository.findByIdAndOrganizationId(1L, 1L)).thenReturn(Optional.of(guide));

        WelcomeGuideToken savedToken = new WelcomeGuideToken();
        savedToken.setId(10L);
        savedToken.setToken(UUID.randomUUID());
        savedToken.setGuide(guide);
        savedToken.setExpiresAt(LocalDateTime.now().plusDays(60));
        when(tokenRepository.save(any())).thenReturn(savedToken);

        WelcomeGuideToken result = service.generateToken(1L, 1L, null);

        assertThat(result.getId()).isEqualTo(10L);
        assertThat(result.getGuide()).isEqualTo(guide);
        verify(tokenRepository).save(any());
    }

    @Test
    void getPublicGuide_validToken_returnsGuide() {
        UUID tokenValue = UUID.randomUUID();
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(1L);
        guide.setTitle("Public Guide");

        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setToken(tokenValue);
        token.setGuide(guide);
        token.setExpiresAt(LocalDateTime.now().plusDays(30));

        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));

        Optional<WelcomeGuide> result = service.getPublicGuide(tokenValue);

        assertThat(result).isPresent();
        assertThat(result.get().getTitle()).isEqualTo("Public Guide");
    }

    @Test
    void getPublicGuide_expiredToken_returnsEmpty() {
        UUID tokenValue = UUID.randomUUID();
        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setToken(tokenValue);
        token.setExpiresAt(LocalDateTime.now().minusDays(1));

        when(tokenRepository.findByToken(tokenValue)).thenReturn(Optional.of(token));

        Optional<WelcomeGuide> result = service.getPublicGuide(tokenValue);

        assertThat(result).isEmpty();
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
}
