package com.clenzy.service;

import com.clenzy.model.DeviceToken;
import com.clenzy.repository.DeviceTokenRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeviceTokenServiceTest {

    @Mock private DeviceTokenRepository deviceTokenRepository;
    @Mock private TenantContext tenantContext;

    private DeviceTokenService service;

    @BeforeEach
    void setUp() {
        service = new DeviceTokenService(deviceTokenRepository, tenantContext);
        lenient().when(tenantContext.getOrganizationId()).thenReturn(1L);
    }

    @Test
    void register_newToken_createsAndPersists() {
        when(deviceTokenRepository.findByToken("tok1")).thenReturn(Optional.empty());
        when(deviceTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        DeviceToken result = service.register("user-1", "tok1", "iOS");

        assertEquals("user-1", result.getUserId());
        assertEquals("tok1", result.getToken());
        assertEquals("iOS", result.getPlatform());
        assertEquals(1L, result.getOrganizationId());
    }

    @Test
    void register_existingTokenSameUser_returnsUnchanged() {
        DeviceToken existing = new DeviceToken("user-1", "tok1", "iOS");
        when(deviceTokenRepository.findByToken("tok1")).thenReturn(Optional.of(existing));

        DeviceToken result = service.register("user-1", "tok1", "iOS");

        assertSame(existing, result);
        verify(deviceTokenRepository, never()).save(any());
    }

    @Test
    void register_existingTokenDifferentUser_reassigns() {
        DeviceToken existing = new DeviceToken("user-OLD", "tok1", "iOS");
        when(deviceTokenRepository.findByToken("tok1")).thenReturn(Optional.of(existing));
        when(deviceTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        DeviceToken result = service.register("user-NEW", "tok1", "iOS");

        assertEquals("user-NEW", result.getUserId());
        verify(deviceTokenRepository).save(existing);
    }

    @Test
    void unregister_callsDeleteByToken() {
        service.unregister("tok1");

        verify(deviceTokenRepository).deleteByToken("tok1");
    }

    @Test
    void removeAllForUser_callsDeleteAll() {
        when(deviceTokenRepository.deleteAllByUserId("user-1")).thenReturn(5);

        service.removeAllForUser("user-1");

        verify(deviceTokenRepository).deleteAllByUserId("user-1");
    }

    @Test
    void getTokensForUser_delegates() {
        DeviceToken t = new DeviceToken("u1", "tk", "iOS");
        when(deviceTokenRepository.findByUserId("u1")).thenReturn(List.of(t));

        List<DeviceToken> result = service.getTokensForUser("u1");

        assertEquals(1, result.size());
        assertSame(t, result.get(0));
    }

    @Test
    void getTokensForUsers_flatMaps() {
        DeviceToken t1 = new DeviceToken("u1", "tk1", "iOS");
        DeviceToken t2 = new DeviceToken("u2", "tk2", "android");
        when(deviceTokenRepository.findByUserId("u1")).thenReturn(List.of(t1));
        when(deviceTokenRepository.findByUserId("u2")).thenReturn(List.of(t2));

        List<DeviceToken> result = service.getTokensForUsers(List.of("u1", "u2"));

        assertEquals(2, result.size());
    }

    @Test
    void getTokensForUsers_empty_returnsEmpty() {
        List<DeviceToken> result = service.getTokensForUsers(List.of());

        assertTrue(result.isEmpty());
    }
}
