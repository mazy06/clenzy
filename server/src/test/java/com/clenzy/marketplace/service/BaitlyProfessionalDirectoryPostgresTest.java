package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.redis.core.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.sql.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="baitly.directory.test.jdbc",matches="jdbc:postgresql://127\\.0\\.0\\.1:55442/postgres")
class BaitlyProfessionalDirectoryPostgresTest {
    @Test void liquibaseAndValidationPreserveIdentityProvenanceAndWithdrawal() throws Exception {
        String base=System.getProperty("baitly.directory.test.jdbc"),schema="baitly_directory_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()){s.execute("CREATE SCHEMA "+schema);}
        String url=base+"?currentSchema="+schema;
        try{
            try(var c=DriverManager.getConnection(url,"postgres","")){
                var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));var resources=new ClassLoaderResourceAccessor();
                try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)){
                    var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                    master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->Set.of("0577-baitly-professional-directory","0583-baitly-national-directory","0585-baitly-directory-ademe-rge","0586-baitly-directory-map-positions").contains(cs.getId())).forEach(selected::addChangeSet);
                    assertThat(selected.getChangeSets()).hasSize(4);new Liquibase(selected,resources,db).update("");
                }
            }
            var ds=new DriverManagerDataSource(url,"postgres","");var jdbc=new JdbcTemplate(ds);var tx=new TransactionTemplate(new DataSourceTransactionManager(ds));
            jdbc.execute("CREATE TABLE marketplace_providers(id bigint,registration_number varchar(40),display_name varchar(150),base_city varchar(80))");
            var mapper=new ObjectMapper().registerModule(new JavaTimeModule());var client=mock(BaitlyProfessionalDataClient.class);
            var redis=mock(StringRedisTemplate.class);
            @SuppressWarnings("unchecked") ValueOperations<String,String> values=mock(ValueOperations.class);
            var tickets=new HashMap<String,String>();when(redis.opsForValue()).thenReturn(values);when(values.get(anyString())).thenAnswer(i->tickets.get(i.getArgument(0)));
            doAnswer(i->{tickets.put(i.getArgument(0),i.getArgument(1));return null;}).when(values).set(anyString(),anyString(),any(java.time.Duration.class));
            when(client.search(anyString(),anyString(),anyInt())).thenReturn(mapper.readTree("""
                {"results":[{"nom_complet":"Atlas","statut_diffusion":"O","etat_administratif":"A","siege":{
                "siret":"12345678900011","statut_diffusion_etablissement":"O","etat_administratif":"A","adresse":"12 rue du Port Nantes",
                "libelle_commune":"Nantes","code_postal":"44000","activite_principale":"81.21Z","latitude":"47.2","longitude":"-1.5"}}]}
                """));
            var directory=new BaitlyProfessionalDirectory(jdbc,client,redis,mapper);
            var preview=directory.search("staff",new BaitlyProfessionalDirectory.Search("Atlas","44000",1));
            assertThat(directory.list("",0).total()).isZero();
            var choice=new BaitlyProfessionalDirectory.Choice(preview.ticket(),0);
            var row=tx.execute(status->directory.confirmBusiness("staff",choice));long id=((Number)row.get("id")).longValue();
            tx.execute(status->directory.confirmBusiness("staff",choice));
            assertThat(directory.list("",0).total()).isEqualTo(1);assertThat(row.get("latitude")).isNull();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence",Integer.class)).isEqualTo(1);
            when(client.match(any())).thenReturn(mapper.readTree("""
                {"elements":[{"type":"node","id":42,"lat":47.21,"lon":-1.51,"tags":{"name":"Atlas","ref:FR:SIRET":"12345678900011","contact:phone":"0102030405"}}]}
                """));
            var matches=directory.match("staff",id);assertThat(directory.list("",0).items().getFirst().get("latitude")).isEqualTo(47.2);
            var selected=new BaitlyProfessionalDirectory.Choice(matches.ticket(),0);
            tx.execute(status->directory.confirmPlace("staff",id,selected));
            assertThat(directory.list("",0).items().getFirst().get("osm_key")).isEqualTo("node/42");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence",Integer.class)).isEqualTo(2);
            assertThatThrownBy(()->tx.execute(status->directory.confirmPlace("staff",id,selected))).hasMessageContaining("changé");
            var existing=tx.execute(status->directory.confirmBusinesses("staff",new BaitlyProfessionalDirectory.BulkChoices(List.of(choice))));
            assertThat(existing).extracting(BaitlyProfessionalDirectory.ImportResult::status).containsExactly("EXISTING");
            assertThat(directory.list("",0).items().getFirst().get("osm_key")).isEqualTo("node/42");
            tx.executeWithoutResult(status->directory.suppress(id));assertThat(directory.list("",0).total()).isZero();
            assertThatThrownBy(()->tx.execute(status->directory.confirmBusiness("staff",choice))).hasMessageContaining("retirée");
            var fresh=new BaitlyProfessionalData.Business("12345678900022","Nouveau","Nantes","Nantes","44000","81.21Z",47.2,-1.5);
            var catalogue=new BaitlyProfessionalData.Business("12345678900033","Inscrit","Nantes","Nantes","44000","81.21Z",47.2,-1.5);
            jdbc.update("INSERT INTO marketplace_providers VALUES(2,?,?,?)",catalogue.siret(),catalogue.name(),catalogue.city());
            UUID pageTwo=UUID.randomUUID();
            tickets.put("baitly:directory:ticket:"+pageTwo,mapper.writeValueAsString(new BaitlyProfessionalDirectory.Ticket(
                "staff","SIRENE",null,null,java.time.Instant.now(),List.of(fresh,catalogue),List.of())));
            var batch=new BaitlyProfessionalDirectory.BulkChoices(List.of(choice,new BaitlyProfessionalDirectory.Choice(pageTwo,0),
                new BaitlyProfessionalDirectory.Choice(pageTwo,0),new BaitlyProfessionalDirectory.Choice(pageTwo,1)));
            var report=tx.execute(status->directory.confirmBusinesses("staff",batch));
            assertThat(report).extracting(BaitlyProfessionalDirectory.ImportResult::status).containsExactly("REMOVED","CREATED","CATALOGUE");
            assertThat(directory.list("",0).total()).isEqualTo(1);
            assertThat(directory.list("",0).items().getFirst().get("latitude")).isEqualTo(47.2);
            var repeated=tx.execute(status->directory.confirmBusinesses("staff",batch));
            assertThat(repeated).extracting(BaitlyProfessionalDirectory.ImportResult::status).containsExactly("REMOVED","EXISTING","CATALOGUE");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_directory_source_evidence",Integer.class)).isEqualTo(1);
            var map=directory.map("Nantes","CLEANING","",-2,47,-1,48,0);
            assertThat(map.items()).hasSize(1);assertThat(map.items().getFirst().get("location_source")).isEqualTo("SIRENE");assertThat(map.nextCursor()).isNull();
            assertThat(directory.map("Paris","CLEANING","",-180,-90,180,90,0).items()).isEmpty();
            assertThat(directory.map("Nantes","SECURITY","",-180,-90,180,90,0).items()).isEmpty();
            assertThat(directory.map("","","",1,40,5,50,0).items()).isEmpty();
            jdbc.update("""
                INSERT INTO baitly_directory_professionals(siret,name,address,city,postal_code,activity,sirene_latitude,sirene_longitude,sirene_retrieved_at,recorded_by)
                SELECT (90000000000000+n)::text,'National '||n,'1 rue du Port','Nantes','44000','81.21Z',47.2,-1.5,now(),'stock' FROM generate_series(1,201) n
                """);
            var first=directory.map("Nantes","CLEANING","",-180,-90,180,90,0);assertThat(first.items()).hasSize(200);assertThat(first.nextCursor()).isNotNull();
            var next=directory.map("Nantes","CLEANING","",-180,-90,180,90,first.nextCursor());assertThat(next.items()).hasSize(2);assertThat(next.nextCursor()).isNull();
            assertThat(next.items().stream().map(r->r.get("id"))).doesNotContainAnyElementsOf(first.items().stream().map(r->r.get("id")).toList());
            assertThat(directory.map("","","%",-180,-90,180,90,0).items()).isEmpty();
            assertThatThrownBy(()->directory.map("","","",Double.NaN,-90,180,90,0)).isInstanceOf(IllegalArgumentException.class);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_directory_professionals",Long.class)).isEqualTo(203);
            jdbc.update("""
                INSERT INTO baitly_directory_professionals(siret,name,address,city,postal_code,activity,sirene_latitude,sirene_longitude,sirene_retrieved_at,recorded_by)
                SELECT (91000000000000+n)::text,'Couverture '||n,'1 rue Test','Autre région','13000',CASE WHEN n%2=0 THEN '96.01B' ELSE '81.21Z' END,
                    43+n%4*2,-4+n%6*2,now(),'stock' FROM generate_series(1,600) n
                """);
            var coverage=directory.clusters("","","",-6,41,10,51.5,"");
            assertThat(coverage.total()).isEqualTo(802);
            assertThat(coverage.clusters().size()).isBetween(5,96);
            assertThat(coverage.clusters().stream().mapToLong(BaitlyProfessionalDirectory.MapCluster::count).sum()).isEqualTo(802);
            assertThat(directory.map("","","",-6,41,10,51.5,0).items()).hasSize(200);
            assertThat(directory.clusters("","LAUNDRY","",-6,41,10,51.5,"").total()).isEqualTo(300);
            assertThat(directory.clusters("Nantes","CLEANING","",-6,41,10,51.5,"").total()).isEqualTo(202);
            assertThat(directory.clusters("","","",-6,41,10,51.5,"ANY").total()).isZero();
            assertThatThrownBy(()->directory.clusters("","","",1,40,1,50,"")).isInstanceOf(IllegalArgumentException.class);
            jdbc.update("""
                INSERT INTO baitly_directory_professionals(siret,name,address,city,postal_code,activity,sirene_latitude,sirene_longitude,sirene_retrieved_at,recorded_by)
                VALUES ('92000000000001','Pacifique A','1 rue Test','Pacifique','00000','81.21Z',0,179.8,now(),'stock'),
                       ('92000000000002','Pacifique B','2 rue Test','Pacifique','00000','81.21Z',0,-179.8,now(),'stock')
                """);
            assertThat(directory.clusters("","","",170,-1,-170,1,"").total()).isEqualTo(2);
            // Ranking must consider rows beyond the first legacy ID page.
            jdbc.update("UPDATE baitly_directory_professionals SET name='Zed',sirene_latitude=48,sirene_longitude=2 WHERE source_active=true");
            long nearest=jdbc.queryForObject("SELECT max(id) FROM baitly_directory_professionals",Long.class);
            jdbc.update("UPDATE baitly_directory_professionals SET name='Alpha',sirene_latitude=46,sirene_longitude=2,rge_email='contact@example.com',rge_phone='0102030405' WHERE id=?",nearest);
            long phoneOnly=nearest-1;
            jdbc.update("UPDATE baitly_directory_professionals SET name='Beta',rge_phone='0102030405' WHERE id=?",phoneOnly);
            jdbc.update("UPDATE baitly_directory_professionals SET website='https://example.com' WHERE id=?",phoneOnly-1);
            for(String sort:List.of("PROXIMITY","CONTACTS","NAME")){
                var ranked=directory.rankedMap("","","",-6,41,10,51,0,"",sort);
                assertThat(ranked.items()).hasSize(200);
                assertThat(ranked.items().getFirst().get("id")).isEqualTo(nearest);
                if(sort.equals("CONTACTS"))assertThat(ranked.items().get(1).get("id")).isEqualTo(phoneOnly);
                var ids=new HashSet<Object>();long cursor=0;
                do{
                    var page=directory.rankedMap("","","",-6,41,10,51,cursor,"",sort);
                    for(var item:page.items())assertThat(ids.add(item.get("id"))).isTrue();
                    cursor=page.nextCursor()==null?0:page.nextCursor();
                }while(cursor>0);
                assertThat(ids).hasSize(804);
            }
            assertThat(directory.rankedMap("","","",-6,41,10,51,0,"BOTH","CONTACTS").items()).hasSize(1);
            assertThatThrownBy(()->directory.rankedMap("","","",-6,41,10,51,0,"","INVALID")).isInstanceOf(IllegalArgumentException.class);
        }finally{try(var c=DriverManager.getConnection(base,"postgres","");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}}
    }
}
