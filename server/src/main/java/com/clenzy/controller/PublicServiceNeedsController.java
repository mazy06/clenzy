package com.clenzy.controller;

import com.clenzy.service.assignment.PublicServiceNeeds;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/service-assignments/public")
@PreAuthorize("isAuthenticated()")
public class PublicServiceNeedsController {
    private final PublicServiceNeeds service;
    public PublicServiceNeedsController(PublicServiceNeeds service) { this.service=service; }
    @GetMapping
    public PublicServiceNeeds.Page list(@AuthenticationPrincipal Jwt jwt,@RequestParam(required=false) Long cursor) {
        if (cursor!=null && cursor<0) throw new IllegalArgumentException("Curseur invalide");
        return service.list(jwt,cursor);
    }
    @PostMapping("/{id}/offers")
    public Long offer(@PathVariable Long id,@RequestBody PublicServiceNeeds.Offer offer,@AuthenticationPrincipal Jwt jwt) {
        return service.offer(id,offer,jwt);
    }
}
