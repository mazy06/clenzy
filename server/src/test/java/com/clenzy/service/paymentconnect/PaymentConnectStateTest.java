package com.clenzy.service.paymentconnect;

import com.clenzy.model.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.access.AccessDeniedException;
import java.time.Duration;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class PaymentConnectStateTest {
    @Test void randomStateExpiresAndIsConsumedExactlyOnce() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked") ValueOperations<String,String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        var states = new PaymentConnectState(redis);
        var person = new PaymentConnectAccess.Beneficiary(7L, 42L, 42L, "user:42", null, UserRole.HOST);
        String state = states.create(person);
        assertThat(UUID.fromString(state)).isNotNull();
        verify(values).set("baitly:payment-connect:" + state, "42:7:user:42", Duration.ofMinutes(10));
        when(values.getAndDelete("baitly:payment-connect:" + state)).thenReturn("42:7:user:42", null);
        states.consume(state, person);
        assertThatThrownBy(() -> states.consume(state, person)).isInstanceOf(AccessDeniedException.class);
    }
    @Test void otherBeneficiaryCannotUseTheSameState() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked") ValueOperations<String,String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.getAndDelete(anyString())).thenReturn("42:7:user:42");
        var org = new PaymentConnectAccess.Beneficiary(7L, 42L, null, "organization", null, UserRole.HOST);
        assertThatThrownBy(() -> new PaymentConnectState(redis).consume(UUID.randomUUID().toString(), org)).isInstanceOf(AccessDeniedException.class);
    }
}
