package com.clenzy.controller;

import com.clenzy.dto.ChannelFeeDto;
import com.clenzy.dto.CreateChannelFeeRequest;
import com.clenzy.service.ChannelFeeService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/channel-fees")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class ChannelFeeController {

    private final ChannelFeeService feeService;
    private final TenantContext tenantContext;

    public ChannelFeeController(ChannelFeeService feeService,
                                 TenantContext tenantContext) {
        this.feeService = feeService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<ChannelFeeDto> list(@RequestParam(required = false) Long propertyId) {
        Long orgId = tenantContext.getOrganizationId();
        if (propertyId != null) {
            return feeService.getByProperty(propertyId, orgId).stream()
                .map(ChannelFeeDto::from).toList();
        }
        return feeService.getAll(orgId).stream()
            .map(ChannelFeeDto::from).toList();
    }

    @GetMapping("/{id}")
    public ChannelFeeDto getById(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelFeeDto.from(feeService.getById(id, orgId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChannelFeeDto create(@Valid @RequestBody CreateChannelFeeRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelFeeDto.from(feeService.create(request, orgId));
    }

    @PutMapping("/{id}")
    public ChannelFeeDto update(@PathVariable Long id,
                                 @Valid @RequestBody CreateChannelFeeRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelFeeDto.from(feeService.update(id, orgId, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        feeService.delete(id, orgId);
    }
}
