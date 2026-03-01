package com.clenzy.controller;

import com.clenzy.dto.ChannelContentMappingDto;
import com.clenzy.dto.CreateChannelContentMappingRequest;
import com.clenzy.service.ChannelContentService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/channel-content")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class ChannelContentController {

    private final ChannelContentService contentService;
    private final TenantContext tenantContext;

    public ChannelContentController(ChannelContentService contentService,
                                     TenantContext tenantContext) {
        this.contentService = contentService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<ChannelContentMappingDto> list(@RequestParam(required = false) Long propertyId) {
        Long orgId = tenantContext.getOrganizationId();
        if (propertyId != null) {
            return contentService.getByProperty(propertyId, orgId).stream()
                .map(ChannelContentMappingDto::from).toList();
        }
        return contentService.getAll(orgId).stream()
            .map(ChannelContentMappingDto::from).toList();
    }

    @GetMapping("/{id}")
    public ChannelContentMappingDto getById(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelContentMappingDto.from(contentService.getById(id, orgId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChannelContentMappingDto create(@Valid @RequestBody CreateChannelContentMappingRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelContentMappingDto.from(contentService.create(request, orgId));
    }

    @PutMapping("/{id}")
    public ChannelContentMappingDto update(@PathVariable Long id,
                                            @Valid @RequestBody CreateChannelContentMappingRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelContentMappingDto.from(contentService.update(id, orgId, request));
    }

    @PostMapping("/sync/{propertyId}")
    @ResponseStatus(HttpStatus.OK)
    public void sync(@PathVariable Long propertyId) {
        Long orgId = tenantContext.getOrganizationId();
        contentService.syncWithChannel(propertyId, orgId);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        contentService.delete(id, orgId);
    }
}
