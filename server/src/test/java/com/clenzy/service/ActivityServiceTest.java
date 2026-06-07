package com.clenzy.service;

import com.clenzy.dto.ActivityDto;
import com.clenzy.integration.activities.ActivityCatalogClient;
import com.clenzy.model.ActivityAffiliateConfig;
import com.clenzy.model.ActivityProvider;
import com.clenzy.model.Property;
import com.clenzy.model.WelcomeGuide;
import com.clenzy.model.WelcomeGuideToken;
import com.clenzy.repository.ActivityAffiliateConfigRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivityServiceTest {

    @Mock private WelcomeGuideTokenRepository tokenRepository;
    @Mock private ActivityAffiliateConfigRepository configRepository;
    @Mock private ActivityCatalogClient viatorClient;

    private ActivityService service;

    @BeforeEach
    void setUp() {
        when(viatorClient.provider()).thenReturn(ActivityProvider.VIATOR);
        service = new ActivityService(tokenRepository, configRepository, List.of(viatorClient));
    }

    private WelcomeGuideToken validToken() {
        Property property = new Property();
        property.setId(5L);
        property.setLatitude(new BigDecimal("48.85"));
        property.setLongitude(new BigDecimal("2.35"));
        property.setCity("Paris");

        WelcomeGuide guide = new WelcomeGuide();
        guide.setOrganizationId(1L);
        guide.setProperty(property);
        guide.setLanguage("fr");

        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setGuide(guide);
        token.setExpiresAt(LocalDateTime.now().plusDays(1));
        return token;
    }

    @Test
    void searchForGuide_enabledProvider_returnsActivities() {
        UUID t = UUID.randomUUID();
        ActivityAffiliateConfig config = new ActivityAffiliateConfig();
        config.setOrganizationId(1L);
        config.setProvider(ActivityProvider.VIATOR);
        config.setEnabled(true);

        when(tokenRepository.findByToken(t)).thenReturn(Optional.of(validToken()));
        when(configRepository.findByOrganizationIdAndEnabledTrue(1L)).thenReturn(List.of(config));
        when(viatorClient.search(any(), eq(config))).thenReturn(List.of(
            new ActivityDto("VIATOR", "Tour Eiffel", "img", "25", "EUR", 4.5, 1200, "2h", "https://book")));

        List<ActivityDto> result = service.searchForGuide(t, 12);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).title()).isEqualTo("Tour Eiffel");
    }

    @Test
    void searchForGuide_invalidToken_returnsEmpty() {
        UUID t = UUID.randomUUID();
        when(tokenRepository.findByToken(t)).thenReturn(Optional.empty());

        assertThat(service.searchForGuide(t, 12)).isEmpty();
    }

    @Test
    void searchForGuide_noEnabledProvider_returnsEmpty() {
        UUID t = UUID.randomUUID();
        when(tokenRepository.findByToken(t)).thenReturn(Optional.of(validToken()));
        when(configRepository.findByOrganizationIdAndEnabledTrue(1L)).thenReturn(List.of());

        assertThat(service.searchForGuide(t, 12)).isEmpty();
    }
}
