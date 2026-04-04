package com.clenzy.booking.service;

import com.clenzy.booking.dto.AiCssGenerateRequestDto;
import com.clenzy.booking.dto.AiDesignAnalysisResponseDto;
import com.clenzy.booking.dto.DesignTokensDto;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiAnonymizationService;
import com.clenzy.service.AiKeyResolver.ResolvedKey;
import com.clenzy.service.AiProviderRouter;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.service.AiTokenBudgetService;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;

/**
 * Orchestrates AI-powered design analysis:
 * 1. Fetch website HTML+CSS via WebsiteFetchService
 * 2. Extract design tokens via OpenAI GPT-4o (delegated to {@link OpenAiProvider})
 * 3. Generate matching CSS via Anthropic Claude (delegated to {@link AnthropicProvider})
 * 4. Store results in DB with content hash for caching
 */
@Service
public class AiDesignService {

    private static final Logger log = LoggerFactory.getLogger(AiDesignService.class);

    private final WebsiteFetchService websiteFetchService;
    private final BookingEngineConfigRepository configRepository;
    private final ObjectMapper objectMapper;
    private final TenantContext tenantContext;
    private final AiProperties aiProperties;
    private final AiProviderRouter aiProviderRouter;
    private final AiTokenBudgetService tokenBudgetService;
    private final AiAnonymizationService anonymizationService;

    public AiDesignService(
            WebsiteFetchService websiteFetchService,
            BookingEngineConfigRepository configRepository,
            ObjectMapper objectMapper,
            TenantContext tenantContext,
            AiProperties aiProperties,
            AiProviderRouter aiProviderRouter,
            AiTokenBudgetService tokenBudgetService,
            AiAnonymizationService anonymizationService
    ) {
        this.websiteFetchService = websiteFetchService;
        this.configRepository = configRepository;
        this.objectMapper = objectMapper;
        this.tenantContext = tenantContext;
        this.aiProperties = aiProperties;
        this.aiProviderRouter = aiProviderRouter;
        this.tokenBudgetService = tokenBudgetService;
        this.anonymizationService = anonymizationService;
    }

    // ─── Main entry point: Analyze website ──────────────────────────────

    /**
     * Full pipeline: fetch → hash check → extract tokens → generate CSS.
     *
     * @param configId the booking engine config ID
     * @param websiteUrl the client's website URL
     * @return analysis result with tokens, CSS, and cache flag
     */
    @CircuitBreaker(name = "ai-design")
    @Retry(name = "ai-design")
    public AiDesignAnalysisResponseDto analyzeWebsite(Long configId, String websiteUrl) {
        requireAiEnabled();

        Long orgId = tenantContext.getRequiredOrganizationId();
        tokenBudgetService.requireFeatureEnabled(orgId, AiFeature.DESIGN);
        BookingEngineConfig config = configRepository.findByIdAndOrganizationId(configId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Config not found: " + configId));

        // 1. Fetch website
        WebsiteFetchService.WebsiteContent content;
        try {
            content = websiteFetchService.fetchWebsite(websiteUrl);
        } catch (IOException e) {
            throw new RuntimeException("Failed to fetch website: " + e.getMessage(), e);
        }

        // 2. Check cache (hash-based)
        if (content.contentHash().equals(config.getAiAnalysisHash())
                && config.getDesignTokens() != null) {
            log.info("Website content unchanged (hash match), returning cached tokens for config {}", configId);

            DesignTokensDto cachedTokens = parseDesignTokens(config.getDesignTokens());
            String cachedCss = config.getCustomCss(); // Reuse existing custom CSS as generated CSS

            return new AiDesignAnalysisResponseDto(cachedTokens, cachedCss, websiteUrl, true);
        }

        // 3. Generate CSS directly from the website content
        log.info("Generating CSS for config {}", configId);
        ResolvedKey cssKey = aiProviderRouter.resolveKey(orgId, "openai", AiFeature.DESIGN);
        tokenBudgetService.requireBudget(orgId, AiFeature.DESIGN, cssKey.source());
        String generatedCss = generateCssFromWebsite(content.html(), content.css(), orgId);

        // 4. Extract design tokens from the generated CSS variables
        DesignTokensDto tokens = extractTokensFromCss(generatedCss);
        log.info("Extracted {} non-null tokens from generated CSS", countNonNull(tokens));

        // 5. Store results in DB
        config.setDesignTokens(serializeTokens(tokens));
        config.setSourceWebsiteUrl(websiteUrl);
        config.setAiAnalysisHash(content.contentHash());
        config.setAiAnalysisAt(LocalDateTime.now());
        configRepository.save(config);

        return new AiDesignAnalysisResponseDto(tokens, generatedCss, websiteUrl, false);
    }

    // ─── Regenerate CSS from edited tokens ──────────────────────────────

    /**
     * Regenerate CSS from user-edited design tokens.
     */
    @CircuitBreaker(name = "ai-design")
    @Retry(name = "ai-design")
    public String regenerateCss(Long configId, AiCssGenerateRequestDto request) {
        requireAiEnabled();

        Long orgId = tenantContext.getRequiredOrganizationId();
        tokenBudgetService.requireFeatureEnabled(orgId, AiFeature.DESIGN);
        configRepository.findByIdAndOrganizationId(configId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Config not found: " + configId));

        ResolvedKey cssKey = aiProviderRouter.resolveKey(orgId, "anthropic", AiFeature.DESIGN);
        tokenBudgetService.requireBudget(orgId, AiFeature.DESIGN, cssKey.source());
        return generateCss(request.designTokens(), request.additionalInstructions(), orgId);
    }

    // ─── Generate CSS from website (single LLM call) ────────────────────

    private String generateCssFromWebsite(String html, String css, Long orgId) {
        String userPrompt = AiDesignPrompts.buildCssFromWebsitePrompt(html, css);
        String anonymizedPrompt = anonymizationService.anonymize(userPrompt);
        AiRequest request = AiRequest.withMaxTokens(AiDesignPrompts.CSS_FROM_WEBSITE_SYSTEM_PROMPT, anonymizedPrompt, 4096);

        RoutedResponse routed = aiProviderRouter.route(orgId, "openai", AiFeature.DESIGN, request);
        tokenBudgetService.recordUsage(orgId, AiFeature.DESIGN, routed.providerName(), routed.response());

        return extractCssFromResponse(routed.response().content());
    }

    // ─── Generate CSS from tokens (regeneration) ───────────────────────

    private String generateCss(DesignTokensDto tokens, String additionalInstructions, Long orgId) {
        String tokensJson = serializeTokens(tokens);
        String userPrompt = AiDesignPrompts.buildClaudeUserPrompt(tokensJson, additionalInstructions);
        String anonymizedPrompt = anonymizationService.anonymize(userPrompt);
        AiRequest request = AiRequest.withMaxTokens(AiDesignPrompts.CLAUDE_SYSTEM_PROMPT, anonymizedPrompt, 4096);

        RoutedResponse routed = aiProviderRouter.route(orgId, "anthropic", AiFeature.DESIGN, request);
        tokenBudgetService.recordUsage(orgId, AiFeature.DESIGN, routed.providerName(), routed.response());

        return extractCssFromResponse(routed.response().content());
    }

    // ─── Extract tokens from CSS variables ─────────────────────────────

    /**
     * Parse les variables CSS --bw-* du CSS genere pour construire les DesignTokens.
     * C'est plus fiable que de demander au LLM de retourner du JSON.
     */
    private DesignTokensDto extractTokensFromCss(String css) {
        return new DesignTokensDto(
                extractCssVar(css, "--bw-primaryColor"),
                extractCssVar(css, "--bw-secondaryColor"),
                extractCssVar(css, "--bw-accentColor"),
                extractCssVar(css, "--bw-backgroundColor"),
                extractCssVar(css, "--bw-surfaceColor"),
                extractCssVar(css, "--bw-textColor"),
                extractCssVar(css, "--bw-textSecondaryColor"),
                extractCssVar(css, "--bw-headingFontFamily"),
                extractCssVar(css, "--bw-bodyFontFamily"),
                extractCssVar(css, "--bw-baseFontSize"),
                extractCssVar(css, "--bw-headingFontWeight"),
                extractCssVar(css, "--bw-borderRadius"),
                extractCssVar(css, "--bw-buttonBorderRadius"),
                extractCssVar(css, "--bw-cardBorderRadius"),
                extractCssVar(css, "--bw-spacing"),
                extractCssVar(css, "--bw-boxShadow"),
                extractCssVar(css, "--bw-cardShadow"),
                extractCssVar(css, "--bw-buttonStyle"),
                extractCssVar(css, "--bw-buttonTextTransform"),
                extractCssVar(css, "--bw-borderColor"),
                extractCssVar(css, "--bw-dividerColor")
        );
    }

    /**
     * Extrait la valeur d'une variable CSS (ex: "--bw-primaryColor: #007bff;" → "#007bff").
     */
    private String extractCssVar(String css, String varName) {
        if (css == null) return null;
        int idx = css.indexOf(varName + ":");
        if (idx < 0) return null;
        int start = idx + varName.length() + 1; // skip ":"
        int end = css.indexOf(';', start);
        if (end < 0) return null;
        String value = css.substring(start, end).trim();
        return value.isEmpty() || "null".equals(value) || "none".equals(value) ? null : value;
    }

    /**
     * Extrait le CSS pur d'une reponse LLM (supprime les balises markdown).
     */
    private String extractCssFromResponse(String content) {
        if (content == null) return "";
        String trimmed = content.trim();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline > 0) trimmed = trimmed.substring(firstNewline + 1);
            if (trimmed.endsWith("```")) trimmed = trimmed.substring(0, trimmed.lastIndexOf("```"));
            trimmed = trimmed.trim();
        }
        return trimmed;
    }

    private int countNonNull(DesignTokensDto tokens) {
        int count = 0;
        if (tokens.primaryColor() != null) count++;
        if (tokens.secondaryColor() != null) count++;
        if (tokens.accentColor() != null) count++;
        if (tokens.backgroundColor() != null) count++;
        if (tokens.textColor() != null) count++;
        if (tokens.bodyFontFamily() != null) count++;
        if (tokens.borderRadius() != null) count++;
        return count;
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    private void requireAiEnabled() {
        if (!aiProperties.isEnabled()) {
            throw new AiNotConfiguredException("AI_FEATURE_DISABLED", "design",
                    "AI design analysis is disabled. Set clenzy.ai.enabled=true");
        }
    }

    private DesignTokensDto parseDesignTokens(String json) {
        try {
            return objectMapper.readValue(json, DesignTokensDto.class);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse stored design tokens, returning empty: {}", e.getMessage());
            return new DesignTokensDto(null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        }
    }

    private String serializeTokens(DesignTokensDto tokens) {
        try {
            return objectMapper.writeValueAsString(tokens);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize design tokens", e);
        }
    }
}
