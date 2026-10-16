package com.clenzy.controller;

import com.clenzy.service.BaitlyOwnerMandatesService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/mobile/owner-mandates")
@PreAuthorize("isAuthenticated()")
public class BaitlyOwnerMandatesController {
    private final BaitlyOwnerMandatesService mandates;
    public BaitlyOwnerMandatesController(BaitlyOwnerMandatesService mandates) { this.mandates = mandates; }

    @GetMapping
    public List<BaitlyOwnerMandatesService.Mandate> list(@AuthenticationPrincipal Jwt jwt) {
        return mandates.list(jwt.getSubject());
    }
}
