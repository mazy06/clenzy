package com.clenzy.service.paymentconnect;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.util.UUID;
import static com.clenzy.service.paymentconnect.PaymentConnectAccess.Beneficiary;

/** One-use authorization state, bound to the authenticated actor, organization and beneficiary. */
@Service
public class PaymentConnectState {
    private final StringRedisTemplate redis;
    public PaymentConnectState(StringRedisTemplate redis) { this.redis = redis; }
    public String create(Beneficiary b) {
        String state = UUID.randomUUID().toString();
        redis.opsForValue().set("baitly:payment-connect:" + state, payload(b), Duration.ofMinutes(10));
        return state;
    }
    public void consume(String state, Beneficiary b) {
        if (state == null || !state.matches("[a-f0-9-]{36}")) throw new AccessDeniedException("Invalid authorization state");
        String stored = redis.opsForValue().getAndDelete("baitly:payment-connect:" + state);
        if (!payload(b).equals(stored)) throw new AccessDeniedException("Authorization expired or belongs to another account");
    }
    private String payload(Beneficiary b) { return b.actorId() + ":" + b.orgId() + ":" + b.key(); }
}
