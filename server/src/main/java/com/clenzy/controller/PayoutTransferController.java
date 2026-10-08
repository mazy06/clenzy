package com.clenzy.controller;

import com.clenzy.dto.PayoutTransferDto;
import com.clenzy.service.payout.PayoutTransferQueryService;
import com.clenzy.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Consultation du journal financier par les équipes plateforme, dans l'organisation sélectionnée. */
@RestController
@RequestMapping("/api/accounting/payout-transfers")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
public class PayoutTransferController {
    private final PayoutTransferQueryService service;
    private final TenantContext tenant;
    public PayoutTransferController(PayoutTransferQueryService service, TenantContext tenant) {
        this.service = service; this.tenant = tenant;
    }
    @GetMapping
    public Page<PayoutTransferDto> list(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) com.clenzy.model.PayoutTransfer.State state,
            @RequestParam(required = false) com.clenzy.model.PayoutTransfer.Source source,
            @RequestParam(defaultValue = "") String search) {
        return service.list(tenant.getRequiredOrganizationId(), page, size, state, source, search);
    }
    @GetMapping("/{id}")
    public PayoutTransferDto.Detail detail(@PathVariable Long id) {
        return service.detail(tenant.getRequiredOrganizationId(), id);
    }
}
