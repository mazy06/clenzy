package com.clenzy.booking.service;

import com.clenzy.booking.dto.AiCssGenerateRequestDto;
import com.clenzy.booking.dto.AiDesignAnalysisResponseDto;
import com.clenzy.booking.dto.DesignTokensDto;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.config.ai.AnthropicProvider;
import com.clenzy.config.ai.OpenAiProvider;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiAnonymizationService;
import com.clenzy.service.AiKeyResolver;
import com.clenzy.service.AiKeyResolver.KeySource;
import com.clenzy.service.AiKeyResolver.ResolvedKey;
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
    private final OpenAiProvider openAiProvider;
    private final AnthropicProvider anthropicProvider;
    private final AiKeyResolver aiKeyResolver;
    private final AiTokenBudgetService tokenBudgetService;
    private final AiAnonymizationService anonymizationService;

    public AiDesignService(
            WebsiteFetchService websiteFetchService,
            BookingEngineConfigRepository configRepository,
            ObjectMapper objectMapper,
            TenantContext tenantContext,
            AiProperties aiProperties,
            OpenAiProvider openAiProvider,
            AnthropicProvider anthropicProvider,
            AiKeyResolver aiKeyResolver,
            AiTokenBudgetService tokenBudgetService,
            AiAnonymizationService anonymizationService
    ) {
        this.websiteFetchService = websiteFetchService;
        this.configRepository = configRepository;
        this.objectMapper = objectMapper;
        this.tenantContext = tenantContext;
        this.aiProperties = aiProperties;
        this.openAiProvider = openAiProvider;
        this.anthropicProvider = anthropicProvider;
        this.aiKeyResolver = aiKeyResolver;
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

        // 3. Extract design tokens via OpenAI (BYOK-aware)
        log.info("Extracting design tokens via OpenAI for config {}", configId);
        ResolvedKey openaiKey = aiKeyResolver.resolve(orgId, openAiProvider.name());
        tokenBudgetService.requireBudget(orgId, AiFeature.DESIGN, openaiKey.source());
        DesignTokensDto tokens = extractTokensViaOpenAi(content.html(), content.css(), openaiKey, orgId);

        // 4. Generate CSS via Claude (BYOK-aware)
        log.info("Generating CSS via Claude for config {}", configId);
        ResolvedKey anthropicKey = aiKeyResolver.resolve(orgId, anthropicProvider.name());
        tokenBudgetService.requireBudget(orgId, AiFeature.DESIGN, anthropicKey.source());
        String generatedCss = generateCssViaClaude(tokens, null, anthropicKey, orgId);

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

        ResolvedKey anthropicKey = aiKeyResolver.resolve(orgId, anthropicProvider.name());
        tokenBudgetService.requireBudget(orgId, AiFeature.DESIGN, anthropicKey.source());
        return generateCssViaClaude(request.designTokens(), request.additionalInstructions(), anthropicKey, orgId);
    }

    // ─── OpenAI: Extract design tokens (delegated to OpenAiProvider) ────

    private DesignTokensDto extractTokensViaOpenAi(String html, String css, ResolvedKey key, Long orgId) {
        String userPrompt = AiDesignPrompts.buildOpenAiUserPrompt(html, css);
        String anonymizedPrompt = anonymizationService.anonymize(userPrompt);

        AiRequest request = AiRequest.json(AiDesignPrompts.OPENAI_SYSTEM_PROMPT, anonymizedPrompt);
        AiRequest resolved = key.modelOverride() != null ? request.overrideModel(key.modelOverride()) : request;
        AiResponse response = (key.source() == KeySource.ORGANIZATION)
                ? openAiProvider.chat(resolved, key.apiKey())
                : openAiProvider.chat(resolved);

        tokenBudgetService.recordUsage(orgId, AiFeature.DESIGN, openAiProvider.name(), response);

        try {
            return objectMapper.readValue(response.content(), DesignTokensDto.class);
        } catch (JsonProcessingException e) {
            log.error("Failed to parse AI design tokens: {}", e.getMessage());
            throw new RuntimeException("Failed to parse AI design tokens", e);
        }
    }

    // ─── Anthropic Claude: Generate CSS (delegated to AnthropicProvider) ─

    private String generateCssViaClaude(DesignTokensDto tokens, String additionalInstructions,
                                        ResolvedKey key, Long orgId) {
        String tokensJson = serializeTokens(tokens);
        String userPrompt = AiDesignPrompts.buildClaudeUserPrompt(tokensJson, additionalInstructions);
        String anonymizedPrompt = anonymizationService.anonymize(userPrompt);

        AiRequest request = AiRequest.withMaxTokens(AiDesignPrompts.CLAUDE_SYSTEM_PROMPT, anonymizedPrompt, 4096);
        AiRequest resolved = key.modelOverride() != null ? request.overrideModel(key.modelOverride()) : request;
        AiResponse response = (key.source() == KeySource.ORGANIZATION)
                ? anthropicProvider.chat(resolved, key.apiKey())
                : anthropicProvider.chat(resolved);

        tokenBudgetService.recordUsage(orgId, AiFeature.DESIGN, anthropicProvider.name(), response);

        return response.content();
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
