package com.clenzy.booking.controller;

import com.clenzy.booking.dto.AiCssGenerateRequestDto;
import com.clenzy.booking.dto.AiDesignAnalysisRequestDto;
import com.clenzy.booking.dto.AiDesignAnalysisResponseDto;
import com.clenzy.booking.service.AiDesignService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST controller for AI-powered design analysis.
 * Provides endpoints to analyze a client's website and generate
 * matching CSS for the booking engine widget.
 */
@RestController
@RequestMapping("/api/booking-engine/ai")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class BookingEngineAiController {

    private static final Logger log = LoggerFactory.getLogger(BookingEngineAiController.class);

    private final AiDesignService aiDesignService;

    public BookingEngineAiController(AiDesignService aiDesignService) {
        this.aiDesignService = aiDesignService;
    }

    /**
     * Analyze a website to extract design tokens and generate matching CSS.
     *
     * Pipeline: Fetch HTML/CSS → OpenAI extracts tokens → Claude generates CSS
     * Results are cached based on content hash — repeated calls with unchanged
     * website content return cached results.
     *
     * @param configId the booking engine config ID
     * @param request  contains the website URL to analyze
     * @return design tokens, generated CSS, cache status
     */
    @PostMapping("/analyze-website/{configId}")
    public ResponseEntity<AiDesignAnalysisResponseDto> analyzeWebsite(
            @PathVariable Long configId,
            @Valid @RequestBody AiDesignAnalysisRequestDto request
    ) {
        log.info("AI design analysis requested for config {} — URL: {}", configId, request.websiteUrl());

        AiDesignAnalysisResponseDto result = aiDesignService.analyzeWebsite(configId, request.websiteUrl());

        log.info("AI design analysis complete for config {} — fromCache: {}", configId, result.fromCache());
        return ResponseEntity.ok(result);
    }

    /**
     * Regenerate CSS from user-edited design tokens.
     *
     * Allows users to modify the extracted tokens and re-generate matching CSS
     * with optional additional instructions (e.g., "use more rounded corners").
     *
     * @param configId the booking engine config ID
     * @param request  design tokens + optional instructions
     * @return regenerated CSS
     */
    @PostMapping("/generate-css/{configId}")
    public ResponseEntity<Map<String, String>> generateCss(
            @PathVariable Long configId,
            @Valid @RequestBody AiCssGenerateRequestDto request
    ) {
        log.info("AI CSS generation requested for config {}", configId);

        String css = aiDesignService.regenerateCss(configId, request);

        return ResponseEntity.ok(Map.of("generatedCss", css));
    }
}
