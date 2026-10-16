package com.clenzy.service.assignment;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import com.clenzy.controller.AssignmentStreamController;
import com.clenzy.tenant.TenantContext;
import java.util.List;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
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
        var response = new MockHttpServletResponse();
        assertThatThrownBy(() -> controller.stream(response)).isInstanceOf(RuntimeException.class);
        verifyNoInteractions(realtime);
        try {
            tenant.setOrganizationId(2L);
            controller.stream(response);
            verify(realtime).subscribe(2L);
            assertThat(response.getHeader("X-Accel-Buffering")).isEqualTo("no");
        } finally { tenant.clear(); }
    }
    @Test void idleConnectionsReceiveCommentsWithoutQueriesOrBusinessEvents() throws Exception {
        var db = mock(JdbcTemplate.class);
        var redis = mock(StringRedisTemplate.class);
        var realtime = new AssignmentRealtime(redis, db);
        var tenant = new TenantContext();
        var mvc = MockMvcBuilders.standaloneSetup(new AssignmentStreamController(realtime, tenant)).build();
        try {
            tenant.setOrganizationId(2L);
            var result = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/service-assignments/stream")).andReturn();
            assertThat(result.getRequest().isAsyncStarted()).isTrue();
            realtime.heartbeat();
            assertThat(result.getResponse().getContentAsString())
                .contains("event:ready", ":baitly-keepalive")
                .doesNotContain("event:assignment");
            verifyNoInteractions(db, redis);
        } finally { tenant.clear(); }
    }
}
