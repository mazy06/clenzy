package com.clenzy.controller;

import com.clenzy.dto.WelcomeGuideDto;
import com.clenzy.service.WelcomeGuideService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/public/guide")
public class PublicGuideController {

    private final WelcomeGuideService guideService;

    public PublicGuideController(WelcomeGuideService guideService) {
        this.guideService = guideService;
    }

    @GetMapping("/{token}")
    public ResponseEntity<WelcomeGuideDto> getGuide(@PathVariable UUID token) {
        return guideService.getPublicGuide(token)
            .map(WelcomeGuideDto::from)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}
