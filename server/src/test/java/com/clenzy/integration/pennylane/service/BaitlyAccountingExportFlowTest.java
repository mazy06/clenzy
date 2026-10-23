package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.repository.PennylaneConnectionRepository;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Parcours locaux sans fournisseur ; les commits et courses sont couverts sur PostgreSQL. */
class BaitlyAccountingExportFlowTest {
    final PennylaneAccountingClient client=mock(PennylaneAccountingClient.class);
    final PennylaneOAuthService oauth=mock(PennylaneOAuthService.class);
    final PennylaneConnectionRepository connections=mock(PennylaneConnectionRepository.class);
    final BaitlyAccountingExportJournal journal=BaitlyAccountingTestJournals.configure(connections,7L);
    final InvoiceRepository invoices=mock(InvoiceRepository.class);
    final ProviderExpenseRepository expenses=mock(ProviderExpenseRepository.class);
    final PennylaneAccountingSyncService service=new PennylaneAccountingSyncService(client,oauth,connections,invoices,expenses,journal);
    final Invoice invoice=new Invoice(); final ProviderExpense expense=new ProviderExpense();
    BaitlyAccountingExportFlowTest() {
        when(oauth.isConnected(7L)).thenReturn(true);
        invoice.setId(42L);invoice.setOrganizationId(7L);invoice.setInvoiceNumber("synthetic");invoice.setInvoiceDate(LocalDate.of(2026,10,23));invoice.setLines(List.of());
        expense.setId(42L);expense.setOrganizationId(7L);expense.setExpenseDate(LocalDate.of(2026,10,23));expense.setAmountHt(BigDecimal.TEN);expense.setTaxRate(BigDecimal.ZERO);
        when(client.findCustomerByExternalRef(eq(7L),anyString())).thenReturn(Optional.of(Map.of("id",1)));
        when(client.findSupplierByExternalRef(eq(7L),anyString())).thenReturn(Optional.of(Map.of("id",1)));
        when(client.createCustomerInvoice(eq(7L),any())).thenReturn(Map.of("id",420));
        when(client.createSupplierInvoice(eq(7L),any())).thenReturn(Map.of("id",420));
    }
    void run(String type) {if(type.equals("invoice")) service.syncInvoice(invoice);else service.syncExpense(expense);}
    @ParameterizedTest @ValueSource(strings={"invoice","expense"})
    void intentPrecedesAllRemoteEffectsAndProofPrecedesLocalApplication(String type) {
        run(type);
        var order=inOrder(journal,client);
        order.verify(journal).prepare(any(),any(),anyString(),isNull());
        if(type.equals("invoice")) {
            order.verify(client).findCustomerByExternalRef(eq(7L),anyString());
            order.verify(client).createCustomerInvoice(eq(7L),any());
        } else {
            order.verify(client).findSupplierByExternalRef(eq(7L),anyString());
            order.verify(client).createSupplierInvoice(eq(7L),any());
        }
        order.verify(journal).confirm(any(),eq("420"));order.verify(journal).applyLocal(any(),eq("420"));
        verifyNoInteractions(invoices,expenses);
    }
    @ParameterizedTest @ValueSource(strings={"invoice","expense"})
    void existingDurableProofRepairsWithoutAnyRemoteCall(String type) {
        when(journal.prepare(any(),any(),anyString(),isNull())).thenAnswer(call -> new BaitlyAccountingExportJournal.Ticket(
                call.getArgument(0),call.getArgument(1),UUID.randomUUID(),call.getArgument(2),"420"));
        run(type);verifyNoInteractions(client,invoices,expenses);
        verify(journal).applyLocal(any(),eq("420"));verify(journal,never()).confirm(any(),any());
    }
    @ParameterizedTest @ValueSource(strings={"invoice","expense"})
    void refusalOfReservationPreventsEveryRemoteSideEffect(String type) {
        when(journal.prepare(any(),any(),anyString(),isNull())).thenThrow(BaitlyAccountingExportJournal.unconfirmed());
        assertThatThrownBy(() -> run(type)).hasNoCause();verifyNoInteractions(client,invoices,expenses);
    }
    @ParameterizedTest @ValueSource(strings={"invoice","expense"})
    void privateErrorsAndTheirCauseGraphAreDiscardedWhileTheAttemptIsBlocked(String type) {
        var failure=new IllegalStateException("synthetic-private@example.invalid",new RuntimeException("synthetic-secret"));
        failure.addSuppressed(new RuntimeException("synthetic-private"));
        if(type.equals("invoice")) doThrow(failure).when(client).createCustomerInvoice(eq(7L),any());
        else doThrow(failure).when(client).createSupplierInvoice(eq(7L),any());
        assertThatThrownBy(() -> run(type)).hasMessage(BaitlyPennylaneDiagnostics.Reason.UNCONFIRMED.message()).hasNoCause()
                .satisfies(safe -> assertThat(safe.getSuppressed()).isEmpty());
        verify(journal).uncertain(any());verify(journal,never()).applyLocal(any(),any());
    }
    @Test void newAuthorizationChangesTheGenerationButRefreshDoesNot() {
        var guard=com.clenzy.integration.oauth.BaitlyOAuthTestGuards.passthrough();
        var encryption=mock(com.clenzy.service.TokenEncryptionService.class);
        when(encryption.encrypt(anyString())).thenAnswer(call -> "synthetic-encrypted-"+call.getArgument(0));
        when(encryption.decrypt(any())).thenReturn("synthetic-refresh");
        var engine=new com.clenzy.integration.oauth.OAuthFlowEngine(mock(com.clenzy.integration.oauth.OAuthStateService.class),encryption,guard);
        var http=mock(org.springframework.web.client.RestTemplate.class);
        org.springframework.test.util.ReflectionTestUtils.setField(engine,"restTemplate",http);
        when(http.exchange(anyString(),eq(org.springframework.http.HttpMethod.POST),any(org.springframework.http.HttpEntity.class),eq(Map.class)))
                .thenReturn(org.springframework.http.ResponseEntity.ok(Map.of("access_token","synthetic-access","refresh_token","synthetic-refresh","expires_in",3600)));
        var config=mock(com.clenzy.integration.oauth.OAuthProviderConfig.class);
        when(config.getProviderKey()).thenReturn("pennylane");when(config.getTokenUrl()).thenReturn("https://example.invalid/token");
        var connection=new com.clenzy.integration.pennylane.model.PennylaneConnection();connection.setOrganizationId(7L);
        var persistence=(com.clenzy.integration.oauth.OAuthConnectionPersistence<com.clenzy.integration.pennylane.model.PennylaneConnection>)mock(com.clenzy.integration.oauth.OAuthConnectionPersistence.class);
        when(persistence.findByOrganizationId(7L)).thenReturn(Optional.of(connection));
        when(persistence.findActiveByOrganizationId(7L)).thenReturn(Optional.of(connection));
        when(persistence.save(any())).thenAnswer(call -> call.getArgument(0));
        UUID original=connection.getAccountingGeneration();
        engine.exchangeCodeForToken(config,persistence,"synthetic-code",3L,7L);
        UUID established=connection.getAccountingGeneration();assertThat(established).isNotEqualTo(original);
        engine.refreshToken(config,persistence,7L);
        assertThat(connection.getAccountingGeneration()).isEqualTo(established);
        engine.exchangeCodeForToken(config,persistence,"synthetic-code-2",3L,7L);
        assertThat(connection.getAccountingGeneration()).isNotEqualTo(established);
    }
}
