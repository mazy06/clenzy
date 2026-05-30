package com.clenzy.integration.nuki;

import com.clenzy.integration.nuki.model.NukiConnection;
import com.clenzy.integration.nuki.model.NukiConnection.NukiConnectionStatus;
import com.clenzy.integration.nuki.repository.NukiConnectionRepository;
import com.clenzy.integration.nuki.service.NukiApiService;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.service.smartlock.AccessCodeParams;
import com.clenzy.service.smartlock.SmartLockBrand;
import com.clenzy.service.smartlock.SmartLockCommandResult;
import com.clenzy.service.smartlock.SmartLockDeviceInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link NukiSmartLockProvider}.
 *
 * Covers brand identity, lock/unlock + error paths, access code create/revoke,
 * device info extraction (battery/online/lockState), token resolution,
 * isAvailable check.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("NukiSmartLockProvider")
class NukiSmartLockProviderTest {

    @Mock private NukiApiService nukiApiService;
    @Mock private NukiConnectionRepository connectionRepository;
    @Mock private TokenEncryptionService encryptionService;

    private NukiSmartLockProvider provider;

    private static final String DEVICE_ID = "device-123";
    private static final Long ORG_ID = 42L;
    private static final String DECRYPTED_TOKEN = "decrypted-bearer-token";

    @BeforeEach
    void setUp() {
        provider = new NukiSmartLockProvider(nukiApiService, connectionRepository, encryptionService);
    }

    private NukiConnection activeConnection() {
        NukiConnection conn = new NukiConnection();
        conn.setId(1L);
        conn.setOrganizationId(ORG_ID);
        conn.setUserId("user-123");
        conn.setAccessTokenEncrypted("encrypted-token");
        conn.setStatus(NukiConnectionStatus.ACTIVE);
        return conn;
    }

    private void givenActiveConnectionAndDecryption() {
        when(connectionRepository.findByOrganizationIdAndStatus(ORG_ID, NukiConnectionStatus.ACTIVE))
            .thenReturn(Optional.of(activeConnection()));
        when(encryptionService.decrypt("encrypted-token")).thenReturn(DECRYPTED_TOKEN);
    }

    @Nested
    @DisplayName("getBrand")
    class GetBrand {

        @Test
        @DisplayName("returns NUKI")
        void returnsNuki() {
            assertThat(provider.getBrand()).isEqualTo(SmartLockBrand.NUKI);
        }
    }

    @Nested
    @DisplayName("unlock")
    class Unlock {

        @Test
        @DisplayName("happy path -> success result")
        void whenSuccess_thenReturnsSuccess() {
            givenActiveConnectionAndDecryption();

            SmartLockCommandResult result = provider.unlock(DEVICE_ID, ORG_ID);

            assertThat(result.success()).isTrue();
            verify(nukiApiService).lockAction(DEVICE_ID, NukiApiService.ACTION_UNLOCK, DECRYPTED_TOKEN);
        }

        @Test
        @DisplayName("api throws -> failure result")
        void whenApiFails_thenReturnsFailure() {
            givenActiveConnectionAndDecryption();
            org.mockito.Mockito.doThrow(new RuntimeException("network"))
                .when(nukiApiService).lockAction(anyString(), anyInt(), anyString());

            SmartLockCommandResult result = provider.unlock(DEVICE_ID, ORG_ID);

            assertThat(result.success()).isFalse();
            assertThat(result.message()).contains("network");
        }

        @Test
        @DisplayName("no active connection -> failure result")
        void whenNoConnection_thenFailure() {
            when(connectionRepository.findByOrganizationIdAndStatus(ORG_ID, NukiConnectionStatus.ACTIVE))
                .thenReturn(Optional.empty());

            SmartLockCommandResult result = provider.unlock(DEVICE_ID, ORG_ID);

            assertThat(result.success()).isFalse();
            assertThat(result.message()).contains("Aucune connexion Nuki");
            verify(nukiApiService, never()).lockAction(anyString(), anyInt(), anyString());
        }
    }

    @Nested
    @DisplayName("lock")
    class Lock {

        @Test
        @DisplayName("happy path -> success")
        void whenSuccess_thenReturnsSuccess() {
            givenActiveConnectionAndDecryption();

            SmartLockCommandResult result = provider.lock(DEVICE_ID, ORG_ID);

            assertThat(result.success()).isTrue();
            verify(nukiApiService).lockAction(DEVICE_ID, NukiApiService.ACTION_LOCK, DECRYPTED_TOKEN);
        }

        @Test
        @DisplayName("api throws -> failure")
        void whenApiFails_thenReturnsFailure() {
            givenActiveConnectionAndDecryption();
            org.mockito.Mockito.doThrow(new RuntimeException("device offline"))
                .when(nukiApiService).lockAction(anyString(), anyInt(), anyString());

            SmartLockCommandResult result = provider.lock(DEVICE_ID, ORG_ID);

            assertThat(result.success()).isFalse();
        }
    }

    @Nested
    @DisplayName("generateAccessCode")
    class GenerateAccessCode {

        private AccessCodeParams params() {
            return new AccessCodeParams(
                "1234", "Test Code",
                LocalDateTime.now(), LocalDateTime.now().plusDays(7),
                AccessCodeParams.AccessCodeType.TEMPORARY);
        }

        @Test
        @DisplayName("happy path with externalId -> success + externalId")
        void whenSuccess_thenReturnsExternalId() {
            givenActiveConnectionAndDecryption();
            Map<String, Object> apiResult = new HashMap<>();
            apiResult.put("id", 999);
            when(nukiApiService.createWebApiCode(eq(DEVICE_ID), any(), eq(DECRYPTED_TOKEN)))
                .thenReturn(apiResult);

            SmartLockCommandResult result = provider.generateAccessCode(DEVICE_ID, params(), ORG_ID);

            assertThat(result.success()).isTrue();
            assertThat(result.externalId()).isEqualTo("999");
        }

        @Test
        @DisplayName("result without id -> success with null externalId")
        void whenResultMissingId_thenNullExternalId() {
            givenActiveConnectionAndDecryption();
            when(nukiApiService.createWebApiCode(any(), any(), any()))
                .thenReturn(new HashMap<>());

            SmartLockCommandResult result = provider.generateAccessCode(DEVICE_ID, params(), ORG_ID);

            assertThat(result.success()).isTrue();
            assertThat(result.externalId()).isNull();
        }

        @Test
        @DisplayName("result null -> success with null externalId")
        void whenResultNull_thenNullExternalId() {
            givenActiveConnectionAndDecryption();
            when(nukiApiService.createWebApiCode(any(), any(), any())).thenReturn(null);

            SmartLockCommandResult result = provider.generateAccessCode(DEVICE_ID, params(), ORG_ID);

            assertThat(result.success()).isTrue();
            assertThat(result.externalId()).isNull();
        }

        @Test
        @DisplayName("api throws -> failure result")
        void whenApiFails_thenFailure() {
            givenActiveConnectionAndDecryption();
            when(nukiApiService.createWebApiCode(any(), any(), any()))
                .thenThrow(new RuntimeException("4xx"));

            SmartLockCommandResult result = provider.generateAccessCode(DEVICE_ID, params(), ORG_ID);

            assertThat(result.success()).isFalse();
            assertThat(result.message()).contains("4xx");
        }
    }

    @Nested
    @DisplayName("revokeAccessCode")
    class RevokeAccessCode {

        @Test
        @DisplayName("happy path -> success")
        void whenSuccess_thenReturnsSuccess() {
            givenActiveConnectionAndDecryption();

            SmartLockCommandResult result = provider.revokeAccessCode(DEVICE_ID, "code-1", ORG_ID);

            assertThat(result.success()).isTrue();
            verify(nukiApiService).deleteWebApiCode(DEVICE_ID, "code-1", DECRYPTED_TOKEN);
        }

        @Test
        @DisplayName("api throws -> failure result")
        void whenApiFails_thenFailure() {
            givenActiveConnectionAndDecryption();
            org.mockito.Mockito.doThrow(new RuntimeException("404"))
                .when(nukiApiService).deleteWebApiCode(anyString(), anyString(), anyString());

            SmartLockCommandResult result = provider.revokeAccessCode(DEVICE_ID, "code-1", ORG_ID);

            assertThat(result.success()).isFalse();
        }
    }

    @Nested
    @DisplayName("getDeviceInfo")
    class GetDeviceInfo {

        @Test
        @DisplayName("happy path with full data -> battery, online, locked state")
        void whenFullData_thenAllExtracted() {
            givenActiveConnectionAndDecryption();
            Map<String, Object> state = new HashMap<>();
            state.put("batteryCharge", 78);
            state.put("state", 1); // LOCKED
            Map<String, Object> data = new HashMap<>();
            data.put("name", "Front Door");
            data.put("state", state);
            data.put("firmwareVersion", "2.10.0");
            when(nukiApiService.getSmartlock(DEVICE_ID, DECRYPTED_TOKEN)).thenReturn(data);

            SmartLockDeviceInfo info = provider.getDeviceInfo(DEVICE_ID, ORG_ID);

            assertThat(info.deviceId()).isEqualTo(DEVICE_ID);
            assertThat(info.name()).isEqualTo("Front Door");
            assertThat(info.batteryLevel()).isEqualTo(78);
            assertThat(info.online()).isTrue();
            assertThat(info.lockState()).isEqualTo("LOCKED");
            assertThat(info.firmwareVersion()).isEqualTo("2.10.0");
        }

        @Test
        @DisplayName("state=3 -> UNLOCKED")
        void whenStateThree_thenUnlocked() {
            givenActiveConnectionAndDecryption();
            Map<String, Object> state = new HashMap<>();
            state.put("state", 3);
            Map<String, Object> data = new HashMap<>();
            data.put("state", state);
            when(nukiApiService.getSmartlock(any(), any())).thenReturn(data);

            SmartLockDeviceInfo info = provider.getDeviceInfo(DEVICE_ID, ORG_ID);

            assertThat(info.lockState()).isEqualTo("UNLOCKED");
        }

        @Test
        @DisplayName("state=5 (unlatched) -> UNLOCKED")
        void whenStateFive_thenUnlocked() {
            givenActiveConnectionAndDecryption();
            Map<String, Object> state = new HashMap<>();
            state.put("state", 5);
            Map<String, Object> data = new HashMap<>();
            data.put("state", state);
            when(nukiApiService.getSmartlock(any(), any())).thenReturn(data);

            SmartLockDeviceInfo info = provider.getDeviceInfo(DEVICE_ID, ORG_ID);

            assertThat(info.lockState()).isEqualTo("UNLOCKED");
        }

        @Test
        @DisplayName("state=99 (unknown) -> UNKNOWN")
        void whenStateUnknown_thenUnknown() {
            givenActiveConnectionAndDecryption();
            Map<String, Object> state = new HashMap<>();
            state.put("state", 99);
            Map<String, Object> data = new HashMap<>();
            data.put("state", state);
            when(nukiApiService.getSmartlock(any(), any())).thenReturn(data);

            SmartLockDeviceInfo info = provider.getDeviceInfo(DEVICE_ID, ORG_ID);

            assertThat(info.lockState()).isEqualTo("UNKNOWN");
        }

        @Test
        @DisplayName("state map vide -> battery null + UNKNOWN")
        void whenStateMapEmpty_thenDefaults() {
            givenActiveConnectionAndDecryption();
            Map<String, Object> data = new HashMap<>();
            data.put("state", new HashMap<>());
            when(nukiApiService.getSmartlock(any(), any())).thenReturn(data);

            SmartLockDeviceInfo info = provider.getDeviceInfo(DEVICE_ID, ORG_ID);

            assertThat(info.batteryLevel()).isNull();
            assertThat(info.lockState()).isEqualTo("UNKNOWN");
            assertThat(info.online()).isFalse();
        }

        @Test
        @DisplayName("no name -> default 'Nuki Smart Lock'")
        void whenNoName_thenDefault() {
            givenActiveConnectionAndDecryption();
            Map<String, Object> data = new HashMap<>();
            when(nukiApiService.getSmartlock(any(), any())).thenReturn(data);

            SmartLockDeviceInfo info = provider.getDeviceInfo(DEVICE_ID, ORG_ID);

            assertThat(info.name()).isEqualTo("Nuki Smart Lock");
        }

        @Test
        @DisplayName("api returns null -> RuntimeException")
        void whenApiReturnsNull_thenThrows() {
            givenActiveConnectionAndDecryption();
            when(nukiApiService.getSmartlock(any(), any())).thenReturn(null);

            assertThatThrownBy(() -> provider.getDeviceInfo(DEVICE_ID, ORG_ID))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Aucune donnee retournee");
        }
    }

    @Nested
    @DisplayName("isAvailable")
    class IsAvailable {

        @Test
        @DisplayName("active connection -> true")
        void whenActive_thenTrue() {
            NukiConnection conn = activeConnection();
            when(connectionRepository.findByOrganizationIdAndStatus(ORG_ID, NukiConnectionStatus.ACTIVE))
                .thenReturn(Optional.of(conn));

            assertThat(provider.isAvailable(ORG_ID)).isTrue();
        }

        @Test
        @DisplayName("no connection -> false")
        void whenNoConnection_thenFalse() {
            when(connectionRepository.findByOrganizationIdAndStatus(ORG_ID, NukiConnectionStatus.ACTIVE))
                .thenReturn(Optional.empty());

            assertThat(provider.isAvailable(ORG_ID)).isFalse();
        }

        @Test
        @DisplayName("connection with non-active status -> false")
        void whenNotActive_thenFalse() {
            NukiConnection conn = new NukiConnection();
            conn.setStatus(NukiConnectionStatus.REVOKED);
            when(connectionRepository.findByOrganizationIdAndStatus(ORG_ID, NukiConnectionStatus.ACTIVE))
                .thenReturn(Optional.of(conn));

            assertThat(provider.isAvailable(ORG_ID)).isFalse();
        }
    }
}
