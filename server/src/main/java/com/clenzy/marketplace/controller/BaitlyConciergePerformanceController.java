package com.clenzy.marketplace.controller;
import com.clenzy.marketplace.service.BaitlyConciergePerformance;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mobile/concierge-performance")
@PreAuthorize("isAuthenticated()")
public class BaitlyConciergePerformanceController {
    private final BaitlyConciergePerformance performance;
    public BaitlyConciergePerformanceController(BaitlyConciergePerformance performance) { this.performance=performance; }
    public record Consent(boolean published) {}
    @GetMapping public BaitlyConciergePerformance.Settings settings(@AuthenticationPrincipal Jwt jwt) {
        return performance.settings(jwt.getSubject());
    }
    @PutMapping public BaitlyConciergePerformance.Settings publish(@RequestBody Consent consent,@AuthenticationPrincipal Jwt jwt) {
        return performance.publish(consent.published(),jwt.getSubject());
    }
}
