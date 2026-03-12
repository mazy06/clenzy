package com.clenzy.controller;

import com.clenzy.dto.AiIntentDetectionDto;
import com.clenzy.dto.AiSuggestedResponseDto;
import com.clenzy.service.AiMessagingService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai/messaging")
@PreAuthorize("isAuthenticated()")
public class AiMessagingController {

    private final AiMessagingService aiMessagingService;
    private final TenantContext tenantContext;

    public AiMessagingController(AiMessagingService aiMessagingService,
                                  TenantContext tenantContext) {
        this.aiMessagingService = aiMessagingService;
        this.tenantContext = tenantContext;
    }

    // ─── Rule-based endpoints ─────────────────────────────────────────

    @PostMapping("/detect-intent")
    public Map<String, Object> detectIntent(@RequestBody Map<String, String> body) {
        String message = body.get("message");
        String intent = aiMessagingService.detectIntent(message);
        boolean urgent = aiMessagingService.isUrgent(message);
        double sentiment = aiMessagingService.analyzeSentiment(message);
        return Map.of("intent", intent, "urgent", urgent, "sentiment", sentiment);
    }

    @PostMapping("/suggest-response")
    @SuppressWarnings("unchecked")
    public Map<String, String> suggestResponse(@RequestBody Map<String, Object> body) {
        String message = (String) body.get("message");
        Map<String, String> vars = body.containsKey("variables")
            ? (Map<String, String>) body.get("variables")
            : Map.of();
        String response = aiMessagingService.generateSuggestedResponse(message, vars);
        return Map.of("suggestedResponse", response, "intent", aiMessagingService.detectIntent(message));
    }

    // ─── AI-powered endpoints ─────────────────────────────────────────

    @PostMapping("/ai-detect-intent")
    public AiIntentDetectionDto detectIntentAi(@RequestBody Map<String, String> body) {
        String message = body.get("message");
        return aiMessagingService.detectIntentAi(message, tenantContext.getRequiredOrganizationId());
    }

    @PostMapping("/ai-suggest-response")
    public AiSuggestedResponseDto suggestResponseAi(@RequestBody Map<String, Object> body) {
        String message = (String) body.get("message");
        String context = (String) body.getOrDefault("context", null);
        String language = (String) body.getOrDefault("language", null);
        return aiMessagingService.generateSuggestedResponseAi(
            message, context, language, tenantContext.getRequiredOrganizationId());
    }
}
