package com.clenzy.controller;

import com.clenzy.service.BaitlyCrmExactOsmEnrichment;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/prospect-location-review/{id}/enrich")
@PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
public class BaitlyCrmExactOsmEnrichmentController {
    private final BaitlyCrmExactOsmEnrichment enrichment;
    public BaitlyCrmExactOsmEnrichmentController(BaitlyCrmExactOsmEnrichment enrichment){this.enrichment=enrichment;}
    @PostMapping public BaitlyCrmExactOsmEnrichment.Outcome enrich(@AuthenticationPrincipal Jwt jwt,@PathVariable long id){return enrichment.enrich(jwt.getSubject(),id);}
}
