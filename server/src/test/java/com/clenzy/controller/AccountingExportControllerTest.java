package com.clenzy.controller;

import com.clenzy.service.AccountingExportService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountingExportControllerTest {

    @Mock private AccountingExportService exportService;
    @Mock private TenantContext tenantContext;

    private AccountingExportController controller;

    @BeforeEach
    void setUp() {
        controller = new AccountingExportController(exportService, tenantContext);
    }

    private LocalDate from = LocalDate.of(2026, 5, 1);
    private LocalDate to = LocalDate.of(2026, 5, 31);

    // ── exportFec ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("exportFec")
    class ExportFec {
        @Test
        void returnsContentWithCorrectHeaders() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(exportService.exportFec(1L, from, to)).thenReturn("JournalCode\tEcritureNum\n");

            ResponseEntity<byte[]> response = controller.exportFec(from, to);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.TEXT_PLAIN);
            assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                    .contains("FEC_").contains(".txt");
            assertThat(response.getBody()).isNotEmpty();
        }
    }

    // ── exportReservationsCsv ────────────────────────────────────────────

    @Nested
    @DisplayName("exportReservationsCsv")
    class ExportReservations {
        @Test
        void returnsCsv() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(exportService.exportReservationsCsv(1L, from, to))
                    .thenReturn("id;guest\n1;John");

            ResponseEntity<byte[]> response = controller.exportReservationsCsv(from, to);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getHeaders().getContentType().toString()).isEqualTo("text/csv");
            assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                    .contains("reservations_").contains(".csv");
        }
    }

    // ── exportPayoutsCsv ─────────────────────────────────────────────────

    @Nested
    @DisplayName("exportPayoutsCsv")
    class ExportPayouts {
        @Test
        void returnsCsv() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(exportService.exportPayoutsCsv(1L, from, to)).thenReturn("id;net\n1;100");

            ResponseEntity<byte[]> response = controller.exportPayoutsCsv(from, to);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                    .contains("payouts_");
        }
    }

    // ── exportExpensesCsv ────────────────────────────────────────────────

    @Nested
    @DisplayName("exportExpensesCsv")
    class ExportExpenses {
        @Test
        void returnsCsv() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(exportService.exportExpensesCsv(1L, from, to)).thenReturn("id;amount\n1;50");

            ResponseEntity<byte[]> response = controller.exportExpensesCsv(from, to);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                    .contains("depenses_");
        }
    }

    // ── exportInvoicesCsv ────────────────────────────────────────────────

    @Nested
    @DisplayName("exportInvoicesCsv")
    class ExportInvoices {
        @Test
        void returnsCsv() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(exportService.exportInvoicesCsv(1L, from, to)).thenReturn("id;num\n1;F-001");

            ResponseEntity<byte[]> response = controller.exportInvoicesCsv(from, to);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                    .contains("factures_");
        }
    }

    // ── exportSepaXml ────────────────────────────────────────────────────

    // Les scenarios de validation metier (org introuvable, eligibilite des
    // statuts, configs non verifiees) sont testes dans
    // AccountingExportServiceTest.GenerateSepaXml — la logique a ete deplacee
    // du controller vers AccountingExportService.generateSepaXml.
    @Nested
    @DisplayName("exportSepaXml")
    class ExportSepaXml {
        @Test
        void valid_returnsXml() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(exportService.generateSepaXml(List.of(1L), 1L)).thenReturn("<xml>test</xml>");

            ResponseEntity<byte[]> response = controller.exportSepaXml(List.of(1L));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_XML);
            assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                    .contains("SEPA_").contains(".xml");
        }

        @Test
        void serviceError_propagates() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(exportService.generateSepaXml(List.of(1L), 1L))
                    .thenThrow(new IllegalArgumentException("Organisation introuvable"));

            assertThatThrownBy(() -> controller.exportSepaXml(List.of(1L)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Organisation introuvable");
        }
    }
}
