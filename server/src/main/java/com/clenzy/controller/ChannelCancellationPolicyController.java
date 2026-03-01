package com.clenzy.controller;

import com.clenzy.dto.ChannelCancellationPolicyDto;
import com.clenzy.dto.CreateChannelCancellationPolicyRequest;
import com.clenzy.service.ChannelCancellationPolicyService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/channel-cancellation-policies")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class ChannelCancellationPolicyController {

    private final ChannelCancellationPolicyService policyService;
    private final TenantContext tenantContext;

    public ChannelCancellationPolicyController(ChannelCancellationPolicyService policyService,
                                                TenantContext tenantContext) {
        this.policyService = policyService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<ChannelCancellationPolicyDto> list(@RequestParam(required = false) Long propertyId) {
        Long orgId = tenantContext.getOrganizationId();
        if (propertyId != null) {
            return policyService.getByProperty(propertyId, orgId).stream()
                .map(ChannelCancellationPolicyDto::from).toList();
        }
        return policyService.getAll(orgId).stream()
            .map(ChannelCancellationPolicyDto::from).toList();
    }

    @GetMapping("/{id}")
    public ChannelCancellationPolicyDto getById(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelCancellationPolicyDto.from(policyService.getById(id, orgId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChannelCancellationPolicyDto create(@Valid @RequestBody CreateChannelCancellationPolicyRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelCancellationPolicyDto.from(policyService.create(request, orgId));
    }

    @PutMapping("/{id}")
    public ChannelCancellationPolicyDto update(@PathVariable Long id,
                                                @Valid @RequestBody CreateChannelCancellationPolicyRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelCancellationPolicyDto.from(policyService.update(id, orgId, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        policyService.delete(id, orgId);
    }
}
