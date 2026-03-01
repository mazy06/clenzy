package com.clenzy.integration;

import com.clenzy.integration.airbnb.dto.*;
import com.clenzy.integration.airbnb.model.*;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncDirection;
import com.clenzy.integration.channel.model.*;
import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.tuya.model.TuyaConnection;
import com.clenzy.model.Property;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Coverage tests for all integration DTOs and models.
 */
class IntegrationDtoCoverageTest {

    // ─── Airbnb DTOs ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("AirbnbReservationDto")
    class AirbnbReservationDtoTest {
        @Test void allFields() {
            AirbnbReservationDto dto = new AirbnbReservationDto();
            dto.setId("res-1");
            dto.setListingId("listing-1");
            dto.setGuestName("Jean");
            dto.setGuestEmail("jean@test.com");
            dto.setGuestPhone("0612345678");
            dto.setGuestCount(2);
            dto.setCheckIn(LocalDate.of(2026, 3, 1));
            dto.setCheckOut(LocalDate.of(2026, 3, 5));
            dto.setStatus("CONFIRMED");
            dto.setTotalPrice(BigDecimal.valueOf(500));
            dto.setCurrency("USD");
            dto.setSource("booking");
            dto.setConfirmationCode("ABC123");
            dto.setSpecialRequests("Late check-in");
            dto.setCreatedAt(LocalDateTime.now());
            dto.setUpdatedAt(LocalDateTime.now());
            assertThat(dto.getId()).isEqualTo("res-1");
            assertThat(dto.getListingId()).isEqualTo("listing-1");
            assertThat(dto.getGuestName()).isEqualTo("Jean");
            assertThat(dto.getGuestEmail()).isEqualTo("jean@test.com");
            assertThat(dto.getGuestPhone()).isEqualTo("0612345678");
            assertThat(dto.getGuestCount()).isEqualTo(2);
            assertThat(dto.getCheckIn()).isEqualTo(LocalDate.of(2026, 3, 1));
            assertThat(dto.getCheckOut()).isEqualTo(LocalDate.of(2026, 3, 5));
            assertThat(dto.getStatus()).isEqualTo("CONFIRMED");
            assertThat(dto.getTotalPrice()).isEqualByComparingTo("500");
            assertThat(dto.getCurrency()).isEqualTo("USD");
            assertThat(dto.getSource()).isEqualTo("booking");
            assertThat(dto.getConfirmationCode()).isEqualTo("ABC123");
            assertThat(dto.getSpecialRequests()).isEqualTo("Late check-in");
            assertThat(dto.getCreatedAt()).isNotNull();
            assertThat(dto.getUpdatedAt()).isNotNull();
        }
        @Test void defaults() {
            AirbnbReservationDto dto = new AirbnbReservationDto();
            assertThat(dto.getCurrency()).isEqualTo("EUR");
            assertThat(dto.getSource()).isEqualTo("airbnb");
        }
    }

    @Nested
    @DisplayName("AirbnbCalendarEventDto")
    class AirbnbCalendarEventDtoTest {
        @Test void allFields() {
            AirbnbCalendarEventDto dto = new AirbnbCalendarEventDto();
            dto.setListingId("listing-1");
            dto.setDate(LocalDate.of(2026, 6, 1));
            dto.setAvailable(true);
            dto.setPrice(BigDecimal.valueOf(120));
            dto.setMinimumStay(2);
            dto.setNotes("Summer rate");
            assertThat(dto.getListingId()).isEqualTo("listing-1");
            assertThat(dto.getDate()).isEqualTo(LocalDate.of(2026, 6, 1));
            assertThat(dto.isAvailable()).isTrue();
            assertThat(dto.getPrice()).isEqualByComparingTo("120");
            assertThat(dto.getMinimumStay()).isEqualTo(2);
            assertThat(dto.getNotes()).isEqualTo("Summer rate");
        }
    }

    @Nested
    @DisplayName("AirbnbListingDto")
    class AirbnbListingDtoTest {
        @Test void allFields() {
            AirbnbListingDto dto = new AirbnbListingDto();
            dto.setId("listing-1");
            dto.setTitle("Villa Bleue");
            dto.setDescription("Beautiful villa");
            dto.setAddress("123 Rue Test");
            dto.setCity("Paris");
            dto.setCountry("France");
            dto.setLatitude(BigDecimal.valueOf(48.8566));
            dto.setLongitude(BigDecimal.valueOf(2.3522));
            dto.setBedroomCount(3);
            dto.setBathroomCount(2);
            dto.setMaxGuests(6);
            dto.setPropertyType("VILLA");
            dto.setNightlyPrice(BigDecimal.valueOf(150));
            dto.setCurrency("EUR");
            dto.setPhotos(List.of("photo1.jpg"));
            dto.setAmenities(List.of("wifi", "pool"));
            dto.setUrl("https://airbnb.com/rooms/1");
            dto.setStatus("LISTED");
            assertThat(dto.getId()).isEqualTo("listing-1");
            assertThat(dto.getTitle()).isEqualTo("Villa Bleue");
            assertThat(dto.getDescription()).isEqualTo("Beautiful villa");
            assertThat(dto.getAddress()).isEqualTo("123 Rue Test");
            assertThat(dto.getCity()).isEqualTo("Paris");
            assertThat(dto.getCountry()).isEqualTo("France");
            assertThat(dto.getLatitude()).isEqualByComparingTo("48.8566");
            assertThat(dto.getLongitude()).isEqualByComparingTo("2.3522");
            assertThat(dto.getBedroomCount()).isEqualTo(3);
            assertThat(dto.getBathroomCount()).isEqualTo(2);
            assertThat(dto.getMaxGuests()).isEqualTo(6);
            assertThat(dto.getPropertyType()).isEqualTo("VILLA");
            assertThat(dto.getNightlyPrice()).isEqualByComparingTo("150");
            assertThat(dto.getCurrency()).isEqualTo("EUR");
            assertThat(dto.getPhotos()).hasSize(1);
            assertThat(dto.getAmenities()).hasSize(2);
            assertThat(dto.getUrl()).isEqualTo("https://airbnb.com/rooms/1");
            assertThat(dto.getStatus()).isEqualTo("LISTED");
        }
        @Test void defaultLists() {
            AirbnbListingDto dto = new AirbnbListingDto();
            assertThat(dto.getPhotos()).isEmpty();
            assertThat(dto.getAmenities()).isEmpty();
        }
    }

    @Nested
    @DisplayName("AirbnbMessageDto")
    class AirbnbMessageDtoTest {
        @Test void allFields() {
            AirbnbMessageDto dto = new AirbnbMessageDto();
            dto.setId("msg-1");
            dto.setReservationId("res-1");
            dto.setThreadId("thread-1");
            dto.setSenderName("Jean");
            dto.setSenderRole("guest");
            dto.setContent("Hello!");
            dto.setSentAt(LocalDateTime.now());
            dto.setRead(true);
            assertThat(dto.getId()).isEqualTo("msg-1");
            assertThat(dto.getReservationId()).isEqualTo("res-1");
            assertThat(dto.getThreadId()).isEqualTo("thread-1");
            assertThat(dto.getSenderName()).isEqualTo("Jean");
            assertThat(dto.getSenderRole()).isEqualTo("guest");
            assertThat(dto.getContent()).isEqualTo("Hello!");
            assertThat(dto.getSentAt()).isNotNull();
            assertThat(dto.isRead()).isTrue();
        }
    }

    @Nested
    @DisplayName("AirbnbConnectionStatusDto")
    class AirbnbConnectionStatusDtoTest {
        @Test void allFields() {
            AirbnbConnectionStatusDto dto = new AirbnbConnectionStatusDto();
            dto.setConnected(true);
            dto.setAirbnbUserId("airbnb-user-1");
            dto.setStatus("ACTIVE");
            dto.setConnectedAt(LocalDateTime.now());
            dto.setLastSyncAt(LocalDateTime.now());
            dto.setScopes("listings,reservations");
            dto.setLinkedListingsCount(3);
            dto.setErrorMessage(null);
            assertThat(dto.isConnected()).isTrue();
            assertThat(dto.getAirbnbUserId()).isEqualTo("airbnb-user-1");
            assertThat(dto.getStatus()).isEqualTo("ACTIVE");
            assertThat(dto.getConnectedAt()).isNotNull();
            assertThat(dto.getLastSyncAt()).isNotNull();
            assertThat(dto.getScopes()).isEqualTo("listings,reservations");
            assertThat(dto.getLinkedListingsCount()).isEqualTo(3);
            assertThat(dto.getErrorMessage()).isNull();
        }
    }

    @Nested
    @DisplayName("AirbnbWebhookPayload")
    class AirbnbWebhookPayloadTest {
        @Test void allFields() {
            AirbnbWebhookPayload dto = new AirbnbWebhookPayload();
            dto.setEventId("evt-1");
            dto.setEventType("reservation.created");
            dto.setTimestamp("2026-01-01T10:00:00Z");
            dto.setData(Map.of("key", "value"));
            assertThat(dto.getEventId()).isEqualTo("evt-1");
            assertThat(dto.getEventType()).isEqualTo("reservation.created");
            assertThat(dto.getTimestamp()).isEqualTo("2026-01-01T10:00:00Z");
            assertThat(dto.getData()).containsEntry("key", "value");
        }
        @Test void defaultData() {
            AirbnbWebhookPayload dto = new AirbnbWebhookPayload();
            assertThat(dto.getData()).isEmpty();
        }
    }

    // ─── Airbnb Models ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("AirbnbWebhookEvent")
    class AirbnbWebhookEventTest {
        @Test void defaultConstructor() {
            AirbnbWebhookEvent e = new AirbnbWebhookEvent();
            assertThat(e.getStatus()).isEqualTo(AirbnbWebhookEvent.WebhookEventStatus.PENDING);
            assertThat(e.getRetryCount()).isEqualTo(0);
        }
        @Test void parameterizedConstructor() {
            AirbnbWebhookEvent e = new AirbnbWebhookEvent("evt-1", "reservation.created", "{\"key\":\"val\"}");
            assertThat(e.getEventId()).isEqualTo("evt-1");
            assertThat(e.getEventType()).isEqualTo("reservation.created");
            assertThat(e.getPayload()).isEqualTo("{\"key\":\"val\"}");
        }
        @Test void prePersist() {
            AirbnbWebhookEvent e = new AirbnbWebhookEvent();
            e.prePersist();
            assertThat(e.getCreatedAt()).isNotNull();
            assertThat(e.getReceivedAt()).isNotNull();
        }
        @Test void prePersistPreservesReceivedAt() {
            AirbnbWebhookEvent e = new AirbnbWebhookEvent();
            LocalDateTime fixed = LocalDateTime.of(2025, 1, 1, 0, 0);
            e.setReceivedAt(fixed);
            e.prePersist();
            assertThat(e.getReceivedAt()).isEqualTo(fixed);
        }
        @Test void utilityMethods() {
            AirbnbWebhookEvent e = new AirbnbWebhookEvent();
            assertThat(e.isPending()).isTrue();
            assertThat(e.isFailed()).isFalse();
            e.setStatus(AirbnbWebhookEvent.WebhookEventStatus.FAILED);
            assertThat(e.isFailed()).isTrue();
            assertThat(e.isPending()).isFalse();
        }
        @Test void incrementRetryCount() {
            AirbnbWebhookEvent e = new AirbnbWebhookEvent();
            e.incrementRetryCount();
            assertThat(e.getRetryCount()).isEqualTo(1);
            e.incrementRetryCount();
            assertThat(e.getRetryCount()).isEqualTo(2);
        }
        @Test void setters() {
            AirbnbWebhookEvent e = new AirbnbWebhookEvent();
            e.setId(1L);
            e.setSignature("sig");
            e.setProcessedAt(LocalDateTime.now());
            e.setErrorMessage("Error");
            assertThat(e.getId()).isEqualTo(1L);
            assertThat(e.getSignature()).isEqualTo("sig");
            assertThat(e.getProcessedAt()).isNotNull();
            assertThat(e.getErrorMessage()).isEqualTo("Error");
        }
        @Test void webhookEventStatusEnum() {
            assertThat(AirbnbWebhookEvent.WebhookEventStatus.values()).hasSize(4);
        }
        @Test void toStringTest() {
            AirbnbWebhookEvent e = new AirbnbWebhookEvent("evt-1", "type", "{}");
            assertThat(e.toString()).contains("AirbnbWebhookEvent");
        }
    }

    @Nested
    @DisplayName("AirbnbConnection")
    class AirbnbConnectionTest {
        @Test void defaultConstructor() {
            AirbnbConnection c = new AirbnbConnection();
            assertThat(c.getStatus()).isEqualTo(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
        }
        @Test void parameterizedConstructor() {
            AirbnbConnection c = new AirbnbConnection("user-1", "encrypted-token");
            assertThat(c.getUserId()).isEqualTo("user-1");
            assertThat(c.getAccessTokenEncrypted()).isEqualTo("encrypted-token");
        }
        @Test void prePersist() {
            AirbnbConnection c = new AirbnbConnection();
            c.prePersist();
            assertThat(c.getCreatedAt()).isNotNull();
            assertThat(c.getUpdatedAt()).isNotNull();
            assertThat(c.getConnectedAt()).isNotNull();
        }
        @Test void prePersistPreservesConnectedAt() {
            AirbnbConnection c = new AirbnbConnection();
            LocalDateTime fixed = LocalDateTime.of(2025, 1, 1, 0, 0);
            c.setConnectedAt(fixed);
            c.prePersist();
            assertThat(c.getConnectedAt()).isEqualTo(fixed);
        }
        @Test void preUpdate() {
            AirbnbConnection c = new AirbnbConnection();
            c.prePersist();
            LocalDateTime before = c.getUpdatedAt();
            c.preUpdate();
            assertThat(c.getUpdatedAt()).isAfterOrEqualTo(before);
        }
        @Test void isActive() {
            AirbnbConnection c = new AirbnbConnection();
            assertThat(c.isActive()).isTrue();
            c.setStatus(AirbnbConnection.AirbnbConnectionStatus.REVOKED);
            assertThat(c.isActive()).isFalse();
        }
        @Test void isTokenExpired() {
            AirbnbConnection c = new AirbnbConnection();
            assertThat(c.isTokenExpired()).isFalse();
            c.setTokenExpiresAt(LocalDateTime.now().minusHours(1));
            assertThat(c.isTokenExpired()).isTrue();
            c.setTokenExpiresAt(LocalDateTime.now().plusHours(1));
            assertThat(c.isTokenExpired()).isFalse();
        }
        @Test void setters() {
            AirbnbConnection c = new AirbnbConnection();
            c.setId(1L);
            c.setOrganizationId(2L);
            c.setAirbnbUserId("airbnb-1");
            c.setRefreshTokenEncrypted("refresh");
            c.setScopes("listings");
            c.setLastSyncAt(LocalDateTime.now());
            c.setErrorMessage("Error");
            assertThat(c.getId()).isEqualTo(1L);
            assertThat(c.getOrganizationId()).isEqualTo(2L);
            assertThat(c.getAirbnbUserId()).isEqualTo("airbnb-1");
            assertThat(c.getRefreshTokenEncrypted()).isEqualTo("refresh");
            assertThat(c.getScopes()).isEqualTo("listings");
            assertThat(c.getErrorMessage()).isEqualTo("Error");
        }
        @Test void statusEnum() {
            assertThat(AirbnbConnection.AirbnbConnectionStatus.values()).hasSize(4);
        }
        @Test void toStringTest() {
            AirbnbConnection c = new AirbnbConnection("user-1", "token");
            assertThat(c.toString()).contains("AirbnbConnection");
        }
    }

    @Nested
    @DisplayName("AirbnbListingMapping")
    class AirbnbListingMappingTest {
        @Test void defaultConstructor() {
            AirbnbListingMapping m = new AirbnbListingMapping();
            assertThat(m.isSyncEnabled()).isTrue();
            assertThat(m.isAutoCreateInterventions()).isTrue();
            assertThat(m.isAutoPushPricing()).isFalse();
        }
        @Test void parameterizedConstructor() {
            Property prop = new Property();
            AirbnbListingMapping m = new AirbnbListingMapping(prop, "listing-1");
            assertThat(m.getProperty()).isEqualTo(prop);
            assertThat(m.getAirbnbListingId()).isEqualTo("listing-1");
        }
        @Test void prePersist() {
            AirbnbListingMapping m = new AirbnbListingMapping();
            m.prePersist();
            assertThat(m.getCreatedAt()).isNotNull();
            assertThat(m.getUpdatedAt()).isNotNull();
        }
        @Test void preUpdate() {
            AirbnbListingMapping m = new AirbnbListingMapping();
            m.prePersist();
            LocalDateTime before = m.getUpdatedAt();
            m.preUpdate();
            assertThat(m.getUpdatedAt()).isAfterOrEqualTo(before);
        }
        @Test void setters() {
            AirbnbListingMapping m = new AirbnbListingMapping();
            m.setId(1L);
            m.setOrganizationId(2L);
            m.setPropertyId(3L);
            m.setAirbnbListingId("listing-1");
            m.setAirbnbListingTitle("Villa Bleue");
            m.setAirbnbListingUrl("https://airbnb.com/rooms/1");
            m.setSyncEnabled(false);
            m.setAutoCreateInterventions(false);
            m.setAutoPushPricing(true);
            m.setLastSyncAt(LocalDateTime.now());
            assertThat(m.getId()).isEqualTo(1L);
            assertThat(m.getOrganizationId()).isEqualTo(2L);
            assertThat(m.getPropertyId()).isEqualTo(3L);
            assertThat(m.getAirbnbListingTitle()).isEqualTo("Villa Bleue");
            assertThat(m.getAirbnbListingUrl()).isEqualTo("https://airbnb.com/rooms/1");
            assertThat(m.isSyncEnabled()).isFalse();
            assertThat(m.isAutoCreateInterventions()).isFalse();
            assertThat(m.isAutoPushPricing()).isTrue();
        }
        @Test void toStringTest() {
            AirbnbListingMapping m = new AirbnbListingMapping();
            m.setAirbnbListingId("listing-1");
            assertThat(m.toString()).contains("AirbnbListingMapping");
        }
    }

    // ─── Minut Model ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("MinutConnection")
    class MinutConnectionTest {
        @Test void defaults() {
            MinutConnection c = new MinutConnection();
            assertThat(c.getStatus()).isEqualTo(MinutConnection.MinutConnectionStatus.ACTIVE);
        }
        @Test void prePersist() {
            MinutConnection c = new MinutConnection();
            c.prePersist();
            assertThat(c.getCreatedAt()).isNotNull();
            assertThat(c.getUpdatedAt()).isNotNull();
            assertThat(c.getConnectedAt()).isNotNull();
        }
        @Test void prePersistPreservesConnectedAt() {
            MinutConnection c = new MinutConnection();
            LocalDateTime fixed = LocalDateTime.of(2025, 6, 1, 0, 0);
            c.setConnectedAt(fixed);
            c.prePersist();
            assertThat(c.getConnectedAt()).isEqualTo(fixed);
        }
        @Test void preUpdate() {
            MinutConnection c = new MinutConnection();
            c.prePersist();
            c.preUpdate();
            assertThat(c.getUpdatedAt()).isNotNull();
        }
        @Test void isActive() {
            MinutConnection c = new MinutConnection();
            assertThat(c.isActive()).isTrue();
            c.setStatus(MinutConnection.MinutConnectionStatus.REVOKED);
            assertThat(c.isActive()).isFalse();
        }
        @Test void isTokenExpired() {
            MinutConnection c = new MinutConnection();
            assertThat(c.isTokenExpired()).isFalse();
            c.setTokenExpiresAt(LocalDateTime.now().minusHours(1));
            assertThat(c.isTokenExpired()).isTrue();
            c.setTokenExpiresAt(LocalDateTime.now().plusHours(1));
            assertThat(c.isTokenExpired()).isFalse();
        }
        @Test void setters() {
            MinutConnection c = new MinutConnection();
            c.setId(1L);
            c.setUserId("user-1");
            c.setMinutUserId("minut-1");
            c.setOrganizationId(2L);
            c.setMinutOrganizationId("minut-org-1");
            c.setAccessTokenEncrypted("token");
            c.setRefreshTokenEncrypted("refresh");
            c.setScopes("read,write");
            c.setLastSyncAt(LocalDateTime.now());
            c.setErrorMessage("Error");
            assertThat(c.getId()).isEqualTo(1L);
            assertThat(c.getUserId()).isEqualTo("user-1");
            assertThat(c.getMinutUserId()).isEqualTo("minut-1");
            assertThat(c.getOrganizationId()).isEqualTo(2L);
            assertThat(c.getMinutOrganizationId()).isEqualTo("minut-org-1");
            assertThat(c.getAccessTokenEncrypted()).isEqualTo("token");
            assertThat(c.getRefreshTokenEncrypted()).isEqualTo("refresh");
            assertThat(c.getScopes()).isEqualTo("read,write");
            assertThat(c.getErrorMessage()).isEqualTo("Error");
        }
        @Test void statusEnum() {
            assertThat(MinutConnection.MinutConnectionStatus.values()).hasSize(4);
        }
    }

    // ─── Tuya Model ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("TuyaConnection")
    class TuyaConnectionTest {
        @Test void defaults() {
            TuyaConnection c = new TuyaConnection();
            assertThat(c.getStatus()).isEqualTo(TuyaConnection.TuyaConnectionStatus.ACTIVE);
        }
        @Test void prePersist() {
            TuyaConnection c = new TuyaConnection();
            c.prePersist();
            assertThat(c.getCreatedAt()).isNotNull();
            assertThat(c.getUpdatedAt()).isNotNull();
            assertThat(c.getConnectedAt()).isNotNull();
        }
        @Test void preUpdate() {
            TuyaConnection c = new TuyaConnection();
            c.prePersist();
            c.preUpdate();
            assertThat(c.getUpdatedAt()).isNotNull();
        }
        @Test void isActive() {
            TuyaConnection c = new TuyaConnection();
            assertThat(c.isActive()).isTrue();
            c.setStatus(TuyaConnection.TuyaConnectionStatus.ERROR);
            assertThat(c.isActive()).isFalse();
        }
        @Test void isTokenExpired() {
            TuyaConnection c = new TuyaConnection();
            assertThat(c.isTokenExpired()).isFalse();
            c.setTokenExpiresAt(LocalDateTime.now().minusHours(1));
            assertThat(c.isTokenExpired()).isTrue();
        }
        @Test void setters() {
            TuyaConnection c = new TuyaConnection();
            c.setId(1L);
            c.setOrganizationId(2L);
            c.setUserId("user-1");
            c.setTuyaUid("tuya-1");
            c.setAccessTokenEncrypted("token");
            c.setRefreshTokenEncrypted("refresh");
            c.setLastSyncAt(LocalDateTime.now());
            c.setErrorMessage("Error");
            assertThat(c.getId()).isEqualTo(1L);
            assertThat(c.getOrganizationId()).isEqualTo(2L);
            assertThat(c.getTuyaUid()).isEqualTo("tuya-1");
            assertThat(c.getAccessTokenEncrypted()).isEqualTo("token");
            assertThat(c.getRefreshTokenEncrypted()).isEqualTo("refresh");
            assertThat(c.getErrorMessage()).isEqualTo("Error");
        }
        @Test void statusEnum() {
            assertThat(TuyaConnection.TuyaConnectionStatus.values()).hasSize(4);
        }
    }

    // ─── Channel Models ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("ChannelName enum")
    class ChannelNameTest {
        @Test void allValues() {
            assertThat(ChannelName.values()).hasSize(12);
            assertThat(ChannelName.valueOf("AIRBNB")).isEqualTo(ChannelName.AIRBNB);
            assertThat(ChannelName.valueOf("BOOKING")).isEqualTo(ChannelName.BOOKING);
            assertThat(ChannelName.valueOf("EXPEDIA")).isEqualTo(ChannelName.EXPEDIA);
            assertThat(ChannelName.valueOf("VRBO")).isEqualTo(ChannelName.VRBO);
            assertThat(ChannelName.valueOf("ICAL")).isEqualTo(ChannelName.ICAL);
            assertThat(ChannelName.valueOf("GOOGLE_VACATION_RENTALS")).isEqualTo(ChannelName.GOOGLE_VACATION_RENTALS);
            assertThat(ChannelName.valueOf("HOMEAWAY")).isEqualTo(ChannelName.HOMEAWAY);
            assertThat(ChannelName.valueOf("TRIPADVISOR")).isEqualTo(ChannelName.TRIPADVISOR);
            assertThat(ChannelName.valueOf("AGODA")).isEqualTo(ChannelName.AGODA);
            assertThat(ChannelName.valueOf("HOTELS_COM")).isEqualTo(ChannelName.HOTELS_COM);
            assertThat(ChannelName.valueOf("DIRECT")).isEqualTo(ChannelName.DIRECT);
            assertThat(ChannelName.valueOf("OTHER")).isEqualTo(ChannelName.OTHER);
        }
    }

    @Nested
    @DisplayName("SyncDirection enum")
    class SyncDirectionTest {
        @Test void allValues() {
            assertThat(SyncDirection.values()).hasSize(2);
            assertThat(SyncDirection.valueOf("INBOUND")).isEqualTo(SyncDirection.INBOUND);
            assertThat(SyncDirection.valueOf("OUTBOUND")).isEqualTo(SyncDirection.OUTBOUND);
        }
    }

    @Nested
    @DisplayName("ChannelConnection")
    class ChannelConnectionTest {
        @Test void defaultConstructor() {
            ChannelConnection cc = new ChannelConnection();
            assertThat(cc.getStatus()).isEqualTo(ChannelConnection.ConnectionStatus.ACTIVE);
        }
        @Test void parameterizedConstructor() {
            ChannelConnection cc = new ChannelConnection(1L, ChannelName.AIRBNB);
            assertThat(cc.getOrganizationId()).isEqualTo(1L);
            assertThat(cc.getChannel()).isEqualTo(ChannelName.AIRBNB);
        }
        @Test void isActive() {
            ChannelConnection cc = new ChannelConnection();
            assertThat(cc.isActive()).isTrue();
            cc.setStatus(ChannelConnection.ConnectionStatus.INACTIVE);
            assertThat(cc.isActive()).isFalse();
        }
        @Test void setters() {
            ChannelConnection cc = new ChannelConnection();
            cc.setId(1L);
            cc.setOrganizationId(2L);
            cc.setChannel(ChannelName.BOOKING);
            cc.setStatus(ChannelConnection.ConnectionStatus.ERROR);
            cc.setCredentialsRef("cred-ref");
            cc.setWebhookUrl("https://hook.com");
            cc.setSyncConfig("{\"auto\":true}");
            cc.setLastSyncAt(LocalDateTime.now());
            cc.setLastError("Timeout");
            assertThat(cc.getId()).isEqualTo(1L);
            assertThat(cc.getChannel()).isEqualTo(ChannelName.BOOKING);
            assertThat(cc.getCredentialsRef()).isEqualTo("cred-ref");
            assertThat(cc.getWebhookUrl()).isEqualTo("https://hook.com");
            assertThat(cc.getSyncConfig()).isEqualTo("{\"auto\":true}");
            assertThat(cc.getLastError()).isEqualTo("Timeout");
        }
        @Test void toStringTest() {
            ChannelConnection cc = new ChannelConnection(1L, ChannelName.ICAL);
            assertThat(cc.toString()).contains("ChannelConnection");
        }
    }

    @Nested
    @DisplayName("ChannelMapping")
    class ChannelMappingTest {
        @Test void defaultConstructor() {
            ChannelMapping cm = new ChannelMapping();
            assertThat(cm.getEntityType()).isEqualTo("PROPERTY");
            assertThat(cm.isSyncEnabled()).isTrue();
        }
        @Test void parameterizedConstructor() {
            ChannelConnection conn = new ChannelConnection(1L, ChannelName.AIRBNB);
            ChannelMapping cm = new ChannelMapping(conn, 42L, "ext-123", 1L);
            assertThat(cm.getConnection()).isEqualTo(conn);
            assertThat(cm.getInternalId()).isEqualTo(42L);
            assertThat(cm.getExternalId()).isEqualTo("ext-123");
            assertThat(cm.getOrganizationId()).isEqualTo(1L);
        }
        @Test void setters() {
            ChannelMapping cm = new ChannelMapping();
            cm.setId(1L);
            cm.setEntityType("RESERVATION");
            cm.setInternalId(10L);
            cm.setExternalId("ext-1");
            cm.setMappingConfig("{\"key\":\"val\"}");
            cm.setSyncEnabled(false);
            cm.setLastSyncAt(LocalDateTime.now());
            cm.setLastSyncStatus("SUCCESS");
            cm.setOrganizationId(5L);
            assertThat(cm.getId()).isEqualTo(1L);
            assertThat(cm.getEntityType()).isEqualTo("RESERVATION");
            assertThat(cm.getInternalId()).isEqualTo(10L);
            assertThat(cm.getExternalId()).isEqualTo("ext-1");
            assertThat(cm.getMappingConfig()).isEqualTo("{\"key\":\"val\"}");
            assertThat(cm.isSyncEnabled()).isFalse();
            assertThat(cm.getLastSyncStatus()).isEqualTo("SUCCESS");
        }
        @Test void toStringTest() {
            ChannelMapping cm = new ChannelMapping();
            cm.setExternalId("ext-1");
            assertThat(cm.toString()).contains("ChannelMapping");
        }
    }

    @Nested
    @DisplayName("ChannelSyncLog")
    class ChannelSyncLogTest {
        @Test void defaultConstructor() {
            ChannelSyncLog log = new ChannelSyncLog();
            assertThat(log.getId()).isNull();
        }
        @Test void parameterizedConstructor() {
            ChannelConnection conn = new ChannelConnection(1L, ChannelName.AIRBNB);
            ChannelSyncLog log = new ChannelSyncLog(1L, conn, SyncDirection.INBOUND, "RESERVATION_SYNC", "SUCCESS");
            assertThat(log.getOrganizationId()).isEqualTo(1L);
            assertThat(log.getConnection()).isEqualTo(conn);
            assertThat(log.getDirection()).isEqualTo(SyncDirection.INBOUND);
            assertThat(log.getEventType()).isEqualTo("RESERVATION_SYNC");
            assertThat(log.getStatus()).isEqualTo("SUCCESS");
        }
        @Test void setters() {
            ChannelSyncLog log = new ChannelSyncLog();
            log.setId(1L);
            log.setOrganizationId(2L);
            ChannelMapping mapping = new ChannelMapping();
            log.setMapping(mapping);
            log.setDirection(SyncDirection.OUTBOUND);
            log.setEventType("CALENDAR_PUSH");
            log.setStatus("FAILED");
            log.setDetails("Some details");
            log.setErrorMessage("Timeout");
            log.setDurationMs(1500);
            assertThat(log.getId()).isEqualTo(1L);
            assertThat(log.getOrganizationId()).isEqualTo(2L);
            assertThat(log.getMapping()).isEqualTo(mapping);
            assertThat(log.getDirection()).isEqualTo(SyncDirection.OUTBOUND);
            assertThat(log.getEventType()).isEqualTo("CALENDAR_PUSH");
            assertThat(log.getStatus()).isEqualTo("FAILED");
            assertThat(log.getDetails()).isEqualTo("Some details");
            assertThat(log.getErrorMessage()).isEqualTo("Timeout");
            assertThat(log.getDurationMs()).isEqualTo(1500);
        }
    }

    @Nested
    @DisplayName("ChannelCalendarDay record")
    class ChannelCalendarDayTest {
        @Test void recordAccessors() {
            ChannelCalendarDay day = new ChannelCalendarDay(LocalDate.of(2026, 3, 1), "BOOKED", "ext-123");
            assertThat(day.date()).isEqualTo(LocalDate.of(2026, 3, 1));
            assertThat(day.status()).isEqualTo("BOOKED");
            assertThat(day.externalId()).isEqualTo("ext-123");
        }
        @Test void recordWithNullExternalId() {
            ChannelCalendarDay day = new ChannelCalendarDay(LocalDate.of(2026, 3, 1), "AVAILABLE", null);
            assertThat(day.externalId()).isNull();
        }
    }
}
