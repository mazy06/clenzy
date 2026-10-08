package com.clenzy.controller;

import com.clenzy.service.BaitlyRefundSeriesStore;
import com.clenzy.service.ManagedRefundReconciliation;
import com.clenzy.model.TransactionStatus;
import com.clenzy.exception.PaymentValidationException;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/** Restitution d'une somme choisie sur une prestation de l'organisation active. */
@RestController
@RequestMapping("/api/payments")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlyRefundSeriesController {
    private final BaitlyRefundSeriesStore store;
    private final ManagedRefundReconciliation refunds;
    private final TenantContext tenant;
    public BaitlyRefundSeriesController(BaitlyRefundSeriesStore store,ManagedRefundReconciliation refunds,TenantContext tenant) {
        this.store=store; this.refunds=refunds; this.tenant=tenant;
    }
    public record Request(BigDecimal amount, UUID requestId) {}

    @ExceptionHandler(PaymentValidationException.class)
    public ResponseEntity<?> notReady(PaymentValidationException failure) {
        return ResponseEntity.badRequest().body(Map.of(
                "code", "REFUND_NOT_READY", "message", failure.getMessage(), "error", failure.getMessage()));
    }

    @GetMapping("/refund-installment/{reference}")
    public Map<String,Object> status(@PathVariable String reference) {
        return store.status(tenant.getRequiredOrganizationId(),reference);
    }

    @PostMapping("/{interventionId}/refund-installment")
    public ResponseEntity<?> refund(@PathVariable Long interventionId,@RequestBody Request request) {
        Long org=tenant.getRequiredOrganizationId();
        String ref=store.prepare(org,interventionId,request.amount(),request.requestId());
        var refund=refunds.resumeSeries(ref,org);
        if(refund.getStatus()!=TransactionStatus.COMPLETED && refund.getStatus()!=TransactionStatus.PROCESSING)
            throw new com.clenzy.exception.PaymentValidationException("Cette restitution doit être rapprochée avant toute nouvelle demande");
        var status=store.status(org,ref);
        return ResponseEntity.status("COMPLETED".equals(status.get("status"))?200:202)
                .body(Map.of("status",status.get("status"),"refundReference",ref,"message",
                        "La restitution est suivie automatiquement jusqu'à sa confirmation et son rapprochement."));
    }
}
