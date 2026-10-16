package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.dto.InterventionResponse;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.*;
import java.math.BigDecimal;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class BaitlyManagerMissionReviewTest {
    final InterventionRepository missions=mock(InterventionRepository.class);
    final InterventionAccessPolicy access=mock(InterventionAccessPolicy.class);
    final InterventionLifecycleService lifecycle=mock(InterventionLifecycleService.class);
    final BaitlyManagerMissionReview service=new BaitlyManagerMissionReview(missions,access,lifecycle);
    Intervention mission;
    Jwt jwt(String role){return Jwt.withTokenValue("test").header("alg","none").subject("reviewer").claim("realm_access",Map.of("roles",List.of(role))).build();}
    @BeforeEach void setup(){mission=new Intervention();mission.setOrganizationId(7L);mission.setVersion(3L);mission.setStatus(InterventionStatus.AWAITING_VALIDATION);when(missions.findById(1L)).thenReturn(Optional.of(mission));when(missions.findForReview(1L,7L)).thenReturn(Optional.of(mission));}
    @Test void fieldWorkerCannotApproveHisOwnWork(){
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->service.record(1L,new BaitlyManagerMissionReview.Review("approve","Bien",5,BigDecimal.TEN,3L),jwt("HOUSEKEEPER")));
        verify(missions,never()).findForReview(any(),any());verifyNoInteractions(lifecycle);
    }
    @Test void actualOrganizationManagerCanReviewWithoutAPlatformRole(){
        var actor=jwt("HOST");when(access.canReview(mission,actor)).thenReturn(true);
        service.record(1L,new BaitlyManagerMissionReview.Review("approve",null,null,BigDecimal.TEN,3L),actor);
        verify(lifecycle).validateIntervention(1L,BigDecimal.TEN,actor);
    }
    @Test void staleReviewNeverChangesFeedbackOrTheLifecycle(){
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.record(1L,new BaitlyManagerMissionReview.Review("approve","Bien",5,BigDecimal.TEN,2L),jwt("SUPER_ADMIN")));
        assertNull(mission.getCustomerFeedback());verifyNoInteractions(lifecycle);
    }
    @Test void approvalUsesThePmsPaymentLifecycleAndRecordsTheManagersAssessment(){
        var actor=jwt("SUPER_ADMIN");var receipt=InterventionResponse.builder().status("AWAITING_PAYMENT").build();
        when(lifecycle.validateIntervention(1L,BigDecimal.TEN,actor)).thenReturn(receipt);
        assertEquals(receipt,service.record(1L,new BaitlyManagerMissionReview.Review("approve"," Bien ",5,BigDecimal.TEN,3L),actor));
        assertEquals("Bien",mission.getCustomerFeedback());assertEquals(5,mission.getCustomerRating());verify(access).assertCanAccess(mission,actor);
    }
    @Test void rejectionRequiresAReasonAndDelegatesToWorkResumption(){
        var actor=jwt("SUPER_MANAGER");
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.record(1L,new BaitlyManagerMissionReview.Review("reject","",null,null,3L),actor));
        service.record(1L,new BaitlyManagerMissionReview.Review("reject","Reprendre la cuisine",2,null,3L),actor);
        verify(lifecycle).rejectWork(1L,"Reprendre la cuisine",actor);
    }
}
