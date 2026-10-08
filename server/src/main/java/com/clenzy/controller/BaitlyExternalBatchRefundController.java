package com.clenzy.controller;

import com.clenzy.service.BaitlyExternalBatchRefunds;
import com.clenzy.tenant.TenantContext;
import com.clenzy.exception.PaymentValidationException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** Rapprochement documentaire Baitly, réservé à l'administration de l'organisation active. */
@RestController
@RequestMapping("/api/payments/{interventionId}/external-batch-refunds")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlyExternalBatchRefundController {
    private final BaitlyExternalBatchRefunds refunds;
    private final TenantContext tenant;
    public BaitlyExternalBatchRefundController(BaitlyExternalBatchRefunds refunds,TenantContext tenant) {
        this.refunds=refunds; this.tenant=tenant;
    }
    public record Assignment(BigDecimal amount,String currency,String reason) {}
    public record Distribution(BigDecimal amount,String currency,String reason,List<BaitlyExternalBatchRefunds.Portion> portions) {}
    @GetMapping("/targets")
    public List<BaitlyExternalBatchRefunds.Target> targets(@PathVariable Long interventionId) {
        return refunds.targets(tenant.getRequiredOrganizationId(),interventionId);
    }
    @PostMapping("/{reference}/distribution")
    public ResponseEntity<BaitlyExternalBatchRefunds.Item> distribute(@PathVariable Long interventionId,@PathVariable String reference,
            @RequestBody Distribution request,@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.accepted().body(refunds.distribute(tenant.getRequiredOrganizationId(),interventionId,reference,
                request.amount(),request.currency(),request.portions(),request.reason(),jwt.getSubject()));
    }
    @GetMapping
    public List<BaitlyExternalBatchRefunds.Item> list(@PathVariable Long interventionId) {
        return refunds.list(tenant.getRequiredOrganizationId(),interventionId);
    }
    @PostMapping("/{reference}/assignment")
    public ResponseEntity<BaitlyExternalBatchRefunds.Item> assign(@PathVariable Long interventionId,@PathVariable String reference,
            @RequestBody Assignment request,@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.accepted().body(refunds.assign(tenant.getRequiredOrganizationId(),interventionId,reference,
                request.amount(),request.currency(),request.reason(),jwt.getSubject()));
    }
    @ExceptionHandler(PaymentValidationException.class)
    public ResponseEntity<?> invalid(PaymentValidationException error) {
        return ResponseEntity.badRequest().body(Map.of("code","EXTERNAL_REFUND_REVIEW","message",error.getMessage(),"error",error.getMessage()));
    }
}
