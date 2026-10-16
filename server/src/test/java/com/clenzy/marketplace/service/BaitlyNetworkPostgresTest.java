package com.clenzy.marketplace.service;
import com.clenzy.marketplace.model.BaitlyNetworkLink;
import com.clenzy.marketplace.repository.*;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.OrganizationService;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import liquibase.*;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.sql.DriverManager;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Liquibase réel, schéma jetable local, jamais une base applicative. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyNetworkPostgresTest {
    static String url,user,schema;static SessionFactory factory;
    @BeforeAll static void start() throws Exception {
        url=System.getProperty("baitly.test.jdbc");user=System.getProperty("baitly.test.user","postgres");
        schema="baitly_network_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(url,user,"");var sql=c.createStatement()){
            sql.execute("CREATE SCHEMA "+schema);
            sql.execute("CREATE TABLE "+schema+".organizations(id bigint PRIMARY KEY)");
            sql.execute("CREATE TABLE "+schema+".marketplace_providers(id bigint PRIMARY KEY)");
            sql.execute("INSERT INTO "+schema+".organizations VALUES(1),(2)");
            sql.execute("INSERT INTO "+schema+".marketplace_providers VALUES(9)");
        }
        for(int pass=0;pass<2;pass++)try(var c=DriverManager.getConnection(url+"?currentSchema="+schema,user,"")){
            var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)){
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->cs.getId().equals("0549-baitly-private-network")).forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(1);
                new Liquibase(selected,resources,db).update("");
            }
        }
        factory=new Configuration().addAnnotatedClass(BaitlyNetworkLink.class)
            .setProperty("hibernate.connection.url",url+"?currentSchema="+schema)
            .setProperty("hibernate.connection.username",user).setProperty("hibernate.hbm2ddl.auto","validate").buildSessionFactory();
    }
    @AfterAll static void stop() throws Exception {
        if(factory!=null)factory.close();
        if(schema!=null)try(var c=DriverManager.getConnection(url,user,"");var sql=c.createStatement()){sql.execute("DROP SCHEMA "+schema+" CASCADE");}
    }
    static <T>T tx(Function<EntityManager,T> action){
        try(var em=factory.createEntityManager()){
            em.getTransaction().begin();
            try{T result=action.apply(em);em.getTransaction().commit();return result;}
            catch(RuntimeException failure){em.getTransaction().rollback();throw failure;}
        }
    }
    BaitlyNetworkLink link(String token){
        var n=new BaitlyNetworkLink();n.setOrganizationId(1L);n.setProviderId(9L);n.setStatus("INVITED");
        n.setTokenHash(BaitlyNetworkService.hash(token));n.setExpiresAt(Instant.now().plusSeconds(300));n.setUpdatedAt(Instant.now());return n;
    }
    @BeforeEach void clean(){tx(em->{em.createQuery("delete from BaitlyNetworkLink").executeUpdate();return null;});}
    @Test void databaseRejectsDuplicateRelationship(){
        tx(em->{em.persist(link("first"));return null;});
        assertThatThrownBy(()->tx(em->{em.persist(link("second"));em.flush();return null;})).isInstanceOf(RuntimeException.class);
    }
    @Test void concurrentConsumptionAcceptsOnlyOnce() throws Exception {
        String token="a".repeat(72);tx(em->{em.persist(link(token));return null;});
        var barrier=new CyclicBarrier(2);var outcomes=new ArrayList<Future<Boolean>>();
        try(var pool=Executors.newFixedThreadPool(2)){
            for(int i=0;i<2;i++)outcomes.add(pool.submit(()->{
                barrier.await(10,TimeUnit.SECONDS);
                try{return tx(em->{
                    var repo=new JpaRepositoryFactory(em).getRepository(BaitlyNetworkLinkRepository.class);
                    var accounts=mock(ProviderAccountResolver.class);when(accounts.requireProviderId("recipient")).thenReturn(9L);
                    var providers=mock(MarketplaceProviderRepository.class);when(providers.findById(9L)).thenReturn(Optional.empty());
                    var orgs=mock(OrganizationRepository.class);when(orgs.findById(1L)).thenReturn(Optional.empty());
                    new BaitlyNetworkService(repo,providers,mock(MarketplaceCatalogService.class),mock(MarketplaceExposureService.class),
                        accounts,mock(OrganizationService.class),orgs,mock(TenantContext.class),Clock.systemUTC()).accept(token,"recipient");
                    return true;
                });}catch(org.springframework.web.server.ResponseStatusException consumed){return false;}
            }));
            assertThat(List.of(outcomes.get(0).get(20,TimeUnit.SECONDS),outcomes.get(1).get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        tx(em->{var n=em.createQuery("from BaitlyNetworkLink",BaitlyNetworkLink.class).getSingleResult();
            assertThat(n.getStatus()).isEqualTo("ACTIVE");assertThat(n.getTokenHash()).isNull();return null;});
    }
}
