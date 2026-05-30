package com.clenzy.integration.pennylane.controller;

import com.clenzy.integration.pennylane.service.PennylaneAccountingSyncService;
import com.clenzy.integration.pennylane.service.PennylaneAccountingSyncService.SyncResult;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PennylaneAccountingController")
class PennylaneAccountingControllerTest {

    @Mock private PennylaneAccountingSyncService syncService;
    @Mock private TenantContext tenantContext;

    private PennylaneAccountingController controller;

    private static final Long ORG_ID = 42L;

    @BeforeEach
    void setUp() {
        controller = new PennylaneAccountingController(syncService, tenantContext);
    }

    @Test
    @DisplayName("syncInvoices — retourne le SyncResult du service")
    void syncInvoices_returnsServiceResult() {
        SyncResult result = new SyncResult("invoices", 3, 0, 3, List.of());
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(syncService.syncAllPendingInvoices(ORG_ID)).thenReturn(result);

        ResponseEntity<SyncResult> response = controller.syncInvoices();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(result);
        assertThat(response.getBody().type()).isEqualTo("invoices");
        assertThat(response.getBody().synced()).isEqualTo(3);
        verify(syncService).syncAllPendingInvoices(ORG_ID);
    }

    @Test
    @DisplayName("syncInvoices — resultat avec echecs propage erreurs")
    void syncInvoices_withFailures_propagatesErrors() {
        SyncResult result = new SyncResult("invoices", 1, 2, 3, List.of("err A", "err B"));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(syncService.syncAllPendingInvoices(ORG_ID)).thenReturn(result);

        ResponseEntity<SyncResult> response = controller.syncInvoices();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().failed()).isEqualTo(2);
        assertThat(response.getBody().errors()).hasSize(2);
    }

    @Test
    @DisplayName("syncExpenses — retourne le SyncResult du service")
    void syncExpenses_returnsServiceResult() {
        SyncResult result = new SyncResult("expenses", 5, 0, 5, List.of());
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(syncService.syncAllPendingExpenses(ORG_ID)).thenReturn(result);

        ResponseEntity<SyncResult> response = controller.syncExpenses();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(result);
        assertThat(response.getBody().type()).isEqualTo("expenses");
        verify(syncService).syncAllPendingExpenses(ORG_ID);
        verify(syncService, never()).syncAllPendingInvoices(ORG_ID);
    }

    @Test
    @DisplayName("syncAll — appelle invoices ET expenses, fusionne dans Map")
    void syncAll_callsBothAndMerges() {
        SyncResult invoices = new SyncResult("invoices", 2, 0, 2, List.of());
        SyncResult expenses = new SyncResult("expenses", 4, 1, 5, List.of("err"));

        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(syncService.syncAllPendingInvoices(ORG_ID)).thenReturn(invoices);
        when(syncService.syncAllPendingExpenses(ORG_ID)).thenReturn(expenses);

        ResponseEntity<Map<String, Object>> response = controller.syncAll();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("invoices", invoices)
                .containsEntry("expenses", expenses);
        verify(syncService).syncAllPendingInvoices(ORG_ID);
        verify(syncService).syncAllPendingExpenses(ORG_ID);
    }

    @Test
    @DisplayName("syncStatus — retourne le Map du service")
    void syncStatus_returnsServiceMap() {
        Map<String, Object> statusMap = new LinkedHashMap<>();
        statusMap.put("connected", true);
        statusMap.put("pendingInvoices", 7L);
        statusMap.put("pendingExpenses", 3L);
        statusMap.put("lastSyncAt", Instant.parse("2026-05-30T10:00:00Z"));

        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(syncService.getSyncStatus(ORG_ID)).thenReturn(statusMap);

        ResponseEntity<Map<String, Object>> response = controller.syncStatus();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("connected", true)
                .containsEntry("pendingInvoices", 7L)
                .containsEntry("pendingExpenses", 3L);
        verify(syncService).getSyncStatus(ORG_ID);
    }

    @Test
    @DisplayName("syncStatus — non connecte -> connected=false")
    void syncStatus_notConnected_returnsConnectedFalse() {
        Map<String, Object> statusMap = new LinkedHashMap<>();
        statusMap.put("connected", false);
        statusMap.put("pendingInvoices", 0L);
        statusMap.put("pendingExpenses", 0L);
        statusMap.put("lastSyncAt", null);

        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(syncService.getSyncStatus(ORG_ID)).thenReturn(statusMap);

        ResponseEntity<Map<String, Object>> response = controller.syncStatus();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("connected", false);
    }

    @Test
    @DisplayName("syncInvoices — org context absent -> IllegalStateException propagee")
    void syncInvoices_noOrgContext_throwsIllegalState() {
        when(tenantContext.getRequiredOrganizationId())
                .thenThrow(new IllegalStateException("Contexte d'organisation non resolu."));

        org.junit.jupiter.api.Assertions.assertThrows(
            IllegalStateException.class,
            () -> controller.syncInvoices()
        );
        verify(syncService, never()).syncAllPendingInvoices(org.mockito.ArgumentMatchers.any());
    }
}
