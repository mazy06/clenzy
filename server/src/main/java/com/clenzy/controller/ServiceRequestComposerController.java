package com.clenzy.controller;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.service.ServiceRequestComposerService;
import com.clenzy.service.ServiceRequestComposerService.Draft;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/** Catalogue composition reuses PMS requests, ownership checks and allocation. */
@RestController
@RequestMapping("/api/service-requests")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class ServiceRequestComposerController {
    private final ServiceRequestComposerService service;
    public ServiceRequestComposerController(ServiceRequestComposerService service) { this.service = service; }

    @PostMapping("/estimate")
    public List<ServiceRequestComposerService.Estimate> estimate(@RequestBody Draft draft) {
        return service.estimate(draft);
    }

    @PostMapping("/batch")
    @ResponseStatus(HttpStatus.CREATED)
    public List<ServiceRequestDto> create(@RequestBody Draft draft, @AuthenticationPrincipal Jwt jwt) {
        return service.create(draft, jwt.getSubject());
    }
}
