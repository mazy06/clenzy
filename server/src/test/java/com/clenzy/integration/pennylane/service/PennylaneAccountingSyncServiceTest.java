package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.model.PennylaneConnection;
import com.clenzy.integration.pennylane.repository.PennylaneConnectionRepository;
import com.clenzy.model.ExpenseStatus;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceLine;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.model.ProviderExpense;
import com.clenzy.model.User;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link PennylaneAccountingSyncService}.
 *
 * <p>Covers single-item sync (invoice + expense), batch sync, lookup vs.
 * create of customers/suppliers, VAT rate mapping, error handling, last-sync
 * tracking, and the connection-required guard.</p>
 */
@ExtendWith(MockitoExtension.class)
class PennylaneAccountingSyncServiceTest {

    @Mock private PennylaneAccountingClient client;
    @Mock private PennylaneOAuthService oauthService;
    @Mock private PennylaneConnectionRepository connectionRepository;
    @Mock private InvoiceRepository invoiceRepository;
    @Mock private ProviderExpenseRepository expenseRepository;

    private PennylaneAccountingSyncService service;

    private static final Long ORG_ID = 10L;

    @BeforeEach
    void setUp() {
        service = new PennylaneAccountingSyncService(
                client, oauthService, connectionRepository, invoiceRepository, expenseRepository);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private Invoice baseInvoice(Long id, String number, String status) {
        Invoice inv = new Invoice();
        inv.setId(id);
        inv.setOrganizationId(ORG_ID);
        inv.setInvoiceNumber(number);
        inv.setInvoiceDate(LocalDate.of(2026, 1, 15));
        inv.setDueDate(LocalDate.of(2026, 2, 15));
        inv.setBuyerName("Customer Inc");
        inv.setStatus(InvoiceStatus.valueOf(status));
        inv.setTotalHt(new BigDecimal("100.00"));
        inv.setTotalTax(new BigDecimal("20.00"));
        inv.setTotalTtc(new BigDecimal("120.00"));
        InvoiceLine line = new InvoiceLine();
        line.setDescription("Service");
        line.setQuantity(new BigDecimal("1"));
        line.setUnitPriceHt(new BigDecimal("100.00"));
        line.setTaxRate(new BigDecimal("0.20"));
        inv.setLines(List.of(line));
        return inv;
    }

    private ProviderExpense baseExpense(Long id, ExpenseStatus status) {
        ProviderExpense e = new ProviderExpense();
        e.setId(id);
        e.setOrganizationId(ORG_ID);
        User provider = new User();
        provider.setId(7L);
        provider.setFirstName("Bob");
        provider.setLastName("Smith");
        e.setProvider(provider);
        e.setDescription("Cleaning service");
        e.setAmountHt(new BigDecimal("50.00"));
        e.setTaxRate(new BigDecimal("0.10"));
        e.setExpenseDate(LocalDate.of(2026, 3, 5));
        e.setStatus(status);
        return e;
    }

    private Map<String, Object> withId(Object id) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", id);
        return m;
    }

    // ─── syncInvoice ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("syncInvoice")
    class SyncInvoice {

        @Test
        void whenCustomerAlreadyExists_thenReusesIdAndCreatesInvoice() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(123)));
            when(client.createCustomerInvoice(eq(ORG_ID), any())).thenReturn(withId(999));
            when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

            Invoice invoice = baseInvoice(1L, "INV-001", "ISSUED");
            service.syncInvoice(invoice);

            verify(client, never()).createCustomer(eq(ORG_ID), any());
            verify(client).createCustomerInvoice(eq(ORG_ID), any());
            assertThat(invoice.getPennylaneInvoiceId()).isEqualTo("999");
            assertThat(invoice.getPennylaneSyncedAt()).isNotNull();
        }

        @Test
        void whenCustomerMissing_thenCreatesCustomerThenInvoice() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString())).thenReturn(Optional.empty());
            when(client.createCustomer(eq(ORG_ID), any())).thenReturn(withId(555));
            when(client.createCustomerInvoice(eq(ORG_ID), any())).thenReturn(withId(777));
            when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

            Invoice invoice = baseInvoice(2L, "INV-002", "ISSUED");
            service.syncInvoice(invoice);

            verify(client).createCustomer(eq(ORG_ID), any());
            assertThat(invoice.getPennylaneInvoiceId()).isEqualTo("777");
        }

        @Test
        void whenCustomerLookupReturnsNonNumberId_thenStillCreates() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            // existing.get("id") not a Number → fallthrough to creation
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId("not-a-number")));
            when(client.createCustomer(eq(ORG_ID), any())).thenReturn(withId(555));
            when(client.createCustomerInvoice(eq(ORG_ID), any())).thenReturn(withId(777));
            when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

            Invoice invoice = baseInvoice(3L, "INV-003", "ISSUED");
            service.syncInvoice(invoice);

            verify(client).createCustomer(eq(ORG_ID), any());
            assertThat(invoice.getPennylaneInvoiceId()).isEqualTo("777");
        }

        @Test
        void whenCreateCustomerReturnsInvalidId_thenThrows() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString())).thenReturn(Optional.empty());
            when(client.createCustomer(eq(ORG_ID), any())).thenReturn(withId("not-a-number"));

            Invoice invoice = baseInvoice(4L, "INV-004", "ISSUED");

            assertThatThrownBy(() -> service.syncInvoice(invoice))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("id invalide");
        }

        @Test
        void whenCreateCustomerReturnsNull_thenThrows() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString())).thenReturn(Optional.empty());
            when(client.createCustomer(eq(ORG_ID), any())).thenReturn(null);

            Invoice invoice = baseInvoice(4L, "INV-004", "ISSUED");

            assertThatThrownBy(() -> service.syncInvoice(invoice))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void whenInvoiceResponseHasNoId_thenThrowsAndDoesNotSave() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));
            when(client.createCustomerInvoice(eq(ORG_ID), any())).thenReturn(new HashMap<>());

            Invoice invoice = baseInvoice(5L, "INV-005", "PAID");

            assertThatThrownBy(() -> service.syncInvoice(invoice))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("id absent");
            verify(invoiceRepository, never()).save(any(Invoice.class));
        }

        @Test
        void whenInvoiceResponseNull_thenThrows() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));
            when(client.createCustomerInvoice(eq(ORG_ID), any())).thenReturn(null);

            Invoice invoice = baseInvoice(5L, "INV-005", "PAID");

            assertThatThrownBy(() -> service.syncInvoice(invoice))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void whenNotConnected_thenThrowsAndNeverCallsApi() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(false);

            assertThatThrownBy(() -> service.syncInvoice(baseInvoice(1L, "INV-001", "ISSUED")))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("non connectee");

            verify(client, never()).findCustomerByExternalRef(anyLong(), anyString());
            verify(client, never()).createCustomerInvoice(anyLong(), any());
        }

        @Test
        void whenDueDateNull_thenAddsThirtyDays() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));
            when(client.createCustomerInvoice(eq(ORG_ID), any())).thenReturn(withId(1));
            when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

            Invoice invoice = baseInvoice(1L, "INV-001", "ISSUED");
            invoice.setDueDate(null);

            service.syncInvoice(invoice);

            ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
            verify(client).createCustomerInvoice(eq(ORG_ID), captor.capture());
            assertThat(captor.getValue().get("deadline")).isEqualTo("2026-02-14");
        }

        @Test
        void whenBuyerNameNull_thenUsesDefaultName() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString())).thenReturn(Optional.empty());
            when(client.createCustomer(eq(ORG_ID), any())).thenReturn(withId(2));
            when(client.createCustomerInvoice(eq(ORG_ID), any())).thenReturn(withId(3));
            when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

            Invoice invoice = baseInvoice(1L, "INV-001", "ISSUED");
            invoice.setBuyerName(null);
            service.syncInvoice(invoice);

            ArgumentCaptor<Map<String, Object>> custCaptor = ArgumentCaptor.forClass(Map.class);
            verify(client).createCustomer(eq(ORG_ID), custCaptor.capture());
            assertThat(custCaptor.getValue().get("name")).isEqualTo("Client Clenzy");
        }

        @Test
        void invoiceBodyContainsExternalReferenceAndLines() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));
            when(client.createCustomerInvoice(eq(ORG_ID), any())).thenReturn(withId(99));
            when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

            Invoice invoice = baseInvoice(1L, "INV-ZZ", "ISSUED");
            service.syncInvoice(invoice);

            ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
            verify(client).createCustomerInvoice(eq(ORG_ID), captor.capture());
            Map<String, Object> body = captor.getValue();
            assertThat(body.get("external_reference")).isEqualTo("clenzy_inv_INV-ZZ");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> lines = (List<Map<String, Object>>) body.get("invoice_lines");
            assertThat(lines).hasSize(1);
            assertThat(lines.get(0).get("label")).isEqualTo("Service");
            assertThat(lines.get(0).get("vat_rate")).isEqualTo("FR_200");
        }
    }

    // ─── syncExpense ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("syncExpense")
    class SyncExpense {

        @Test
        void whenSupplierExists_thenReusesIdAndCreatesExpense() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findSupplierByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(321)));
            when(client.createSupplierInvoice(eq(ORG_ID), any())).thenReturn(withId(888));
            when(expenseRepository.save(any(ProviderExpense.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ProviderExpense exp = baseExpense(10L, ExpenseStatus.APPROVED);
            service.syncExpense(exp);

            verify(client, never()).createSupplier(eq(ORG_ID), any());
            assertThat(exp.getPennylaneInvoiceId()).isEqualTo("888");
            assertThat(exp.getPennylaneSyncedAt()).isNotNull();
        }

        @Test
        void whenSupplierMissing_thenCreatesIt() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findSupplierByExternalRef(eq(ORG_ID), anyString())).thenReturn(Optional.empty());
            when(client.createSupplier(eq(ORG_ID), any())).thenReturn(withId(900));
            when(client.createSupplierInvoice(eq(ORG_ID), any())).thenReturn(withId(901));
            when(expenseRepository.save(any(ProviderExpense.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ProviderExpense exp = baseExpense(11L, ExpenseStatus.PAID);
            service.syncExpense(exp);

            verify(client).createSupplier(eq(ORG_ID), any());
        }

        @Test
        void whenProviderNull_thenUsesFallbackNames() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findSupplierByExternalRef(eq(ORG_ID), anyString())).thenReturn(Optional.empty());
            when(client.createSupplier(eq(ORG_ID), any())).thenReturn(withId(900));
            when(client.createSupplierInvoice(eq(ORG_ID), any())).thenReturn(withId(901));
            when(expenseRepository.save(any(ProviderExpense.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ProviderExpense exp = baseExpense(12L, ExpenseStatus.APPROVED);
            exp.setProvider(null);
            service.syncExpense(exp);

            ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
            verify(client).createSupplier(eq(ORG_ID), captor.capture());
            assertThat(captor.getValue().get("name")).isEqualTo("Fournisseur inconnu");
            assertThat(captor.getValue().get("external_reference")).isEqualTo("clenzy_supplier_unknown");
        }

        @Test
        void whenExpenseResponseHasNoId_thenThrowsAndDoesNotSave() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findSupplierByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));
            when(client.createSupplierInvoice(eq(ORG_ID), any())).thenReturn(new HashMap<>());

            ProviderExpense exp = baseExpense(13L, ExpenseStatus.APPROVED);

            assertThatThrownBy(() -> service.syncExpense(exp))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("id absent");
            verify(expenseRepository, never()).save(any(ProviderExpense.class));
        }

        @Test
        void whenExpenseResponseNull_thenThrows() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findSupplierByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));
            when(client.createSupplierInvoice(eq(ORG_ID), any())).thenReturn(null);

            ProviderExpense exp = baseExpense(13L, ExpenseStatus.APPROVED);

            assertThatThrownBy(() -> service.syncExpense(exp))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void expenseBodyHasOneLineWithCorrectFields() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findSupplierByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));
            when(client.createSupplierInvoice(eq(ORG_ID), any())).thenReturn(withId(50));
            when(expenseRepository.save(any(ProviderExpense.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ProviderExpense exp = baseExpense(14L, ExpenseStatus.APPROVED);
            service.syncExpense(exp);

            ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
            verify(client).createSupplierInvoice(eq(ORG_ID), captor.capture());
            Map<String, Object> body = captor.getValue();
            assertThat(body.get("external_reference")).isEqualTo("clenzy_exp_14");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> lines = (List<Map<String, Object>>) body.get("invoice_lines");
            assertThat(lines).hasSize(1);
            assertThat(lines.get(0).get("vat_rate")).isEqualTo("FR_100");
        }

        @Test
        void whenSupplierLookupReturnsNonNumberId_thenStillCreatesSupplier() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findSupplierByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId("not-num")));
            when(client.createSupplier(eq(ORG_ID), any())).thenReturn(withId(2));
            when(client.createSupplierInvoice(eq(ORG_ID), any())).thenReturn(withId(3));
            when(expenseRepository.save(any(ProviderExpense.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ProviderExpense exp = baseExpense(15L, ExpenseStatus.APPROVED);
            service.syncExpense(exp);

            verify(client).createSupplier(eq(ORG_ID), any());
        }

        @Test
        void whenCreateSupplierReturnsInvalidId_thenThrows() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findSupplierByExternalRef(eq(ORG_ID), anyString())).thenReturn(Optional.empty());
            when(client.createSupplier(eq(ORG_ID), any())).thenReturn(withId("bad"));

            ProviderExpense exp = baseExpense(16L, ExpenseStatus.APPROVED);

            assertThatThrownBy(() -> service.syncExpense(exp))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("id invalide");
        }
    }

    // ─── batch sync ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("syncAllPendingInvoices")
    class SyncAllPendingInvoices {

        @Test
        void whenAllSucceed_thenReturnsSyncedCount() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            Invoice i1 = baseInvoice(1L, "I-001", "ISSUED");
            Invoice i2 = baseInvoice(2L, "I-002", "PAID");
            when(invoiceRepository.findPendingPennylaneSync(eq(ORG_ID), any()))
                    .thenReturn(List.of(i1, i2));
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));
            when(client.createCustomerInvoice(eq(ORG_ID), any())).thenReturn(withId(100));
            when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

            PennylaneConnection conn = new PennylaneConnection();
            conn.setOrganizationId(ORG_ID);
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));

            PennylaneAccountingSyncService.SyncResult result = service.syncAllPendingInvoices(ORG_ID);

            assertThat(result.type()).isEqualTo("invoices");
            assertThat(result.synced()).isEqualTo(2);
            assertThat(result.failed()).isEqualTo(0);
            assertThat(result.total()).isEqualTo(2);
            assertThat(result.errors()).isEmpty();
            verify(connectionRepository).save(conn);
            assertThat(conn.getLastSyncAt()).isNotNull();
        }

        @Test
        void whenOneFails_thenContinuesAndReportsError() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            Invoice i1 = baseInvoice(1L, "I-001", "ISSUED");
            Invoice i2 = baseInvoice(2L, "I-002", "PAID");
            when(invoiceRepository.findPendingPennylaneSync(eq(ORG_ID), any()))
                    .thenReturn(List.of(i1, i2));
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));
            when(client.createCustomerInvoice(eq(ORG_ID), any()))
                    .thenReturn(withId(100))
                    .thenThrow(new RuntimeException("API 500"));
            when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            PennylaneAccountingSyncService.SyncResult result = service.syncAllPendingInvoices(ORG_ID);

            assertThat(result.synced()).isEqualTo(1);
            assertThat(result.failed()).isEqualTo(1);
            assertThat(result.total()).isEqualTo(2);
            assertThat(result.errors()).hasSize(1);
            assertThat(result.errors().get(0)).contains("I-002");
        }

        @Test
        void whenNothingPending_thenReturnsEmptyResult() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(invoiceRepository.findPendingPennylaneSync(eq(ORG_ID), any())).thenReturn(List.of());
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            PennylaneAccountingSyncService.SyncResult result = service.syncAllPendingInvoices(ORG_ID);

            assertThat(result.synced()).isZero();
            assertThat(result.failed()).isZero();
            assertThat(result.total()).isZero();
        }

        @Test
        void whenNotConnected_thenThrows() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(false);

            assertThatThrownBy(() -> service.syncAllPendingInvoices(ORG_ID))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("syncAllPendingExpenses")
    class SyncAllPendingExpenses {

        @Test
        void whenAllSucceed_thenReturnsSyncedCount() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(expenseRepository.findPendingPennylaneSync(eq(ORG_ID), any()))
                    .thenReturn(List.of(
                            baseExpense(1L, ExpenseStatus.APPROVED),
                            baseExpense(2L, ExpenseStatus.PAID)));
            when(client.findSupplierByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));
            when(client.createSupplierInvoice(eq(ORG_ID), any())).thenReturn(withId(1));
            when(expenseRepository.save(any(ProviderExpense.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            PennylaneAccountingSyncService.SyncResult result = service.syncAllPendingExpenses(ORG_ID);

            assertThat(result.type()).isEqualTo("expenses");
            assertThat(result.synced()).isEqualTo(2);
            assertThat(result.failed()).isZero();
        }

        @Test
        void whenAllFail_thenReportsAllErrors() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            ProviderExpense e1 = baseExpense(1L, ExpenseStatus.APPROVED);
            ProviderExpense e2 = baseExpense(2L, ExpenseStatus.PAID);
            when(expenseRepository.findPendingPennylaneSync(eq(ORG_ID), any()))
                    .thenReturn(List.of(e1, e2));
            when(client.findSupplierByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));
            when(client.createSupplierInvoice(eq(ORG_ID), any()))
                    .thenThrow(new RuntimeException("rate limited"));
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            PennylaneAccountingSyncService.SyncResult result = service.syncAllPendingExpenses(ORG_ID);

            assertThat(result.synced()).isZero();
            assertThat(result.failed()).isEqualTo(2);
            assertThat(result.errors()).hasSize(2);
            assertThat(result.errors().get(0)).contains("#1");
            assertThat(result.errors().get(1)).contains("#2");
        }

        @Test
        void whenNotConnected_thenThrows() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(false);

            assertThatThrownBy(() -> service.syncAllPendingExpenses(ORG_ID))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    // ─── getSyncStatus ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("getSyncStatus")
    class GetSyncStatus {

        @Test
        void whenConnectedWithCounts_thenReturnsStatus() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(invoiceRepository.countPendingPennylaneSync(eq(ORG_ID), any())).thenReturn(5L);
            when(expenseRepository.countPendingPennylaneSync(eq(ORG_ID), any())).thenReturn(3L);
            PennylaneConnection conn = new PennylaneConnection();
            Instant lastSync = Instant.parse("2026-04-01T12:00:00Z");
            conn.setLastSyncAt(lastSync);
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(conn));

            Map<String, Object> status = service.getSyncStatus(ORG_ID);

            assertThat(status).containsEntry("connected", true);
            assertThat(status).containsEntry("pendingInvoices", 5L);
            assertThat(status).containsEntry("pendingExpenses", 3L);
            assertThat(status).containsEntry("lastSyncAt", lastSync);
        }

        @Test
        void whenNoConnection_thenLastSyncIsNull() {
            when(oauthService.isConnected(ORG_ID)).thenReturn(false);
            when(invoiceRepository.countPendingPennylaneSync(eq(ORG_ID), any())).thenReturn(0L);
            when(expenseRepository.countPendingPennylaneSync(eq(ORG_ID), any())).thenReturn(0L);
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            Map<String, Object> status = service.getSyncStatus(ORG_ID);

            assertThat(status).containsEntry("connected", false);
            assertThat(status).containsEntry("lastSyncAt", null);
        }
    }

    // ─── VAT mapping (covered indirectly via syncInvoice) ───────────────────

    @Nested
    @DisplayName("VAT rate mapping")
    class VatMapping {

        @Test
        void whenTaxRateZero_thenMapsToExempt() {
            assertVatRateMapsTo(BigDecimal.ZERO, "exempt");
        }

        @Test
        void whenTaxRateNull_thenMapsToExempt() {
            assertVatRateMapsTo(null, "exempt");
        }

        @Test
        void whenTaxRate20_thenMapsToFR200() {
            assertVatRateMapsTo(new BigDecimal("0.20"), "FR_200");
        }

        @Test
        void whenTaxRate10_thenMapsToFR100() {
            assertVatRateMapsTo(new BigDecimal("0.10"), "FR_100");
        }

        @Test
        void whenTaxRate055_thenMapsToFR055() {
            assertVatRateMapsTo(new BigDecimal("0.055"), "FR_055");
        }

        @Test
        void whenTaxRateUnknown_thenThrowsAndNeverCreatesInvoice() {
            // 8.5% n'est pas un taux TVA français mappable : l'export DOIT échouer
            // explicitement plutôt que de retomber silencieusement sur un code par défaut.
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));

            Invoice invoice = baseInvoice(1L, "INV", "ISSUED");
            invoice.getLines().get(0).setTaxRate(new BigDecimal("0.085"));

            assertThatThrownBy(() -> service.syncInvoice(invoice))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Taux de TVA non reconnu")
                    .hasMessageContaining("8.5%");

            // Aucune facture exportée, aucun marquage de sync → réconciliation/retry.
            verify(client, never()).createCustomerInvoice(anyLong(), any());
            verify(invoiceRepository, never()).save(any(Invoice.class));
            assertThat(invoice.getPennylaneSyncedAt()).isNull();
        }

        @Test
        void whenBatchHasUnknownTaxRate_thenItemFailsAndOthersSucceed() {
            // En batch, un taux inconnu fait échouer l'item concerné (compté dans
            // failed + errors, non marqué synced) sans bloquer les autres.
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            Invoice ok = baseInvoice(1L, "I-OK", "ISSUED");
            Invoice bad = baseInvoice(2L, "I-BAD", "PAID");
            bad.getLines().get(0).setTaxRate(new BigDecimal("0.085"));
            when(invoiceRepository.findPendingPennylaneSync(eq(ORG_ID), any()))
                    .thenReturn(List.of(ok, bad));
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));
            when(client.createCustomerInvoice(eq(ORG_ID), any())).thenReturn(withId(100));
            when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));
            when(connectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.empty());

            PennylaneAccountingSyncService.SyncResult result = service.syncAllPendingInvoices(ORG_ID);

            assertThat(result.synced()).isEqualTo(1);
            assertThat(result.failed()).isEqualTo(1);
            assertThat(result.errors()).hasSize(1);
            assertThat(result.errors().get(0)).contains("I-BAD").contains("Taux de TVA non reconnu");
            assertThat(bad.getPennylaneSyncedAt()).isNull();
        }

        private void assertVatRateMapsTo(BigDecimal taxRate, String expected) {
            when(oauthService.isConnected(ORG_ID)).thenReturn(true);
            when(client.findCustomerByExternalRef(eq(ORG_ID), anyString()))
                    .thenReturn(Optional.of(withId(1)));
            when(client.createCustomerInvoice(eq(ORG_ID), any())).thenReturn(withId(1));
            when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));

            Invoice invoice = baseInvoice(1L, "INV", "ISSUED");
            invoice.getLines().get(0).setTaxRate(taxRate);
            service.syncInvoice(invoice);

            ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
            verify(client).createCustomerInvoice(eq(ORG_ID), captor.capture());
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> lines = (List<Map<String, Object>>) captor.getValue().get("invoice_lines");
            assertThat(lines.get(0).get("vat_rate")).isEqualTo(expected);
        }
    }

    // ─── Result record ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("SyncResult record")
    class SyncResultRecord {

        @Test
        void exposesAllFields() {
            PennylaneAccountingSyncService.SyncResult r =
                    new PennylaneAccountingSyncService.SyncResult(
                            "invoices", 3, 1, 4, List.of("error1"));

            assertThat(r.type()).isEqualTo("invoices");
            assertThat(r.synced()).isEqualTo(3);
            assertThat(r.failed()).isEqualTo(1);
            assertThat(r.total()).isEqualTo(4);
            assertThat(r.errors()).containsExactly("error1");
        }
    }
}
