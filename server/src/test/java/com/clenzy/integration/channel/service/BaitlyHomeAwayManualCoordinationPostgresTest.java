package com.clenzy.integration.channel.service;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.dto.ChannelConnectRequest;
import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.repository.ChannelConnectionRepository;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import com.clenzy.integration.expedia.repository.ExpediaConnectionRepository;
import com.clenzy.integration.hotelscom.repository.HotelsComConnectionRepository;
import com.clenzy.integration.agoda.repository.AgodaConnectionRepository;
import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.integration.oauth.BaitlyOAuthBusyException;
import com.clenzy.integration.oauth.BaitlyOAuthConnectionGuard;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.*;
import org.springframework.orm.jpa.vendor.HibernateJpaDialect;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Même verrou et vraie transaction JPA que le moteur OAuth ; aucune requête fournisseur. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class BaitlyHomeAwayManualCoordinationPostgresTest {
    SessionFactory factory;
    JdbcTemplate admin;
    String schema;
    TransactionTemplate transaction;
    BaitlyOAuthConnectionGuard guard;
    ChannelConnectionRepository channels;
    HomeAwayConnectionRepository oauth;
    CredentialEncryptionService crypto;

    @BeforeEach void start() {
        String jdbc = System.getProperty("baitly.test.jdbc");
        if (!jdbc.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]*(?:test|recipe|ci)[a-zA-Z0-9_]*")
                && !jdbc.equals("jdbc:postgresql://127.0.0.1:55439/postgres")) {
            throw new IllegalArgumentException("Base locale dédiée requise");
        }
        admin = new JdbcTemplate(new DriverManagerDataSource(jdbc, "postgres", ""));
        schema = "baitly_manual_" + UUID.randomUUID().toString().replace("-", "");
        admin.execute("CREATE SCHEMA " + schema);
        var source = new DriverManagerDataSource(jdbc + "?currentSchema=" + schema, "postgres", "");
        com.clenzy.integration.oauth.BaitlyOAuthTestGuards.installRefreshJournal(source);
        var config = new Configuration().addAnnotatedClass(HomeAwayConnection.class).addAnnotatedClass(ChannelConnection.class)
                .setProperty("hibernate.hbm2ddl.auto", "create-drop");
        config.getProperties().put("hibernate.connection.datasource", source);
        factory = config.buildSessionFactory();
        var manager = new JpaTransactionManager(factory);
        manager.setDataSource(source); manager.setJpaDialect(new HibernateJpaDialect()); manager.afterPropertiesSet();
        transaction = new TransactionTemplate(manager);
        guard = new BaitlyOAuthConnectionGuard(new JdbcTemplate(source), manager);
        var repositories = new JpaRepositoryFactory(SharedEntityManagerCreator.createSharedEntityManager(factory));
        channels = repositories.getRepository(ChannelConnectionRepository.class);
        oauth = repositories.getRepository(HomeAwayConnectionRepository.class);
        crypto = mock(CredentialEncryptionService.class);
        when(crypto.encrypt(anyString())).thenAnswer(call -> "synthetic-encrypted-" + call.getArgument(0));
    }

    @AfterEach void close() {
        try {if (factory != null) factory.close();}
        finally {if (schema != null) admin.execute("DROP SCHEMA " + schema + " CASCADE");}
    }

    <T> T tx(Supplier<T> work) {return transaction.execute(status -> work.get());}
    ChannelConnectionService service(ChannelConnectionRepository generic) {
        return new ChannelConnectionService(generic, mock(BookingConnectionRepository.class), mock(ExpediaConnectionRepository.class),
                mock(HotelsComConnectionRepository.class), mock(AgodaConnectionRepository.class), oauth, crypto, guard);
    }
    void fixture(long org, ChannelConnection.ConnectionStatus status) {
        tx(() -> {
            var nativeConnection = new HomeAwayConnection(org, "synthetic-old-access");
            nativeConnection.setRefreshTokenEncrypted("synthetic-old-refresh");
            nativeConnection.setTokenExpiresAt(java.time.LocalDateTime.now().plusHours(1));
            nativeConnection.setListingId("synthetic-listing");
            oauth.saveAndFlush(nativeConnection);
            var generic = new ChannelConnection(org, ChannelName.HOMEAWAY);
            generic.setStatus(status); generic.setCredentialsRef(nativeConnection.getId().toString());
            channels.saveAndFlush(generic);
            return null;
        });
    }
    ChannelConnectRequest request() {
        return new ChannelConnectRequest(Map.of("listingId", "synthetic-new-listing", "accessToken", "synthetic-new-access"));
    }

    @Test void refreshExcludesManualWritesButNotOtherOrganizations() throws Exception {
        fixture(7L, ChannelConnection.ConnectionStatus.INACTIVE);
        fixture(8L, ChannelConnection.ConnectionStatus.ACTIVE);
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var refresh = executor.submit(() -> guard.executeRefresh("homeaway", 7L, () -> {
                entered.countDown();
                try {if (!release.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("Recette expirée");}
                catch (InterruptedException e) {Thread.currentThread().interrupt(); throw new IllegalStateException("Recette interrompue");}
                var current = oauth.findByOrganizationId(7L).orElseThrow();
                current.setAccessTokenEncrypted("synthetic-rotated-access");
                current.setRefreshTokenEncrypted("synthetic-rotated-refresh");
                return oauth.save(current);
            }));
            try {
                assertThat(entered.await(15, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> service(channels).connect(7L, ChannelName.HOMEAWAY, request())).isInstanceOf(BaitlyOAuthBusyException.class);
                assertThatThrownBy(() -> service(channels).disconnect(7L, ChannelName.HOMEAWAY)).isInstanceOf(BaitlyOAuthBusyException.class);
                service(channels).disconnect(8L, ChannelName.HOMEAWAY);
            } finally {release.countDown();}
            refresh.get(15, TimeUnit.SECONDS);
        }
        assertThat(tx(() -> oauth.findByOrganizationId(7L).orElseThrow()).getRefreshTokenEncrypted()).isEqualTo("synthetic-rotated-refresh");
        assertThat(tx(() -> oauth.findByOrganizationId(8L).orElseThrow()).getStatus()).isEqualTo(HomeAwayConnection.HomeAwayConnectionStatus.INACTIVE);
    }

    @Test void reconnectCommitsOneNativeRowAndItsGenericReference() {
        fixture(7L, ChannelConnection.ConnectionStatus.INACTIVE);
        Long id = tx(() -> oauth.findByOrganizationId(7L).orElseThrow()).getId();
        service(channels).connect(7L, ChannelName.HOMEAWAY, request());
        var current = tx(() -> oauth.findByOrganizationId(7L).orElseThrow());
        assertThat(current.getId()).isEqualTo(id);
        assertThat(tx(() -> oauth.count())).isEqualTo(1L);
        assertThat(current.getRefreshTokenEncrypted()).isNull();
        assertThat(current.getTokenExpiresAt()).isNull();
        assertThat(tx(() -> channels.findByOrganizationIdAndChannel(7L, ChannelName.HOMEAWAY).orElseThrow()).getCredentialsRef()).isEqualTo(id.toString());
    }

    @Test void firstConnectionCommitsBothRows() {
        service(channels).connect(7L, ChannelName.HOMEAWAY, request());
        var current = tx(() -> oauth.findByOrganizationId(7L).orElseThrow());
        assertThat(current.getAccessTokenEncrypted()).isEqualTo("synthetic-encrypted-synthetic-new-access");
        assertThat(tx(() -> channels.findByOrganizationIdAndChannel(7L, ChannelName.HOMEAWAY).orElseThrow()).isActive()).isTrue();
    }

    @Test void disconnectPurgesCredentialsWithoutClaimingRemoteRevocation() {
        fixture(7L, ChannelConnection.ConnectionStatus.ACTIVE);
        service(channels).disconnect(7L, ChannelName.HOMEAWAY);
        var current = tx(() -> oauth.findByOrganizationId(7L).orElseThrow());
        assertThat(current.getAccessTokenEncrypted()).isEmpty();
        assertThat(current.getRefreshTokenEncrypted()).isNull();
        assertThat(current.getTokenExpiresAt()).isNull();
        assertThat(current.getErrorMessage()).isEqualTo("Déconnexion locale ; révocation distante non confirmée");
        assertThat(tx(() -> channels.findByOrganizationIdAndChannel(7L, ChannelName.HOMEAWAY).orElseThrow()).isActive()).isFalse();
    }

    @Test void genericWriteFailureRollsBackTheNativeMutation() {
        fixture(7L, ChannelConnection.ConnectionStatus.INACTIVE);
        var failing = mock(ChannelConnectionRepository.class);
        when(failing.findByOrganizationIdAndChannel(7L, ChannelName.HOMEAWAY))
                .thenAnswer(call -> channels.findByOrganizationIdAndChannel(7L, ChannelName.HOMEAWAY));
        when(failing.save(any())).thenThrow(new IllegalStateException("Synthetic generic write failure"));
        assertThatThrownBy(() -> service(failing).connect(7L, ChannelName.HOMEAWAY, request())).isInstanceOf(IllegalStateException.class);
        assertThat(tx(() -> oauth.findByOrganizationId(7L).orElseThrow()).getAccessTokenEncrypted()).isEqualTo("synthetic-old-access");
        assertThat(tx(() -> channels.findByOrganizationIdAndChannel(7L, ChannelName.HOMEAWAY).orElseThrow()).isActive()).isFalse();
    }
}
