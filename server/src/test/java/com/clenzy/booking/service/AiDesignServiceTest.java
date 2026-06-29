package com.clenzy.booking.service;

import com.clenzy.booking.dto.AiCssGenerateRequestDto;
import com.clenzy.booking.dto.AiDesignAnalysisResponseDto;
import com.clenzy.booking.dto.DesignTokensDto;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiAnonymizationService;
import com.clenzy.service.ResolvedTarget;
import com.clenzy.service.KeySource;
import com.clenzy.service.AiProviderRouter;
import com.clenzy.service.AiTokenBudgetService;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.lang.reflect.Method;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AiDesignService}.
 *
 * <p>The pipeline involves several collaborators (website fetch, LLM router, token budget,
 * anonymization). All are mocked. We exercise: AI-disabled guard, cache-hit short-circuit,
 * full generation path persistence, CSS regeneration, plus helpers ({@code extractCssFromResponse},
 * {@code extractCssVar}, {@code extractTokensFromCss}, {@code countNonNull},
 * {@code parseDesignTokens}, {@code serializeTokens}) via reflection.</p>
 */
@ExtendWith(MockitoExtension.class)
class AiDesignServiceTest {

    private static final Long ORG_ID = 8L;
    private static final Long CONFIG_ID = 42L;
    private static final String URL = "https://example.com";

    @Mock private WebsiteFetchService websiteFetchService;
    @Mock private BookingEngineConfigRepository configRepository;
    @Mock private TenantContext tenantContext;
    @Mock private AiProperties aiProperties;
    @Mock private AiProviderRouter aiProviderRouter;
    @Mock private AiTokenBudgetService tokenBudgetService;
    @Mock private AiAnonymizationService anonymizationService;

    private ObjectMapper objectMapper;
    private AiDesignService service;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new AiDesignService(
                websiteFetchService, configRepository, objectMapper,
                tenantContext, aiProperties, aiProviderRouter,
                tokenBudgetService, anonymizationService);
    }

    // ─── helpers ─────────────────────────────────────────────────────────

    private BookingEngineConfig blankConfig() {
        BookingEngineConfig c = new BookingEngineConfig();
        c.setId(CONFIG_ID);
        c.setOrganizationId(ORG_ID);
        return c;
    }

    private DesignTokensDto sampleTokens() {
        return new DesignTokensDto(
                "#FF0000", "#00FF00", "#0000FF", "#FFFFFF", "#F4F4F4",
                "#111111", "#666666", "Inter", "Roboto", "16px",
                "700", "8px", "4px", "8px", "16px",
                "0 1px 2px rgba(0,0,0,0.1)", "0 2px 4px rgba(0,0,0,0.1)",
                "filled", "uppercase", "#E0E0E0", "#D0D0D0");
    }

    private String sampleCss() {
        return ":root {\n"
                + "  --bw-primaryColor: #FF0000;\n"
                + "  --bw-secondaryColor: #00FF00;\n"
                + "  --bw-accentColor: #0000FF;\n"
                + "  --bw-backgroundColor: #FFFFFF;\n"
                + "  --bw-surfaceColor: #F4F4F4;\n"
                + "  --bw-textColor: #111111;\n"
                + "  --bw-textSecondaryColor: #666666;\n"
                + "  --bw-headingFontFamily: Inter;\n"
                + "  --bw-bodyFontFamily: Roboto;\n"
                + "  --bw-baseFontSize: 16px;\n"
                + "  --bw-headingFontWeight: 700;\n"
                + "  --bw-borderRadius: 8px;\n"
                + "  --bw-buttonBorderRadius: 4px;\n"
                + "  --bw-cardBorderRadius: 8px;\n"
                + "  --bw-spacing: 16px;\n"
                + "  --bw-boxShadow: none;\n"
                + "  --bw-cardShadow: 0 2px 4px rgba(0,0,0,0.1);\n"
                + "  --bw-buttonStyle: filled;\n"
                + "  --bw-buttonTextTransform: uppercase;\n"
                + "  --bw-borderColor: #E0E0E0;\n"
                + "  --bw-dividerColor: null;\n"
                + "}";
    }

    private AiResponse aiResp(String body) {
        return new AiResponse(body, 100, 200, 300, "model-x", "stop");
    }

    private AiProviderRouter.RoutedResponse routed(AiResponse resp, String providerName) {
        return new AiProviderRouter.RoutedResponse(resp, providerName, KeySource.PLATFORM_DB);
    }

    private ResolvedTarget key() {
        return new ResolvedTarget("openai", null, "api-key", null, KeySource.PLATFORM_DB);
    }

    // ─── analyzeWebsite ──────────────────────────────────────────────────

    @Nested
    @DisplayName("analyzeWebsite")
    class AnalyzeWebsite {

        @Test
        @DisplayName("throws AiNotConfiguredException when AI is disabled")
        void disabled_throws() {
            when(aiProperties.isEnabled()).thenReturn(false);

            assertThatThrownBy(() -> service.analyzeWebsite(CONFIG_ID, URL))
                    .isInstanceOf(AiNotConfiguredException.class);
        }

        @Test
        @DisplayName("throws IllegalArgumentException when config not found for org")
        void configNotFound_throws() {
            when(aiProperties.isEnabled()).thenReturn(true);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByIdAndOrganizationId(CONFIG_ID, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.analyzeWebsite(CONFIG_ID, URL))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Config not found");
        }

        @Test
        @DisplayName("wraps IOException from website fetch in RuntimeException")
        void fetchIOException_wrapped() throws IOException {
            when(aiProperties.isEnabled()).thenReturn(true);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByIdAndOrganizationId(CONFIG_ID, ORG_ID))
                    .thenReturn(Optional.of(blankConfig()));
            when(websiteFetchService.fetchWebsite(URL))
                    .thenThrow(new IOException("connection refused"));

            assertThatThrownBy(() -> service.analyzeWebsite(CONFIG_ID, URL))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Failed to fetch website")
                    .hasMessageContaining("connection refused");
        }

        @Test
        @DisplayName("returns cached tokens when content hash matches and tokens present")
        void cacheHit_returnsCached() throws Exception {
            when(aiProperties.isEnabled()).thenReturn(true);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);

            BookingEngineConfig cfg = blankConfig();
            String tokensJson = objectMapper.writeValueAsString(sampleTokens());
            cfg.setAiAnalysisHash("hash-abc");
            cfg.setDesignTokens(tokensJson);
            cfg.setCustomCss("body{color:red}");
            when(configRepository.findByIdAndOrganizationId(CONFIG_ID, ORG_ID))
                    .thenReturn(Optional.of(cfg));

            when(websiteFetchService.fetchWebsite(URL))
                    .thenReturn(new WebsiteFetchService.WebsiteContent("<html/>", "css", "hash-abc"));

            AiDesignAnalysisResponseDto result = service.analyzeWebsite(CONFIG_ID, URL);

            assertThat(result.fromCache()).isTrue();
            assertThat(result.generatedCss()).isEqualTo("body{color:red}");
            assertThat(result.sourceUrl()).isEqualTo(URL);
            assertThat(result.designTokens().primaryColor()).isEqualTo("#FF0000");
            verify(aiProviderRouter, never()).route(any(), any(), any(), any());
            verify(configRepository, never()).save(any());
        }

        @Test
        @DisplayName("cache miss runs full pipeline, persists tokens and updates hash")
        void cacheMiss_runsPipeline() throws IOException {
            when(aiProperties.isEnabled()).thenReturn(true);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);

            BookingEngineConfig cfg = blankConfig();
            // No existing hash → cache miss
            when(configRepository.findByIdAndOrganizationId(CONFIG_ID, ORG_ID))
                    .thenReturn(Optional.of(cfg));
            when(websiteFetchService.fetchWebsite(URL))
                    .thenReturn(new WebsiteFetchService.WebsiteContent("<html/>", "css-body", "new-hash"));

            when(aiProviderRouter.resolveKey(ORG_ID, "openai", AiFeature.DESIGN)).thenReturn(key());
            when(anonymizationService.anonymize(anyString())).thenAnswer(inv -> inv.getArgument(0));
            when(aiProviderRouter.route(eq(ORG_ID), eq("openai"), eq(AiFeature.DESIGN), any(AiRequest.class)))
                    .thenReturn(routed(aiResp("```css\n" + sampleCss() + "\n```"), "openai"));
            when(configRepository.save(any(BookingEngineConfig.class))).thenAnswer(inv -> inv.getArgument(0));

            AiDesignAnalysisResponseDto result = service.analyzeWebsite(CONFIG_ID, URL);

            assertThat(result.fromCache()).isFalse();
            assertThat(result.generatedCss()).contains("--bw-primaryColor: #FF0000");
            assertThat(result.designTokens().primaryColor()).isEqualTo("#FF0000");
            assertThat(result.designTokens().headingFontFamily()).isEqualTo("Inter");

            ArgumentCaptor<BookingEngineConfig> captor = ArgumentCaptor.forClass(BookingEngineConfig.class);
            verify(configRepository).save(captor.capture());
            BookingEngineConfig saved = captor.getValue();
            assertThat(saved.getAiAnalysisHash()).isEqualTo("new-hash");
            assertThat(saved.getSourceWebsiteUrl()).isEqualTo(URL);
            assertThat(saved.getAiAnalysisAt()).isNotNull();
            assertThat(saved.getDesignTokens()).contains("\"primaryColor\":\"#FF0000\"");

            // Budget bookkeeping
            verify(tokenBudgetService).requireFeatureEnabled(ORG_ID, AiFeature.DESIGN);
            verify(tokenBudgetService).requireBudget(ORG_ID, AiFeature.DESIGN,
                    KeySource.PLATFORM_DB);
            verify(tokenBudgetService).recordUsage(eq(ORG_ID), eq(AiFeature.DESIGN), eq("openai"),
                    any(AiResponse.class));
            verify(anonymizationService).anonymize(anyString());
        }

        @Test
        @DisplayName("hash differs but tokens null → also runs pipeline")
        void cacheMissOnNullTokens() throws IOException {
            when(aiProperties.isEnabled()).thenReturn(true);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);

            BookingEngineConfig cfg = blankConfig();
            cfg.setAiAnalysisHash("same"); // hash equals but tokens null
            cfg.setDesignTokens(null);
            when(configRepository.findByIdAndOrganizationId(CONFIG_ID, ORG_ID))
                    .thenReturn(Optional.of(cfg));
            when(websiteFetchService.fetchWebsite(URL))
                    .thenReturn(new WebsiteFetchService.WebsiteContent("<html/>", "css", "same"));

            when(aiProviderRouter.resolveKey(ORG_ID, "openai", AiFeature.DESIGN)).thenReturn(key());
            when(anonymizationService.anonymize(anyString())).thenAnswer(inv -> inv.getArgument(0));
            when(aiProviderRouter.route(eq(ORG_ID), eq("openai"), eq(AiFeature.DESIGN), any(AiRequest.class)))
                    .thenReturn(routed(aiResp(sampleCss()), "openai"));
            when(configRepository.save(any(BookingEngineConfig.class))).thenAnswer(inv -> inv.getArgument(0));

            AiDesignAnalysisResponseDto result = service.analyzeWebsite(CONFIG_ID, URL);

            assertThat(result.fromCache()).isFalse();
            verify(aiProviderRouter).route(any(), any(), any(), any());
        }
    }

    // ─── regenerateCss ───────────────────────────────────────────────────

    @Nested
    @DisplayName("regenerateCss")
    class RegenerateCss {

        @Test
        @DisplayName("throws when AI disabled")
        void disabled_throws() {
            when(aiProperties.isEnabled()).thenReturn(false);
            DesignTokensDto tokens = sampleTokens();
            AiCssGenerateRequestDto req = new AiCssGenerateRequestDto(tokens, "darker");

            assertThatThrownBy(() -> service.regenerateCss(CONFIG_ID, req))
                    .isInstanceOf(AiNotConfiguredException.class);
        }

        @Test
        @DisplayName("throws when config not found")
        void configNotFound_throws() {
            when(aiProperties.isEnabled()).thenReturn(true);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByIdAndOrganizationId(CONFIG_ID, ORG_ID))
                    .thenReturn(Optional.empty());
            DesignTokensDto tokens = sampleTokens();
            AiCssGenerateRequestDto req = new AiCssGenerateRequestDto(tokens, null);

            assertThatThrownBy(() -> service.regenerateCss(CONFIG_ID, req))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Config not found");
        }

        @Test
        @DisplayName("calls anthropic provider with anonymized prompt and returns extracted CSS")
        void invokesAnthropic_andReturnsCss() {
            when(aiProperties.isEnabled()).thenReturn(true);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByIdAndOrganizationId(CONFIG_ID, ORG_ID))
                    .thenReturn(Optional.of(blankConfig()));
            when(aiProviderRouter.resolveKey(ORG_ID, "anthropic", AiFeature.DESIGN)).thenReturn(key());
            when(anonymizationService.anonymize(anyString())).thenAnswer(inv -> inv.getArgument(0));
            when(aiProviderRouter.route(eq(ORG_ID), eq("anthropic"), eq(AiFeature.DESIGN), any(AiRequest.class)))
                    .thenReturn(routed(aiResp("```css\nbody{color:red}\n```"), "anthropic"));

            DesignTokensDto tokens = sampleTokens();
            AiCssGenerateRequestDto req = new AiCssGenerateRequestDto(tokens, "make it darker");
            String css = service.regenerateCss(CONFIG_ID, req);

            assertThat(css).isEqualTo("body{color:red}");
            verify(tokenBudgetService).requireFeatureEnabled(ORG_ID, AiFeature.DESIGN);
            verify(tokenBudgetService).requireBudget(ORG_ID, AiFeature.DESIGN,
                    KeySource.PLATFORM_DB);
            verify(tokenBudgetService).recordUsage(eq(ORG_ID), eq(AiFeature.DESIGN), eq("anthropic"),
                    any(AiResponse.class));
        }
    }

    // ─── Private helpers via reflection ──────────────────────────────────

    @Nested
    @DisplayName("Private helpers")
    class Helpers {

        @Test
        @DisplayName("extractCssFromResponse strips ```css fences and trims")
        void extractCss_stripsFences() throws Exception {
            String css = (String) invoke("extractCssFromResponse",
                    String.class, "```css\n.x{color:red}\n```");
            assertThat(css).isEqualTo(".x{color:red}");
        }

        @Test
        @DisplayName("extractCssFromResponse handles untagged ``` fences")
        void extractCss_plainFences() throws Exception {
            String css = (String) invoke("extractCssFromResponse",
                    String.class, "```\n.x{a:1}\n```");
            assertThat(css).isEqualTo(".x{a:1}");
        }

        @Test
        @DisplayName("extractCssFromResponse returns empty for null content")
        void extractCss_null() throws Exception {
            assertThat(invoke("extractCssFromResponse", String.class, (Object) null)).isEqualTo("");
        }

        @Test
        @DisplayName("extractCssFromResponse passes through plain CSS without fences")
        void extractCss_plain() throws Exception {
            String css = (String) invoke("extractCssFromResponse", String.class, "body{}");
            assertThat(css).isEqualTo("body{}");
        }

        @Test
        @DisplayName("extractCssVar returns value, or null on missing/empty/none/null sentinel")
        void extractCssVar_branches() throws Exception {
            String css = "--bw-primaryColor: #FF0000;\n--bw-empty: ;\n--bw-noneVal: none;\n--bw-nullVal: null;";
            assertThat(invoke("extractCssVar", String.class, css, "--bw-primaryColor"))
                    .isEqualTo("#FF0000");
            assertThat(invoke("extractCssVar", String.class, css, "--bw-empty")).isNull();
            assertThat(invoke("extractCssVar", String.class, css, "--bw-noneVal")).isNull();
            assertThat(invoke("extractCssVar", String.class, css, "--bw-nullVal")).isNull();
            assertThat(invoke("extractCssVar", String.class, css, "--bw-missing")).isNull();
            assertThat(invoke("extractCssVar", String.class, (Object) null, "--bw-x")).isNull();
        }

        @Test
        @DisplayName("extractCssVar handles missing semicolon → returns null")
        void extractCssVar_missingSemicolon() throws Exception {
            assertThat(invoke("extractCssVar", String.class, "--bw-x: abc", "--bw-x")).isNull();
        }

        @Test
        @DisplayName("extractTokensFromCss extracts all 21 tokens")
        void extractTokensFromCss_full() throws Exception {
            DesignTokensDto tokens = (DesignTokensDto) invoke("extractTokensFromCss",
                    DesignTokensDto.class, sampleCss());
            assertThat(tokens.primaryColor()).isEqualTo("#FF0000");
            assertThat(tokens.bodyFontFamily()).isEqualTo("Roboto");
            assertThat(tokens.boxShadow()).isNull(); // "none" → null
            assertThat(tokens.dividerColor()).isNull(); // "null" → null
            assertThat(tokens.borderColor()).isEqualTo("#E0E0E0");
        }

        @Test
        @DisplayName("countNonNull tallies the 7 tracked fields")
        void countNonNull() throws Exception {
            DesignTokensDto allNull = new DesignTokensDto(
                    null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null, null, null, null, null);
            assertThat((int) invoke("countNonNull", int.class, allNull)).isEqualTo(0);

            DesignTokensDto partial = new DesignTokensDto(
                    "#fff", null, null, "#000", null, null, null,
                    null, "Inter", null, null, "8px", null, null, null, null, null, null, null, null, null);
            // primaryColor, backgroundColor, bodyFontFamily, borderRadius → 4
            assertThat((int) invoke("countNonNull", int.class, partial)).isEqualTo(4);

            assertThat((int) invoke("countNonNull", int.class, sampleTokens())).isEqualTo(7);
        }

        @Test
        @DisplayName("requireAiEnabled passes when enabled, throws when not")
        void requireAiEnabled_branches() {
            when(aiProperties.isEnabled()).thenReturn(true);
            // should not throw
            try {
                invoke("requireAiEnabled", void.class);
            } catch (Exception e) {
                throw new AssertionError("did not expect exception", e);
            }

            when(aiProperties.isEnabled()).thenReturn(false);
            assertThatThrownBy(() -> invoke("requireAiEnabled", void.class))
                    .isInstanceOf(AiNotConfiguredException.class);
        }

        @Test
        @DisplayName("parseDesignTokens reads valid JSON")
        void parseDesignTokens_validJson() throws Exception {
            String json = objectMapper.writeValueAsString(sampleTokens());
            DesignTokensDto parsed = (DesignTokensDto) invoke("parseDesignTokens",
                    DesignTokensDto.class, json);
            assertThat(parsed.primaryColor()).isEqualTo("#FF0000");
        }

        @Test
        @DisplayName("parseDesignTokens returns empty DTO on invalid JSON")
        void parseDesignTokens_invalidJson() throws Exception {
            DesignTokensDto parsed = (DesignTokensDto) invoke("parseDesignTokens",
                    DesignTokensDto.class, "not json {{");
            assertThat(parsed).isNotNull();
            assertThat(parsed.primaryColor()).isNull();
            assertThat(parsed.bodyFontFamily()).isNull();
        }

        @Test
        @DisplayName("serializeTokens roundtrips through Jackson")
        void serializeTokens_roundtrip() throws Exception {
            String json = (String) invoke("serializeTokens", String.class, sampleTokens());
            assertThat(json).contains("\"primaryColor\":\"#FF0000\"");
            DesignTokensDto back = objectMapper.readValue(json, DesignTokensDto.class);
            assertThat(back.primaryColor()).isEqualTo("#FF0000");
        }
    }

    // ─── reflection helper ───────────────────────────────────────────────

    private Object invoke(String name, Class<?> returnType, Object... args) throws Exception {
        for (Method m : AiDesignService.class.getDeclaredMethods()) {
            if (!m.getName().equals(name)) continue;
            if (m.getParameterCount() != args.length) continue;
            Class<?>[] sig = m.getParameterTypes();
            boolean ok = true;
            for (int i = 0; i < args.length; i++) {
                if (args[i] == null) continue;
                if (!sig[i].isAssignableFrom(args[i].getClass())) { ok = false; break; }
            }
            if (!ok) continue;
            m.setAccessible(true);
            try {
                return m.invoke(service, args);
            } catch (java.lang.reflect.InvocationTargetException e) {
                if (e.getCause() instanceof RuntimeException re) throw re;
                if (e.getCause() instanceof Exception ce) throw ce;
                throw e;
            }
        }
        throw new NoSuchMethodException(name + " (matching params)");
    }
}
