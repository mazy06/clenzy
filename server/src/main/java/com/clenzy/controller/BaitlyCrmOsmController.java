package com.clenzy.controller;

import com.clenzy.service.BaitlyCrmOsmMatching;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/prospect-locations/{id}/osm")
@PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
public class BaitlyCrmOsmController {
    private final BaitlyCrmOsmMatching matching;
    public BaitlyCrmOsmController(BaitlyCrmOsmMatching matching){this.matching=matching;}
    @PostMapping("/search")
    public BaitlyCrmOsmMatching.Results search(@AuthenticationPrincipal Jwt jwt,@PathVariable long id,@Valid @RequestBody BaitlyCrmOsmMatching.Search input){return matching.search(jwt.getSubject(),id,input);}
    @PostMapping("/confirm")
    public void confirm(@AuthenticationPrincipal Jwt jwt,@PathVariable long id,@Valid @RequestBody BaitlyCrmOsmMatching.Confirmation input){matching.confirm(jwt.getSubject(),id,input);}
}
