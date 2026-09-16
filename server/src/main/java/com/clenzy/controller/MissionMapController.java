package com.clenzy.controller;

import com.clenzy.service.MissionMapQueryService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mission-map")
@PreAuthorize("isAuthenticated()")
public class MissionMapController {
    private final MissionMapQueryService service;
    public MissionMapController(MissionMapQueryService service) { this.service = service; }

    @GetMapping("/{kind}/overview")
    public MissionMapQueryService.Overview overview(@PathVariable String kind,
            @ModelAttribute MissionMapQueryService.Filters filters, @AuthenticationPrincipal Jwt jwt) {
        return service.overview(kind, filters, jwt);
    }

    @GetMapping("/{kind}/page")
    public MissionMapQueryService.Batch page(@PathVariable String kind,
            @ModelAttribute MissionMapQueryService.Filters filters,
            @RequestParam(defaultValue = "0") int page, @AuthenticationPrincipal Jwt jwt) {
        return service.page(kind, filters, page, jwt);
    }
}
