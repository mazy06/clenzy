package com.clenzy.integration.netatmo.service;

import com.clenzy.dto.netatmo.UpdateNetatmoConfigDto;
import com.clenzy.integration.netatmo.model.NetatmoPlatformConfig;
import com.clenzy.integration.netatmo.repository.NetatmoPlatformConfigRepository;
import com.clenzy.service.TokenEncryptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NetatmoPlatformConfigServiceTest {

    @Mock NetatmoPlatformConfigRepository repository;
    @Mock TokenEncryptionService encryptionService;

    NetatmoPlatformConfigService service;

    @BeforeEach
    void setUp() {
        service = new NetatmoPlatformConfigService(repository, encryptionService);
    }

    @Test
    void whenSaveNew_thenEncryptsSecretAndConfigured() {
        when(repository.findFirstByOrderByIdAsc()).thenReturn(Optional.empty());
        when(encryptionService.encrypt("secret")).thenReturn("enc:secret");
        when(encryptionService.decrypt("enc:secret")).thenReturn("secret");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.save(new UpdateNetatmoConfigDto("cid", "secret", "https://app.clenzy.fr/api/netatmo/callback"), "kc-1");

        ArgumentCaptor<NetatmoPlatformConfig> cap = ArgumentCaptor.forClass(NetatmoPlatformConfig.class);
        verify(repository).save(cap.capture());
        assertThat(cap.getValue().getClientId()).isEqualTo("cid");
        assertThat(cap.getValue().getClientSecretEncrypted()).isEqualTo("enc:secret"); // chiffre
        assertThat(cap.getValue().getRedirectUri()).isEqualTo("https://app.clenzy.fr/api/netatmo/callback");
        assertThat(service.isConfigured()).isTrue();
        assertThat(service.getClientSecret()).isEqualTo("secret"); // dechiffre via cache
    }

    @Test
    void whenSaveBlankSecretOnExisting_thenKeepsExistingSecret() {
        NetatmoPlatformConfig existing = new NetatmoPlatformConfig();
        existing.setClientId("old");
        existing.setClientSecretEncrypted("enc:old");
        existing.setRedirectUri("https://old");
        when(repository.findFirstByOrderByIdAsc()).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(encryptionService.decrypt("enc:old")).thenReturn("old");

        service.save(new UpdateNetatmoConfigDto("newid", "", "https://new"), "kc-1");

        ArgumentCaptor<NetatmoPlatformConfig> cap = ArgumentCaptor.forClass(NetatmoPlatformConfig.class);
        verify(repository).save(cap.capture());
        assertThat(cap.getValue().getClientId()).isEqualTo("newid");
        assertThat(cap.getValue().getRedirectUri()).isEqualTo("https://new");
        assertThat(cap.getValue().getClientSecretEncrypted()).isEqualTo("enc:old"); // secret inchange
    }

    @Test
    void whenNoConfig_thenNotConfigured() {
        when(repository.findFirstByOrderByIdAsc()).thenReturn(Optional.empty());

        assertThat(service.isConfigured()).isFalse();
        assertThat(service.getClientId()).isNull();
        assertThat(service.getClientSecret()).isNull();
    }
}
