package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class BaitlyDirectoryCountrySelectionTest {
    @Test void boundedReadSelectionsDoNotRelaxRegistryIdentities(){
        assertThat(BaitlyDirectoryCountry.countries(" ma,FR,ma ")).containsExactly("FR","MA");
        for(String invalid:List.of("", "FR,", "FR,XX", "FR,,MA", "FR,MA,SA,FR,MA,SA,FR,MA"))
            assertThatThrownBy(()->BaitlyDirectoryCountry.countries(invalid)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->BaitlyDirectoryCountry.country("FR,MA")).isInstanceOf(IllegalArgumentException.class);
        assertThat(BaitlyProfessionalSearchFilters.readServices("LAUNDRY,CLEANING,LAUNDRY")).containsExactly("CLEANING","LAUNDRY");
        for(String invalid:List.of("CLEANING,", "UNKNOWN", "CLEANING,,LAUNDRY", "CLEANING,".repeat(40)))
            assertThatThrownBy(()->BaitlyProfessionalSearchFilters.readServices(invalid)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->BaitlyProfessionalSearchFilters.activities("CLEANING,LAUNDRY")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @EnabledIfSystemProperty(named="baitly.directory.test.jdbc",matches="jdbc:postgresql:.*baitly_directory_test_.*")
    void mixedCountriesUseTheirOwnServiceDefinitionsInListsCoverageAndTiles()throws Exception {
        BaitlyNationalDirectoryPostgresTest.withDatabase((db,manager)->{
            db.update("""
                INSERT INTO baitly_directory_professionals(siret,country_code,identifier_type,identifier,base_source,name,address,city,postal_code,activity,service,sirene_latitude,sirene_longitude,sirene_retrieved_at,recorded_by,email)
                VALUES ('12345678900011','FR','SIRET','12345678900011','SIRENE','A France','','Paris','75001','81.21Z',null,48,2,now(),'test','fr@example.org'),
                       ('22345678900011','FR','SIRET','22345678900011','SIRENE','B Travaux','','Paris','75001','43.21A',null,48,2,now(),'test','travaux@example.org'),
                       (null,'MA','ICE','001234567890123','OMPIC','C Maroc','','Rabat','','','CLEANING',34,-7,now(),'test','ma@example.org'),
                       (null,'MA','ICE','001234567890124','OMPIC','D Maintenance','','Rabat','','81.21Z','MAINTENANCE',34,-7,now(),'test','maintenance@example.org'),
                       (null,'SA','UNN','7000000001','WATHQ','E Saudi','','Riyadh','','','CLEANING',24,45,now(),'test','sa@example.org')
                """);
            var directory=new BaitlyProfessionalDirectory(db,null,null,new ObjectMapper());
            assertThat(directory.list("",0,"CLEANING","EMAIL","MA,FR,MA").items()).extracting(row->row.get("name")).containsExactly("A France","C Maroc");
            assertThat(directory.list("",0,"CLEANING,MAINTENANCE,CLEANING","EMAIL","FR,MA").items()).extracting(row->row.get("name")).containsExactly("A France","B Travaux","C Maroc","D Maintenance");
            assertThat(directory.list("",0,"CLEANING,MAINTENANCE","EMAIL","MA").total()).isEqualTo(2);
            assertThat(directory.clusters("","CLEANING,MAINTENANCE","",-180,-90,180,90,"EMAIL","FR,MA").total()).isEqualTo(4);
            assertThat(directory.map("","CLEANING","",-180,-90,180,90,0,"EMAIL","FR,MA").items()).hasSize(2);
            assertThat(directory.clusters("","CLEANING","",-180,-90,180,90,"EMAIL","FR,MA").total()).isEqualTo(2);
            assertThat(directory.rankedMap("","CLEANING","",-180,-90,180,90,0,"EMAIL","NAME",0.,40.,"FR,MA").items()).extracting(row->row.get("name")).containsExactly("A France","C Maroc");
            try(var connection=db.getDataSource().getConnection()){
                var database=liquibase.database.DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new liquibase.database.jvm.JdbcConnection(connection));
                try(var master=new liquibase.Liquibase(System.getProperty("baitly.directory.test.changelog","db/changelog/db.changelog-master.yaml"),new liquibase.resource.ClassLoaderResourceAccessor(),database)){
                    var selected=new liquibase.changelog.DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                    master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->Set.of("0587-baitly-directory-search-index","0588-baitly-directory-postgis","0591-baitly-directory-country-cells").contains(cs.getId())).forEach(selected::addChangeSet);
                    assertThat(selected.getChangeSets()).hasSize(3);
                    new liquibase.Liquibase(selected,new liquibase.resource.ClassLoaderResourceAccessor(),database).update("");
                }
            }
            var index=new BaitlyDirectoryMapIndex(db,null,new ObjectMapper(),new io.micrometer.core.instrument.simple.SimpleMeterRegistry(),manager);
            assertThat(index.rebuild()).isTrue();directory.mapIndex(index);
            assertThat(index.coverage("CLEANING","EMAIL",-180,-90,180,90,"FR,MA").total()).isEqualTo(2);
            assertThat(index.coverage("CLEANING,MAINTENANCE","EMAIL",-180,-90,180,90,"FR,MA").total()).isEqualTo(4);
            assertThat(index.coverage("CLEANING,MAINTENANCE","EMAIL",-180,-90,180,90,"FR").total()).isEqualTo(2);
            assertThat(index.tile(0,0,0,"CLEANING,MAINTENANCE","EMAIL",index.state().revision(),"FR,MA")).isNotEmpty();
            assertThat(index.tile(0,0,0,"CLEANING","EMAIL",index.state().revision(),"FR,MA")).isNotEmpty();
            assertThat(directory.rankedMap("","CLEANING","",-180,-90,180,90,0,"EMAIL","PROXIMITY",-7.,34.,"MA,SA").items()).extracting(row->row.get("name")).containsExactly("C Maroc","E Saudi");
        });
    }
}
