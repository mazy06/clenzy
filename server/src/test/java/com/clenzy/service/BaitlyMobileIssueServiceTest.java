package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.exception.UnauthorizedException;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
@ExtendWith(MockitoExtension.class)
class BaitlyMobileIssueServiceTest {
    @Mock InterventionRepository missions;@Mock IssueRepository issues;@Mock InterventionAccessPolicy access;
    @Mock UserRepository users;@Mock NotificationService notifications;@InjectMocks BaitlyMobileIssueService service;
    Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("worker").build();
    @Test void unassignedAccountCannotReportOnAnotherMission() {
        var mission=new Intervention();when(missions.findById(1L)).thenReturn(Optional.of(mission));
        when(access.requireAssignee(mission,jwt)).thenThrow(new UnauthorizedException("not assigned"));
        assertThatThrownBy(()->service.report(1L,"Leak","Bathroom",jwt)).isInstanceOf(UnauthorizedException.class);
        verifyNoInteractions(issues,users,notifications);
    }
    @Test void assignedProviderReportsIntoPropertyOrganizationRatherThanOwnOrganization() {
        var actor=new User();actor.setId(42L);actor.setOrganizationId(7L);
        var property=new Property();property.setId(5L);
        var mission=new Intervention();mission.setProperty(property);mission.setOrganizationId(99L);mission.setStatus(InterventionStatus.IN_PROGRESS);
        when(missions.findById(1L)).thenReturn(Optional.of(mission));when(access.requireAssignee(mission,jwt)).thenReturn(actor);
        when(users.findByKeycloakId("worker")).thenReturn(Optional.of(actor));
        var saved=mock(Issue.class);when(saved.getId()).thenReturn(9L);when(issues.saveAndFlush(any())).thenReturn(saved);
        assertThat(service.report(1L,"Leak","Bathroom",jwt)).containsEntry("id",9L);
        var capture=ArgumentCaptor.forClass(Issue.class);verify(issues).saveAndFlush(capture.capture());
        assertThat(capture.getValue().getOrganizationId()).isEqualTo(99L);
        assertThat(capture.getValue().getReportedBy()).isEqualTo(42L);
    }
}
