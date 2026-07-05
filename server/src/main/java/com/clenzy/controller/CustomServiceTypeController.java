package com.clenzy.controller;

import com.clenzy.dto.CustomServiceTypeDto;
import com.clenzy.dto.CustomServiceTypeRequest;
import com.clenzy.service.CustomServiceTypeService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Types de service personnalisés (« Autre ») réutilisables, org-scopés. Tout
 * opérateur authentifié peut lister/ajouter les types de SON organisation
 * (l'org vient du {@code TenantContext}, jamais du client). Controller mince :
 * délégation au service, aucun repository ici (règle ArchUnit).
 */
@RestController
@RequestMapping("/api/custom-service-types")
@PreAuthorize("isAuthenticated()")
public class CustomServiceTypeController {

    private final CustomServiceTypeService service;
    private final TenantContext tenantContext;

    public CustomServiceTypeController(CustomServiceTypeService service, TenantContext tenantContext) {
        this.service = service;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<CustomServiceTypeDto> list(@RequestParam String category) {
        return service.list(tenantContext.getRequiredOrganizationId(), category).stream()
                .map(CustomServiceTypeDto::from)
                .toList();
    }

    @PostMapping
    public CustomServiceTypeDto create(@RequestBody CustomServiceTypeRequest request) {
        return CustomServiceTypeDto.from(
                service.create(tenantContext.getRequiredOrganizationId(), request.category(), request.label()));
    }
}
