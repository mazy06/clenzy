package com.clenzy.controller;
import com.clenzy.service.BaitlyManagerMissionReview;
import com.clenzy.dto.InterventionResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import jakarta.validation.Valid;
@RestController @RequestMapping("/api/mobile/missions") @PreAuthorize("isAuthenticated()")
public class BaitlyManagerMissionReviewController {
    private final BaitlyManagerMissionReview service;
    public BaitlyManagerMissionReviewController(BaitlyManagerMissionReview service){this.service=service;}
    @PostMapping("/{id}/manager-review") public InterventionResponse review(@PathVariable Long id,@Valid @RequestBody BaitlyManagerMissionReview.Review command,@AuthenticationPrincipal Jwt jwt){return service.record(id,command,jwt);}
}
