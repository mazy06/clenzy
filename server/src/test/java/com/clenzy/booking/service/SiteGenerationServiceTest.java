package com.clenzy.booking.service;

import com.clenzy.booking.dto.SiteGenerationBrief;
import com.clenzy.booking.dto.SiteGenerationResultDto;
import com.clenzy.booking.dto.SitePageDto;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.model.Site;
import com.clenzy.booking.model.SitePageType;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.booking.repository.SiteRepository;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.SiteGenerationException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.NotificationKey;
import com.clenzy.service.ResolvedTarget;
import com.clenzy.service.KeySource;
import com.clenzy.service.AiProviderRouter;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.service.AiTokenBudgetService;
import com.clenzy.service.NotificationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires de {@link SiteGenerationService} (LLM mocké). On vérifie l'orchestration complète :
 * dérivation + application du thème, génération multi-pages en BROUILLON, enveloppe GrapesJS valide,
 * marqueurs booking, échec LLM explicite, refus cross-org, et respect du gating/budget (feature gate).
 */
@ExtendWith(MockitoExtension.class)
class SiteGenerationServiceTest {

    private static final Long ORG_ID = 7L;
    private static final Long SITE_ID = 42L;

    @Mock private SiteRepository siteRepository;
    @Mock private BookingEngineConfigRepository configRepository;
    @Mock private com.clenzy.booking.repository.DesignSystemRepository designSystemRepository;
    @Mock private com.clenzy.repository.PropertyRepository propertyRepository;
    @Mock private AiProviderRouter aiProviderRouter;
    @Mock private AiTokenBudgetService tokenBudgetService;
    @Mock private SiteAdminService siteAdminService;
    @Mock private NotificationService notificationService;
    @Mock private com.clenzy.config.AiProperties aiProperties;
    @Mock private com.clenzy.service.ai.CreditBalanceService creditBalanceService;
    @Mock private com.clenzy.service.ai.CreditMeteringService creditMeteringService;
    @Mock private ObjectProvider<SiteGenerationService> self;

    private ObjectMapper objectMapper;
    private SiteGenerationService service;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new SiteGenerationService(
            siteRepository, configRepository, designSystemRepository, propertyRepository, aiProviderRouter,
            tokenBudgetService, siteAdminService, notificationService, aiProperties, creditBalanceService,
            creditMeteringService, objectMapper, self);
        // self.getObject() → l'instance réelle (applyTheme / loadOrgImageUrls / meterGenerationCredits = no-op en test).
        lenient().when(self.getObject()).thenReturn(service);
        // Pas de photos réelles en test unitaire → repli placeholders (liste vide).
        lenient().when(propertyRepository.findByOrganizationId(org.mockito.ArgumentMatchers.anyLong()))
            .thenReturn(java.util.List.of());
        // Config génération : gate crédits OFF (défaut) → pas de facturation en test ; max tokens = défaut.
        lenient().when(aiProperties.getSiteGeneration())
            .thenReturn(new com.clenzy.config.AiProperties.SiteGeneration());
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    private Site ownedSite() {
        Site site = new Site();
        site.setId(SITE_ID);
        site.setOrganizationId(ORG_ID);
        site.setName("Dar Atlas");
        site.setDefaultLocale("fr");
        return site;
    }

    private SiteGenerationBrief brief() {
        return new SiteGenerationBrief("riad de luxe", "chaleureux et authentique",
            "Dar Atlas", "#c2674a", List.of("fr", "en"));
    }

    private ResolvedTarget platformKey() {
        return new ResolvedTarget("anthropic", null, "api-key", null, KeySource.PLATFORM_DB);
    }

    private RoutedResponse routed(String body) {
        AiResponse resp = new AiResponse(body, 500, 3000, 3500, "claude-x", "stop");
        return new RoutedResponse(resp, "anthropic", KeySource.PLATFORM_DB);
    }

    /** Réponse LLM JSON valide : 4 pages, marqueurs booking sur HOME (search) + PROPERTY_LIST (results). */
    private String validLlmJson() {
        return """
            {
              "css": ".site-root { --c-primary: #c2674a; } .site-hero { padding: 80px 0; }",
              "pages": [
                { "path": "/", "type": "HOME", "title": "Accueil",
                  "html": "<div class=\\"site-root\\"><nav class=\\"site-nav\\"><a href=\\"/\\">Accueil</a></nav><section class=\\"site-hero\\"><h1>Riads d'exception</h1><div data-clenzy-widget=\\"search\\" data-clenzy-next=\\"/logements\\"></div></section><footer class=\\"site-footer\\">© Dar Atlas</footer></div>",
                  "seoTitle": "Dar Atlas — Riads à Marrakech", "seoDescription": "Riads d'exception, réservation directe." },
                { "path": "/logements", "type": "PROPERTY_LIST", "title": "Nos riads",
                  "html": "<div class=\\"site-root\\"><nav class=\\"site-nav\\"></nav><section class=\\"site-section\\"><h2>Nos riads</h2><div data-clenzy-widget=\\"results\\" data-clenzy-next=\\"/logements\\"></div></section><footer class=\\"site-footer\\"></footer></div>",
                  "seoTitle": "Nos riads disponibles", "seoDescription": "Découvrez nos riads de la médina." },
                { "path": "/a-propos", "type": "CUSTOM", "title": "La maison",
                  "html": "<div class=\\"site-root\\"><section class=\\"site-section\\"><h2>La maison</h2><p>Une conciergerie ancrée dans la médina.</p></section></div>",
                  "seoTitle": "La maison — Dar Atlas", "seoDescription": "Notre histoire." },
                { "path": "/contact", "type": "CUSTOM", "title": "Contact",
                  "html": "<div class=\\"site-root\\"><section class=\\"site-section\\"><h2>Contact</h2><p>Écrivez-nous.</p></section></div>",
                  "seoTitle": "Contact — Dar Atlas", "seoDescription": "Contactez la conciergerie." }
              ]
            }
            """;
    }

    /** Stub commun du happy path : site possédé + features ON + key + routing. */
    private void stubHappyPath(String llmBody) {
        when(siteRepository.findByIdAndOrganizationId(SITE_ID, ORG_ID)).thenReturn(Optional.of(ownedSite()));
        when(aiProviderRouter.resolveKey(ORG_ID, "anthropic", AiFeature.DESIGN)).thenReturn(platformKey());
        when(aiProviderRouter.route(eq(ORG_ID), eq("anthropic"), eq(AiFeature.DESIGN), any(AiRequest.class)))
            .thenReturn(routed(llmBody));
        // createAiGeneratedPage echoes the DRAFT it was handed (id assigned).
        when(siteAdminService.createAiGeneratedPage(eq(ORG_ID), eq(SITE_ID), any(SitePageDto.class)))
            .thenAnswer(inv -> {
                SitePageDto in = inv.getArgument(2);
                return new SitePageDto(99L, SITE_ID, in.path(), in.type(), in.title(), in.blocks(),
                    in.locale(), "DRAFT", in.sortOrder(), in.seoTitle(), in.seoDescription(),
                    in.seoOgImageUrl(), null, false, true, null, null);
            });
    }

    // ─── tests ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("génère N pages DRAFT (ai_generated) sans rien publier")
    void generates_draft_pages() {
        stubHappyPath(validLlmJson());

        SiteGenerationResultDto result = service.generateSite(ORG_ID, SITE_ID, brief());

        assertThat(result.pagesCreated()).hasSize(4);
        assertThat(result.pagesCreated()).allSatisfy(p -> assertThat(p.status()).isEqualTo("DRAFT"));
        assertThat(result.themeApplied()).isTrue();

        // Aucune page n'est publiée : on ne crée QUE des brouillons IA, jamais createPage / publishPage.
        ArgumentCaptor<SitePageDto> captor = ArgumentCaptor.forClass(SitePageDto.class);
        verify(siteAdminService, atLeastOnce()).createAiGeneratedPage(eq(ORG_ID), eq(SITE_ID), captor.capture());
        assertThat(captor.getAllValues()).allSatisfy(p -> assertThat(p.aiGenerated()).isTrue());
    }

    @Test
    @DisplayName("emballe chaque page dans une enveloppe GrapesJS valide (format/html/projectData null)")
    void wraps_valid_grapesjs_envelope() throws Exception {
        stubHappyPath(validLlmJson());
        service.generateSite(ORG_ID, SITE_ID, brief());

        ArgumentCaptor<SitePageDto> captor = ArgumentCaptor.forClass(SitePageDto.class);
        verify(siteAdminService, atLeastOnce()).createAiGeneratedPage(eq(ORG_ID), eq(SITE_ID), captor.capture());

        for (SitePageDto page : captor.getAllValues()) {
            JsonNode env = objectMapper.readTree(page.blocks());
            assertThat(env.get("format").asText()).isEqualTo("grapesjs");
            assertThat(env.get("html").asText()).isNotBlank();
            assertThat(env.has("css")).isTrue();
            assertThat(env.get("projectData").isNull()).isTrue();
        }
    }

    @Test
    @DisplayName("place le marqueur booking search sur HOME et results sur PROPERTY_LIST")
    void places_booking_markers() throws Exception {
        stubHappyPath(validLlmJson());
        service.generateSite(ORG_ID, SITE_ID, brief());

        ArgumentCaptor<SitePageDto> captor = ArgumentCaptor.forClass(SitePageDto.class);
        verify(siteAdminService, atLeastOnce()).createAiGeneratedPage(eq(ORG_ID), eq(SITE_ID), captor.capture());

        SitePageDto home = captor.getAllValues().stream()
            .filter(p -> SitePageType.HOME.name().equals(p.type())).findFirst().orElseThrow();
        SitePageDto list = captor.getAllValues().stream()
            .filter(p -> SitePageType.PROPERTY_LIST.name().equals(p.type())).findFirst().orElseThrow();

        String homeHtml = objectMapper.readTree(home.blocks()).get("html").asText();
        String listHtml = objectMapper.readTree(list.blocks()).get("html").asText();
        assertThat(homeHtml).contains("data-clenzy-widget=\"search\"");
        assertThat(listHtml).contains("data-clenzy-widget=\"results\"");
    }

    @Test
    @DisplayName("dérive et applique un thème (designTokens) au site")
    void applies_theme_to_site() {
        stubHappyPath(validLlmJson());
        ArgumentCaptor<Site> siteCaptor = ArgumentCaptor.forClass(Site.class);

        service.generateSite(ORG_ID, SITE_ID, brief());

        verify(siteRepository).save(siteCaptor.capture());
        Site saved = siteCaptor.getValue();
        assertThat(saved.getDesignTokens()).isNotBlank();
        // Couleur primaire issue du brief (#c2674a).
        assertThat(saved.getPrimaryColor()).isEqualTo("#c2674a");
    }

    @Test
    @DisplayName("applique aussi le thème à la BookingEngineConfig liée si présente")
    void applies_theme_to_linked_config() {
        Site site = ownedSite();
        site.setBookingEngineConfigId(11L);
        when(siteRepository.findByIdAndOrganizationId(SITE_ID, ORG_ID)).thenReturn(Optional.of(site));
        when(aiProviderRouter.resolveKey(ORG_ID, "anthropic", AiFeature.DESIGN)).thenReturn(platformKey());
        when(aiProviderRouter.route(eq(ORG_ID), eq("anthropic"), eq(AiFeature.DESIGN), any(AiRequest.class)))
            .thenReturn(routed(validLlmJson()));
        when(siteAdminService.createAiGeneratedPage(eq(ORG_ID), eq(SITE_ID), any(SitePageDto.class)))
            .thenAnswer(inv -> {
                SitePageDto in = inv.getArgument(2);
                return new SitePageDto(99L, SITE_ID, in.path(), in.type(), in.title(), in.blocks(),
                    in.locale(), "DRAFT", in.sortOrder(), in.seoTitle(), in.seoDescription(),
                    in.seoOgImageUrl(), null, false, true, null, null);
            });
        BookingEngineConfig config = new BookingEngineConfig();
        config.setId(11L);
        config.setOrganizationId(ORG_ID);
        when(configRepository.findByIdAndOrganizationId(11L, ORG_ID)).thenReturn(Optional.of(config));

        service.generateSite(ORG_ID, SITE_ID, brief());

        verify(configRepository).save(config);
        assertThat(config.getDesignTokens()).isNotBlank();
    }

    @Test
    @DisplayName("échec LLM → SiteGenerationException, aucune page créée (pas avalé)")
    void llm_failure_throws_and_creates_nothing() {
        when(siteRepository.findByIdAndOrganizationId(SITE_ID, ORG_ID)).thenReturn(Optional.of(ownedSite()));
        when(aiProviderRouter.resolveKey(ORG_ID, "anthropic", AiFeature.DESIGN)).thenReturn(platformKey());
        when(aiProviderRouter.route(eq(ORG_ID), eq("anthropic"), eq(AiFeature.DESIGN), any(AiRequest.class)))
            .thenThrow(new RuntimeException("LLM timeout"));

        assertThatThrownBy(() -> service.generateSite(ORG_ID, SITE_ID, brief()))
            .isInstanceOf(SiteGenerationException.class);

        verify(siteAdminService, never()).createAiGeneratedPage(any(), any(), any());
    }

    @Test
    @DisplayName("réponse LLM illisible → SiteGenerationException")
    void unparseable_llm_response_throws() {
        when(siteRepository.findByIdAndOrganizationId(SITE_ID, ORG_ID)).thenReturn(Optional.of(ownedSite()));
        when(aiProviderRouter.resolveKey(ORG_ID, "anthropic", AiFeature.DESIGN)).thenReturn(platformKey());
        when(aiProviderRouter.route(eq(ORG_ID), eq("anthropic"), eq(AiFeature.DESIGN), any(AiRequest.class)))
            .thenReturn(routed("ceci n'est pas du JSON"));

        assertThatThrownBy(() -> service.generateSite(ORG_ID, SITE_ID, brief()))
            .isInstanceOf(SiteGenerationException.class);
        verify(siteAdminService, never()).createAiGeneratedPage(any(), any(), any());
    }

    @Test
    @DisplayName("site d'une autre org → NotFoundException (ownership), aucun appel LLM")
    void cross_org_site_rejected() {
        when(siteRepository.findByIdAndOrganizationId(SITE_ID, ORG_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.generateSite(ORG_ID, SITE_ID, brief()))
            .isInstanceOf(NotFoundException.class);

        verify(aiProviderRouter, never()).route(any(), any(), any(AiFeature.class), any());
        verify(siteAdminService, never()).createAiGeneratedPage(any(), any(), any());
    }

    @Test
    @DisplayName("feature gate + budget vérifiés avant l'appel LLM")
    void feature_gate_and_budget_enforced() {
        stubHappyPath(validLlmJson());

        service.generateSite(ORG_ID, SITE_ID, brief());

        // La génération de site est rattachée à la feature DESIGN (« Generation CSS/JS du booking engine »).
        verify(tokenBudgetService).requireFeatureEnabled(ORG_ID, AiFeature.DESIGN);
        verify(tokenBudgetService).requireBudget(eq(ORG_ID), eq(AiFeature.DESIGN), any());
        // L'usage tokens est enregistré après l'appel.
        verify(tokenBudgetService).recordUsage(eq(ORG_ID), eq(AiFeature.DESIGN), eq("anthropic"), any());
    }

    @Test
    @DisplayName("aucun modèle exploitable → notifie SUPER_ADMIN/SUPER_MANAGER + remonte AI_NOT_CONFIGURED")
    void no_usable_model_notifies_platform_staff() {
        when(siteRepository.findByIdAndOrganizationId(SITE_ID, ORG_ID)).thenReturn(Optional.of(ownedSite()));
        // Aucun modèle configuré exploitable → le resolver lève AI_NOT_CONFIGURED (repli DB déjà tenté).
        when(aiProviderRouter.resolveKey(ORG_ID, "anthropic", AiFeature.DESIGN))
            .thenThrow(new AiNotConfiguredException("AI_NOT_CONFIGURED", "design", "aucun modèle"));

        assertThatThrownBy(() -> service.generateSite(ORG_ID, SITE_ID, brief()))
            .isInstanceOf(AiNotConfiguredException.class);

        verify(notificationService).notifyAllPlatformStaff(eq(NotificationKey.AI_MODEL_EOL), any(), any(), any());
        verify(siteAdminService, never()).createAiGeneratedPage(any(), any(), any());
    }

    @Test
    @DisplayName("brief vide (type de bien manquant) → IllegalArgumentException, aucun appel LLM")
    void blank_brief_rejected() {
        SiteGenerationBrief blank = new SiteGenerationBrief("  ", null, null, null, List.of("fr"));

        assertThatThrownBy(() -> service.generateSite(ORG_ID, SITE_ID, blank))
            .isInstanceOf(IllegalArgumentException.class);

        verify(aiProviderRouter, never()).route(any(), any(), any(AiFeature.class), any());
    }
}
