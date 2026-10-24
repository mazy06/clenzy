package com.clenzy.service.device;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BaitlyDeviceRealtimeConfirmationTest {
    final StringRedisTemplate redis=mock(StringRedisTemplate.class);
    final DeviceRealtimePublisher publisher=new DeviceRealtimePublisher(redis,new ObjectMapper());
    @Test void zeroSubscribersStillConfirmsBrokerAcceptance() {
        when(redis.convertAndSend(anyString(),any())).thenReturn(0L);
        publisher.publishDeviceChangedConfirmed(7L,"noise",31L,"hors ligne");
        verify(redis).convertAndSend(eq(DeviceRealtimePublisher.CHANNEL),argThat((Object value) -> value.toString().contains("\"organizationId\":7")));
    }
    @Test void absentBrokerReceiptIsNotTreatedAsConfirmed() {
        when(redis.convertAndSend(anyString(),any())).thenReturn(null);
        assertThatThrownBy(() -> publisher.publishDeviceChangedConfirmed(7L,"noise",31L,"hors ligne")).hasNoCause();
    }
    @Test void strictModeDropsPrivateFailureButLegacyBestEffortRemainsNonThrowing() {
        when(redis.convertAndSend(anyString(),any())).thenThrow(new IllegalStateException("synthetic-private"));
        assertThatThrownBy(() -> publisher.publishDeviceChangedConfirmed(7L,"noise",31L,"hors ligne"))
                .hasMessage("Publication objet non confirmee").hasNoCause();
        assertThatCode(() -> publisher.publishDeviceChanged(7L,"noise",31L,"hors ligne")).doesNotThrowAnyException();
    }
}
