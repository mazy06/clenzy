package com.clenzy.integration.holidays;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class PublicHolidaysClientTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    @SuppressWarnings("unchecked")
    private RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
    @SuppressWarnings("unchecked")
    private ValueOperations<String, Object> valueOps = mock(ValueOperations.class);
    private PublicHolidaysClient client;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(anyString())).thenReturn(null);

        client = new PublicHolidaysClient(restTemplate, redisTemplate,
                "https://date.nager.at", true);
    }

    @Test
    void findInRange_parsesApiResponse_andFiltersWindow() {
        mockServer.expect(requestTo("https://date.nager.at/api/v3/PublicHolidays/2026/FR"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        [
                          {"date":"2026-01-01","localName":"Jour de l'an","name":"New Year's Day","countryCode":"FR"},
                          {"date":"2026-05-01","localName":"Fete du Travail","name":"Labour Day","countryCode":"FR"},
                          {"date":"2026-07-14","localName":"Fete Nationale","name":"Bastille Day","countryCode":"FR"}
                        ]
                        """, MediaType.APPLICATION_JSON));

        List<PublicHolidaysClient.PublicHoliday> holidays = client.findInRange(
                "FR", LocalDate.parse("2026-05-01"), LocalDate.parse("2026-08-31"));

        // Sur la fenetre, 2 sont attendus (mai + juillet) — janvier est exclu
        assertEquals(2, holidays.size());
        assertEquals("Fete du Travail", holidays.get(0).localName());
        assertEquals("Fete Nationale", holidays.get(1).localName());
        verify(valueOps).set(eq("events:holidays:FR:2026"), any(), eq(Duration.ofDays(7)));
        mockServer.verify();
    }

    @Test
    void findInRange_cacheHit_skipsHttp() {
        var cached = new PublicHolidaysClient.CachedHolidayList(List.of(
                new PublicHolidaysClient.PublicHoliday(
                        LocalDate.parse("2026-07-14"), "Fete Nat", "Bastille Day", "FR")
        ));
        when(valueOps.get("events:holidays:FR:2026")).thenReturn(cached);

        List<PublicHolidaysClient.PublicHoliday> holidays = client.findInRange(
                "FR", LocalDate.parse("2026-07-01"), LocalDate.parse("2026-07-31"));

        assertEquals(1, holidays.size());
        verify(valueOps, never()).set(anyString(), any(), any(Duration.class));
    }

    @Test
    void findInRange_spansMultipleYears_callsApiForEachYear() {
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("/2026/FR")))
                .andRespond(withSuccess("""
                        [{"date":"2026-12-25","localName":"Noel","name":"Christmas","countryCode":"FR"}]
                        """, MediaType.APPLICATION_JSON));
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("/2027/FR")))
                .andRespond(withSuccess("""
                        [{"date":"2027-01-01","localName":"Jour de l'an","name":"New Year","countryCode":"FR"}]
                        """, MediaType.APPLICATION_JSON));

        List<PublicHolidaysClient.PublicHoliday> holidays = client.findInRange(
                "FR", LocalDate.parse("2026-12-20"), LocalDate.parse("2027-01-05"));

        assertEquals(2, holidays.size());
        mockServer.verify();
    }

    @Test
    void findInRange_httpFailure_returnsEmpty_doesNotThrow() {
        mockServer.expect(requestTo(org.hamcrest.Matchers.startsWith("https://")))
                .andRespond(withServerError());

        assertDoesNotThrow(() -> {
            List<PublicHolidaysClient.PublicHoliday> holidays = client.findInRange(
                    "FR", LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31"));
            assertTrue(holidays.isEmpty());
        });
    }

    @Test
    void disabled_returnsEmptyWithoutHttp() {
        PublicHolidaysClient disabled = new PublicHolidaysClient(restTemplate, redisTemplate,
                "https://date.nager.at", false);

        List<PublicHolidaysClient.PublicHoliday> holidays = disabled.findInRange(
                "FR", LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31"));

        assertTrue(holidays.isEmpty());
        assertFalse(disabled.isEnabled());
        // Aucune interaction Redis ni HTTP
        verifyNoInteractions(valueOps);
    }

    @Test
    void invalidCountryCode_returnsEmpty() {
        assertTrue(client.findInRange(null, LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31")).isEmpty());
        assertTrue(client.findInRange("FRANCE", LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31")).isEmpty());
        assertTrue(client.findInRange("", LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31")).isEmpty());
    }

    @Test
    void invertedDateRange_returnsEmpty() {
        assertTrue(client.findInRange("FR",
                LocalDate.parse("2026-12-31"), LocalDate.parse("2026-01-01")).isEmpty());
    }
}
