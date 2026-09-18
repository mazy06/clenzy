package com.clenzy.service.assignment;

import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.Clock;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class AssignmentNotificationDeliveryTest {
    final JdbcTemplate db=mock(JdbcTemplate.class);
    final ServiceRequestRepository needs=mock(ServiceRequestRepository.class);
    final NotificationService notifications=mock(NotificationService.class);
    final AssignmentNotificationDelivery delivery=new AssignmentNotificationDelivery(db,needs,
        mock(AssignmentProposalStore.class),notifications,Clock.systemUTC());

    @Test void alreadyDeliveredEventDoesNotNotifyAgain() {
        when(db.queryForList(anyString(),eq(1L))).thenReturn(List.of());
        delivery.send(1L);
        verifyNoInteractions(needs,notifications);
    }

    @Test void storageFailureMustNotAcknowledgeTheEvent() {
        var need=new ServiceRequest(); need.setId(2L); need.setOrganizationId(3L);
        when(needs.findById(2L)).thenReturn(Optional.of(need));
        when(db.queryForList(contains("FOR UPDATE"),eq(1L)))
            .thenReturn(List.of(Map.of("request_id",2L,"kind","PUBLIC")));
        var recipient=new HashMap<String,Object>();
        recipient.put("keycloak_id","manager"); recipient.put("organization_id",3L);
        when(db.queryForList(contains("role IN"),eq(3L))).thenReturn(List.of(recipient));
        when(db.queryForList(anyString(),eq(String.class),eq("manager"))).thenReturn(List.of("en"));
        doThrow(new IllegalStateException("storage unavailable")).when(notifications)
            .sendByOrgIdStrict(anyString(),any(),anyString(),anyString(),anyString(),anyLong(),anyMap());
        assertThatThrownBy(() -> delivery.send(1L)).isInstanceOf(IllegalStateException.class);
        verify(db,never()).update(contains("sent_at=CURRENT_TIMESTAMP"),eq(1L));
    }
}
