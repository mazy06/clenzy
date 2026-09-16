package com.clenzy.service.assignment;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import com.clenzy.controller.AssignmentStreamController;
import com.clenzy.tenant.TenantContext;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class AssignmentRealtimeTest {
    @Test void onlyConcernedOrganizationsReceiveAnInvalidationWithoutBusinessData() {
        var db=mock(JdbcTemplate.class);
        var redis=mock(StringRedisTemplate.class);
        when(db.queryForList(anyString(),eq(Long.class),eq(344L),eq(344L))).thenReturn(List.of(2L,7L));
        new AssignmentRealtime(redis,db).changed(344L);
        verify(redis).convertAndSend(AssignmentRealtime.CHANNEL,"2");
        verify(redis).convertAndSend(AssignmentRealtime.CHANNEL,"7");
        verifyNoMoreInteractions(redis);
    }
    @Test void streamScopeComesFromAuthenticatedTenantAndCannotBeChosenByTheClient() throws Exception {
        var tenant=new TenantContext();
        var realtime=mock(AssignmentRealtime.class);
        var controller=new AssignmentStreamController(realtime,tenant);
        assertThatThrownBy(controller::stream).isInstanceOf(RuntimeException.class);
        verifyNoInteractions(realtime);
        try {
            tenant.setOrganizationId(2L);
            controller.stream();
            verify(realtime).subscribe(2L);
        } finally { tenant.clear(); }
    }
}
