package com.clenzy.integration.pennylane.controller;

import com.clenzy.integration.pennylane.service.PennylaneAccountingSyncService;
import com.clenzy.integration.pennylane.service.PennylaneAccountingSyncService.SyncResult;
import com.clenzy.tenant.TenantContext;
import com.clenzy.service.OrganizationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.access.AccessDeniedException;
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
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER', 'HOST')")
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneAccountingController {

    private static final Logger log = LoggerFactory.getLogger(PennylaneAccountingController.class);

    private final PennylaneAccountingSyncService syncService;
    private final TenantContext tenantContext;
    private final OrganizationService organizationAccess;

    public PennylaneAccountingController(PennylaneAccountingSyncService syncService,
                                          TenantContext tenantContext, OrganizationService organizationAccess) {
        this.syncService = syncService;
        this.tenantContext = tenantContext;
        this.organizationAccess = organizationAccess;
    }

    /**
     * Synchronise toutes les factures en attente vers Pennylane.
     */
    @PostMapping("/sync-invoices")
    public ResponseEntity<SyncResult> syncInvoices(@AuthenticationPrincipal Jwt jwt) {
        Long orgId = requireManager(jwt);
        log.info("Pennylane sync — lancement sync factures pour org={}", orgId);

        SyncResult result = syncService.syncAllPendingInvoices(orgId);
        return ResponseEntity.ok(result);
    }

    /**
     * Synchronise toutes les depenses en attente vers Pennylane.
     */
    @PostMapping("/sync-expenses")
    public ResponseEntity<SyncResult> syncExpenses(@AuthenticationPrincipal Jwt jwt) {
        Long orgId = requireManager(jwt);
        log.info("Pennylane sync — lancement sync depenses pour org={}", orgId);

        SyncResult result = syncService.syncAllPendingExpenses(orgId);
        return ResponseEntity.ok(result);
    }

    /**
     * Synchronise tout (factures + depenses) vers Pennylane.
     */
    @PostMapping("/sync-all")
    public ResponseEntity<Map<String, Object>> syncAll(@AuthenticationPrincipal Jwt jwt) {
        Long orgId = requireManager(jwt);
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
    public ResponseEntity<Map<String, Object>> syncStatus(@AuthenticationPrincipal Jwt jwt) {
        Long orgId = requireManager(jwt);
        return ResponseEntity.ok(syncService.getSyncStatus(orgId));
    }
    private Long requireManager(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new AccessDeniedException("Identité requise");
        }
        Long orgId = tenantContext.getRequiredOrganizationId();
        if (orgId == null || orgId <= 0) throw new AccessDeniedException("Organisation requise");
        organizationAccess.validateOrgManagement(jwt.getSubject(), orgId);
        return orgId;
    }
}
