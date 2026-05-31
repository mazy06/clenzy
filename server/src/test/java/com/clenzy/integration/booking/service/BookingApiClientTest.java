package com.clenzy.integration.booking.service;

import com.clenzy.integration.booking.config.BookingConfig;
import com.clenzy.integration.booking.dto.BookingCalendarEventDto;
import com.clenzy.integration.booking.dto.BookingRateDto;
import com.clenzy.integration.booking.dto.BookingReservationDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires de {@link BookingApiClient}.
 * Mocke {@link RestTemplate} pour eviter tout appel reseau et capture les payloads
 * envoyes a l'API XML Booking.com pour verifier les requetes OTA.
 */
@ExtendWith(MockitoExtension.class)
class BookingApiClientTest {

    @Mock private BookingConfig config;
    @Mock private RestTemplate restTemplate;

    private BookingApiClient client;

    private static final String API_URL = "https://supply-xml.booking.com/hotels/xml";
    private static final String HOTEL_ID = "12345";

    @BeforeEach
    void setUp() {
        lenient().when(config.getApiBaseUrl()).thenReturn(API_URL);
        lenient().when(config.getUsername()).thenReturn("user");
        lenient().when(config.getPassword()).thenReturn("pass");
        client = new BookingApiClient(config, restTemplate);
    }

    private void stubExchange(String responseBody, HttpStatus status) {
        when(restTemplate.exchange(eq(API_URL), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(responseBody, status));
    }

    // ───────────────────── getAvailability ──────────────────────────────────────

    @Nested
    @DisplayName("getAvailability")
    class GetAvailability {

        @Test
        @DisplayName("parses AvailStatusMessage response into events")
        void parsesAvailStatusMessageResponse() {
            String xml = """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <OTA_HotelAvailGetRS xmlns="http://www.opentravel.org/OTA/2003/05">
                        <AvailStatusMessages HotelCode="12345">
                            <AvailStatusMessage>
                                <StatusApplicationControl Start="2026-07-01" End="2026-07-02" InvTypeCode="DBL"/>
                                <LengthsOfStay>
                                    <LengthOfStay MinMaxMessageType="SetMinLOS" Time="2"/>
                                    <LengthOfStay MinMaxMessageType="SetMaxLOS" Time="14"/>
                                </LengthsOfStay>
                                <RestrictionStatus Status="Open" Status2="Open" Restriction="Arrival"/>
                            </AvailStatusMessage>
                        </AvailStatusMessages>
                    </OTA_HotelAvailGetRS>
                    """;
            stubExchange(xml, HttpStatus.OK);

            List<BookingCalendarEventDto> events =
                    client.getAvailability(HOTEL_ID, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 5));

            assertThat(events).hasSize(1);
            BookingCalendarEventDto e = events.get(0);
            assertThat(e.hotelId()).isEqualTo(HOTEL_ID);
            assertThat(e.roomId()).isEqualTo("DBL");
            assertThat(e.date()).isEqualTo(LocalDate.of(2026, 7, 1));
            assertThat(e.minStay()).isEqualTo(2);
            assertThat(e.maxStay()).isEqualTo(14);
            assertThat(e.closedOnArrival()).isFalse();
            assertThat(e.closedOnDeparture()).isFalse();
        }

        @Test
        @DisplayName("parses Closed availability with restrictions")
        void parsesClosedStatus() {
            String xml = """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <OTA_HotelAvailGetRS xmlns="http://www.opentravel.org/OTA/2003/05">
                        <AvailStatusMessages HotelCode="12345">
                            <AvailStatusMessage>
                                <StatusApplicationControl Start="2026-08-01" End="2026-08-02" InvTypeCode="STD"/>
                                <RestrictionStatus Status="Close" Status2="Close" Restriction="Arrival"/>
                            </AvailStatusMessage>
                        </AvailStatusMessages>
                    </OTA_HotelAvailGetRS>
                    """;
            stubExchange(xml, HttpStatus.OK);

            List<BookingCalendarEventDto> events =
                    client.getAvailability(HOTEL_ID, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 2));

            assertThat(events).hasSize(1);
            assertThat(events.get(0).closedOnArrival()).isTrue();
            assertThat(events.get(0).closedOnDeparture()).isTrue();
            assertThat(events.get(0).available()).isFalse();
        }

        @Test
        @DisplayName("parses RoomStays response (OTA_HotelAvailRS variant)")
        void parsesRoomStaysResponse() {
            String xml = """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <OTA_HotelAvailRS xmlns="http://www.opentravel.org/OTA/2003/05">
                        <RoomStays>
                            <RoomStay>
                                <RoomTypes><RoomType RoomTypeCode="STD"/></RoomTypes>
                                <RoomRates>
                                    <RoomRate>
                                        <Rates>
                                            <Rate EffectiveDate="2026-07-01" ExpireDate="2026-07-02">
                                                <Base AmountAfterTax="99.99" CurrencyCode="EUR"/>
                                            </Rate>
                                        </Rates>
                                    </RoomRate>
                                </RoomRates>
                            </RoomStay>
                        </RoomStays>
                    </OTA_HotelAvailRS>
                    """;
            stubExchange(xml, HttpStatus.OK);

            List<BookingCalendarEventDto> events =
                    client.getAvailability(HOTEL_ID, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 2));

            assertThat(events).hasSize(1);
            assertThat(events.get(0).price()).isEqualByComparingTo("99.99");
            assertThat(events.get(0).currency()).isEqualTo("EUR");
            assertThat(events.get(0).roomId()).isEqualTo("STD");
        }

        @Test
        @DisplayName("returns empty list on OTA Error response")
        void returnsEmptyOnOtaError() {
            String xml = """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <OTA_HotelAvailGetRS xmlns="http://www.opentravel.org/OTA/2003/05">
                        <Errors>
                            <Error Code="123" ShortText="Bad credentials">Forbidden</Error>
                        </Errors>
                    </OTA_HotelAvailGetRS>
                    """;
            stubExchange(xml, HttpStatus.OK);

            List<BookingCalendarEventDto> events =
                    client.getAvailability(HOTEL_ID, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 2));

            assertThat(events).isEmpty();
        }

        @Test
        @DisplayName("returns empty list on empty response body")
        void returnsEmptyOnEmptyResponse() {
            stubExchange("", HttpStatus.OK);
            List<BookingCalendarEventDto> events =
                    client.getAvailability(HOTEL_ID, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 2));
            assertThat(events).isEmpty();
        }

        @Test
        @DisplayName("returns empty list on malformed XML")
        void returnsEmptyOnMalformedXml() {
            stubExchange("<not really xml<<<", HttpStatus.OK);
            List<BookingCalendarEventDto> events =
                    client.getAvailability(HOTEL_ID, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 2));
            assertThat(events).isEmpty();
        }

        @Test
        @DisplayName("propagates RestClientException from HTTP layer")
        void propagatesHttpException() {
            when(restTemplate.exchange(anyApiUrl(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                    .thenThrow(new RestClientException("connection refused"));

            assertThatThrownBy(() -> client.getAvailability(HOTEL_ID,
                    LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 2)))
                    .isInstanceOf(RestClientException.class);
        }

        @Test
        @DisplayName("returns null body on non-2xx status (sendXmlRequest)")
        void onNon2xxReturnsNullBody() {
            // The service code logs an error and returns null on non-2xx;
            // the parser then receives null and returns an empty list.
            when(restTemplate.exchange(eq(API_URL), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(new ResponseEntity<>("body-ignored", HttpStatus.MOVED_PERMANENTLY));

            List<BookingCalendarEventDto> events =
                    client.getAvailability(HOTEL_ID, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 2));
            assertThat(events).isEmpty();
        }

        @Test
        @DisplayName("propagates 401 Unauthorized error")
        void propagates401() {
            when(restTemplate.exchange(eq(API_URL), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                    .thenThrow(HttpClientErrorException.create(HttpStatus.UNAUTHORIZED,
                            "Unauthorized", null, null, null));

            assertThatThrownBy(() -> client.getAvailability(HOTEL_ID,
                    LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 2)))
                    .isInstanceOf(HttpClientErrorException.class);
        }

        @Test
        @DisplayName("propagates 500 Server error")
        void propagates500() {
            when(restTemplate.exchange(eq(API_URL), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                    .thenThrow(HttpServerErrorException.create(HttpStatus.INTERNAL_SERVER_ERROR,
                            "boom", null, null, null));

            assertThatThrownBy(() -> client.getAvailability(HOTEL_ID,
                    LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 2)))
                    .isInstanceOf(HttpServerErrorException.class);
        }

        @Test
        @DisplayName("captures correct XML payload (HotelCode + StayDateRange)")
        void capturesPayload() {
            stubExchange("<OTA_HotelAvailRS/>", HttpStatus.OK);
            client.getAvailability(HOTEL_ID, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 5));

            ArgumentCaptor<HttpEntity<String>> captor = newHttpEntityCaptor();
            verify(restTemplate).exchange(eq(API_URL), eq(HttpMethod.POST), captor.capture(), eq(String.class));
            String payload = captor.getValue().getBody();
            assertThat(payload).contains("OTA_HotelAvailRQ");
            assertThat(payload).contains("HotelCode=\"" + HOTEL_ID + "\"");
            assertThat(payload).contains("Start=\"2026-07-01\"");
            assertThat(payload).contains("End=\"2026-07-05\"");
            // Basic auth header should be present
            assertThat(captor.getValue().getHeaders().getFirst("Authorization")).startsWith("Basic ");
        }
    }

    // ───────────────────── updateAvailability ───────────────────────────────────

    @Nested
    @DisplayName("updateAvailability")
    class UpdateAvailability {

        @Test
        @DisplayName("returns true on success XML response")
        void returnsTrueOnSuccess() {
            stubExchange("<OTA_HotelAvailNotifRS><Success/></OTA_HotelAvailNotifRS>", HttpStatus.OK);

            BookingCalendarEventDto event = new BookingCalendarEventDto(
                    HOTEL_ID, "DBL", LocalDate.of(2026, 7, 1),
                    true, BigDecimal.ZERO, "EUR", 2, 14, false, false);

            assertThat(client.updateAvailability(List.of(event))).isTrue();
        }

        @Test
        @DisplayName("returns false on response without <Success>")
        void returnsFalseOnNoSuccess() {
            stubExchange("<OTA_HotelAvailNotifRS><Errors><Error/></Errors></OTA_HotelAvailNotifRS>", HttpStatus.OK);
            BookingCalendarEventDto event = new BookingCalendarEventDto(
                    HOTEL_ID, "DBL", LocalDate.of(2026, 7, 1),
                    true, BigDecimal.ZERO, "EUR", 1, 365, false, false);

            assertThat(client.updateAvailability(List.of(event))).isFalse();
        }

        @Test
        @DisplayName("returns true and skips HTTP call when events empty")
        void emptyListIsTrueWithoutCall() {
            assertThat(client.updateAvailability(List.of())).isTrue();
            verifyNoInteractions(restTemplate);
        }

        @Test
        @DisplayName("captures XML containing AvailStatusMessage per event")
        void capturesAvailStatusMessage() {
            stubExchange("<Success/>", HttpStatus.OK);
            BookingCalendarEventDto e1 = new BookingCalendarEventDto(
                    HOTEL_ID, "DBL", LocalDate.of(2026, 7, 1),
                    true, BigDecimal.ZERO, "EUR", 2, 14, true, false);
            BookingCalendarEventDto e2 = new BookingCalendarEventDto(
                    HOTEL_ID, "SGL", LocalDate.of(2026, 7, 2),
                    true, BigDecimal.ZERO, "EUR", 1, 30, false, true);

            client.updateAvailability(List.of(e1, e2));

            ArgumentCaptor<HttpEntity<String>> captor = newHttpEntityCaptor();
            verify(restTemplate).exchange(eq(API_URL), eq(HttpMethod.POST), captor.capture(), eq(String.class));
            String payload = captor.getValue().getBody();
            assertThat(payload).contains("OTA_HotelAvailNotifRQ");
            assertThat(payload).contains("AvailStatusMessage").contains("InvTypeCode=\"DBL\"");
            assertThat(payload).contains("InvTypeCode=\"SGL\"");
            // Closed on arrival → Status="Close"
            assertThat(payload).contains("Status=\"Close\"");
        }

        @Test
        @DisplayName("propagates HTTP exception")
        void propagatesException() {
            when(restTemplate.exchange(eq(API_URL), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                    .thenThrow(new RestClientException("network down"));

            BookingCalendarEventDto event = new BookingCalendarEventDto(
                    HOTEL_ID, "DBL", LocalDate.of(2026, 7, 1),
                    true, BigDecimal.ZERO, "EUR", 1, 1, false, false);

            assertThatThrownBy(() -> client.updateAvailability(List.of(event)))
                    .isInstanceOf(RestClientException.class);
        }
    }

    // ───────────────────── updateRates ──────────────────────────────────────────

    @Nested
    @DisplayName("updateRates")
    class UpdateRates {

        @Test
        @DisplayName("returns true on success")
        void returnsTrueOnSuccess() {
            stubExchange("<OTA_HotelRatePlanNotifRS><Success/></OTA_HotelRatePlanNotifRS>", HttpStatus.OK);

            BookingRateDto rate = new BookingRateDto(
                    "DBL", LocalDate.of(2026, 7, 1), new BigDecimal("120.00"),
                    "EUR", "rate-1", "RACK", 1, null);
            assertThat(client.updateRates(List.of(rate))).isTrue();
        }

        @Test
        @DisplayName("returns false on no-Success response")
        void returnsFalseOnFailure() {
            stubExchange("<RatePlan></RatePlan>", HttpStatus.OK);
            BookingRateDto rate = new BookingRateDto(
                    "DBL", LocalDate.of(2026, 7, 1), new BigDecimal("99.00"),
                    "EUR", "rate-1", "BAR", 1, null);
            assertThat(client.updateRates(List.of(rate))).isFalse();
        }

        @Test
        @DisplayName("empty list returns true without HTTP")
        void emptyListIsTrueWithoutCall() {
            assertThat(client.updateRates(List.of())).isTrue();
            verifyNoInteractions(restTemplate);
        }

        @Test
        @DisplayName("captures XML with rate plan, room code, price, currency")
        void capturesPayload() {
            stubExchange("<Success/>", HttpStatus.OK);
            BookingRateDto rate = new BookingRateDto(
                    "STD", LocalDate.of(2026, 7, 1), new BigDecimal("199.99"),
                    "EUR", "rate-1", "BAR", 1, null);
            client.updateRates(List.of(rate));

            ArgumentCaptor<HttpEntity<String>> captor = newHttpEntityCaptor();
            verify(restTemplate).exchange(eq(API_URL), eq(HttpMethod.POST), captor.capture(), eq(String.class));
            String payload = captor.getValue().getBody();
            assertThat(payload).contains("OTA_HotelRatePlanNotifRQ");
            assertThat(payload).contains("RatePlanCode=\"BAR\"");
            assertThat(payload).contains("InvTypeCode=\"STD\"");
            assertThat(payload).contains("AmountAfterTax=\"199.99\"");
            assertThat(payload).contains("CurrencyCode=\"EUR\"");
        }
    }

    // ───────────────────── getReservations ──────────────────────────────────────

    @Nested
    @DisplayName("getReservations")
    class GetReservations {

        @Test
        @DisplayName("parses full reservation with guest, room, dates, price")
        void parsesFullReservation() {
            String xml = """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <OTA_ResRetrieveRS xmlns="http://www.opentravel.org/OTA/2003/05">
                        <ReservationsList>
                            <HotelReservation ResStatus="Commit" CreateDateTime="2026-01-15T10:00:00Z">
                                <UniqueID Type="14" ID="RES-123456789"/>
                                <RoomStays>
                                    <RoomStay>
                                        <TimeSpan Start="2026-02-01" End="2026-02-05"/>
                                        <RoomTypes><RoomType RoomTypeCode="DBL"/></RoomTypes>
                                        <Total AmountAfterTax="400.00" CurrencyCode="EUR"/>
                                    </RoomStay>
                                </RoomStays>
                                <ResGuests>
                                    <ResGuest>
                                        <Profiles>
                                            <ProfileInfo>
                                                <Profile>
                                                    <Customer>
                                                        <PersonName>
                                                            <GivenName>John</GivenName>
                                                            <Surname>Doe</Surname>
                                                        </PersonName>
                                                        <Email>john@example.com</Email>
                                                        <Telephone PhoneNumber="+33600000000"/>
                                                        <Address>
                                                            <CountryName Code="FR">France</CountryName>
                                                        </Address>
                                                    </Customer>
                                                </Profile>
                                            </ProfileInfo>
                                        </Profiles>
                                    </ResGuest>
                                </ResGuests>
                                <ResGlobalInfo>
                                    <GuestCounts><GuestCount Count="2"/></GuestCounts>
                                    <SpecialRequests>
                                        <SpecialRequest><Text>Late check-in</Text></SpecialRequest>
                                    </SpecialRequests>
                                </ResGlobalInfo>
                            </HotelReservation>
                        </ReservationsList>
                    </OTA_ResRetrieveRS>
                    """;
            stubExchange(xml, HttpStatus.OK);

            List<BookingReservationDto> reservations =
                    client.getReservations(HOTEL_ID, LocalDate.of(2026, 1, 1));

            assertThat(reservations).hasSize(1);
            BookingReservationDto r = reservations.get(0);
            assertThat(r.reservationId()).isEqualTo("RES-123456789");
            assertThat(r.hotelId()).isEqualTo(HOTEL_ID);
            assertThat(r.roomId()).isEqualTo("DBL");
            assertThat(r.guestName()).isEqualTo("John Doe");
            assertThat(r.guestEmail()).isEqualTo("john@example.com");
            assertThat(r.guestPhone()).isEqualTo("+33600000000");
            assertThat(r.checkIn()).isEqualTo(LocalDate.of(2026, 2, 1));
            assertThat(r.checkOut()).isEqualTo(LocalDate.of(2026, 2, 5));
            assertThat(r.status()).isEqualTo("CONFIRMED");
            assertThat(r.totalPrice()).isEqualByComparingTo("400.00");
            assertThat(r.currency()).isEqualTo("EUR");
            assertThat(r.numberOfGuests()).isEqualTo(2);
            assertThat(r.specialRequests()).isEqualTo("Late check-in");
            assertThat(r.bookerCountry()).isEqualTo("FR");
        }

        @Test
        @DisplayName("maps ResStatus 'Cancel' → CANCELLED")
        void mapsCancelStatus() {
            String xml = baseReservationXml("Cancel");
            stubExchange(xml, HttpStatus.OK);

            List<BookingReservationDto> rs = client.getReservations(HOTEL_ID, LocalDate.of(2026, 1, 1));
            assertThat(rs).hasSize(1);
            assertThat(rs.get(0).status()).isEqualTo("CANCELLED");
        }

        @Test
        @DisplayName("maps ResStatus 'Modify' → MODIFIED")
        void mapsModifyStatus() {
            String xml = baseReservationXml("Modify");
            stubExchange(xml, HttpStatus.OK);

            List<BookingReservationDto> rs = client.getReservations(HOTEL_ID, LocalDate.of(2026, 1, 1));
            assertThat(rs.get(0).status()).isEqualTo("MODIFIED");
        }

        @Test
        @DisplayName("maps unknown status to UPPERCASE")
        void mapsUnknownStatus() {
            String xml = baseReservationXml("Some-Other-Status");
            stubExchange(xml, HttpStatus.OK);

            List<BookingReservationDto> rs = client.getReservations(HOTEL_ID, LocalDate.of(2026, 1, 1));
            assertThat(rs.get(0).status()).isEqualTo("SOME-OTHER-STATUS");
        }

        @Test
        @DisplayName("returns empty when no reservations in response")
        void emptyOnNoReservations() {
            stubExchange("<OTA_ResRetrieveRS xmlns=\"http://www.opentravel.org/OTA/2003/05\"></OTA_ResRetrieveRS>",
                    HttpStatus.OK);
            assertThat(client.getReservations(HOTEL_ID, LocalDate.of(2026, 1, 1))).isEmpty();
        }

        @Test
        @DisplayName("returns empty on OTA error in response")
        void emptyOnError() {
            String xml = """
                    <OTA_ResRetrieveRS xmlns="http://www.opentravel.org/OTA/2003/05">
                        <Errors><Error Code="42" ShortText="bad"/></Errors>
                    </OTA_ResRetrieveRS>
                    """;
            stubExchange(xml, HttpStatus.OK);
            assertThat(client.getReservations(HOTEL_ID, LocalDate.of(2026, 1, 1))).isEmpty();
        }

        @Test
        @DisplayName("returns empty on empty body")
        void emptyOnEmptyBody() {
            stubExchange("", HttpStatus.OK);
            assertThat(client.getReservations(HOTEL_ID, LocalDate.of(2026, 1, 1))).isEmpty();
        }

        @Test
        @DisplayName("skips reservation missing check-in/check-out")
        void skipsWithoutDates() {
            String xml = """
                    <OTA_ResRetrieveRS xmlns="http://www.opentravel.org/OTA/2003/05">
                        <ReservationsList>
                            <HotelReservation ResStatus="Commit">
                                <UniqueID ID="X1"/>
                                <RoomStays>
                                    <RoomStay>
                                        <RoomTypes><RoomType RoomTypeCode="DBL"/></RoomTypes>
                                    </RoomStay>
                                </RoomStays>
                            </HotelReservation>
                        </ReservationsList>
                    </OTA_ResRetrieveRS>
                    """;
            stubExchange(xml, HttpStatus.OK);
            assertThat(client.getReservations(HOTEL_ID, LocalDate.of(2026, 1, 1))).isEmpty();
        }

        @Test
        @DisplayName("falls back to AmountBeforeTax when AmountAfterTax missing")
        void fallsBackToAmountBeforeTax() {
            String xml = """
                    <OTA_ResRetrieveRS xmlns="http://www.opentravel.org/OTA/2003/05">
                        <ReservationsList>
                            <HotelReservation ResStatus="Commit">
                                <UniqueID Type="14" ID="X1"/>
                                <RoomStays>
                                    <RoomStay>
                                        <TimeSpan Start="2026-02-01" End="2026-02-02"/>
                                        <RoomTypes><RoomType RoomTypeCode="DBL"/></RoomTypes>
                                        <Total AmountBeforeTax="80.00" CurrencyCode="USD"/>
                                    </RoomStay>
                                </RoomStays>
                            </HotelReservation>
                        </ReservationsList>
                    </OTA_ResRetrieveRS>
                    """;
            stubExchange(xml, HttpStatus.OK);

            List<BookingReservationDto> rs = client.getReservations(HOTEL_ID, LocalDate.of(2026, 1, 1));
            assertThat(rs.get(0).totalPrice()).isEqualByComparingTo("80.00");
            assertThat(rs.get(0).currency()).isEqualTo("USD");
        }

        @Test
        @DisplayName("captures correct read-request XML payload")
        void capturesPayload() {
            stubExchange("<OTA_ResRetrieveRS/>", HttpStatus.OK);
            client.getReservations(HOTEL_ID, LocalDate.of(2025, 12, 1));

            ArgumentCaptor<HttpEntity<String>> captor = newHttpEntityCaptor();
            verify(restTemplate).exchange(eq(API_URL), eq(HttpMethod.POST), captor.capture(), eq(String.class));
            String payload = captor.getValue().getBody();
            assertThat(payload).contains("OTA_ReadRQ");
            assertThat(payload).contains("HotelCode=\"" + HOTEL_ID + "\"");
            assertThat(payload).contains("Start=\"2025-12-01\"");
        }

        @Test
        @DisplayName("propagates HTTP exception")
        void propagatesException() {
            when(restTemplate.exchange(eq(API_URL), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                    .thenThrow(new RestClientException("boom"));
            assertThatThrownBy(() -> client.getReservations(HOTEL_ID, LocalDate.of(2026, 1, 1)))
                    .isInstanceOf(RestClientException.class);
        }
    }

    // ───────────────────── acknowledgeReservation ───────────────────────────────

    @Nested
    @DisplayName("acknowledgeReservation")
    class AcknowledgeReservation {

        @Test
        @DisplayName("returns true on success response")
        void returnsTrueOnSuccess() {
            stubExchange("<OTA_NotifReportRS><Success/></OTA_NotifReportRS>", HttpStatus.OK);
            assertThat(client.acknowledgeReservation("RES-123")).isTrue();
        }

        @Test
        @DisplayName("returns false when response has no Success element")
        void returnsFalseOnError() {
            stubExchange("<OTA_NotifReportRS><Errors><Error/></Errors></OTA_NotifReportRS>", HttpStatus.OK);
            assertThat(client.acknowledgeReservation("RES-123")).isFalse();
        }

        @Test
        @DisplayName("returns false on null body (handled by sendXmlRequest non-2xx path)")
        void returnsFalseOnNullBody() {
            when(restTemplate.exchange(eq(API_URL), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                    .thenReturn(new ResponseEntity<>(null, HttpStatus.NO_CONTENT));
            // 2xx but null body → success path returns null body → isSuccessResponse(null)=false
            assertThat(client.acknowledgeReservation("RES-123")).isFalse();
        }

        @Test
        @DisplayName("captures XML acknowledgment payload with reservation id")
        void capturesAckPayload() {
            stubExchange("<Success/>", HttpStatus.OK);
            client.acknowledgeReservation("RES-XYZ-99");

            ArgumentCaptor<HttpEntity<String>> captor = newHttpEntityCaptor();
            verify(restTemplate).exchange(eq(API_URL), eq(HttpMethod.POST), captor.capture(), eq(String.class));
            String payload = captor.getValue().getBody();
            assertThat(payload).contains("OTA_NotifReportRQ");
            assertThat(payload).contains("ResStatus=\"Commit\"");
            assertThat(payload).contains("UniqueID=\"RES-XYZ-99\"");
        }

        @Test
        @DisplayName("propagates HTTP exception")
        void propagatesException() {
            when(restTemplate.exchange(eq(API_URL), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                    .thenThrow(new RestClientException("kaboom"));
            assertThatThrownBy(() -> client.acknowledgeReservation("RES-1"))
                    .isInstanceOf(RestClientException.class);
        }
    }

    // ───────────────────── helpers ──────────────────────────────────────────────

    @SuppressWarnings({"unchecked", "rawtypes"})
    private ArgumentCaptor<HttpEntity<String>> newHttpEntityCaptor() {
        return (ArgumentCaptor) ArgumentCaptor.forClass(HttpEntity.class);
    }

    private String anyApiUrl() {
        return eq(API_URL);
    }

    private String baseReservationXml(String resStatus) {
        return """
                <OTA_ResRetrieveRS xmlns="http://www.opentravel.org/OTA/2003/05">
                    <ReservationsList>
                        <HotelReservation ResStatus="%s">
                            <UniqueID Type="14" ID="RES-1"/>
                            <RoomStays>
                                <RoomStay>
                                    <TimeSpan Start="2026-02-01" End="2026-02-02"/>
                                    <RoomTypes><RoomType RoomTypeCode="DBL"/></RoomTypes>
                                    <Total AmountAfterTax="100.00" CurrencyCode="EUR"/>
                                </RoomStay>
                            </RoomStays>
                        </HotelReservation>
                    </ReservationsList>
                </OTA_ResRetrieveRS>
                """.formatted(resStatus);
    }
}
