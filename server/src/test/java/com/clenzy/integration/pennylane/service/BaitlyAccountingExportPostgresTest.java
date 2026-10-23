package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.model.PennylaneConnection;
import com.clenzy.integration.pennylane.repository.PennylaneConnectionRepository;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.clenzy.integration.pennylane.service.BaitlyAccountingExportJournal.*;

/** Migration réelle, concurrence et reprise sur PostgreSQL CI éphémère ; aucun fournisseur. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql:.*")
class BaitlyAccountingExportPostgresTest {
    JdbcTemplate admin,db,observer;
    String schema;
    DriverManagerDataSource source;
    DataSourceTransactionManager manager;
    BaitlyAccountingExportJournal journal;
    UUID generation;
    final PennylaneAccountingClient client=mock(PennylaneAccountingClient.class);
    final String hash="a".repeat(64);
    @BeforeEach void start() {
        String jdbc=System.getProperty("baitly.test.jdbc");
        if (!jdbc.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]*(?:test|recipe|ci)[a-zA-Z0-9_]*")
                && !jdbc.equals("jdbc:postgresql://127.0.0.1:55439/postgres")) throw new IllegalArgumentException("Base de recette dédiée requise");
        admin=new JdbcTemplate(new DriverManagerDataSource(jdbc,"postgres",""));
        schema="baitly_export_"+UUID.randomUUID().toString().replace("-",""); admin.execute("CREATE SCHEMA "+schema);
        source=new DriverManagerDataSource(jdbc+"?currentSchema="+schema,"postgres",""); db=new JdbcTemplate(source);
        observer=new JdbcTemplate(new DriverManagerDataSource(jdbc+"?currentSchema="+schema,"postgres",""));
        db.execute("CREATE TABLE pennylane_connections (id BIGSERIAL PRIMARY KEY,organization_id BIGINT UNIQUE NOT NULL,status VARCHAR(20) NOT NULL)");
        db.execute("CREATE TABLE invoices (id BIGINT PRIMARY KEY,organization_id BIGINT NOT NULL,status VARCHAR(20),updated_at TIMESTAMP,pennylane_invoice_id VARCHAR(50),pennylane_synced_at TIMESTAMPTZ)");
        db.execute("CREATE TABLE provider_expenses (id BIGINT PRIMARY KEY,organization_id BIGINT NOT NULL,status VARCHAR(20),updated_at TIMESTAMPTZ,pennylane_invoice_id VARCHAR(50),pennylane_synced_at TIMESTAMPTZ)");
        db.update("INSERT INTO pennylane_connections (organization_id,status) VALUES (7,'ACTIVE'),(8,'ACTIVE')");
        db.update("INSERT INTO invoices (id,organization_id,status) VALUES (999,7,'ISSUED'),(777,7,'DRAFT')");
        db.update("INSERT INTO provider_expenses (id,organization_id,status) VALUES (888,7,'APPROVED')");
        migrate(); migrate();
        generation=db.queryForObject("SELECT accounting_generation FROM pennylane_connections WHERE organization_id=7",UUID.class);
        manager=new DataSourceTransactionManager(source); journal=new BaitlyAccountingExportJournal(db,manager);
        db.update("INSERT INTO invoices (id,organization_id,status) VALUES (42,7,'ISSUED'),(43,8,'ISSUED')");
        db.update("INSERT INTO provider_expenses (id,organization_id,status) VALUES (42,7,'APPROVED')");
        when(client.findCustomerByExternalRef(eq(7L),anyString())).thenReturn(Optional.of(Map.of("id",1)));
        when(client.findSupplierByExternalRef(eq(7L),anyString())).thenReturn(Optional.of(Map.of("id",1)));
    }
    void migrate() {
        try (var connection=source.getConnection()) {
            var database=liquibase.database.DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new liquibase.database.jvm.JdbcConnection(connection));
            var resources=new liquibase.resource.ClassLoaderResourceAccessor();
            try (var master=new liquibase.Liquibase("db/changelog/db.changelog-master.yaml",resources,database)) {
                var selected=new liquibase.changelog.DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream().filter(set -> set.getId().equals("0597-baitly-accounting-export-journal")).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(1);
                new liquibase.Liquibase(selected,resources,database).update("");
            }
        } catch (Exception failure) {throw new IllegalStateException("Migration de recette échouée",failure);}
    }
    @Test void journalEntityMatchesTheActualLiquibaseSchema() {
        var config=new org.hibernate.cfg.Configuration().addAnnotatedClass(com.clenzy.integration.pennylane.model.BaitlyAccountingExport.class)
                .setProperty("hibernate.hbm2ddl.auto","validate");
        config.getProperties().put("hibernate.connection.datasource",source);
        try(var factory=config.buildSessionFactory()) {assertThat(factory.isOpen()).isTrue();}
    }
    @AfterEach void close() {if(schema!=null) admin.execute("DROP SCHEMA "+schema+" CASCADE");}
    Key key(Kind kind) {return new Key(7L,kind,42L);}
    Ticket prepare(Kind kind) {return journal.prepare(key(kind),generation,hash,null);}
    PennylaneAccountingSyncService service() {
        var oauth=mock(PennylaneOAuthService.class); when(oauth.isConnected(7L)).thenReturn(true);
        var connections=mock(PennylaneConnectionRepository.class);
        when(connections.findByOrganizationIdAndStatus(7L,PennylaneConnection.Status.ACTIVE)).thenAnswer(call -> {
            var value=new PennylaneConnection();value.setOrganizationId(7L);
            ReflectionTestUtils.setField(value,"accountingGeneration",db.queryForObject("SELECT accounting_generation FROM pennylane_connections WHERE organization_id=7",UUID.class));
            return Optional.of(value);
        });
        return new PennylaneAccountingSyncService(client,oauth,connections,mock(InvoiceRepository.class),mock(ProviderExpenseRepository.class),journal);
    }
    Invoice invoice() {var value=new Invoice();value.setId(42L);value.setOrganizationId(7L);value.setInvoiceNumber("synthetic-number");value.setInvoiceDate(LocalDate.of(2026,10,23));value.setBuyerName("synthetic-name");value.setLines(List.of());return value;}
    ProviderExpense expense() {var value=new ProviderExpense();value.setId(42L);value.setOrganizationId(7L);value.setExpenseDate(LocalDate.of(2026,10,23));value.setAmountHt(BigDecimal.TEN);value.setTaxRate(BigDecimal.ZERO);return value;}
    String state(Kind kind) {return observer.queryForObject("SELECT state FROM baitly_accounting_exports WHERE organization_id=7 AND document_kind=? AND document_id=42",String.class,kind.name());}
    @Test void migrationQuarantinesTheHistoricalUnprovenBacklogWithoutTouchingDocuments() {
        assertThat(journal.countUnconfirmed(7L)).isEqualTo(2);
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_accounting_exports WHERE document_id=777",Long.class)).isZero();
        assertThatThrownBy(() -> journal.prepare(new Key(7L,Kind.INVOICE,999L),generation,hash,null)).hasNoCause();
        assertThat(db.queryForObject("SELECT pennylane_invoice_id FROM invoices WHERE id=999",String.class)).isNull();
    }
    @ParameterizedTest @EnumSource(Kind.class)
    void committedIntentSurvivesCallerRollbackAndPreventsRestartResubmission(Kind kind) {
        assertThatThrownBy(() -> new TransactionTemplate(manager).execute(status -> {prepare(kind);throw new IllegalStateException("synthetic rollback");}))
                .hasMessage("synthetic rollback");
        assertThat(state(kind)).isEqualTo("SENDING");
        var restarted=new BaitlyAccountingExportJournal(db,manager);
        assertThatThrownBy(() -> restarted.prepare(key(kind),generation,hash,null)).hasNoCause();
    }
    @Test void twoInstancesCannotOwnTheSameEmissionButOtherOrganizationsRemainIndependent() throws Exception {
        var ready=new CountDownLatch(1);var release=new CountDownLatch(1);
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
            var first=pool.submit(() -> {var ticket=prepare(Kind.INVOICE);ready.countDown();release.await(15,TimeUnit.SECONDS);return ticket;});
            try {
                assertThat(ready.await(15,TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> new BaitlyAccountingExportJournal(db,manager).prepare(key(Kind.INVOICE),generation,hash,null)).hasNoCause();
                UUID other=db.queryForObject("SELECT accounting_generation FROM pennylane_connections WHERE organization_id=8",UUID.class);
                assertThat(journal.prepare(new Key(8L,Kind.INVOICE,43L),other,hash,null).confirmedId()).isNull();
            } finally {release.countDown();}
            assertThat(first.get(15,TimeUnit.SECONDS).confirmedId()).isNull();
        }
    }
    @ParameterizedTest @EnumSource(Kind.class)
    void unknownResultCannotReleaseTheIntentOrBeRearmedByTime(Kind kind) {
        var ticket=prepare(kind);journal.uncertain(ticket);
        db.update("UPDATE baitly_accounting_exports SET created_at=CURRENT_TIMESTAMP-INTERVAL '100 days' WHERE document_id=42");
        assertThatThrownBy(() -> prepare(kind)).hasNoCause();
        assertThat(state(kind)).isEqualTo("UNKNOWN");
    }
    @ParameterizedTest @EnumSource(Kind.class)
    void durableConfirmationRepairsOnlyTheLocalMarkerAndPreservesOtherFields(Kind kind) {
        var ticket=prepare(kind);journal.confirm(ticket,"420");journal.uncertain(ticket);
        assertThat(state(kind)).isEqualTo("CONFIRMED");
        var replay=prepare(kind);assertThat(replay.confirmedId()).isEqualTo("420");
        journal.applyLocal(replay,"420");journal.applyLocal(replay,"420");
        String table=kind==Kind.INVOICE?"invoices":"provider_expenses";
        assertThat(db.queryForObject("SELECT pennylane_invoice_id FROM "+table+" WHERE id=42",String.class)).isEqualTo("420");
        assertThat(db.queryForObject("SELECT updated_at FROM "+table+" WHERE id=42",Object.class)).isNull();
        verifyNoInteractions(client);
    }
    @ParameterizedTest @EnumSource(Kind.class)
    void changedDocumentOrAuthorizationCannotReuseTheProof(Kind kind) {
        var ticket=prepare(kind);journal.confirm(ticket,"420");
        assertThatThrownBy(() -> journal.prepare(key(kind),generation,"b".repeat(64),null)).hasNoCause();
        String table=kind==Kind.INVOICE?"invoices":"provider_expenses";
        db.update("UPDATE "+table+" SET updated_at=CURRENT_TIMESTAMP WHERE id=42");
        assertThatThrownBy(() -> journal.applyLocal(ticket,"420")).hasNoCause();
        db.update("UPDATE pennylane_connections SET accounting_generation=? WHERE organization_id=7",UUID.randomUUID());
        assertThatThrownBy(() -> journal.applyLocal(ticket,"420")).hasNoCause();
        assertThat(state(kind)).isEqualTo("CONFIRMED");
    }
    @Test void timeoutAfterRemoteAcceptanceIsNeverAutomaticallyResent() {
        when(client.createCustomerInvoice(eq(7L),any())).thenAnswer(call -> {
            assertThat(state(Kind.INVOICE)).isEqualTo("SENDING");
            throw new IllegalStateException("synthetic-private@example.invalid",new RuntimeException("synthetic-secret"));
        });
        assertThatThrownBy(() -> service().syncInvoice(invoice())).isInstanceOf(IllegalStateException.class);
        assertThat(state(Kind.INVOICE)).isEqualTo("UNKNOWN");
        assertThatThrownBy(() -> service().syncInvoice(invoice())).hasNoCause();
        verify(client,times(1)).createCustomerInvoice(eq(7L),any());
    }
    @Test void localWriteFailureAfterRemoteSuccessCanBeRepairedWithoutASecondCreation() {
        when(client.createCustomerInvoice(eq(7L),any())).thenAnswer(call -> {db.update("DELETE FROM invoices WHERE id=42");return Map.of("id",420);});
        assertThatThrownBy(() -> service().syncInvoice(invoice())).hasNoCause();
        assertThat(state(Kind.INVOICE)).isEqualTo("CONFIRMED");
        db.update("INSERT INTO invoices(id,organization_id,status) VALUES(42,7,'ISSUED')");
        service().syncInvoice(invoice());
        verify(client,times(1)).createCustomerInvoice(eq(7L),any());
        assertThat(db.queryForObject("SELECT pennylane_invoice_id FROM invoices WHERE id=42",String.class)).isEqualTo("420");
    }
    @Test void expenseUsesTheSameDurablePath() {
        when(client.createSupplierInvoice(eq(7L),any())).thenAnswer(call -> {assertThat(state(Kind.EXPENSE)).isEqualTo("SENDING");return Map.of("id",420);});
        service().syncExpense(expense());
        assertThat(state(Kind.EXPENSE)).isEqualTo("CONFIRMED");
        assertThat(db.queryForObject("SELECT pennylane_invoice_id FROM provider_expenses WHERE id=42",String.class)).isEqualTo("420");
    }
    @Test void wrongOrganizationAndWrongOwnerCannotConfirmOrModifyAnotherAttempt() {
        var ticket=prepare(Kind.INVOICE);
        var forged=new Ticket(ticket.key(),ticket.generation(),UUID.randomUUID(),ticket.fingerprint(),null);
        assertThatThrownBy(() -> journal.confirm(forged,"420")).hasNoCause();
        journal.uncertain(forged);assertThat(state(Kind.INVOICE)).isEqualTo("SENDING");
        assertThatThrownBy(() -> journal.prepare(new Key(8L,Kind.INVOICE,42L),generation,hash,null)).hasNoCause();
    }
    @Test void reconnectionDuringTheRemoteCallLeavesAnUncertainResultWithoutLocalSuccess() {
        when(client.createCustomerInvoice(eq(7L),any())).thenAnswer(call -> {
            db.update("UPDATE pennylane_connections SET accounting_generation=? WHERE organization_id=7",UUID.randomUUID());
            return Map.of("id",420);
        });
        assertThatThrownBy(() -> service().syncInvoice(invoice())).hasNoCause();
        assertThat(state(Kind.INVOICE)).isEqualTo("UNKNOWN");
        assertThat(db.queryForObject("SELECT pennylane_invoice_id FROM invoices WHERE id=42",String.class)).isNull();
        assertThatThrownBy(() -> service().syncInvoice(invoice())).hasNoCause();
        verify(client,times(1)).createCustomerInvoice(eq(7L),any());
    }
    @Test void localApplicationUsesTheOriginalConfirmationTimeEvenAfterRetry() {
        var ticket=prepare(Kind.INVOICE);journal.confirm(ticket,"420");
        var original=db.queryForObject("SELECT confirmed_at FROM baitly_accounting_exports WHERE document_id=42",java.sql.Timestamp.class);
        assertThat(journal.applyLocal(ticket,"420")).isEqualTo(original.toInstant());
        db.update("UPDATE invoices SET pennylane_synced_at=CURRENT_TIMESTAMP+INTERVAL '1 day' WHERE id=42");
        assertThat(journal.applyLocal(ticket,"420")).isEqualTo(original.toInstant());
        assertThat(db.queryForObject("SELECT pennylane_synced_at FROM invoices WHERE id=42",java.sql.Timestamp.class)).isEqualTo(original);
    }
}
