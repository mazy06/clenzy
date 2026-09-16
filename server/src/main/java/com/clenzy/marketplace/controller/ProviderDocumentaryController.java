package com.clenzy.marketplace.controller;
import com.clenzy.marketplace.service.ProviderDocumentaryService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/marketplace/documentary")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class ProviderDocumentaryController {
    private final ProviderDocumentaryService service;
    public ProviderDocumentaryController(ProviderDocumentaryService service) { this.service=service; }
    @GetMapping("/{providerId}") public ProviderDocumentaryService.View view(@PathVariable Long providerId) { return service.view(providerId); }
    @PostMapping("/{providerId}/reviews") public ProviderDocumentaryService.View review(@PathVariable Long providerId,
            @RequestBody ProviderDocumentaryService.Review request,@AuthenticationPrincipal Jwt jwt) {
        service.review(providerId,request,jwt.getSubject()); return service.view(providerId);
    }
    public record Reason(String reason) {}
    @PostMapping("/{providerId}/reviews/{reviewId}/revoke") public void revoke(@PathVariable Long providerId,@PathVariable Long reviewId,
            @RequestBody Reason request,@AuthenticationPrincipal Jwt jwt) { service.revoke(providerId,reviewId,request.reason(),jwt.getSubject()); }
    public record Rule(String country,String professionalStatus,String serviceScope,List<String> requiredTypes,boolean regulated,String reason) {}
    @PutMapping("/rules") public void rule(@RequestBody Rule request,@AuthenticationPrincipal Jwt jwt) {
        service.rule(request.country(),request.professionalStatus(),request.serviceScope(),request.requiredTypes(),request.regulated(),request.reason(),jwt.getSubject());
    }
}
