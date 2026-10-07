package com.clenzy.service.payout;

import com.clenzy.repository.PaymentConnectionRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.sql.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/** Exécute les requêtes du dépôt sur les migrations réelles, avec un rôle non propriétaire soumis à RLS. */
final class BaitlyExpenseBeneficiaryPostgresAssertions {
    static void verify(String url,String user,String role) throws Exception {
        try(Connection c=DriverManager.getConnection(url,user,"");Statement s=c.createStatement()) {
            s.execute("INSERT INTO organizations(id,name,type) VALUES(19,'Société de test','CLEANING_COMPANY')");
            s.execute("INSERT INTO users(id,organization_id) VALUES(142,19)");
            s.execute("INSERT INTO payment_connections(id,organization_id,beneficiary_key,country,provider,provider_account_id,authorized,details_submitted,payouts_enabled,transfers_enabled) VALUES('00000000-0000-0000-0000-000000000019',19,'organization','FR','STRIPE','acct_expense_company',true,true,true,true)");
            s.execute("INSERT INTO payment_connections(id,organization_id,beneficiary_key,user_id,country,provider,provider_account_id) VALUES('00000000-0000-0000-0000-000000000020',19,'user:142',142,'FR','STRIPE','acct_expense_person')");
            s.execute("INSERT INTO provider_expenses(id,organization_id,provider_id,owner_payout_id,status) VALUES(902,7,142,1,'INCLUDED'),(903,7,142,1,'INCLUDED'),(904,7,142,1,'PAID')");
            s.execute("SET ROLE "+role);s.execute("SET app.current_org='7'");
            var jdbc=new NamedParameterJdbcTemplate(new SingleConnectionDataSource(c,true));
            String personal=query("findExpenseProviderAccount"),company=query("findExpenseCompanyAccount");
            var params=Map.of("expenseId",902L,"orgId",7L);
            assertThat(jdbc.queryForList(personal,params)).hasSize(1);
            assertThat(jdbc.queryForList(company,params)).isEmpty();
            assertThat(count(s,"SELECT count(*) FROM payment_connections WHERE organization_id=19 AND beneficiary_key='organization'")).isZero();
            forbidden(s,insert(902,8,142,19),"23514");
            forbidden(s,insert(902,7,43,19),"23514");
            forbidden(s,insert(902,7,142,9),"23514");
            forbidden(s,insert(904,7,142,19),"23514");
            s.execute(insert(902,7,142,19));
            assertThat(jdbc.queryForList(personal,params)).isEmpty();
            assertThat(jdbc.queryForList(company,params)).singleElement().satisfies(row -> {
                assertThat(row.get("accountId")).isEqualTo("acct_expense_company");assertThat(row.get("ready")).isEqualTo(true);
            });
            assertThat(jdbc.queryForList(company,Map.of("expenseId",903L,"orgId",7L))).isEmpty();
            forbidden(s,"UPDATE baitly_expense_beneficiaries SET beneficiary_organization_id=9 WHERE expense_id=902","23514");
            forbidden(s,"DELETE FROM baitly_expense_beneficiaries WHERE expense_id=902","23514");
            forbidden(s,"UPDATE provider_expenses SET provider_id=43 WHERE id=902","23514");
            assertThat(s.executeUpdate("UPDATE payment_connections SET authorized=false WHERE organization_id=19")).isZero();
            s.execute("SET app.current_org='8'");
            assertThat(count(s,"SELECT count(*) FROM baitly_expense_beneficiaries")).isZero();
            assertThat(jdbc.queryForList(company,params)).isEmpty();
            forbidden(s,insert(903,7,142,19),"42501");
            s.execute("RESET ROLE");
            s.execute("UPDATE payment_connections SET authorized=false WHERE organization_id=19 AND beneficiary_key='organization'");
            s.execute("SET ROLE "+role);s.execute("SET app.current_org='7'");
            assertThat(jdbc.queryForList(company,params)).singleElement().satisfies(row -> assertThat(row.get("ready")).isEqualTo(false));
            assertThat(jdbc.queryForList(personal,params)).isEmpty();
            s.execute("RESET ROLE");
            s.execute("UPDATE users SET organization_id=9 WHERE id=142");
            s.execute("SET ROLE "+role);s.execute("SET app.current_org='7'");
            assertThat(jdbc.queryForList(company,params)).isEmpty();assertThat(jdbc.queryForList(personal,params)).isEmpty();
            s.execute("RESET ROLE");s.execute("UPDATE users SET organization_id=19 WHERE id=142");
        }
        // Le choix et l'envoi partagent le verrou de la dépense : une émission concurrente fige le destinataire.
        try(Connection a=DriverManager.getConnection(url,user,"");Connection b=DriverManager.getConnection(url,user,"");
            Statement sa=a.createStatement();Statement sb=b.createStatement()) {
            a.setAutoCommit(false);b.setAutoCommit(false);
            sa.execute("SELECT id FROM provider_expenses WHERE id=903 FOR UPDATE");
            sb.execute("SET LOCAL lock_timeout='150ms'");
            forbidden(sb,insert(903,7,142,19),"55P03");b.rollback();
            sa.execute("INSERT INTO payout_transfers(organization_id,source,source_id,beneficiary_user_id,amount,currency,provider,destination,description,idempotency_key,state) VALUES(7,'PROVIDER_EXPENSE',903,142,10,'EUR','STRIPE','acct_expense_person','Expense test','baitly-expense-903','SUBMITTING')");
            a.commit();
            forbidden(sb,insert(903,7,142,19),"23514");b.rollback();
        }
        try(var factory=new org.hibernate.cfg.Configuration().addPackage("com.clenzy.model")
                .addAnnotatedClass(com.clenzy.model.BaitlyExpenseBeneficiary.class)
                .setProperty("hibernate.connection.url",url).setProperty("hibernate.connection.username",user)
                .setProperty("hibernate.hbm2ddl.auto","validate").buildSessionFactory();var em=factory.createEntityManager()) {
            var repository=new org.springframework.data.jpa.repository.support.JpaRepositoryFactory(em)
                    .getRepository(com.clenzy.repository.BaitlyExpenseBeneficiaryRepository.class);
            em.getTransaction().begin();
            em.createNativeQuery("INSERT INTO provider_expenses(id,organization_id,provider_id,status) VALUES(905,7,142,'DRAFT')").executeUpdate();
            var expense=new com.clenzy.model.ProviderExpense();expense.setId(905L);expense.setOrganizationId(7L);
            var provider=new com.clenzy.model.User();provider.setId(142L);expense.setProvider(provider);
            repository.saveAndFlush(new com.clenzy.model.BaitlyExpenseBeneficiary(expense,19L,42L));em.clear();
            assertThat(repository.findByExpenseIdAndOrganizationId(905L,7L)).get().satisfies(saved -> {
                assertThat(saved.getBeneficiaryOrganizationId()).isEqualTo(19L);assertThat(saved.getProviderId()).isEqualTo(142L);
            });
            assertThat(repository.findByExpenseIdAndOrganizationId(905L,8L)).isEmpty();
            assertThat(repository.company(905L,7L)).get().satisfies(candidate->assertThat(candidate.getId()).isEqualTo(19L));
            assertThat(repository.hasTransfer(903L,7L)).isTrue();assertThat(repository.hasTransfer(903L,8L)).isFalse();
            em.getTransaction().rollback();
        }
    }
    private static String query(String method) {
        return Arrays.stream(PaymentConnectionRepository.class.getMethods()).filter(m->m.getName().equals(method))
                .findFirst().orElseThrow().getAnnotation(Query.class).value();
    }
    private static String insert(long expense,long org,long provider,long company) {
        return "INSERT INTO baitly_expense_beneficiaries(expense_id,organization_id,provider_id,beneficiary_organization_id,selected_by_user_id) VALUES("
                +expense+","+org+","+provider+","+company+",42)";
    }
    private static int count(Statement s,String sql) throws SQLException { try(var rs=s.executeQuery(sql)) { rs.next();return rs.getInt(1); } }
    private static void forbidden(Statement s,String sql,String state) {
        assertThatThrownBy(()->s.execute(sql)).isInstanceOf(SQLException.class)
                .extracting(error->((SQLException)error).getSQLState()).isEqualTo(state);
    }
}
