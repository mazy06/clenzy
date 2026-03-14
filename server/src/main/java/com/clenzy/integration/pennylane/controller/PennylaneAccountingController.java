package com.clenzy.integration.pennylane.controller;

import com.clenzy.integration.pennylane.service.PennylaneAccountingSyncService;
import com.clenzy.integration.pennylane.service.PennylaneAccountingSyncService.SyncResult;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Controller pour la synchronisation comptable vers Pennylane.
 */
@RestController
@RequestMapping("/api/pennylane/accounting")
@PreAuthorize("isAuthenticated()")
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneAccountingController {

    private static final Logger log = LoggerFactory.getLogger(PennylaneAccountingController.class);

    private final PennylaneAccountingSyncService syncService;
    private final TenantContext tenantContext;

    public PennylaneAccountingController(PennylaneAccountingSyncService syncService,
                                          TenantContext tenantContext) {
        this.syncService = syncService;
        this.tenantContext = tenantContext;
    }

    /**
     * Synchronise toutes les factures en attente vers Pennylane.
     */
    @PostMapping("/sync-invoices")
    public ResponseEntity<SyncResult> syncInvoices() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.info("Pennylane sync — lancement sync factures pour org={}", orgId);

        SyncResult result = syncService.syncAllPendingInvoices(orgId);
        return ResponseEntity.ok(result);
    }

    /**
     * Synchronise toutes les depenses en attente vers Pennylane.
     */
    @PostMapping("/sync-expenses")
    public ResponseEntity<SyncResult> syncExpenses() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.info("Pennylane sync — lancement sync depenses pour org={}", orgId);

        SyncResult result = syncService.syncAllPendingExpenses(orgId);
        return ResponseEntity.ok(result);
    }

    /**
     * Synchronise tout (factures + depenses) vers Pennylane.
     */
    @PostMapping("/sync-all")
    public ResponseEntity<Map<String, Object>> syncAll() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        log.info("Pennylane sync — lancement sync complete pour org={}", orgId);

        SyncResult invoices = syncService.syncAllPendingInvoices(orgId);
        SyncResult expenses = syncService.syncAllPendingExpenses(orgId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("invoices", invoices);
        result.put("expenses", expenses);
        return ResponseEntity.ok(result);
    }

    /**
     * Retourne le statut de synchronisation (elements en attente, derniere sync).
     */
    @GetMapping("/sync-status")
    public ResponseEntity<Map<String, Object>> syncStatus() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(syncService.getSyncStatus(orgId));
    }
}
