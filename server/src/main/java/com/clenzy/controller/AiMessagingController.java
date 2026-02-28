package com.clenzy.controller;

import com.clenzy.service.AiMessagingService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai/messaging")
public class AiMessagingController {

    private final AiMessagingService aiMessagingService;

    public AiMessagingController(AiMessagingService aiMessagingService) {
        this.aiMessagingService = aiMessagingService;
    }

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
}
