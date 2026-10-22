package com.clenzy.integration.oauth;

import com.clenzy.integration.minut.config.MinutConfig;
import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.repository.MinutConnectionRepository;
import com.clenzy.integration.minut.service.MinutOAuthService;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.tenant.TenantContext;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/** Vérifie le commit du chemin de récupération avec les contraintes SQL de la vraie entité. */
class BaitlyOAuthCredentialPersistenceTest {
    @Test
    void refreshEncryptionFailureCommitsErrorWithoutCommittingHalfARotatedPair() {
        try (var factory = new Configuration().addAnnotatedClass(MinutConnection.class)
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:baitlyoauthpreparation;MODE=PostgreSQL")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop").buildSessionFactory()) {
            var connection = new MinutConnection();
            connection.setUserId("synthetic-user");
            connection.setOrganizationId(7L);
            connection.setStatus(MinutConnection.MinutConnectionStatus.ACTIVE);
            connection.setAccessTokenEncrypted("old-encrypted-access");
            connection.setRefreshTokenEncrypted("old-encrypted-refresh");
            var oldExpiry = LocalDateTime.of(2030, 1, 1, 0, 0);
            connection.setTokenExpiresAt(oldExpiry);
            try (var em = factory.createEntityManager()) {
                em.getTransaction().begin();
                em.persist(connection);
                em.getTransaction().commit();
            }
            var repo = mock(MinutConnectionRepository.class);
            when(repo.save(any())).thenAnswer(call -> {
                try (var em = factory.createEntityManager()) {
                    em.getTransaction().begin();
                    var saved = em.merge((MinutConnection) call.getArgument(0));
                    em.getTransaction().commit();
                    return saved;
                }
            });
            var crypto = mock(TokenEncryptionService.class);
            when(crypto.decrypt("old-encrypted-refresh")).thenReturn("synthetic-refresh");
            when(crypto.encrypt("new-access")).thenReturn("new-encrypted-access");
            when(crypto.encrypt("new-refresh")).thenThrow(new IllegalStateException("Synthetic encryption failure"));
            var config = mock(MinutConfig.class);
            when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
            var http = mock(RestTemplate.class);
            when(http.postForEntity(anyString(), any(), eq(Map.class))).thenReturn(ResponseEntity.ok(
                    Map.of("access_token", "new-access", "refresh_token", "new-refresh", "expires_in", 3600)));
            var service = new MinutOAuthService(config, repo, crypto, mock(TenantContext.class),
                    mock(StringRedisTemplate.class), http);
            service.refreshToken(connection);
            try (var em = factory.createEntityManager()) {
                var saved = em.find(MinutConnection.class, connection.getId());
                assertThat(saved.getStatus()).isEqualTo(MinutConnection.MinutConnectionStatus.ERROR);
                assertThat(saved.getAccessTokenEncrypted()).isEqualTo("old-encrypted-access");
                assertThat(saved.getRefreshTokenEncrypted()).isEqualTo("old-encrypted-refresh");
                assertThat(saved.getTokenExpiresAt()).isEqualTo(oldExpiry);
            }
            verify(http, times(1)).postForEntity(anyString(), any(), eq(Map.class));
        }
    }
}
