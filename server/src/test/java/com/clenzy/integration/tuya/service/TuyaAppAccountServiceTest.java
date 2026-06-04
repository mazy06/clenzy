package com.clenzy.integration.tuya.service;

import com.clenzy.integration.tuya.model.TuyaAppAccount;
import com.clenzy.integration.tuya.repository.TuyaAppAccountRepository;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TuyaAppAccountServiceTest {

    @Mock private TuyaAppAccountRepository repository;
    @Mock private TuyaApiService apiService;
    @Mock private TokenEncryptionService encryptionService;
    @Mock private TenantContext tenantContext;

    @InjectMocks private TuyaAppAccountService service;

    @Test
    void whenAccountExists_thenReturnsItWithoutProvisioning() {
        // Arrange
        TuyaAppAccount existing = new TuyaAppAccount();
        existing.setUserId("user-1");
        existing.setTuyaUid("uid-1");
        when(repository.findByUserId("user-1")).thenReturn(Optional.of(existing));

        // Act
        TuyaAppAccount result = service.getOrCreate("user-1");

        // Assert
        assertThat(result).isSameAs(existing);
        verifyNoInteractions(apiService);
    }

    @Test
    void whenAccountAbsent_thenProvisionsViaTuyaAndSaves() {
        // Arrange
        when(repository.findByUserId("user-2")).thenReturn(Optional.empty());
        when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
        when(apiService.createAppUser(anyString(), anyString(), anyString()))
                .thenReturn(Map.of("result", Map.of("uid", "tuya-uid-xyz")));
        when(encryptionService.encrypt(anyString())).thenReturn("ENC");
        when(repository.save(any(TuyaAppAccount.class))).thenAnswer(inv -> inv.getArgument(0));

        // Act
        TuyaAppAccount result = service.getOrCreate("user-2");

        // Assert
        assertThat(result.getTuyaUid()).isEqualTo("tuya-uid-xyz");
        assertThat(result.getUserId()).isEqualTo("user-2");
        assertThat(result.getOrganizationId()).isEqualTo(7L);
        assertThat(result.getTuyaSecretEncrypted()).isEqualTo("ENC");
        assertThat(result.getTuyaUsername()).startsWith("clenzy_");
        verify(apiService).createAppUser(anyString(), anyString(), anyString());
    }
}
