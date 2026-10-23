package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.repository.PennylaneConnectionRepository;
import com.clenzy.model.*;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyPennylaneResponseValidationTest {
    static List<Object> invalid() {return Arrays.asList(null, "", "null", "undefined", Map.of("secret", "synthetic-private"), 0, -1, 1.25, "x".repeat(51));}
    static Stream<Arguments> invalidResponses() {return Stream.of("invoice", "expense").flatMap(type -> invalid().stream().map(id -> Arguments.of(type, id)));}
    static Stream<Arguments> invalidParties() {return Stream.of("invoice", "expense").flatMap(type -> Arrays.asList(null, 0, -1, 1.25, "synthetic-id", Map.of("secret", "synthetic-private")).stream().map(id -> Arguments.of(type, id)));}
    Map<String,Object> response(Object id) {var map = new HashMap<String,Object>();map.put("id", id);return map;}
    final PennylaneAccountingClient client = mock(PennylaneAccountingClient.class);
    final PennylaneOAuthService oauth = mock(PennylaneOAuthService.class);
    final InvoiceRepository invoices = mock(InvoiceRepository.class);
    final ProviderExpenseRepository expenses = mock(ProviderExpenseRepository.class);
    final PennylaneConnectionRepository connections = mock(PennylaneConnectionRepository.class);
    final BaitlyAccountingExportJournal journal = BaitlyAccountingTestJournals.configure(connections, 7L);
    final PennylaneAccountingSyncService service = new PennylaneAccountingSyncService(client, oauth, connections, invoices, expenses, journal);
    final Invoice invoice = new Invoice();
    final ProviderExpense expense = new ProviderExpense();
    void setup() {
        when(oauth.isConnected(7L)).thenReturn(true);
        invoice.setId(1L);invoice.setOrganizationId(7L);invoice.setInvoiceDate(LocalDate.of(2026,10,22));invoice.setInvoiceNumber("synthetic-number");invoice.setLines(List.of());
        expense.setId(2L);expense.setOrganizationId(7L);expense.setExpenseDate(LocalDate.of(2026,10,22));expense.setAmountHt(BigDecimal.TEN);expense.setTaxRate(BigDecimal.ZERO);
    }
    @ParameterizedTest @MethodSource("invalidResponses")
    void malformedExportIdNeverMarksLocalDocumentSynced(String type, Object id) {
        setup();
        if (type.equals("invoice")) {
            when(client.findCustomerByExternalRef(eq(7L), anyString())).thenReturn(Optional.of(Map.of("id", 1)));
            when(client.createCustomerInvoice(eq(7L), any())).thenReturn(response(id));
        } else {
            when(client.findSupplierByExternalRef(eq(7L), anyString())).thenReturn(Optional.of(Map.of("id", 1)));
            when(client.createSupplierInvoice(eq(7L), any())).thenReturn(response(id));
        }
        assertThatThrownBy(() -> {if (type.equals("invoice")) service.syncInvoice(invoice);else service.syncExpense(expense);})
                .isInstanceOf(BaitlyPennylaneDiagnostics.Failure.class).hasNoCause()
                .hasMessage("Réponse Pennylane invalide : identifiant absent ou invalide");
        verifyNoInteractions(invoices, expenses);
        assertThat(invoice.getPennylaneInvoiceId()).isNull();assertThat(invoice.getPennylaneSyncedAt()).isNull();
        assertThat(expense.getPennylaneInvoiceId()).isNull();assertThat(expense.getPennylaneSyncedAt()).isNull();
    }
    @ParameterizedTest @MethodSource("invalidParties")
    void malformedLookupDoesNotTriggerDuplicatePartyOrDocumentCreation(String type, Object id) {
        setup();
        if (type.equals("invoice")) when(client.findCustomerByExternalRef(eq(7L), anyString())).thenReturn(Optional.of(response(id)));
        else when(client.findSupplierByExternalRef(eq(7L), anyString())).thenReturn(Optional.of(response(id)));
        assertThatThrownBy(() -> {if (type.equals("invoice")) service.syncInvoice(invoice);else service.syncExpense(expense);})
                .isInstanceOf(BaitlyPennylaneDiagnostics.Failure.class).hasNoCause();
        verify(client, never()).createCustomer(anyLong(), any());verify(client, never()).createSupplier(anyLong(), any());
        verify(client, never()).createCustomerInvoice(anyLong(), any());verify(client, never()).createSupplierInvoice(anyLong(), any());
        verifyNoInteractions(invoices, expenses);
    }
}
