package com.clenzy.service.payout;

import com.clenzy.repository.PayoutTransferRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.PaymentConnectionRepository;
import com.clenzy.repository.ProviderPayoutBeneficiaryRepository;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.PayoutMethod;
import com.clenzy.model.PayoutTransfer;
import com.clenzy.model.PayoutTransferEvent;
import com.clenzy.model.ProviderPayoutBeneficiary;
import org.hibernate.cfg.Configuration;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.Query;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.sql.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** Schéma jetable : vraies migrations, contraintes, concurrence et isolation PostgreSQL. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class PayoutTransferJournalLiquibaseTest {
    @Test void journalPreservesHistoryAndPreventsDuplicateEmissionAcrossTenants() throws Exception {
        String url = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String schema = "baitly_transfer_" + UUID.randomUUID().toString().replace("-", "");
        String role = schema + "_reader";
        String scoped = url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema;
        try (Connection admin = DriverManager.getConnection(url, user, ""); Statement sql = admin.createStatement()) {
            sql.execute("CREATE SCHEMA " + schema);
            sql.execute("CREATE ROLE " + role);
            try {
                try (Connection c = DriverManager.getConnection(scoped, user, ""); Statement s = c.createStatement()) {
                    s.execute("CREATE TABLE organizations(id bigint PRIMARY KEY, name text, type text DEFAULT 'CLEANING_COMPANY')");
                    s.execute("CREATE TABLE users(id bigint PRIMARY KEY, organization_id bigint, keycloak_id text)");
                    s.execute("CREATE TABLE interventions(id bigint PRIMARY KEY, organization_id bigint, property_id bigint, assigned_user_id bigint, status text, payment_status text, team_id bigint)");
                    s.execute("CREATE TABLE teams(id bigint PRIMARY KEY,organization_id bigint,personal_user_id bigint)");
                    s.execute("CREATE TABLE owner_payouts(id bigint PRIMARY KEY,organization_id bigint,owner_id bigint,net_amount numeric(12,2),currency text,payout_method text,stripe_transfer_id text,period_start date,period_end date,retry_count int,status text,created_at timestamptz)");
                    s.execute("CREATE TABLE housekeeper_payout_records(id bigint PRIMARY KEY,organization_id bigint,intervention_id bigint,user_id bigint,amount numeric(12,2),stripe_transfer_id text,status text,created_at timestamptz)");
                    s.execute("INSERT INTO owner_payouts VALUES(1,7,10,80,'EUR','STRIPE_CONNECT','tr_old','2026-01-01','2026-01-31',0,'PAID',now()),(2,7,10,80,'EUR','STRIPE_CONNECT',null,'2026-02-01','2026-02-28',1,'FAILED',now()),(3,7,10,80,'EUR',null,null,'2026-03-01','2026-03-31',0,'PENDING',now())");
                    s.execute("ALTER TABLE owner_payouts ADD COLUMN funding_version integer NOT NULL DEFAULT 0");
                    s.execute("CREATE TABLE provider_expenses(id bigint PRIMARY KEY,organization_id bigint,provider_id bigint,owner_payout_id bigint,status text,payment_reference text)");
                    s.execute("CREATE TABLE payment_transactions(id bigint PRIMARY KEY,organization_id bigint,source_type text,source_id bigint,provider_type text,payment_type text,status text,disputed_amount numeric(12,2))");
                    s.execute("CREATE TABLE intervention_payment_allocations(organization_id bigint,transaction_id bigint,intervention_id bigint)");
                    s.execute("CREATE TABLE service_requests(id bigint PRIMARY KEY,organization_id bigint,converted_intervention_id bigint)");
                    s.execute("CREATE TABLE owner_payout_reservations(organization_id bigint,payout_id bigint,payment_transaction_ids jsonb)");
                    s.execute("CREATE TABLE baitly_transfer_recoveries(organization_id bigint,transfer_id bigint,refund_id bigint,state text)");
                    s.execute("INSERT INTO housekeeper_payout_records VALUES(1,7,11,42,95,'tr_pro','SENT',now()),(2,7,12,42,95,null,'BLOCKED',now())");
                    s.execute("INSERT INTO organizations(id) VALUES(7),(8),(9)");
                    s.execute("INSERT INTO users(id,organization_id) VALUES(42,9),(43,9)");
                    s.execute("INSERT INTO interventions(id,organization_id,assigned_user_id,status,payment_status) VALUES(11,7,42,'COMPLETED','PAID')");
                }
                migrate(scoped, user);
                migrate(scoped, user);
                try (Connection c = DriverManager.getConnection(scoped, user, ""); Statement s = c.createStatement()) {
                    assertThat(count(s, "SELECT count(*) FROM payout_transfers")).isEqualTo(3);
                    assertThat(count(s, "SELECT count(*) FROM payout_transfer_events")).isEqualTo(3);
                    assertThat(count(s, "SELECT count(*) FROM databasechangelog WHERE id='0494-payout-transfer-journal'")).isEqualTo(1);
                    assertThat(count(s, "SELECT count(*) FROM owner_payouts WHERE id=1 AND status='PAID' AND stripe_transfer_id='tr_old'")).isEqualTo(1);
                    assertThat(count(s, "SELECT count(*) FROM payout_transfers WHERE state='RECONCILIATION_REQUIRED' AND destination='legacy-unresolved'")).isEqualTo(3);
                    forbidden(s, "UPDATE payout_transfers SET amount=79 WHERE source='OWNER_PAYOUT' AND source_id=1", "23514");
                    forbidden(s, "DELETE FROM payout_transfers", "23514");
                    forbidden(s, "DELETE FROM payout_transfer_events", "23514");
                    forbidden(s, "INSERT INTO payout_transfer_events(organization_id,transfer_id,state) SELECT 8,id,'SUBMITTING' FROM payout_transfers LIMIT 1", "23503");
                    s.execute("INSERT INTO payment_connections(id,organization_id,beneficiary_key,user_id,country,provider,provider_account_id) VALUES('00000000-0000-0000-0000-000000000001',9,'user:42',42,'FR','STRIPE','acct_provider'),('00000000-0000-0000-0000-000000000002',9,'user:43',43,'FR','STRIPE','acct_unrelated')");
                }
                assertConcurrentEmission(scoped, user);
                assertJpaMappingsAndExecutionClaim(scoped, user);
                sql.execute("GRANT USAGE ON SCHEMA " + schema + " TO " + role);
                sql.execute("GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA " + schema + " TO " + role);
                sql.execute("GRANT USAGE ON ALL SEQUENCES IN SCHEMA " + schema + " TO " + role);
                try (Connection c = DriverManager.getConnection(scoped, user, ""); Statement s = c.createStatement()) {
                    s.execute("SET ROLE " + role);
                    s.execute("SET app.current_org='8'");
                    assertThat(count(s, "SELECT count(*) FROM payout_transfers")).isZero();
                    assertThat(count(s, "SELECT count(*) FROM payout_transfer_events")).isZero();
                    assertThat(count(s, "SELECT count(*) FROM payment_connections")).isZero();
                    s.execute("SET app.current_org='7'");
                    assertThat(count(s, "SELECT count(*) FROM payout_transfers")).isEqualTo(4);
                    assertThat(count(s, "SELECT count(*) FROM payment_connections")).isEqualTo(1);
                    String accountQuery = Arrays.stream(PaymentConnectionRepository.class.getMethods())
                            .filter(m -> m.getName().equals("findAssignedProviderAccount")).findFirst().orElseThrow()
                            .getAnnotation(Query.class).value();
                    var jdbc = new NamedParameterJdbcTemplate(new SingleConnectionDataSource(c,true));
                    var accountRows = jdbc.queryForList(accountQuery,Map.of("missionId",11L,"orgId",7L,"userId",42L));
                    assertThat(accountRows).hasSize(1);
                    assertThat(accountRows.getFirst().get("accountId")).isEqualTo("acct_provider");
                    assertThat(jdbc.queryForList(accountQuery,Map.of("missionId",11L,"orgId",7L,"userId",43L))).isEmpty();
                    assertResidualAccountAccess(s, jdbc, role, accountQuery,
                            Map.of("missionId",11L,"orgId",7L,"userId",42L), 11L, "acct_provider");
                    // Voir le compte du fournisseur ne confère jamais le droit de le modifier.
                    assertThat(s.executeUpdate("UPDATE payment_connections SET provider_account_id='acct_attacker' WHERE user_id=42")).isZero();
                    forbidden(s, "INSERT INTO payout_transfer_events(organization_id,transfer_id,state) SELECT 8,id,'SUBMITTING' FROM payout_transfers LIMIT 1", "42501");
                }
                assertCompanyBeneficiaryIsolation(scoped,user,role);
                assertBeneficiarySelectionLock(scoped,user);
                BankPayoutPostgresAssertions.verify(scoped,user,role);
                PayoutReconciliationPostgresAssertions.verify(scoped,user,role);
                PayoutRecoveryPostgresAssertions.verify(scoped,user,role);
                BeneficiaryPayoutPostgresAssertions.verify(scoped,user,role);
                SignedPayoutWebhookPostgresAssertions.runRecipe(scoped,user,role);
                assertExpenseAccountScope(scoped,user,role);
                BaitlyExpenseBeneficiaryPostgresAssertions.verify(scoped,user,role);
            } finally {
                sql.execute("DROP SCHEMA " + schema + " CASCADE");
                sql.execute("DROP ROLE " + role);
            }
        }
    }

    private void assertCompanyBeneficiaryIsolation(String url,String user,String role) throws Exception {
        try(Connection c=DriverManager.getConnection(url,user,""); Statement s=c.createStatement()) {
            s.execute("INSERT INTO teams VALUES(99,9,null),(100,9,42)");
            s.execute("INSERT INTO interventions(id,organization_id,team_id,status,payment_status) VALUES(13,7,99,'COMPLETED','PAID'),(14,7,100,'COMPLETED','PAID')");
            s.execute("INSERT INTO payment_connections(id,organization_id,beneficiary_key,country,provider,provider_account_id,authorized,details_submitted,payouts_enabled,transfers_enabled) VALUES('00000000-0000-0000-0000-000000000003',9,'organization','FR','STRIPE','acct_company',true,true,true,true)");
            s.execute("SET ROLE " + role); s.execute("SET app.current_org='7'");
            assertThat(count(s,"SELECT count(*) FROM payment_connections WHERE beneficiary_key='organization'")).isZero();
            s.execute("INSERT INTO provider_payout_beneficiaries(intervention_id,organization_id,beneficiary_organization_id,team_id,selected_by_user_id) VALUES(13,7,9,99,43)");
            var jdbc=new NamedParameterJdbcTemplate(new SingleConnectionDataSource(c,true));
            String query=Arrays.stream(PaymentConnectionRepository.class.getMethods()).filter(m -> m.getName().equals("findOrganizationProviderAccount"))
                    .findFirst().orElseThrow().getAnnotation(Query.class).value();
            var rows=jdbc.queryForList(query,Map.of("missionId",13L,"orgId",7L,"beneficiaryOrgId",9L));
            assertThat(rows).hasSize(1);
            assertThat(rows.getFirst().get("accountId")).isEqualTo("acct_company");
            assertThat(rows.getFirst().get("ready")).isEqualTo(true);
            assertResidualAccountAccess(s, jdbc, role, query,
                    Map.of("missionId",13L,"orgId",7L,"beneficiaryOrgId",9L), 13L, "acct_company");
            assertThat(jdbc.queryForList(query,Map.of("missionId",14L,"orgId",7L,"beneficiaryOrgId",9L))).isEmpty();
            String assignment=Arrays.stream(ProviderPayoutBeneficiaryRepository.class.getMethods()).filter(m -> m.getName().equals("findAssignment"))
                    .findFirst().orElseThrow().getAnnotation(Query.class).value();
            assertThat(jdbc.queryForList(assignment,Map.of("missionId",14L,"orgId",7L)).getFirst().get("recipientUserId")).isEqualTo(42L);
            assertThat(jdbc.queryForList(assignment,Map.of("missionId",14L,"orgId",8L))).isEmpty();
            assertThat(s.executeUpdate("UPDATE payment_connections SET authorized=false WHERE beneficiary_key='organization'")).isZero();
            forbidden(s,"UPDATE provider_payout_beneficiaries SET beneficiary_organization_id=8 WHERE intervention_id=13","23514");
            forbidden(s,"DELETE FROM provider_payout_beneficiaries WHERE intervention_id=13","23514");
            s.execute("SET app.current_org='8'");
            assertThat(count(s,"SELECT count(*) FROM provider_payout_beneficiaries")).isZero();
            assertThat(jdbc.queryForList(query,Map.of("missionId",13L,"orgId",7L,"beneficiaryOrgId",9L))).isEmpty();
            s.execute("RESET ROLE");
            s.execute("UPDATE interventions SET team_id=100 WHERE id=13");
            s.execute("SET ROLE " + role); s.execute("SET app.current_org='7'");
            assertThat(count(s,"SELECT count(*) FROM payment_connections WHERE beneficiary_key='organization'")).isZero();
            s.execute("RESET ROLE");
            s.execute("INSERT INTO payout_transfers(organization_id,source,source_id,beneficiary_organization_id,amount,currency,provider,destination,description,idempotency_key,state) VALUES(7,'INTERVENTION',13,9,95,'EUR','STRIPE','acct_company','Prestation #13','payout-intervention-13','SUBMITTING')");
            forbidden(s,"UPDATE payout_transfers SET beneficiary_organization_id=8 WHERE source='INTERVENTION' AND source_id=13","23514");
            forbidden(s,"INSERT INTO housekeeper_payout_records(id,organization_id,intervention_id,user_id,beneficiary_organization_id,amount,status,created_at) VALUES(3,7,13,42,9,95,'PENDING',now())","23514");
            s.execute("INSERT INTO housekeeper_payout_records(id,organization_id,intervention_id,beneficiary_organization_id,amount,status,created_at) VALUES(3,7,13,9,95,'PENDING',now())");
            forbidden(s,"UPDATE housekeeper_payout_records SET beneficiary_organization_id=null,user_id=42 WHERE id=3","23514");
        }
    }

    private void assertBeneficiarySelectionLock(String url,String user) throws Exception {
        String lock=Arrays.stream(ProviderPayoutBeneficiaryRepository.class.getMethods()).filter(m -> m.getName().equals("lockMission"))
                .findFirst().orElseThrow().getAnnotation(Query.class).value();
        try(Connection a=DriverManager.getConnection(url,user,""); Connection b=DriverManager.getConnection(url,user,""); Statement sb=b.createStatement()) {
            a.setAutoCommit(false); b.setAutoCommit(false);
            var first=new NamedParameterJdbcTemplate(new SingleConnectionDataSource(a,true));
            var second=new NamedParameterJdbcTemplate(new SingleConnectionDataSource(b,true));
            first.queryForObject(lock,Map.of("missionId",13L),Integer.class);
            sb.execute("SET LOCAL lock_timeout='150ms'");
            assertThatThrownBy(() -> second.queryForObject(lock,Map.of("missionId",13L),Integer.class)).hasRootCauseInstanceOf(SQLException.class);
            b.rollback(); a.commit();
            assertThat(second.queryForObject(lock,Map.of("missionId",13L),Integer.class)).isEqualTo(1);
            b.commit();
        }
    }

    /** Exécute la requête métier avec le rôle RLS réel, y compris après restitution partielle. */
    private void assertResidualAccountAccess(Statement sql, NamedParameterJdbcTemplate jdbc,
            String role, String query, Map<String, Long> params, long missionId, String account) throws SQLException {
        sql.execute("RESET ROLE");
        sql.execute("UPDATE interventions SET payment_status='PARTIALLY_REFUNDED' WHERE id=" + missionId);
        sql.execute("SET ROLE " + role);
        sql.execute("SET app.current_org='7'");
        var rows = jdbc.queryForList(query, params);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().get("accountId")).isEqualTo(account);
        assertThat(count(sql, "SELECT count(*) FROM payment_connections WHERE provider_account_id='acct_unrelated'")).isZero();
        assertThat(sql.executeUpdate("UPDATE payment_connections SET authorized=false WHERE provider_account_id='" + account + "'")).isZero();

        sql.execute("SET app.current_org='8'");
        assertThat(jdbc.queryForList(query, params)).isEmpty();
        sql.execute("SET app.current_org='7'");
        sql.execute("RESET ROLE");
        sql.execute("UPDATE payment_connections SET authorized=false WHERE provider_account_id='" + account + "'");
        sql.execute("SET ROLE " + role);
        // Une connexion révoquée doit être visible et non prête : jamais de repli vers un compte legacy.
        assertThat(jdbc.queryForList(query, params)).singleElement().satisfies(row ->
                assertThat(row.get("ready")).isEqualTo(false));

        for (String blocked : List.of("REFUNDED", "UNPAID", "PROCESSING", "REFUND_PENDING")) {
            sql.execute("RESET ROLE");
            sql.execute("UPDATE interventions SET payment_status='" + blocked + "' WHERE id=" + missionId);
            sql.execute("SET ROLE " + role);
            assertThat(jdbc.queryForList(query, params)).as(blocked).isEmpty();
        }
        sql.execute("RESET ROLE");
        sql.execute("UPDATE interventions SET payment_status='PARTIALLY_REFUNDED',status='PENDING' WHERE id=" + missionId);
        sql.execute("SET ROLE " + role);
        assertThat(jdbc.queryForList(query, params)).isEmpty();
        sql.execute("RESET ROLE");
        sql.execute("UPDATE interventions SET payment_status='PAID',status='COMPLETED' WHERE id=" + missionId);
        sql.execute("UPDATE payment_connections SET authorized=true WHERE provider_account_id='" + account + "'");
        sql.execute("SET ROLE " + role);
    }

    private void assertConcurrentEmission(String url, String user) throws Exception {
        String query = Arrays.stream(PayoutTransferRepository.class.getMethods()).filter(m -> m.getName().equals("insertIfAbsent"))
                .findFirst().orElseThrow().getAnnotation(Query.class).value();
        Map<String,Object> params = new HashMap<>(Map.of("orgId",7L,"source","OWNER_PAYOUT","sourceId",31L,"userId",10L,
                "amount",80,"currency","EUR","destination","acct_owner","description","Payout #31","key","payout-31"));
        params.put("beneficiaryOrgId",null);
        try (Connection first = DriverManager.getConnection(url,user,""); Connection second = DriverManager.getConnection(url,user,"");
             Statement a = first.createStatement(); Statement b = second.createStatement()) {
            var jdbcA = new NamedParameterJdbcTemplate(new SingleConnectionDataSource(first,true));
            var jdbcB = new NamedParameterJdbcTemplate(new SingleConnectionDataSource(second,true));
            first.setAutoCommit(false); second.setAutoCommit(false);
            assertThat(jdbcA.update(query,params)).isEqualTo(1);
            b.execute("SET LOCAL lock_timeout='150ms'");
            assertThatThrownBy(() -> jdbcB.update(query,params)).hasRootCauseInstanceOf(SQLException.class);
            second.rollback(); first.commit();
            assertThat(jdbcB.update(query,params)).isZero();
            second.commit();
            a.execute("UPDATE payout_transfers SET state='TRANSFERRED',external_reference='tr_confirmed' WHERE source_id=31");
            first.commit();
            forbidden(a,"UPDATE payout_transfers SET state='SUBMITTING' WHERE source_id=31","23514");
            first.rollback();
        }
    }

    private void assertJpaMappingsAndExecutionClaim(String url,String user) {
        try(var sessions = new Configuration().addPackage("com.clenzy.model")
                .addAnnotatedClass(OwnerPayout.class).addAnnotatedClass(PayoutTransfer.class).addAnnotatedClass(PayoutTransferEvent.class)
                .addAnnotatedClass(ProviderPayoutBeneficiary.class)
                .setProperty("hibernate.connection.url",url).setProperty("hibernate.connection.username",user)
                .setProperty("hibernate.hbm2ddl.auto","none").buildSessionFactory();
            var em = sessions.createEntityManager()) {
            em.getTransaction().begin();
            var factory = new JpaRepositoryFactory(em);
            var payouts = factory.getRepository(OwnerPayoutRepository.class);
            var transfers = factory.getRepository(PayoutTransferRepository.class);
            em.createQuery("update OwnerPayout p set p.status=:status where p.id=3")
                    .setParameter("status",OwnerPayout.PayoutStatus.APPROVED).executeUpdate();
            assertThat(payouts.claimExecution(3L,8L,PayoutMethod.WISE,OwnerPayout.PayoutStatus.APPROVED,OwnerPayout.PayoutStatus.PROCESSING)).isZero();
            assertThat(payouts.claimExecution(3L,7L,PayoutMethod.STRIPE_CONNECT,OwnerPayout.PayoutStatus.APPROVED,OwnerPayout.PayoutStatus.PROCESSING)).isEqualTo(1);
            assertThat(payouts.claimExecution(3L,7L,PayoutMethod.WISE,OwnerPayout.PayoutStatus.APPROVED,OwnerPayout.PayoutStatus.PROCESSING)).isZero();
            var transfer = transfers.lockBySource(7L,PayoutTransfer.Source.OWNER_PAYOUT,31L).orElseThrow();
            assertThat(transfer.getExternalReference()).isEqualTo("tr_confirmed");
            assertThat(transfers.lockBySource(8L,PayoutTransfer.Source.OWNER_PAYOUT,31L)).isEmpty();
            em.getTransaction().commit();

            // Exerce le repository Spring Data et le mapping de la décision, pas seulement le SQL brut.
            em.getTransaction().begin();
            var beneficiaries = factory.getRepository(ProviderPayoutBeneficiaryRepository.class);
            assertThat(beneficiaries.lockMission(11L)).isEqualTo(1);
            var assignment = beneficiaries.findAssignment(11L,7L).orElseThrow();
            assertThat(assignment.getAssignedUserId()).isEqualTo(42L);
            assertThat(assignment.getTeamId()).isNull();
            assertThat(assignment.getRecipientOrganizationId()).isEqualTo(9L);
            assertThat(beneficiaries.findAssignment(11L,8L)).isEmpty();
            beneficiaries.saveAndFlush(new ProviderPayoutBeneficiary(11L,7L,9L,42L,null,43L));
            em.clear();
            var decision = beneficiaries.findByInterventionIdAndOrganizationId(11L,7L).orElseThrow();
            assertThat(decision.getBeneficiaryOrganizationId()).isEqualTo(9L);
            assertThat(decision.getSelectedByUserId()).isEqualTo(43L);
            assertThat(beneficiaries.findByInterventionIdAndOrganizationId(11L,8L)).isEmpty();
            em.getTransaction().rollback();
        }
    }

    private long count(Statement sql,String query) throws SQLException {
        try(ResultSet rs=sql.executeQuery(query)) { rs.next(); return rs.getLong(1); }
    }
    private void forbidden(Statement sql,String query,String state) {
        assertThatThrownBy(() -> sql.execute(query)).isInstanceOf(SQLException.class)
                .extracting(e -> ((SQLException)e).getSQLState()).isEqualTo(state);
    }
    private void assertExpenseAccountScope(String url,String user,String role) throws Exception {
        try(Connection c=DriverManager.getConnection(url,user,"");Statement s=c.createStatement()) {
            s.execute("UPDATE owner_payouts SET funding_version=1 WHERE id=1");
            s.execute("INSERT INTO provider_expenses(id,organization_id,provider_id,owner_payout_id,status) VALUES(901,7,43,1,'INCLUDED')");
            s.execute("SET ROLE "+role);s.execute("SET app.current_org='7'");
            var jdbc=new NamedParameterJdbcTemplate(new SingleConnectionDataSource(c,true));
            String query=Arrays.stream(PaymentConnectionRepository.class.getMethods())
                    .filter(m->m.getName().equals("findExpenseProviderAccount")).findFirst().orElseThrow().getAnnotation(Query.class).value();
            assertThat(jdbc.queryForList(query,Map.of("expenseId",901L,"orgId",7L)))
                    .singleElement().satisfies(row->assertThat(row.get("accountId")).isEqualTo("acct_unrelated"));
            assertThat(jdbc.queryForList(query,Map.of("expenseId",901L,"orgId",8L))).isEmpty();
            assertThat(s.executeUpdate("UPDATE payment_connections SET authorized=false WHERE user_id=43")).isZero();
            s.execute("INSERT INTO payout_transfers(organization_id,source,source_id,beneficiary_user_id,amount,currency,provider,destination,description,idempotency_key,state) VALUES(7,'PROVIDER_EXPENSE',901,43,10,'EUR','STRIPE','acct_unrelated','Expense','baitly-expense-901','SUBMITTING')");
            forbidden(s,"UPDATE payout_transfers SET amount=11 WHERE source='PROVIDER_EXPENSE'","23514");
            s.execute("UPDATE provider_expenses SET status='APPROVED' WHERE id=901");
            assertThat(jdbc.queryForList(query,Map.of("expenseId",901L,"orgId",7L))).isEmpty();
            s.execute("SET app.current_org='8'");
            assertThat(count(s,"SELECT count(*) FROM payment_connections WHERE user_id=43")).isZero();
        }
    }
    private void migrate(String url,String user) throws Exception {
        try(Connection c=DriverManager.getConnection(url,user,"")) {
            var database=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,database)) {
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream().filter(s -> Set.of(
                    "0492-payment-connections","0494-payout-transfer-journal","0495-provider-payout-account-read-access","0496-provider-organization-beneficiaries","0497-stripe-bank-payout-tracking","0498-payout-reconciliation-audit","0499-payout-recovery-jobs","0500-beneficiary-transfer-read-indexes","0504-residual-provider-account-read-access","0507-provider-expense-transfers","0509-expense-organization-beneficiaries").contains(s.getId()))
                    .forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(11);
                new Liquibase(selected,resources,database).update("");
            }
        }
    }
}
