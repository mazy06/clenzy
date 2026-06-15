package com.clenzy.booking.service;

import com.clenzy.booking.dto.GeneratedContentDto;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.model.AiFeature;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.AiKeyResolver.KeySource;
import com.clenzy.service.AiKeyResolver.ResolvedKey;
import com.clenzy.service.AiProviderRouter;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.service.AiTokenBudgetService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Génération IA de contenu booking (CLZ Domaine 2) : gating/budget/usage, ownership org,
 * langue fr/en/ar, parsing du format SEO.
 */
@ExtendWith(MockitoExtension.class)
class PropertyContentAiServiceTest {

    @Mock private PropertyRepository propertyRepository;
    @Mock private TenantContext tenantContext;
    @Mock private AiProviderRouter aiProviderRouter;
    @Mock private AiTokenBudgetService tokenBudgetService;

    private PropertyContentAiService service;

    private static final Long ORG = 1L;
    private static final Long PID = 7L;

    @BeforeEach
    void setUp() {
        service = new PropertyContentAiService(propertyRepository, tenantContext, aiProviderRouter, tokenBudgetService);
        lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG);
    }

    private Property property(Long orgId) {
        Property p = new Property();
        p.setId(PID);
        p.setOrganizationId(orgId);
        p.setName("Villa Atlas");
        p.setCity("Marrakech");
        p.setCountry("MA");
        p.setBedroomCount(3);
        p.setMaxGuests(6);
        return p;
    }

    private void stubLlm(String content) {
        when(aiProviderRouter.resolveKey(eq(ORG), any(), eq(AiFeature.CONTENT)))
            .thenReturn(new ResolvedKey("k", null, KeySource.PLATFORM));
        when(aiProviderRouter.route(eq(ORG), any(), eq(AiFeature.CONTENT), any()))
            .thenReturn(new RoutedResponse(new AiResponse(content, 10, 50, 60, "claude", "stop"), "anthropic", KeySource.PLATFORM));
    }

    @Test
    void generateDescription_returnsContent_gatesAndRecordsUsage() {
        when(propertyRepository.findById(PID)).thenReturn(Optional.of(property(ORG)));
        stubLlm("Sublime villa avec piscine au coeur de Marrakech.");

        GeneratedContentDto dto = service.generateDescription(PID, "fr", "luxueux");

        assertThat(dto.kind()).isEqualTo("DESCRIPTION");
        assertThat(dto.language()).isEqualTo("fr");
        assertThat(dto.title()).isNull();
        assertThat(dto.content()).isEqualTo("Sublime villa avec piscine au coeur de Marrakech.");
        verify(tokenBudgetService).requireFeatureEnabled(ORG, AiFeature.CONTENT);
        verify(tokenBudgetService).recordUsage(eq(ORG), eq(AiFeature.CONTENT), eq("anthropic"), any());
    }

    @Test
    void generateSeoMeta_parsesTitleAndMeta() {
        when(propertyRepository.findById(PID)).thenReturn(Optional.of(property(ORG)));
        stubLlm("TITLE: Villa Atlas a Marrakech\nMETA: Sejournez dans une villa 3 chambres avec piscine.");

        GeneratedContentDto dto = service.generateSeoMeta(PID, "en");

        assertThat(dto.kind()).isEqualTo("SEO_META");
        assertThat(dto.language()).isEqualTo("en");
        assertThat(dto.title()).isEqualTo("Villa Atlas a Marrakech");
        assertThat(dto.content()).isEqualTo("Sejournez dans une villa 3 chambres avec piscine.");
    }

    @Test
    void unsupportedLanguage_fallsBackToFrench() {
        when(propertyRepository.findById(PID)).thenReturn(Optional.of(property(ORG)));
        stubLlm("Texte.");

        GeneratedContentDto dto = service.generateDescription(PID, "de", null);

        assertThat(dto.language()).isEqualTo("fr");
    }

    @Test
    void rejectsPropertyFromAnotherOrg() {
        when(propertyRepository.findById(PID)).thenReturn(Optional.of(property(2L)));

        assertThatThrownBy(() -> service.generateDescription(PID, "fr", null))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test
    void unknownProperty_throws() {
        when(propertyRepository.findById(PID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.generateSeoMeta(PID, "fr"))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
