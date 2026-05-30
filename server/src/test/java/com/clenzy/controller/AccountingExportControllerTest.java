package com.clenzy.controller;

import com.clenzy.model.Organization;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.service.AccountingExportService;
import com.clenzy.service.SepaXmlService;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountingExportControllerTest {

    @Mock private AccountingExportService exportService;
    @Mock private SepaXmlService sepaXmlService;
    @Mock private OwnerPayoutRepository payoutRepository;
    @Mock private OwnerPayoutConfigRepository configRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private TenantContext tenantContext;

    private AccountingExportController controller;

    @BeforeEach
    void setUp() {
        controller = new AccountingExportController(
                exportService, sepaXmlService,
                payoutRepository, configRepository, organizationRepository, tenantContext);
    }

    private OwnerPayout payout(Long id, Long ownerId, PayoutStatus status) {
        OwnerPayout p = new OwnerPayout();
        p.setId(id);
        p.setOwnerId(ownerId);
        p.setStatus(status);
        p.setOrganizationId(1L);
        p.setNetAmount(new BigDecimal("100"));
        return p;
    }

    private OwnerPayoutConfig config(Long ownerId, boolean verified) {
        OwnerPayoutConfig c = new OwnerPayoutConfig();
        c.setOwnerId(ownerId);
        c.setVerified(verified);
        c.setPayoutMethod(PayoutMethod.SEPA_TRANSFER);
        return c;
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

    @Nested
    @DisplayName("exportSepaXml")
    class ExportSepaXml {
        @Test
        void valid_returnsXml() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            Organization org = new Organization();
            org.setId(1L);
            org.setName("MyOrg");
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));

            OwnerPayout p1 = payout(1L, 10L, PayoutStatus.APPROVED);
            when(payoutRepository.findByIdsAndOrgId(List.of(1L), 1L)).thenReturn(List.of(p1));

            OwnerPayoutConfig c = config(10L, true);
            when(configRepository.findAllByOrgId(1L)).thenReturn(List.of(c));

            when(sepaXmlService.generatePain001(eq(org), any(), any()))
                    .thenReturn("<xml>test</xml>");

            ResponseEntity<byte[]> response = controller.exportSepaXml(List.of(1L));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_XML);
            assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                    .contains("SEPA_").contains(".xml");
        }

        @Test
        void processingStatus_alsoEligible() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            Organization org = new Organization();
            org.setId(1L);
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));

            OwnerPayout p1 = payout(1L, 10L, PayoutStatus.PROCESSING);
            when(payoutRepository.findByIdsAndOrgId(List.of(1L), 1L)).thenReturn(List.of(p1));

            OwnerPayoutConfig c = config(10L, true);
            when(configRepository.findAllByOrgId(1L)).thenReturn(List.of(c));

            when(sepaXmlService.generatePain001(any(), any(), any())).thenReturn("<xml/>");

            ResponseEntity<byte[]> response = controller.exportSepaXml(List.of(1L));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void organizationNotFound_throws() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(organizationRepository.findById(1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.exportSepaXml(List.of(1L)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Organisation introuvable");
        }

        @Test
        void noEligiblePayouts_throws() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            Organization org = new Organization();
            org.setId(1L);
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
            // payout is PENDING => not eligible
            OwnerPayout p1 = payout(1L, 10L, PayoutStatus.PENDING);
            when(payoutRepository.findByIdsAndOrgId(List.of(1L), 1L)).thenReturn(List.of(p1));

            assertThatThrownBy(() -> controller.exportSepaXml(List.of(1L)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Aucun payout eligible");
        }

        @Test
        void emptyEligiblePayouts_throws() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            Organization org = new Organization();
            org.setId(1L);
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
            when(payoutRepository.findByIdsAndOrgId(List.of(1L), 1L)).thenReturn(List.of());

            assertThatThrownBy(() -> controller.exportSepaXml(List.of(1L)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Aucun payout eligible");
        }

        @Test
        void unverifiedConfig_throws() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            Organization org = new Organization();
            org.setId(1L);
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));

            OwnerPayout p1 = payout(1L, 10L, PayoutStatus.APPROVED);
            when(payoutRepository.findByIdsAndOrgId(List.of(1L), 1L)).thenReturn(List.of(p1));

            OwnerPayoutConfig unverified = config(10L, false);
            when(configRepository.findAllByOrgId(1L)).thenReturn(List.of(unverified));

            assertThatThrownBy(() -> controller.exportSepaXml(List.of(1L)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("non verifiee");
        }

        @Test
        void missingConfigForOwner_throws() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            Organization org = new Organization();
            org.setId(1L);
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));

            OwnerPayout p1 = payout(1L, 10L, PayoutStatus.APPROVED);
            when(payoutRepository.findByIdsAndOrgId(List.of(1L), 1L)).thenReturn(List.of(p1));
            // No config for owner 10
            when(configRepository.findAllByOrgId(1L)).thenReturn(List.of());

            assertThatThrownBy(() -> controller.exportSepaXml(List.of(1L)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("non verifiee");
        }
    }
}
