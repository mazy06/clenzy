package com.clenzy.marketplace.service;

import com.clenzy.marketplace.dto.CatalogProviderDto;
import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.model.*;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.OrganizationService;
import com.clenzy.tenant.TenantContext;
import liquibase.*;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.access.AccessDeniedException;
import java.sql.DriverManager;
import java.time.*;
import java.util.*;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Migration réelle et calcul des agrégats sur un schéma local jetable. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyConciergePerformancePostgresTest {
    static String url,user,schema; static JdbcTemplate db;
    @BeforeAll static void start() throws Exception {
        url=System.getProperty("baitly.test.jdbc"); user=System.getProperty("baitly.test.user","postgres");
        schema="baitly_concierge_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(url,user,"");var sql=c.createStatement()) {
            sql.execute("CREATE SCHEMA "+schema);
            sql.execute("CREATE TABLE "+schema+".marketplace_providers(id bigint PRIMARY KEY)");
            sql.execute("INSERT INTO "+schema+".marketplace_providers VALUES(9)");
        }
        for(int pass=0;pass<2;pass++) try(var c=DriverManager.getConnection(url+"?currentSchema="+schema,user,"")) {
            var database=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,database)) {
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream().filter(cs -> cs.getId().equals("0550-baitly-concierge-publications")).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(1);
                new Liquibase(selected,resources,database).update("");
            }
        }
        try(var factory=new Configuration().addAnnotatedClass(BaitlyConciergePublication.class)
            .setProperty("hibernate.connection.url",url+"?currentSchema="+schema)
            .setProperty("hibernate.connection.username",user).setProperty("hibernate.hbm2ddl.auto","validate").buildSessionFactory()) {
            assertThat(factory.isOpen()).isTrue();
        }
        db=new JdbcTemplate(new DriverManagerDataSource(url+"?currentSchema="+schema,user,""));
        db.execute("CREATE TABLE properties(id bigint PRIMARY KEY,organization_id bigint,status varchar(30),created_at timestamp)");
        db.execute("CREATE TABLE reservations(property_id bigint,organization_id bigint,check_in date,check_out date,status varchar(30))");
        db.execute("INSERT INTO properties VALUES (1,7,'ACTIVE','2024-01-01'),(2,7,'ACTIVE','2024-01-01'),(3,7,'ACTIVE','2024-01-01'),(4,7,'ACTIVE','2024-01-01'),(5,7,'ACTIVE','2025-07-01'),(6,8,'ACTIVE','2024-01-01'),(7,7,'INACTIVE','2024-01-01')");
        db.execute("INSERT INTO reservations VALUES (1,7,'2025-01-01','2025-01-11','confirmed'),(1,7,'2025-01-05','2025-01-15','confirmed'),(2,7,'2025-01-01','2026-01-01','cancelled'),(1,8,'2025-01-01','2026-01-01','confirmed'),(3,7,'2024-12-30','2025-01-03','completed'),(4,7,'2025-12-31','2026-01-03','checked_out'),(7,7,'2025-01-01','2026-01-01','confirmed')");
    }
    @AfterAll static void stop() throws Exception {
        if(schema!=null) try(var c=DriverManager.getConnection(url,user,"");var sql=c.createStatement()) { sql.execute("DROP SCHEMA "+schema+" CASCADE"); }
    }
    final BaitlyConciergePublicationRepository publications=mock(BaitlyConciergePublicationRepository.class);
    final MarketplaceProviderRepository providers=mock(MarketplaceProviderRepository.class);
    final MarketplaceCatalogService catalog=mock(MarketplaceCatalogService.class);
    final MarketplaceExposureService exposure=mock(MarketplaceExposureService.class);
    final ProviderAccountResolver accounts=mock(ProviderAccountResolver.class);
    final OrganizationService organizations=mock(OrganizationService.class);
    final OrganizationRepository orgs=mock(OrganizationRepository.class);
    final TenantContext tenant=mock(TenantContext.class);
    BaitlyConciergePerformance service;
    @BeforeEach void setup() {
        var p=new MarketplaceProvider(); p.setId(9L); p.setHomeOrganizationId(7L); p.setDisplayName("Conciergerie test");
        p.setRatingCount(2); p.setRatingAvg(new BigDecimal("4.8"));
        when(providers.findById(9L)).thenReturn(Optional.of(p)); when(providers.findForRating(9L)).thenReturn(Optional.of(p));
        when(accounts.requireProviderId("owner")).thenReturn(9L); when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        var org=new Organization();org.setType(OrganizationType.CONCIERGE);
        when(orgs.findById(7L)).thenReturn(Optional.of(org));
        when(catalog.getCatalogEntry(9L,null)).thenReturn(Optional.of(CatalogProviderDto.from(p,null,List.of(),List.of("CONCIERGE"),List.of(),null,false)));
        service=new BaitlyConciergePerformance(publications,providers,catalog,exposure,accounts,organizations,orgs,tenant,db,
            Clock.fixed(Instant.parse("2026-10-12T10:00:00Z"),ZoneOffset.UTC));
    }
    @Test void aggregatesAreBoundedDeduplicatedAndScopedWithoutPublishingOnRead() {
        var settings=service.settings("owner");
        assertThat(settings.published()).isFalse(); assertThat(settings.eligible()).isTrue();
        assertThat(settings.preview().managedProperties()).isEqualTo(5);
        assertThat(settings.preview().occupancyPct()).isEqualByComparingTo("1.0");
        assertThat(settings.preview().periodStart()).isEqualTo(LocalDate.of(2025,1,1));
        assertThat(settings.preview().periodEnd()).isEqualTo(LocalDate.of(2025,12,31));
        assertThat(settings.preview().ratingAvg()).isNull();
        verify(publications,never()).saveAndFlush(any());
    }
    @Test void employeeCannotPublishOrganizationMetrics() {
        doThrow(new AccessDeniedException("denied")).when(organizations).validateOrgManagement("owner",7L);
        assertThatThrownBy(() -> service.publish(true,"owner")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(publications);
    }
    @Test void otherOrganizationCannotPublishTheProvider() {
        when(tenant.getRequiredOrganizationId()).thenReturn(8L);
        assertThatThrownBy(() -> service.publish(true,"owner")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(publications);
    }
    @Test void optInRecordsConsentAndWithdrawalIsImmediate() {
        service.publish(true,"owner");
        var captured=org.mockito.ArgumentCaptor.forClass(BaitlyConciergePublication.class);
        verify(publications).saveAndFlush(captured.capture());
        assertThat(captured.getValue().published).isTrue(); assertThat(captured.getValue().consentedBy).isEqualTo("owner");
        clearInvocations(publications); service.publish(false,"owner");
        verify(publications).saveAndFlush(captured.capture()); assertThat(captured.getValue().published).isFalse();
    }
    @Test void publicResultsExcludeHiddenOrInsufficientSamples() {
        var row=new BaitlyConciergePublication();row.providerId=9L;row.managedProperties=5;
        when(publications.findByPublishedTrueAndPeriodStartOrderByProviderId(any())).thenReturn(List.of(row));
        when(exposure.visibilityOf(any())).thenReturn(MarketplaceExposureService.Visibility.NONE);
        assertThat(service.publicList()).isEmpty();
        verify(catalog,never()).getCatalogEntry(any(),any());
        row.managedProperties=4;clearInvocations(exposure);
        assertThat(service.publicList()).isEmpty(); verifyNoInteractions(exposure);
    }
    @Test void databaseRejectsUnsafePublicSampleAndLiquibaseOnlyAppliesOnce() {
        assertThat(db.queryForObject("SELECT count(*) FROM databasechangelog WHERE id='0550-baitly-concierge-publications'",Integer.class)).isOne();
        assertThatThrownBy(() -> db.update("INSERT INTO baitly_concierge_publications VALUES (9,true,'2025-01-01','2025-12-31',4,80,now(),'owner')"))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @Test void visibleOptedInCompanyOnlyExposesWhitelistedFields() throws Exception {
        var row=new BaitlyConciergePublication();row.providerId=9L;row.managedProperties=5;
        row.periodStart=LocalDate.of(2025,1,1);row.periodEnd=LocalDate.of(2025,12,31);row.occupancyPct=new BigDecimal("70.0");
        when(publications.findByPublishedTrueAndPeriodStartOrderByProviderId(any())).thenReturn(List.of(row));
        when(exposure.visibilityOf(any())).thenReturn(new MarketplaceExposureService.Visibility(7L,true,Map.of(),null));
        var results=service.publicList(); assertThat(results).hasSize(1);
        assertThat(results.getFirst().ratingAvg()).isNull();
        var json=new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(results.getFirst().provider());
        var keys=new ArrayList<String>();json.fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactlyInAnyOrder("id","displayName","avatarUrl","baseCity","coverageCities");
    }
}
