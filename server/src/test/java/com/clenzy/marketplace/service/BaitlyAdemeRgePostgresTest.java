package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.io.IOException;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="baitly.directory.test.jdbc",matches="jdbc:postgresql://127\\.0\\.0\\.1:55442/postgres")
class BaitlyAdemeRgePostgresTest {
    @Test void httpDownloadHoldsNoPoolConnectionAndPublicationReleasesItsLock()throws Exception {
        BaitlyNationalDirectoryPostgresTest.withDatabase((db,manager)->{
            db.update("INSERT INTO baitly_directory_professionals(siret,name,address,city,postal_code,activity,sirene_retrieved_at,recorded_by) VALUES('12345678900011','Atlas','Paris','Paris','75001','43.22A',now(),'stock')");
            var borrowed=new java.util.concurrent.atomic.AtomicInteger();
            var tracked=new org.springframework.jdbc.datasource.DelegatingDataSource(db.getDataSource()){
                @Override public java.sql.Connection getConnection()throws java.sql.SQLException {
                    var real=super.getConnection();borrowed.incrementAndGet();var closed=new java.util.concurrent.atomic.AtomicBoolean();
                    return (java.sql.Connection)java.lang.reflect.Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{java.sql.Connection.class},(proxy,method,args)->{
                        try{return method.invoke(real,args);}catch(java.lang.reflect.InvocationTargetException error){throw error.getCause();}
                        finally{if(method.getName().equals("close")&&closed.compareAndSet(false,true))borrowed.decrementAndGet();}
                    });
                }
            };
            var client=mock(BaitlyAdemeRgeClient.class);
            when(client.download()).thenAnswer(call->{
                assertThat(borrowed.get()).isZero();
                assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
                return new BaitlyAdemeRgeClient.Snapshot("2026-10-20T03:00:00Z",List.of(new BaitlyAdemeRgeClient.Contact("12345678900011",null,"contact@example.com",null)));
            });
            var service=new BaitlyAdemeRgeEnrichment(new org.springframework.jdbc.core.JdbcTemplate(tracked),client,new org.springframework.jdbc.datasource.DataSourceTransactionManager(tracked),new ObjectMapper(),true);
            assertThat(service.enrich().matched()).isEqualTo(1);
            assertThat(borrowed.get()).isZero();
            assertThat(db.queryForObject("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=1875440583",Long.class)).isZero();
        });
    }
    @Test void anExpiredOrReplacedDownloadClaimCannotPublish()throws Exception {
        BaitlyNationalDirectoryPostgresTest.withDatabase((db,manager)->{
            db.update("INSERT INTO baitly_directory_professionals(siret,name,address,city,postal_code,activity,sirene_retrieved_at,recorded_by) VALUES('12345678900011','Atlas','Paris','Paris','75001','43.22A',now(),'stock')");
            var client=mock(BaitlyAdemeRgeClient.class);
            when(client.download()).thenAnswer(call->{
                db.update("UPDATE baitly_directory_rge_sync SET next_check=now()+interval '30 minutes'");
                return new BaitlyAdemeRgeClient.Snapshot("2026-10-20T03:00:00Z",List.of(new BaitlyAdemeRgeClient.Contact("12345678900011",null,"stale@example.com",null)));
            });
            assertThat(new BaitlyAdemeRgeEnrichment(db,client,manager,new ObjectMapper(),true).enrich().matched()).isZero();
            assertThat(db.queryForObject("SELECT rge_email FROM baitly_directory_professionals",String.class)).isNull();
        });
    }
    @Test void exactSiretEnrichmentIsPersistentIdempotentScopedAndKeepsOsmChoices()throws Exception {
        BaitlyNationalDirectoryPostgresTest.withDatabase((db,manager)->{
            db.update("""
                INSERT INTO baitly_directory_professionals(siret,name,address,city,postal_code,activity,sirene_latitude,sirene_longitude,sirene_retrieved_at,recorded_by,suppressed,source_active)
                VALUES('12345678900011','Atlas','1 rue du Port','Paris','75001','43.22A',48.8,2.3,now(),'stock',false,true),
                ('22345678900022','Retiré','Paris','Paris','75001','43.22A',48.8,2.3,now(),'stock',true,true),
                ('32345678900033','Fermé','Paris','Paris','75001','43.22A',48.8,2.3,now(),'stock',false,false)
                """);
            db.execute("CREATE TABLE private_test_crm(name text,phone text)");db.update("INSERT INTO private_test_crm VALUES('Mon édition','privé')");
            db.execute("CREATE TABLE baitly_crm_contact_authorizations(id bigint)");
            var client=mock(BaitlyAdemeRgeClient.class);var mapper=new ObjectMapper();
            var source=new BaitlyAdemeRgeClient.Contact("12345678900011","0102030405","contact@example.com","https://example.com");
            when(client.download()).thenReturn(new BaitlyAdemeRgeClient.Snapshot("2026-10-20T03:00:00Z",List.of(source,
                new BaitlyAdemeRgeClient.Contact("22345678900022","hidden",null,null),
                new BaitlyAdemeRgeClient.Contact("32345678900033","closed",null,null),
                new BaitlyAdemeRgeClient.Contact("92345678900099","not-existing",null,null))));
            var service=new BaitlyAdemeRgeEnrichment(db,client,manager,mapper,true);
            assertThat(service.enrich().matched()).isEqualTo(1);
            var directory=new BaitlyProfessionalDirectory(db,null,null,mapper);
            var row=directory.list("Atlas",0).items().getFirst();long id=((Number)row.get("id")).longValue();
            assertThat(row).containsEntry("phone","0102030405").containsEntry("email","contact@example.com").containsEntry("website","https://example.com").containsEntry("latitude",48.8);
            assertThat(directory.map("Paris","MAINTENANCE","Atlas",-180,-90,180,90,0).items().getFirst()).containsEntry("email","contact@example.com");
            var reference=directory.referencedSource(id);
            assertThat(reference.email()).isEqualTo("contact@example.com");
            assertThat(reference.contactSources()).extracting(BaitlyProfessionalDirectory.ContactEvidence::source).containsExactly("ADEME");
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_professionals",Long.class)).isEqualTo(3);
            assertThat(db.queryForObject("SELECT rge_email FROM baitly_directory_professionals WHERE suppressed",String.class)).isNull();
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_crm_contact_authorizations",Long.class)).isZero();
            assertThat(db.queryForObject("SELECT phone FROM private_test_crm",String.class)).isEqualTo("privé");
            service.enrich();verify(client,times(1)).download(); // Checkpoint survives recreating the worker.
            db.update("UPDATE baitly_directory_rge_sync SET next_check=now()-interval '1 second'");
            new BaitlyAdemeRgeEnrichment(db,client,manager,mapper,true).enrich();
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence WHERE source='ADEME'",Long.class)).isEqualTo(1);
            db.update("UPDATE baitly_directory_professionals SET phone='manual',osm_key='node/42',latitude=48.9,longitude=2.4,osm_confirmed_at=now(),osm_confirmed_by='staff' WHERE id=?",id);
            assertThat(directory.list("Atlas",0).items().getFirst()).containsEntry("phone","manual");
            db.update("UPDATE baitly_directory_rge_sync SET next_check=now()-interval '1 second'");
            when(client.download()).thenThrow(new IOException("Partial download"));
            assertThatThrownBy(service::enrich).isInstanceOf(IOException.class);
            assertThat(directory.list("Atlas",0).items().getFirst()).containsEntry("email","contact@example.com").containsEntry("phone","manual");
            db.update("UPDATE baitly_directory_rge_sync SET next_check=now()-interval '1 second'");
            doReturn(new BaitlyAdemeRgeClient.Snapshot("2026-10-21T03:00:00Z",List.of(new BaitlyAdemeRgeClient.Contact("92345678900099",null,null,null)))).when(client).download();
            assertThat(service.enrich().retired()).isEqualTo(1);
            assertThat(directory.list("Atlas",0).items().getFirst()).containsEntry("email",null).containsEntry("phone","manual");
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence WHERE source='ADEME'",Long.class)).isEqualTo(2);
        });
    }
    @Test void disablingSourceDoesNotAccessNetworkOrDatabase()throws Exception {
        var db=mock(org.springframework.jdbc.core.JdbcTemplate.class);var client=mock(BaitlyAdemeRgeClient.class);
        new BaitlyAdemeRgeEnrichment(db,client,mock(org.springframework.transaction.PlatformTransactionManager.class),new ObjectMapper(),false).enrich();
        verifyNoInteractions(db,client);
    }
}
