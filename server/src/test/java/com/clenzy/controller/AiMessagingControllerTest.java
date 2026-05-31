package com.clenzy.controller;

import com.clenzy.dto.AiIntentDetectionDto;
import com.clenzy.dto.AiSuggestedResponseDto;
import com.clenzy.service.AiMessagingService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiMessagingControllerTest {

    @Mock private AiMessagingService aiMessagingService;
    @Mock private TenantContext tenantContext;

    private AiMessagingController controller;

    @BeforeEach
    void setUp() {
        controller = new AiMessagingController(aiMessagingService, tenantContext);
        lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
    }

    @Test
    void detectIntent_returnsIntentUrgentSentiment() {
        when(aiMessagingService.detectIntent("hello")).thenReturn("GREETING");
        when(aiMessagingService.isUrgent("hello")).thenReturn(false);
        when(aiMessagingService.analyzeSentiment("hello")).thenReturn(0.5);

        Map<String, Object> result = controller.detectIntent(Map.of("message", "hello"));

        assertEquals("GREETING", result.get("intent"));
        assertEquals(false, result.get("urgent"));
        assertEquals(0.5, result.get("sentiment"));
    }

    @Test
    void suggestResponse_withVariables_returnsResponseAndIntent() {
        when(aiMessagingService.detectIntent("msg")).thenReturn("BOOKING");
        when(aiMessagingService.generateSuggestedResponse(eq("msg"), eq(Map.of("var", "x")))).thenReturn("Hi!");

        Map<String, Object> body = new HashMap<>();
        body.put("message", "msg");
        body.put("variables", Map.of("var", "x"));

        Map<String, String> result = controller.suggestResponse(body);

        assertEquals("Hi!", result.get("suggestedResponse"));
        assertEquals("BOOKING", result.get("intent"));
    }

    @Test
    void suggestResponse_noVariables_usesEmptyMap() {
        when(aiMessagingService.detectIntent("msg")).thenReturn("UNKNOWN");
        when(aiMessagingService.generateSuggestedResponse(eq("msg"), eq(Map.of()))).thenReturn("Reponse");

        Map<String, Object> body = new HashMap<>();
        body.put("message", "msg");

        Map<String, String> result = controller.suggestResponse(body);

        assertEquals("Reponse", result.get("suggestedResponse"));
        assertEquals("UNKNOWN", result.get("intent"));
    }

    @Test
    void detectIntentAi_delegatesToService() {
        AiIntentDetectionDto dto = new AiIntentDetectionDto("BOOKING", 0.9, "fr", List.of("date"), false);
        when(aiMessagingService.detectIntentAi("hello", 1L)).thenReturn(dto);

        AiIntentDetectionDto result = controller.detectIntentAi(Map.of("message", "hello"));

        assertEquals(dto, result);
    }

    @Test
    void suggestResponseAi_withAllOptions() {
        AiSuggestedResponseDto dto = new AiSuggestedResponseDto("r", "friendly", "en", List.of());
        when(aiMessagingService.generateSuggestedResponseAi("hi", "ctx", "en", 1L)).thenReturn(dto);

        Map<String, Object> body = new HashMap<>();
        body.put("message", "hi");
        body.put("context", "ctx");
        body.put("language", "en");

        AiSuggestedResponseDto result = controller.suggestResponseAi(body);

        assertEquals(dto, result);
    }

    @Test
    void suggestResponseAi_minimalBody() {
        AiSuggestedResponseDto dto = new AiSuggestedResponseDto("r", "neutral", "fr", List.of());
        when(aiMessagingService.generateSuggestedResponseAi(eq("msg"), eq(null), eq(null), eq(1L))).thenReturn(dto);

        Map<String, Object> body = new HashMap<>();
        body.put("message", "msg");

        AiSuggestedResponseDto result = controller.suggestResponseAi(body);

        assertEquals(dto, result);
    }
}
