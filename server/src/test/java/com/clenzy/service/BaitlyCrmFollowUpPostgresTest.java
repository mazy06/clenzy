package com.clenzy.service;

import com.clenzy.repository.OrganizationMemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.access.AccessDeniedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="baitly.directory.test.jdbc",matches="jdbc:postgresql://127\\.0\\.0\\.1:55442/postgres")
class BaitlyCrmFollowUpPostgresTest {
    @Test void migratesAndPersistsFollowUpWithTenantIsolationWithoutErasingQualification() throws Exception {
        String base=System.getProperty("baitly.directory.test.jdbc");
        String schema="baitly_follow_up_"+UUID.randomUUID().toString().replace("-", "");
        try(var connection=DriverManager.getConnection(base,"postgres","");var statement=connection.createStatement()) {
            statement.execute("CREATE SCHEMA "+schema);
            try {
                var db=new JdbcTemplate(new DriverManagerDataSource(base+"?currentSchema="+schema,"postgres",""));
                db.execute("CREATE TABLE organizations(id bigint PRIMARY KEY)");
                db.execute("CREATE TABLE users(id bigint PRIMARY KEY)");
                db.execute("CREATE TABLE prospects(id bigint PRIMARY KEY, organization_id bigint, archived boolean DEFAULT false, UNIQUE(organization_id,id))");
                db.execute(Files.readString(Path.of("src/main/resources/db/changelog/changes/0574__baitly_crm_contact_details.sql")));
                db.execute(Files.readString(Path.of("src/main/resources/db/changelog/changes/0596__baitly_crm_follow_up.sql")));
                db.execute("INSERT INTO organizations VALUES(10),(20)");
                db.execute("INSERT INTO prospects(id,organization_id,archived) VALUES(1,10,false),(2,20,false),(3,10,true)");
                var access=mock(BaitlyCrmAccess.class);when(access.lock("actor")).thenReturn(10L);
                var members=mock(OrganizationMemberRepository.class);when(members.findByOrganizationIdWithUser(10L)).thenReturn(List.of());
                var service=new BaitlyCrmDetails(db,access,members,mock(PermissionService.class),mock(UserAvatarUrlResolver.class));
                LocalDate last=LocalDate.now().minusDays(2),due=LocalDate.now().plusDays(1);
                service.saveFollowUp("actor",1,new BaitlyCrmDetails.FollowUp(last," Appeler pour confirmer les tarifs ",due));
                service.save("actor",1,new BaitlyCrmDetails.Details(null,"Atlas",null,null,null,"QUALIFIED"));
                var row=db.queryForMap("SELECT * FROM baitly_crm_contact_details WHERE prospect_id=1");
                assertThat(row).containsEntry("next_action","Appeler pour confirmer les tarifs").containsEntry("qualification","QUALIFIED");
                assertThat(db.queryForObject("SELECT last_exchange_on FROM baitly_crm_contact_details WHERE prospect_id=1",LocalDate.class)).isEqualTo(last);
                service.saveFollowUp("actor",1,new BaitlyCrmDetails.FollowUp(last,null,null));
                assertThat(db.queryForMap("SELECT company_name,qualification,next_action FROM baitly_crm_contact_details WHERE prospect_id=1"))
                    .containsEntry("company_name","Atlas").containsEntry("qualification","QUALIFIED").containsEntry("next_action",null);
                for(long id:List.of(2L,3L,999L))assertThatThrownBy(()->service.saveFollowUp("actor",id,new BaitlyCrmDetails.FollowUp(last,"Appeler",due))).isInstanceOf(AccessDeniedException.class);
                assertThatThrownBy(()->service.saveFollowUp("actor",1,new BaitlyCrmDetails.FollowUp(last,"Appeler",null))).isInstanceOf(IllegalArgumentException.class);
                assertThatThrownBy(()->service.saveFollowUp("actor",1,new BaitlyCrmDetails.FollowUp(LocalDate.now().plusDays(1),null,null))).isInstanceOf(IllegalArgumentException.class);
                assertThatThrownBy(()->db.execute("UPDATE baitly_crm_contact_details SET next_action_on=current_date WHERE prospect_id=1")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
                assertThat(db.queryForObject("SELECT count(*) FROM baitly_crm_contact_details",Integer.class)).isEqualTo(1);
            } finally { statement.execute("DROP SCHEMA "+schema+" CASCADE"); }
        }
    }
}
