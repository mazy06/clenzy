package com.clenzy.service;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.nio.file.*;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@EnabledIfSystemProperty(named="baitly.test.jdbc", matches="jdbc:postgresql:.*")
class ProviderTariffPostgresTest {
    Connection connection; Statement sql; String schema;
    @BeforeEach void setup() throws Exception {
        schema="tariffs_"+UUID.randomUUID().toString().replace("-", "");
        connection=DriverManager.getConnection(System.getProperty("baitly.test.jdbc"),System.getProperty("baitly.test.user","postgres"),"");
        sql=connection.createStatement();sql.execute("CREATE SCHEMA "+schema);sql.execute("SET search_path TO "+schema);
        sql.execute("CREATE TABLE users(id bigint PRIMARY KEY)");
        sql.execute("CREATE TABLE marketplace_providers(id bigint PRIMARY KEY,user_id bigint)");
        sql.execute("CREATE TABLE marketplace_service_items(id bigint PRIMARY KEY,code varchar(100))");
        sql.execute("CREATE TABLE marketplace_provider_services(id bigserial PRIMARY KEY,provider_id bigint,category_id bigint,service_item_id bigint,label varchar(120),amount numeric(10,2),pricing_model varchar(20),currency varchar(3),unit_label varchar(40),active boolean DEFAULT true)");
        sql.execute(Files.readString(Path.of("src/main/resources/db/changelog/changes/0322__technician_prestations.sql")));
        sql.execute(Files.readString(Path.of("src/main/resources/db/changelog/changes/0338__create_housekeeper_rates.sql")));
        sql.execute("INSERT INTO users VALUES(1),(2),(3),(4)");
        sql.execute("INSERT INTO marketplace_providers VALUES(1,1),(2,1),(3,2),(4,NULL),(5,NULL),(6,3)");
        sql.execute("INSERT INTO marketplace_service_items VALUES(1,'cleaning-turnover'),(2,'maintenance-plumbing')");
        sql.execute("INSERT INTO marketplace_provider_services(provider_id,category_id,service_item_id,label,amount,pricing_model,currency) VALUES(1,1,1,'Ménage',30,'HOURLY','EUR'),(2,1,1,'Ménage',30,'HOURLY','EUR'),(3,1,1,'Ménage',40,'HOURLY','EUR'),(4,1,1,'Ménage',50,'HOURLY','EUR'),(5,1,1,'Ménage',60,'HOURLY','EUR'),(6,2,2,'Plomberie',80,'FLAT','EUR')");
        sql.execute("INSERT INTO technician_prestations(organization_id,user_id,intervention_type,base_price) VALUES(101,3,'PLUMBING_REPAIR',80),(102,3,'PLUMBING_REPAIR',100)");
        sql.execute("INSERT INTO housekeeper_rates(organization_id,user_id,property_id,amount,unit) VALUES(101,2,NULL,40,'HOURLY'),(102,2,NULL,50,'HOURLY'),(101,2,99,120,'FLAT')");
        // Cas réel : plusieurs offres libres sur devis, sans montant, avant la migration.
        sql.execute("INSERT INTO marketplace_provider_services(provider_id,category_id,label,amount,pricing_model,currency) VALUES(1,1,'Ménage entre deux séjours',NULL,'ON_QUOTE','EUR'),(2,1,'Ménage entre deux séjours',NULL,'ON_QUOTE','EUR')");
        connection.setAutoCommit(false);
        sql.execute(Files.readString(Path.of("src/main/resources/db/changelog/changes/0451__canonical_provider_tariffs.sql")).replace("public",schema));
        connection.commit();connection.setAutoCommit(true);
    }
    @AfterEach void cleanup() throws Exception {
        if(connection==null)return;
        if(!connection.getAutoCommit())connection.rollback();
        connection.setAutoCommit(true);sql.execute("RESET ROLE");sql.execute("DROP SCHEMA "+schema+" CASCADE");sql.close();connection.close();
    }
    @Test void twoProfilesReferenceOneLivingPrice() throws Exception {
        assertThat(value("SELECT count(DISTINCT tariff_id)::text FROM marketplace_provider_services WHERE provider_id IN(1,2) AND service_item_id=1")).isEqualTo("1");
        sql.execute("UPDATE provider_tariffs SET amount=35 WHERE user_id=1 AND service_key='cleaning-turnover'");
        assertThat(value("SELECT min(t.amount)::text FROM marketplace_provider_services s JOIN provider_tariffs t ON t.id=s.tariff_id WHERE s.provider_id IN(1,2)")).isEqualTo("35.00");
        assertThat(value("SELECT count(*)::text FROM marketplace_provider_services WHERE tariff_id IS NOT NULL AND amount IS NOT NULL")).isEqualTo("0");
    }
    @Test void onQuoteOffersMigrateWithoutNullReviewOrInventedAmount() throws Exception {
        assertThat(value("SELECT needs_review::text FROM provider_tariffs WHERE user_id=1 AND service_key='custom:1:ménage entre deux séjours'")).isEqualTo("false");
        assertThat(value("SELECT count(*)::text FROM provider_tariffs WHERE user_id=1 AND service_key='custom:1:ménage entre deux séjours' AND pricing_model='ON_QUOTE' AND amount IS NULL")).isEqualTo("1");
        assertThat(value("SELECT count(DISTINCT tariff_id)::text FROM marketplace_provider_services WHERE label='Ménage entre deux séjours'")).isEqualTo("1");
    }
    @Test void onQuoteCandidacyActivatesWithoutNullReview() throws Exception {
        sql.execute("UPDATE marketplace_provider_services SET amount=NULL,pricing_model='ON_QUOTE' WHERE provider_id=4");
        sql.execute("UPDATE marketplace_providers SET user_id=4 WHERE id=4");
        assertThat(value("SELECT needs_review::text FROM provider_tariffs WHERE user_id=4")).isEqualTo("false");
        assertThat(value("SELECT count(*)::text FROM provider_tariffs WHERE user_id=4 AND pricing_model='ON_QUOTE' AND amount IS NULL")).isEqualTo("1");
    }
    @Test void onQuoteAndPricedOffersStillRequireReviewWhenTheyDisagree() throws Exception {
        sql.execute("UPDATE marketplace_provider_services SET amount=NULL,pricing_model='ON_QUOTE' WHERE provider_id=4");
        sql.execute("INSERT INTO marketplace_provider_services(provider_id,category_id,service_item_id,label,amount,pricing_model,currency) VALUES(4,1,1,'Ménage bis',75,'HOURLY','EUR')");
        sql.execute("UPDATE marketplace_providers SET user_id=4 WHERE id=4");
        assertThat(value("SELECT needs_review::text FROM provider_tariffs WHERE user_id=4")).isEqualTo("true");
    }
    @Test void uncertainOldPricesAreArchivedAndNeverChosenArbitrarily() throws Exception {
        assertThat(value("SELECT count(*)::text FROM provider_tariffs WHERE user_id IN(2,3) AND needs_review AND amount IS NULL AND pricing_model='ON_QUOTE'")).isEqualTo("2");
        assertThat(value("SELECT count(*)::text FROM provider_tariff_migration_archive WHERE source_table='housekeeper_rates'")).isEqualTo("3");
        assertThat(value("SELECT count(*)::text FROM housekeeper_rates")).isEqualTo("0");
        assertThat(value("SELECT count(*)::text FROM technician_prestations")).isEqualTo("0");
    }
    @Test void activationTransfersOnlyFirstDraftAndDoesNotOverwritePublishedPrice() throws Exception {
        sql.execute("UPDATE marketplace_providers SET user_id=4 WHERE id=4");
        sql.execute("UPDATE marketplace_providers SET user_id=4 WHERE id=5");
        assertThat(value("SELECT amount::text FROM provider_tariffs WHERE user_id=4")).isEqualTo("50.00");
        assertThat(value("SELECT count(DISTINCT tariff_id)::text FROM marketplace_provider_services WHERE provider_id IN(4,5)")).isEqualTo("1");
    }
    @Test void contradictoryPricesWithinOneCandidacyRequireConfirmation() throws Exception {
        sql.execute("INSERT INTO marketplace_provider_services(provider_id,category_id,service_item_id,label,amount,pricing_model,currency) VALUES(4,1,1,'Ménage bis',75,'HOURLY','EUR')");
        sql.execute("UPDATE marketplace_providers SET user_id=4 WHERE id=4");
        assertThat(value("SELECT count(*)::text FROM provider_tariffs WHERE user_id=4 AND needs_review AND amount IS NULL")).isEqualTo("1");
        assertThat(value("SELECT count(*)::text FROM provider_tariff_migration_archive WHERE source_table='marketplace_provider_services' AND (payload->>'provider_id')::bigint=4")).isEqualTo("2");
    }
    @Test void legacyWritersAndCrossOwnerReferencesAreRejected() {
        assertThatThrownBy(()->sql.execute("INSERT INTO housekeeper_rates(organization_id,user_id,amount,unit) VALUES(1,1,10,'HOURLY')")).hasMessageContaining("unique provider tariff");
        assertThatThrownBy(()->sql.execute("INSERT INTO technician_prestations(organization_id,user_id,intervention_type,base_price) VALUES(1,1,'CLEANING',10)")).hasMessageContaining("unique provider tariff");
        assertThatThrownBy(()->sql.execute("UPDATE marketplace_provider_services SET amount=10 WHERE provider_id=1")).hasMessageContaining("unique tariff");
        assertThatThrownBy(()->sql.execute("UPDATE marketplace_provider_services SET tariff_id=(SELECT id FROM provider_tariffs WHERE user_id=2) WHERE provider_id=1")).hasMessageContaining("owner mismatch");
    }
    @Test void incompleteOrUnresolvedPricesCannotPassDatabaseConstraints() {
        assertThatThrownBy(()->sql.execute("UPDATE provider_tariffs SET amount=50 WHERE needs_review")).hasMessageContaining("ck_provider_tariff");
        assertThatThrownBy(()->sql.execute("INSERT INTO provider_tariffs(user_id,service_key,pricing_model,amount) VALUES(1,'broken','HOURLY',-1)")).hasMessageContaining("ck_provider_tariff_price");
    }
    @Test void missingAmountIsRejectedForPricedModel() {
        assertThatThrownBy(()->sql.execute("INSERT INTO provider_tariffs(user_id,service_key,pricing_model) VALUES(1,'broken','HOURLY')"))
            .hasMessageContaining("ck_provider_tariff_price");
    }
    @Test void candidateEditAndAccountActivationSerialize() throws Exception {
        connection.setAutoCommit(false);sql.execute("UPDATE marketplace_providers SET user_id=4 WHERE id=4");
        try(var second=DriverManager.getConnection(System.getProperty("baitly.test.jdbc"),System.getProperty("baitly.test.user","postgres"),"");var other=second.createStatement()) {
            other.execute("SET search_path TO "+schema);other.execute("SET lock_timeout='200ms'");
            assertThatThrownBy(()->other.execute("UPDATE marketplace_provider_services SET amount=99 WHERE provider_id=4")).hasMessageContaining("lock timeout");
            connection.commit();connection.setAutoCommit(true);
            assertThatThrownBy(()->other.execute("UPDATE marketplace_provider_services SET amount=99 WHERE provider_id=4")).hasMessageContaining("unique tariff");
        }
    }
    @Test void repositoryValidatesMigratedSchemaAndUsesGlobalIdentityWithTenantMembership() throws Exception {
        sql.execute("ALTER TABLE users ADD COLUMN organization_id bigint DEFAULT 101");
        sql.execute("CREATE TABLE organization_members(user_id bigint,organization_id bigint)");
        sql.execute("INSERT INTO organization_members VALUES(1,202)");
        var config=new org.hibernate.cfg.Configuration()
            .setProperty("hibernate.connection.url",System.getProperty("baitly.test.jdbc"))
            .setProperty("hibernate.connection.username",System.getProperty("baitly.test.user","postgres"))
            .setProperty("hibernate.default_schema",schema).setProperty("hibernate.hbm2ddl.auto","validate")
            .addAnnotatedClass(com.clenzy.model.ProviderTariff.class);
        try(var factory=config.buildSessionFactory();var em=factory.createEntityManager()) {
            em.getTransaction().begin();em.createNativeQuery("SET search_path TO "+schema).executeUpdate();
            var repo=new org.springframework.data.jpa.repository.support.JpaRepositoryFactory(em)
                .getRepository(com.clenzy.repository.ProviderTariffRepository.class);
            assertThat(repo.belongsToOrganization(1L,101L)).isTrue();
            assertThat(repo.belongsToOrganization(1L,202L)).isTrue();
            assertThat(repo.belongsToOrganization(1L,999L)).isFalse();
            assertThat(repo.findOfferingInOrganization(202L,java.util.List.of("cleaning-turnover"))).containsExactly(1L);
            repo.lockUser(1L);
            var tariff=repo.findByUserIdAndServiceKey(1L,"cleaning-turnover").orElseThrow();
            tariff.setAmount(new java.math.BigDecimal("42.50"));repo.saveAndFlush(tariff);
            em.getTransaction().commit();
            assertThat(value("SELECT min(t.amount)::text FROM marketplace_provider_services s JOIN provider_tariffs t ON t.id=s.tariff_id WHERE s.provider_id IN(1,2)")).isEqualTo("42.50");
        }
    }
    String value(String query) throws Exception {try(var rows=sql.executeQuery(query)){rows.next();return rows.getString(1);}}
}
