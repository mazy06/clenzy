package com.clenzy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class BaitlyCrmLocationBatchesTest {
    JdbcTemplate db=mock(JdbcTemplate.class);BaitlyCrmAccess access=mock(BaitlyCrmAccess.class);
    BaitlyCrmOsmMatching matching=mock(BaitlyCrmOsmMatching.class);OrganizationService organizations=mock(OrganizationService.class);PermissionService permissions=mock(PermissionService.class);
    BaitlyCrmLocationBatches service(boolean enabled,String endpoint){return new BaitlyCrmLocationBatches(db,access,matching,new ObjectMapper(),organizations,permissions,enabled,endpoint);}
    @Test void publicNominatimCannotBeUsedForMassSearchEvenWhenFlagIsEnabled(){
        when(access.require("actor")).thenReturn(10L);when(access.lock("actor")).thenReturn(10L);
        var service=service(true,"https://nominatim.openstreetmap.org/search");assertThat(service.config("actor")).containsEntry("enabled",false);
        assertThatThrownBy(()->service.start("actor",new BaitlyCrmLocationBatches.Start("FR",true))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        service.tick();verifyNoInteractions(db,matching);
    }
    @Test void dedicatedServiceRequiresExplicitActivation(){
        when(access.require("actor")).thenReturn(10L);
        assertThat(service(false,"https://geo.example/search").config("actor")).containsEntry("enabled",false);
        assertThat(service(true,"https://geo.example/search").config("actor")).containsEntry("enabled",true);
    }
    @Test void unknownOrganizationJobCannotBeCancelledOrConfirmed(){
        when(access.lock("actor")).thenReturn(10L);UUID id=UUID.randomUUID();var service=service(true,"https://geo.example/search");
        assertThatThrownBy(()->service.cancel("actor",id)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->service.confirm("actor",id,7,new BaitlyCrmLocationBatches.Choice(0))).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(matching);
    }
    @Test void workerCancelsAJobWhenItsCreatorLosesManagementAccess(){
        UUID id=UUID.randomUUID();when(db.queryForObject(contains("pg_try_advisory"),eq(Boolean.class))).thenReturn(true);
        when(db.queryForList(contains("FOR UPDATE OF i,b"))).thenReturn(List.of(Map.of("organization_id",10L,"batch_id",id,"prospect_id",7L,"created_by","actor","attempts",0)));
        service(true,"https://geo.example/search").tick();
        verify(db).update(contains("status='CANCELLED'"),eq(10L),eq(id));verifyNoInteractions(matching);
    }
}
