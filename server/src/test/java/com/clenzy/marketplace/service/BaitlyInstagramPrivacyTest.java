package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.web.server.ResponseStatusException;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.Base64;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyInstagramPrivacyTest {
    final ObjectMapper json = new ObjectMapper();
    final Instant now = Instant.parse("2026-10-12T12:00:00Z");
    final StringRedisTemplate redis = mock(StringRedisTemplate.class);
    final ValueOperations<String,String> values = mock(ValueOperations.class);
    final BaitlyReels reels = mock(BaitlyReels.class);
    final BaitlyInstagramPrivacy service = new BaitlyInstagramPrivacy("test-secret",
        "https://app.baitly.fr/api/public/baitly-catalog/instagram/callback", json,
        Clock.fixed(now, ZoneOffset.UTC), redis, reels);

    String signed(String id, String algorithm, long issued) throws Exception {
        String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(json.writeValueAsBytes(
            Map.of("user_id",id,"algorithm",algorithm,"issued_at",issued)));
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("test-secret".getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.US_ASCII))) + "." + payload;
    }
    @Test void acceptsOnlySignedNumericIdentityAndRecentTimestamp() throws Exception {
        assertThat(service.verifiedUserId(signed("123","HMAC-SHA256",now.getEpochSecond()))).isEqualTo("123");
        for(String invalid: new String[] { "unsigned", signed("../other","HMAC-SHA256",now.getEpochSecond()),
                signed("123","none",now.getEpochSecond()), signed("123","HMAC-SHA256",now.minus(Duration.ofDays(8)).getEpochSecond()),
                signed("123","HMAC-SHA256",now.plusSeconds(600).getEpochSecond()) }) {
            assertThatThrownBy(() -> service.verifiedUserId(invalid)).isInstanceOf(ResponseStatusException.class);
        }
        String request = signed("123","HMAC-SHA256",now.getEpochSecond());
        assertThatThrownBy(() -> service.verifiedUserId("A" + request.substring(1))).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(reels);
    }
    @Test void confirmsDeletionOnlyAfterServiceReturnsAndSuppressesReplay() throws Exception {
        when(redis.opsForValue()).thenReturn(values);
        when(values.setIfAbsent(anyString(),eq("processing"),any(Duration.class))).thenReturn(true);
        String request = signed("123","HMAC-SHA256",now.getEpochSecond());
        var result = service.erase(request);
        assertThat(result.get("url")).isEqualTo("https://app.baitly.fr/api/public/baitly-catalog/instagram/deletion-status/"+result.get("confirmation_code"));
        var ordered=inOrder(reels,values);
        ordered.verify(reels).eraseInstagramData("123");
        ordered.verify(values).set(eq("baitly:instagram:privacy:receipt:"+result.get("confirmation_code")),eq("completed"),any(Duration.class));
        when(values.get(startsWith("baitly:instagram:privacy:event:"))).thenReturn(result.get("confirmation_code"));
        assertThat(service.erase(request)).isEqualTo(result);
        String[] parts=request.split("\\.");
        assertThat(service.erase(parts[0]+"="+"."+parts[1])).isEqualTo(result);
        verify(reels,times(1)).eraseInstagramData("123");
    }
    @Test void failedDeletionNeverEmitsCompletedReceipt() throws Exception {
        when(redis.opsForValue()).thenReturn(values);
        when(values.setIfAbsent(anyString(),eq("processing"),any(Duration.class))).thenReturn(true);
        doThrow(new IllegalStateException("database unavailable")).when(reels).eraseInstagramData("123");
        assertThatThrownBy(() -> service.erase(signed("123","HMAC-SHA256",now.getEpochSecond()))).isInstanceOf(IllegalStateException.class);
        verify(values,never()).set(startsWith("baitly:instagram:privacy:receipt:"),anyString(),any(Duration.class));
        verify(redis).delete(startsWith("baitly:instagram:privacy:event:"));
    }
}
