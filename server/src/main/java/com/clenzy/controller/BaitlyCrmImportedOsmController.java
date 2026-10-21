package com.clenzy.controller;

import com.clenzy.service.BaitlyCrmImportedOsmSearch;
import com.clenzy.service.BaitlyCrmOsmMatching;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/prospect-locations/{id}/osm/imported-search")
@PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
public class BaitlyCrmImportedOsmController {
    private final BaitlyCrmImportedOsmSearch search;
    public BaitlyCrmImportedOsmController(BaitlyCrmImportedOsmSearch search){this.search=search;}
    @PostMapping
    public BaitlyCrmOsmMatching.Results search(@AuthenticationPrincipal Jwt jwt,@PathVariable long id){return search.search(jwt.getSubject(),id);}
}
