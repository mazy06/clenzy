package com.clenzy.integration.channel.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.agoda.model.AgodaConnection;
import com.clenzy.integration.agoda.repository.AgodaConnectionRepository;
import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.dto.ChannelConnectRequest;
import com.clenzy.integration.channel.dto.ChannelConnectionDto;
import com.clenzy.integration.channel.dto.ChannelConnectionTestResult;
import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.repository.ChannelConnectionRepository;
import com.clenzy.integration.expedia.model.ExpediaConnection;
import com.clenzy.integration.expedia.repository.ExpediaConnectionRepository;
import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.integration.hotelscom.model.HotelsComConnection;
import com.clenzy.integration.hotelscom.repository.HotelsComConnectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChannelConnectionServiceTest {

    @Mock private ChannelConnectionRepository channelConnectionRepository;
    @Mock private BookingConnectionRepository bookingConnectionRepository;
    @Mock private ExpediaConnectionRepository expediaConnectionRepository;
    @Mock private HotelsComConnectionRepository hotelsComConnectionRepository;
    @Mock private AgodaConnectionRepository agodaConnectionRepository;
    @Mock private HomeAwayConnectionRepository homeAwayConnectionRepository;
    @Mock private CredentialEncryptionService encryptionService;

    private ChannelConnectionService service;

    private static final Long ORG_ID = 100L;

    @BeforeEach
    void setUp() {
        service = new ChannelConnectionService(
                channelConnectionRepository, bookingConnectionRepository,
                expediaConnectionRepository, hotelsComConnectionRepository,
                agodaConnectionRepository, homeAwayConnectionRepository, encryptionService);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static Map<String, String> creds(String... kv) {
        Map<String, String> m = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put(kv[i], kv[i + 1]);
        return m;
    }

    private static ChannelConnection makeChannelConnection(ChannelName channel,
                                                            ChannelConnection.ConnectionStatus status) {
        ChannelConnection cc = new ChannelConnection(ORG_ID, channel);
        cc.setId(99L);
        cc.setStatus(status);
        return cc;
    }

    // ── getConnectionsForOrganization ───────────────────────────────────────

    @Nested
    @DisplayName("getConnectionsForOrganization")
    class GetConnectionsTests {

        @Test
        void returnsListMappedToDto() {
            ChannelConnection cc = makeChannelConnection(ChannelName.BOOKING, ChannelConnection.ConnectionStatus.ACTIVE);
            cc.setExternalPropertyId("hotel-1");
            when(channelConnectionRepository.findActiveByOrganizationId(ORG_ID)).thenReturn(List.of(cc));

            List<ChannelConnectionDto> result = service.getConnectionsForOrganization(ORG_ID);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).channel()).isEqualTo(ChannelName.BOOKING);
            assertThat(result.get(0).connected()).isTrue();
            assertThat(result.get(0).externalPropertyId()).isEqualTo("hotel-1");
        }

        @Test
        void returnsEmptyWhenNoConnections() {
            when(channelConnectionRepository.findActiveByOrganizationId(ORG_ID)).thenReturn(List.of());

            assertThat(service.getConnectionsForOrganization(ORG_ID)).isEmpty();
        }
    }

    @Nested
    @DisplayName("getConnectionStatus")
    class GetConnectionStatusTests {

        @Test
        void returnsDtoWhenPresent() {
            ChannelConnection cc = makeChannelConnection(ChannelName.EXPEDIA, ChannelConnection.ConnectionStatus.ACTIVE);
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.EXPEDIA))
                    .thenReturn(Optional.of(cc));

            Optional<ChannelConnectionDto> result = service.getConnectionStatus(ORG_ID, ChannelName.EXPEDIA);

            assertThat(result).isPresent();
            assertThat(result.get().channel()).isEqualTo(ChannelName.EXPEDIA);
        }

        @Test
        void returnsEmptyWhenAbsent() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.AGODA))
                    .thenReturn(Optional.empty());

            assertThat(service.getConnectionStatus(ORG_ID, ChannelName.AGODA)).isEmpty();
        }
    }

    // ── connect ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("connect — validation")
    class ConnectValidationTests {

        @Test
        @DisplayName("rejects unsupported channel")
        void unsupportedChannel() {
            ChannelConnectRequest req = new ChannelConnectRequest(creds("k", "v"));

            assertThatThrownBy(() -> service.connect(ORG_ID, ChannelName.AIRBNB, req))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Channel non supporte");
        }

        @Test
        @DisplayName("rejects when already active")
        void alreadyActive() {
            ChannelConnection existing = makeChannelConnection(
                    ChannelName.BOOKING, ChannelConnection.ConnectionStatus.ACTIVE);
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.BOOKING))
                    .thenReturn(Optional.of(existing));

            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("hotelId", "h", "username", "u", "password", "p"));

            assertThatThrownBy(() -> service.connect(ORG_ID, ChannelName.BOOKING, req))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("deja connecte");
        }
    }

    @Nested
    @DisplayName("connect — BOOKING")
    class ConnectBookingTests {

        @Test
        void success() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.BOOKING))
                    .thenReturn(Optional.empty());
            when(encryptionService.encrypt(anyString())).thenAnswer(inv -> "enc(" + inv.getArgument(0) + ")");
            BookingConnection saved = new BookingConnection(ORG_ID, "hotel-1");
            saved.setId(7L);
            when(bookingConnectionRepository.save(any(BookingConnection.class))).thenReturn(saved);
            when(channelConnectionRepository.save(any(ChannelConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("hotelId", "hotel-1", "username", "alice", "password", "s3cret"));
            ChannelConnectionDto dto = service.connect(ORG_ID, ChannelName.BOOKING, req);

            assertThat(dto.channel()).isEqualTo(ChannelName.BOOKING);
            assertThat(dto.externalPropertyId()).isEqualTo("hotel-1");
            verify(encryptionService).encrypt("s3cret");

            ArgumentCaptor<BookingConnection> captor = ArgumentCaptor.forClass(BookingConnection.class);
            verify(bookingConnectionRepository).save(captor.capture());
            assertThat(captor.getValue().getUsername()).isEqualTo("alice");
        }

        @Test
        void missingPassword_throws() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.BOOKING))
                    .thenReturn(Optional.empty());
            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("hotelId", "h", "username", "u"));

            assertThatThrownBy(() -> service.connect(ORG_ID, ChannelName.BOOKING, req))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Credential manquant: password");
        }

        @Test
        void reactivatesInactiveConnection() {
            ChannelConnection inactive = makeChannelConnection(
                    ChannelName.BOOKING, ChannelConnection.ConnectionStatus.INACTIVE);
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.BOOKING))
                    .thenReturn(Optional.of(inactive));
            when(encryptionService.encrypt(anyString())).thenReturn("enc");
            BookingConnection saved = new BookingConnection(ORG_ID, "hotel-1");
            saved.setId(7L);
            when(bookingConnectionRepository.save(any(BookingConnection.class))).thenReturn(saved);
            when(channelConnectionRepository.save(any(ChannelConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("hotelId", "hotel-1", "username", "u", "password", "p"));

            ChannelConnectionDto dto = service.connect(ORG_ID, ChannelName.BOOKING, req);

            assertThat(dto.status()).isEqualTo("ACTIVE");
            ArgumentCaptor<ChannelConnection> captor = ArgumentCaptor.forClass(ChannelConnection.class);
            verify(channelConnectionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(ChannelConnection.ConnectionStatus.ACTIVE);
        }
    }

    @Nested
    @DisplayName("connect — EXPEDIA")
    class ConnectExpediaTests {

        @Test
        void success() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.EXPEDIA))
                    .thenReturn(Optional.empty());
            when(encryptionService.encrypt(anyString())).thenReturn("enc");
            ExpediaConnection saved = new ExpediaConnection(ORG_ID, "P", "enc", "enc");
            saved.setId(11L);
            when(expediaConnectionRepository.save(any(ExpediaConnection.class))).thenReturn(saved);
            when(channelConnectionRepository.save(any(ChannelConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("propertyId", "P", "apiKey", "K", "apiSecret", "S"));
            ChannelConnectionDto dto = service.connect(ORG_ID, ChannelName.EXPEDIA, req);

            assertThat(dto.externalPropertyId()).isEqualTo("P");
            verify(encryptionService, times(2)).encrypt(anyString());
        }

        @Test
        void missingApiKey_throws() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.EXPEDIA))
                    .thenReturn(Optional.empty());

            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("propertyId", "P", "apiSecret", "S"));

            assertThatThrownBy(() -> service.connect(ORG_ID, ChannelName.EXPEDIA, req))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("apiKey");
        }
    }

    @Nested
    @DisplayName("connect — HOTELS_COM")
    class ConnectHotelsComTests {

        @Test
        void success() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.HOTELS_COM))
                    .thenReturn(Optional.empty());
            when(encryptionService.encrypt(anyString())).thenReturn("enc");
            HotelsComConnection saved = new HotelsComConnection();
            saved.setId(12L);
            saved.setOrganizationId(ORG_ID);
            saved.setPropertyId("P");
            when(hotelsComConnectionRepository.save(any(HotelsComConnection.class))).thenReturn(saved);
            when(channelConnectionRepository.save(any(ChannelConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("propertyId", "P", "apiKey", "K", "apiSecret", "S"));
            ChannelConnectionDto dto = service.connect(ORG_ID, ChannelName.HOTELS_COM, req);

            assertThat(dto.externalPropertyId()).isEqualTo("P");
        }
    }

    @Nested
    @DisplayName("connect — AGODA")
    class ConnectAgodaTests {

        @Test
        void success_withSecret() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.AGODA))
                    .thenReturn(Optional.empty());
            when(encryptionService.encrypt(anyString())).thenReturn("enc");
            AgodaConnection saved = new AgodaConnection(ORG_ID, "P", "enc");
            saved.setId(13L);
            when(agodaConnectionRepository.save(any(AgodaConnection.class))).thenReturn(saved);
            when(channelConnectionRepository.save(any(ChannelConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("propertyId", "P", "apiKey", "K", "apiSecret", "S"));
            ChannelConnectionDto dto = service.connect(ORG_ID, ChannelName.AGODA, req);

            assertThat(dto.externalPropertyId()).isEqualTo("P");
            // both apiKey and apiSecret encrypted
            verify(encryptionService, times(2)).encrypt(anyString());
        }

        @Test
        void success_withoutSecret() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.AGODA))
                    .thenReturn(Optional.empty());
            when(encryptionService.encrypt(anyString())).thenReturn("enc");
            AgodaConnection saved = new AgodaConnection(ORG_ID, "P", "enc");
            saved.setId(13L);
            when(agodaConnectionRepository.save(any(AgodaConnection.class))).thenReturn(saved);
            when(channelConnectionRepository.save(any(ChannelConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("propertyId", "P", "apiKey", "K"));
            ChannelConnectionDto dto = service.connect(ORG_ID, ChannelName.AGODA, req);

            assertThat(dto.externalPropertyId()).isEqualTo("P");
            // only apiKey encrypted (secret missing/blank)
            verify(encryptionService, times(1)).encrypt(anyString());
        }
    }

    @Nested
    @DisplayName("connect — HOMEAWAY")
    class ConnectHomeAwayTests {

        @Test
        void success_withRefreshToken() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.HOMEAWAY))
                    .thenReturn(Optional.empty());
            when(encryptionService.encrypt(anyString())).thenReturn("enc");
            HomeAwayConnection saved = new HomeAwayConnection(ORG_ID, "enc");
            saved.setId(14L);
            when(homeAwayConnectionRepository.save(any(HomeAwayConnection.class))).thenReturn(saved);
            when(channelConnectionRepository.save(any(ChannelConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("listingId", "L", "accessToken", "T", "refreshToken", "R"));
            ChannelConnectionDto dto = service.connect(ORG_ID, ChannelName.HOMEAWAY, req);

            assertThat(dto.externalPropertyId()).isEqualTo("L");
            verify(encryptionService, times(2)).encrypt(anyString());
        }

        @Test
        void success_withoutRefreshToken() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.HOMEAWAY))
                    .thenReturn(Optional.empty());
            when(encryptionService.encrypt(anyString())).thenReturn("enc");
            HomeAwayConnection saved = new HomeAwayConnection(ORG_ID, "enc");
            saved.setId(14L);
            when(homeAwayConnectionRepository.save(any(HomeAwayConnection.class))).thenReturn(saved);
            when(channelConnectionRepository.save(any(ChannelConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("listingId", "L", "accessToken", "T"));
            ChannelConnectionDto dto = service.connect(ORG_ID, ChannelName.HOMEAWAY, req);

            assertThat(dto.externalPropertyId()).isEqualTo("L");
            // only accessToken encrypted
            verify(encryptionService, times(1)).encrypt(anyString());
        }
    }

    @Nested
    @DisplayName("connect — STUB channels")
    class ConnectStubTests {

        @Test
        void tripcom_success() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.TRIPCOM))
                    .thenReturn(Optional.empty());
            when(encryptionService.encrypt(anyString())).thenReturn("enc");
            when(channelConnectionRepository.save(any(ChannelConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("partnerId", "PART-1", "apiKey", "K"));
            ChannelConnectionDto dto = service.connect(ORG_ID, ChannelName.TRIPCOM, req);

            assertThat(dto.channel()).isEqualTo(ChannelName.TRIPCOM);
            assertThat(dto.externalPropertyId()).isEqualTo("PART-1");

            ArgumentCaptor<ChannelConnection> captor = ArgumentCaptor.forClass(ChannelConnection.class);
            verify(channelConnectionRepository).save(captor.capture());
            assertThat(captor.getValue().getCredentialsRef()).startsWith("stub:");
        }

        @Test
        void hometogo_success() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.HOMETOGO))
                    .thenReturn(Optional.empty());
            when(encryptionService.encrypt(anyString())).thenReturn("enc");
            when(channelConnectionRepository.save(any(ChannelConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("partnerId", "PART-X", "icalUrl", "https://ical/url.ics"));
            ChannelConnectionDto dto = service.connect(ORG_ID, ChannelName.HOMETOGO, req);

            assertThat(dto.externalPropertyId()).isEqualTo("PART-X");
        }

        @Test
        void simpleApiKeyChannels_defaultExternalIdIsChannelName() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.GATHERN))
                    .thenReturn(Optional.empty());
            when(encryptionService.encrypt(anyString())).thenReturn("enc");
            when(channelConnectionRepository.save(any(ChannelConnection.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ChannelConnectionDto dto = service.connect(ORG_ID, ChannelName.GATHERN,
                    new ChannelConnectRequest(creds("apiKey", "K")));

            assertThat(dto.externalPropertyId()).isEqualTo("gathern");
        }

        @Test
        void missingRequiredField_throws() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.TRIPCOM))
                    .thenReturn(Optional.empty());

            ChannelConnectRequest req = new ChannelConnectRequest(creds("partnerId", "P"));

            assertThatThrownBy(() -> service.connect(ORG_ID, ChannelName.TRIPCOM, req))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("apiKey");
        }
    }

    // ── disconnect ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("disconnect")
    class DisconnectTests {

        @Test
        void notFound_throws() {
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.BOOKING))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.disconnect(ORG_ID, ChannelName.BOOKING))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void booking_deactivatesBothEntities() {
            ChannelConnection cc = makeChannelConnection(ChannelName.BOOKING, ChannelConnection.ConnectionStatus.ACTIVE);
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.BOOKING))
                    .thenReturn(Optional.of(cc));
            BookingConnection bc = new BookingConnection(ORG_ID, "H");
            when(bookingConnectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(bc));

            service.disconnect(ORG_ID, ChannelName.BOOKING);

            assertThat(cc.getStatus()).isEqualTo(ChannelConnection.ConnectionStatus.INACTIVE);
            verify(channelConnectionRepository).save(cc);
            verify(bookingConnectionRepository).save(bc);
            assertThat(bc.getStatus()).isEqualTo(BookingConnection.BookingConnectionStatus.INACTIVE);
        }

        @Test
        void expedia_deactivatesEachEntity() {
            ChannelConnection cc = makeChannelConnection(ChannelName.EXPEDIA, ChannelConnection.ConnectionStatus.ACTIVE);
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.EXPEDIA))
                    .thenReturn(Optional.of(cc));
            ExpediaConnection ec = new ExpediaConnection(ORG_ID, "P", "k", "s");
            when(expediaConnectionRepository.findByOrganizationId(ORG_ID)).thenReturn(List.of(ec));

            service.disconnect(ORG_ID, ChannelName.EXPEDIA);

            assertThat(ec.getStatus()).isEqualTo(ExpediaConnection.ExpediaConnectionStatus.INACTIVE);
            verify(expediaConnectionRepository).save(ec);
        }

        @Test
        void agoda_deactivates() {
            ChannelConnection cc = makeChannelConnection(ChannelName.AGODA, ChannelConnection.ConnectionStatus.ACTIVE);
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.AGODA))
                    .thenReturn(Optional.of(cc));
            AgodaConnection ac = new AgodaConnection(ORG_ID, "P", "k");
            when(agodaConnectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(ac));

            service.disconnect(ORG_ID, ChannelName.AGODA);

            assertThat(ac.getStatus()).isEqualTo(AgodaConnection.AgodaConnectionStatus.INACTIVE);
            verify(agodaConnectionRepository).save(ac);
        }

        @Test
        void hotelsCom_deactivates() {
            ChannelConnection cc = makeChannelConnection(ChannelName.HOTELS_COM, ChannelConnection.ConnectionStatus.ACTIVE);
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.HOTELS_COM))
                    .thenReturn(Optional.of(cc));
            HotelsComConnection hc = new HotelsComConnection();
            when(hotelsComConnectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(hc));

            service.disconnect(ORG_ID, ChannelName.HOTELS_COM);

            assertThat(hc.getStatus()).isEqualTo(HotelsComConnection.HotelsComConnectionStatus.INACTIVE);
            verify(hotelsComConnectionRepository).save(hc);
        }

        @Test
        void homeAway_deactivates() {
            ChannelConnection cc = makeChannelConnection(ChannelName.HOMEAWAY, ChannelConnection.ConnectionStatus.ACTIVE);
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.HOMEAWAY))
                    .thenReturn(Optional.of(cc));
            HomeAwayConnection hc = new HomeAwayConnection(ORG_ID, "enc");
            when(homeAwayConnectionRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(hc));

            service.disconnect(ORG_ID, ChannelName.HOMEAWAY);

            assertThat(hc.getStatus()).isEqualTo(HomeAwayConnection.HomeAwayConnectionStatus.INACTIVE);
            verify(homeAwayConnectionRepository).save(hc);
        }

        @Test
        void stub_noSpecificEntityToDeactivate() {
            ChannelConnection cc = makeChannelConnection(ChannelName.TRIPCOM, ChannelConnection.ConnectionStatus.ACTIVE);
            when(channelConnectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.TRIPCOM))
                    .thenReturn(Optional.of(cc));

            service.disconnect(ORG_ID, ChannelName.TRIPCOM);

            assertThat(cc.getStatus()).isEqualTo(ChannelConnection.ConnectionStatus.INACTIVE);
            verify(channelConnectionRepository).save(cc);
            // No interaction with specific repos
            verify(bookingConnectionRepository, never()).save(any());
        }

        @Test
        void rejectsUnsupportedChannel() {
            assertThatThrownBy(() -> service.disconnect(ORG_ID, ChannelName.AIRBNB))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ── testConnection ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("testConnection")
    class TestConnectionTests {

        @Test
        void booking_success() {
            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("hotelId", "h", "username", "u", "password", "p"));
            ChannelConnectionTestResult r = service.testConnection(ORG_ID, ChannelName.BOOKING, req);
            assertThat(r.success()).isTrue();
            assertThat(r.channelPropertyName()).isEqualTo("h");
        }

        @Test
        void booking_missingPassword() {
            ChannelConnectRequest req = new ChannelConnectRequest(
                    creds("hotelId", "h", "username", "u"));
            ChannelConnectionTestResult r = service.testConnection(ORG_ID, ChannelName.BOOKING, req);
            assertThat(r.success()).isFalse();
            assertThat(r.message()).contains("password");
        }

        @Test
        void expedia_success() {
            ChannelConnectionTestResult r = service.testConnection(ORG_ID, ChannelName.EXPEDIA,
                    new ChannelConnectRequest(
                            creds("propertyId", "P", "apiKey", "K", "apiSecret", "S")));
            assertThat(r.success()).isTrue();
            assertThat(r.channelPropertyName()).isEqualTo("P");
        }

        @Test
        void hotelsCom_success() {
            ChannelConnectionTestResult r = service.testConnection(ORG_ID, ChannelName.HOTELS_COM,
                    new ChannelConnectRequest(
                            creds("propertyId", "P", "apiKey", "K", "apiSecret", "S")));
            assertThat(r.success()).isTrue();
        }

        @Test
        void agoda_success() {
            ChannelConnectionTestResult r = service.testConnection(ORG_ID, ChannelName.AGODA,
                    new ChannelConnectRequest(
                            creds("propertyId", "P", "apiKey", "K")));
            assertThat(r.success()).isTrue();
            assertThat(r.channelPropertyName()).isEqualTo("P");
        }

        @Test
        void homeAway_success() {
            ChannelConnectionTestResult r = service.testConnection(ORG_ID, ChannelName.HOMEAWAY,
                    new ChannelConnectRequest(
                            creds("listingId", "L", "accessToken", "T")));
            assertThat(r.success()).isTrue();
            assertThat(r.channelPropertyName()).isEqualTo("L");
        }

        @Test
        void tripcom_success_returnsPartnerId() {
            ChannelConnectionTestResult r = service.testConnection(ORG_ID, ChannelName.TRIPCOM,
                    new ChannelConnectRequest(
                            creds("partnerId", "PART", "apiKey", "K")));
            assertThat(r.success()).isTrue();
            assertThat(r.channelPropertyName()).isEqualTo("PART");
            assertThat(r.message()).contains("stub");
        }

        @Test
        void gathern_success_noIdentifier() {
            ChannelConnectionTestResult r = service.testConnection(ORG_ID, ChannelName.GATHERN,
                    new ChannelConnectRequest(creds("apiKey", "K")));
            assertThat(r.success()).isTrue();
            assertThat(r.channelPropertyName()).isNull();
        }

        @Test
        void stub_missingField() {
            ChannelConnectionTestResult r = service.testConnection(ORG_ID, ChannelName.RENTELLY,
                    new ChannelConnectRequest(creds("foo", "bar")));
            assertThat(r.success()).isFalse();
            assertThat(r.message()).contains("apiKey");
        }

        @Test
        void unsupportedChannel_throws() {
            ChannelConnectRequest req = new ChannelConnectRequest(creds("k", "v"));
            assertThatThrownBy(() -> service.testConnection(ORG_ID, ChannelName.AIRBNB, req))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }
}
