package com.clenzy.controller;

import com.clenzy.service.BaitlyCrmEnrichmentRuns;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/prospect-enrichment-runs")
@PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
public class BaitlyCrmEnrichmentRunController {
    private final BaitlyCrmEnrichmentRuns runs;
    public BaitlyCrmEnrichmentRunController(BaitlyCrmEnrichmentRuns runs){this.runs=runs;}
    @GetMapping public BaitlyCrmEnrichmentRuns.Progress latest(@AuthenticationPrincipal Jwt jwt){return runs.latest(jwt.getSubject());}
    @PostMapping public BaitlyCrmEnrichmentRuns.Progress start(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BaitlyCrmEnrichmentRuns.Start input){return runs.start(jwt.getSubject(),input);}
    @PostMapping("/{id}/cancel") public void cancel(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){runs.cancel(jwt.getSubject(),id);}
}
