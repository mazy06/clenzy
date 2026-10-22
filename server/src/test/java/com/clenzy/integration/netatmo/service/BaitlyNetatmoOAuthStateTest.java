package com.clenzy.integration.netatmo.service;

import com.clenzy.integration.netatmo.config.NetatmoConfig;
import com.clenzy.integration.netatmo.repository.NetatmoConnectionRepository;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.web.client.RestTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyNetatmoOAuthStateTest {
    final StringRedisTemplate redis=mock(StringRedisTemplate.class);
    @SuppressWarnings("unchecked") final ValueOperations<String,String> values=mock(ValueOperations.class);
    final NetatmoOAuthService service=new NetatmoOAuthService(mock(NetatmoConfig.class),mock(NetatmoPlatformConfigService.class),
            mock(NetatmoConnectionRepository.class),mock(TokenEncryptionService.class),mock(TenantContext.class),redis,mock(RestTemplate.class));

    @Test void atomicConsumptionKeepsOrganizationAndRejectsReplay() {
        when(redis.opsForValue()).thenReturn(values);
        when(values.getAndDelete("oauth:netatmo:state:one-use")).thenReturn("user-test|7",null);
        var identity=service.consumeState("one-use");
        assertThat(identity.userId()).isEqualTo("user-test");assertThat(identity.organizationId()).isEqualTo(7L);
        assertThatThrownBy(() -> service.consumeState("one-use")).isInstanceOf(SecurityException.class);
        verify(values,never()).get(anyString());verify(redis,never()).delete(anyString());
    }
    @Test void missingStateNeverTouchesRedis() {
        assertThatThrownBy(() -> service.consumeState(null)).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.consumeState(" ")).isInstanceOf(SecurityException.class);
        verifyNoInteractions(redis,values);
    }
}
