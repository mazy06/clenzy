package com.clenzy.controller;

import com.clenzy.dto.BeneficiaryTransferDto;
import com.clenzy.service.paymentconnect.PaymentConnectAccess.Scope;
import com.clenzy.service.payout.BeneficiaryPayoutService;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/my-payout-transfers")
@PreAuthorize("isAuthenticated()")
public class BeneficiaryPayoutController {
    private final BeneficiaryPayoutService service;
    public BeneficiaryPayoutController(BeneficiaryPayoutService service) { this.service=service; }
    @GetMapping
    public Page<BeneficiaryTransferDto> list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue="PERSONAL") Scope scope,@RequestParam(defaultValue="0") int page) {
        return service.list(jwt.getSubject(),scope,page);
    }
    @GetMapping("/{id}")
    public BeneficiaryTransferDto.Detail detail(@AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,@RequestParam(defaultValue="PERSONAL") Scope scope) {
        return service.detail(jwt.getSubject(),scope,id);
    }
}
