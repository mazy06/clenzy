package com.clenzy.integration.oauth;

import com.clenzy.integration.airbnb.config.AirbnbConfig;
import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.repository.AirbnbConnectionRepository;
import com.clenzy.integration.airbnb.service.*;
import com.clenzy.integration.minut.config.MinutConfig;
import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.repository.MinutConnectionRepository;
import com.clenzy.integration.minut.service.MinutOAuthService;
import com.clenzy.integration.netatmo.config.NetatmoConfig;
import com.clenzy.integration.netatmo.model.NetatmoConnection;
import com.clenzy.integration.netatmo.repository.NetatmoConnectionRepository;
import com.clenzy.integration.netatmo.service.*;
import com.clenzy.service.*;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Persiste la déconnexion contre les vraies colonnes NOT NULL des entités. */
class BaitlyLegacyOAuthDisconnectPersistenceTest {
    static SessionFactory factory;
    @BeforeAll static void start() {
        factory=new Configuration().addAnnotatedClass(AirbnbConnection.class).addAnnotatedClass(MinutConnection.class)
                .addAnnotatedClass(NetatmoConnection.class)
                .setProperty("hibernate.connection.url","jdbc:h2:mem:legacyoauthdisconnect;MODE=PostgreSQL")
                .setProperty("hibernate.hbm2ddl.auto","create-drop").buildSessionFactory();
    }
    @AfterAll static void close() {if(factory!=null)factory.close();}
    <T>T tx(Function<EntityManager,T> work) {
        try(var em=factory.createEntityManager()) {
            em.getTransaction().begin();
            try {var result=work.apply(em);em.getTransaction().commit();return result;}
            catch(RuntimeException failure){em.getTransaction().rollback();throw failure;}
        }
    }

    @ParameterizedTest @ValueSource(strings={"airbnb","minut","netatmo"})
    void disconnectCommitsWithoutKeepingEncryptedTokensOrViolatingNotNull(String provider) {
        Object connection=switch(provider){case "airbnb"->new AirbnbConnection();case "minut"->new MinutConnection();default->new NetatmoConnection();};
        ReflectionTestUtils.setField(connection,"userId","user-"+provider);
        ReflectionTestUtils.setField(connection,"accessTokenEncrypted","old-encrypted-access");
        ReflectionTestUtils.setField(connection,"refreshTokenEncrypted","old-encrypted-refresh");
        ReflectionTestUtils.setField(connection,"tokenExpiresAt",LocalDateTime.now().plusHours(1));
        tx(em->{em.persist(connection);return null;});
        Long id=(Long)ReflectionTestUtils.getField(connection,"id");
        var http=mock(RestTemplate.class);when(http.postForEntity(anyString(),any(),eq(Void.class))).thenThrow(new IllegalStateException("provider unavailable"));
        var redis=mock(StringRedisTemplate.class);
        if(connection instanceof AirbnbConnection c) {
            var repo=mock(AirbnbConnectionRepository.class);when(repo.findByUserId(c.getUserId())).thenReturn(Optional.of(c));
            when(repo.save(any())).thenAnswer(call->tx(em->em.merge(call.getArgument(0))));
            var config=mock(AirbnbConfig.class);when(config.getApiBaseUrl()).thenReturn("https://oauth.example.invalid");
            var crypto=mock(AirbnbTokenEncryptionService.class);when(crypto.decrypt(anyString())).thenReturn("synthetic-token");
            new AirbnbOAuthService(config,repo,crypto,mock(AuditLogService.class),redis,http).revokeToken(c.getUserId());
        } else if(connection instanceof MinutConnection c) {
            var repo=mock(MinutConnectionRepository.class);when(repo.findByUserId(c.getUserId())).thenReturn(Optional.of(c));
            when(repo.save(any())).thenAnswer(call->tx(em->em.merge(call.getArgument(0))));
            var config=mock(MinutConfig.class);when(config.getApiBaseUrl()).thenReturn("https://oauth.example.invalid");
            var crypto=mock(TokenEncryptionService.class);when(crypto.decrypt(anyString())).thenReturn("synthetic-token");
            new MinutOAuthService(config,repo,crypto,mock(TenantContext.class),redis,http).revokeToken(c.getUserId());
        } else {
            var c=(NetatmoConnection)connection;var repo=mock(NetatmoConnectionRepository.class);
            when(repo.findByUserId(c.getUserId())).thenReturn(Optional.of(c));when(repo.save(any())).thenAnswer(call->tx(em->em.merge(call.getArgument(0))));
            new NetatmoOAuthService(mock(NetatmoConfig.class),mock(NetatmoPlatformConfigService.class),repo,mock(TokenEncryptionService.class),
                    mock(TenantContext.class),redis,http).revokeToken(c.getUserId());
        }
        Object saved=tx(em->em.find(connection.getClass(),id));
        assertThat(ReflectionTestUtils.getField(saved,"status").toString()).isEqualTo("REVOKED");
        assertThat(ReflectionTestUtils.getField(saved,"accessTokenEncrypted")).isEqualTo("");
        assertThat(ReflectionTestUtils.getField(saved,"refreshTokenEncrypted")).isNull();
        assertThat(ReflectionTestUtils.getField(saved,"tokenExpiresAt")).isNull();
        assertThat(ReflectionTestUtils.getField(saved,"errorMessage")).isEqualTo(BaitlyOAuthDiagnostics.message(BaitlyOAuthDiagnostics.Operation.REVOKE));
    }
}
