package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.Jwt;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class BaitlyMissionSafetyServiceTest {
    final InterventionRepository missions=mock(InterventionRepository.class);
    final InterventionAccessPolicy access=mock(InterventionAccessPolicy.class);
    final TeamRepository teams=mock(TeamRepository.class);
    final PropertyInventoryItemRepository inventory=mock(PropertyInventoryItemRepository.class);
    final BaitlyMobileIssueService issues=mock(BaitlyMobileIssueService.class);
    final IssueRepository records=mock(IssueRepository.class);
    final BaitlyMissionSafetyService service=new BaitlyMissionSafetyService(missions,access,teams,inventory,issues,records);
    final Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("worker").build();
    Intervention mission;
    @BeforeEach void setup(){
        mission=new Intervention();mission.setOrganizationId(7L);mission.setStatus(InterventionStatus.IN_PROGRESS);
        when(missions.findById(1L)).thenReturn(Optional.of(mission));when(missions.findForReview(1L,7L)).thenReturn(Optional.of(mission));
        when(records.findBySourceInterventionIdAndOrganizationIdOrderByCreatedAtDesc(1L,7L)).thenReturn(List.of());
    }
    @Test void pauseIsIdempotentAndResumeAccumulatesOnce(){
        service.pause(1L,jwt,false);var paused=mission.getBaitlyPausedAt();assertNotNull(paused);
        service.pause(1L,jwt,false);assertEquals(paused,mission.getBaitlyPausedAt());
        mission.setBaitlyPausedAt(LocalDateTime.now().minusSeconds(120));service.pause(1L,jwt,true);
        assertNull(mission.getBaitlyPausedAt());assertTrue(mission.getBaitlyPauseSeconds()>=120);
        long seconds=mission.getBaitlyPauseSeconds();service.pause(1L,jwt,true);assertEquals(seconds,mission.getBaitlyPauseSeconds());
    }
    @Test void deniesUnassignedActorBeforeLocking(){
        doThrow(new org.springframework.security.access.AccessDeniedException("Denied")).when(access).requireAssignee(mission,jwt);
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->service.pause(1L,jwt,false));
        verify(missions,never()).findForReview(anyLong(),anyLong());
    }
    @Test void damageRejectsUnknownRoomWithoutIssueOrPause(){
        var property=new Property();property.setOrganizationId(7L);property.setBedroomCount(1);mission.setProperty(property);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.damage(1L,new BaitlyMissionSafetyService.Damage("breakage","bedroom_9",null,""),jwt));
        verifyNoInteractions(issues);assertNull(mission.getBaitlyPausedAt());
    }
    @Test void damageStoresStructuredEvidenceAndPauses(){
        var property=new Property();property.setId(3L);property.setOrganizationId(7L);mission.setProperty(property);
        var item=new PropertyInventoryItem();item.setOrganizationId(7L);item.setName("Canapé");
        when(inventory.findBaitlyMissionItem(4L,3L,7L)).thenReturn(Optional.of(item));
        var issue=new Issue();when(issues.report(eq(1L),anyString(),anyString(),eq(jwt))).thenReturn(Map.of("id",5L));
        when(records.findById(5L)).thenReturn(Optional.of(issue));
        service.damage(1L,new BaitlyMissionSafetyService.Damage("breakage","living_1",4L,"Pied cassé"),jwt);
        assertEquals("breakage",issue.getBaitlyDamageCause());assertEquals("living_1",issue.getBaitlyDamageRoom());assertEquals(4L,issue.getBaitlyDamageItemId());
        assertNotNull(mission.getBaitlyPausedAt());verify(records).save(issue);
    }
    @Test void reportsAPropertySurfaceWithoutInventingAnInventoryItem(){
        var property=new Property();property.setOrganizationId(7L);mission.setProperty(property);
        var issue=new Issue();when(issues.report(eq(1L),anyString(),anyString(),eq(jwt))).thenReturn(Map.of("id",5L));when(records.findById(5L)).thenReturn(Optional.of(issue));
        service.damage(1L,new BaitlyMissionSafetyService.Damage("leak","kitchen_1",null,"Trace d’humidité","surface","ceiling","Plafond"),jwt);
        assertEquals("surface",issue.getBaitlyDamageElementCategory());assertEquals("ceiling",issue.getBaitlyDamageElementCode());assertEquals("Plafond",issue.getBaitlyDamageElementName());assertNull(issue.getBaitlyDamageItemId());
        verify(inventory,never()).findBaitlyMissionItem(any(),any(),any());verify(inventory,never()).save(any());
    }
}
