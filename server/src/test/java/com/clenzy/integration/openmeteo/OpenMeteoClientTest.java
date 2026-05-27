package com.clenzy.integration.openmeteo;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

class OpenMeteoClientTest {

    private static final Instant T0 = Instant.parse("2026-05-26T08:00:00Z");

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    @SuppressWarnings("unchecked")
    private RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
    @SuppressWarnings("unchecked")
    private ValueOperations<String, Object> valueOps = mock(ValueOperations.class);
    private Clock clock;
    private OpenMeteoClient client;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        clock = Clock.fixed(T0, ZoneId.of("UTC"));

        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(anyString())).thenReturn(null);

        client = new OpenMeteoClient(
                restTemplate, redisTemplate, clock,
                "https://geocoding-api.open-meteo.com",
                "https://api.open-meteo.com");
    }

    // ─── geocode ────────────────────────────────────────────────────────────

    @Test
    void geocode_returnsCoords_andWritesCacheSnapshot_withStaleTtl() {
        mockServer.expect(requestTo("https://geocoding-api.open-meteo.com/v1/search?name=Paris&count=1&language=fr&format=json"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {
                          "results": [
                            {"name":"Paris","latitude":48.8566,"longitude":2.3522,"country_code":"FR"}
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        Optional<OpenMeteoClient.GeoCoord> coord = client.geocode("Paris");

        assertTrue(coord.isPresent());
        assertEquals(48.8566, coord.get().latitude(), 0.0001);
        assertEquals("FR", coord.get().countryCode());

        // Cache write : CachedSnapshot + TTL 24h (le SWR garde la valeur en "stale" jusqu'a 24h)
        verify(valueOps).set(eq("weather:geocode:paris"),
                any(OpenMeteoClient.CachedSnapshot.class),
                eq(Duration.ofHours(24)));
        mockServer.verify();
    }

    @Test
    void geocode_freshCacheHit_skipsHttpCall() {
        var cached = new OpenMeteoClient.CachedSnapshot<>(
                new OpenMeteoClient.GeoCoord(48.0, 2.0, "Paris", "FR"),
                T0.toEpochMilli()); // age = 0 → fresh
        when(valueOps.get("weather:geocode:paris")).thenReturn(cached);

        Optional<OpenMeteoClient.GeoCoord> coord = client.geocode("Paris");

        assertTrue(coord.isPresent());
        assertEquals(48.0, coord.get().latitude());
        verify(valueOps, never()).set(anyString(), any(), any(Duration.class));
    }

    @Test
    void geocode_staleCache_revalidatesViaHttp() {
        var staleCoord = new OpenMeteoClient.GeoCoord(48.0, 2.0, "Paris", "FR");
        var cached = new OpenMeteoClient.CachedSnapshot<>(
                staleCoord, T0.minusSeconds(7200).toEpochMilli()); // 2h ago → stale
        when(valueOps.get("weather:geocode:paris")).thenReturn(cached);

        mockServer.expect(requestTo(org.hamcrest.Matchers.startsWith("https://")))
                .andRespond(withSuccess("""
                        {"results":[{"name":"Paris","latitude":48.85,"longitude":2.35,"country_code":"FR"}]}
                        """, MediaType.APPLICATION_JSON));

        Optional<OpenMeteoClient.GeoCoord> coord = client.geocode("Paris");

        assertTrue(coord.isPresent());
        // Re-fetched : nouveau lat 48.85, pas la valeur stale 48.0
        assertEquals(48.85, coord.get().latitude(), 0.001);
        mockServer.verify();
    }

    @Test
    void geocode_httpFailure_fallsBackToStaleCache() {
        var staleCoord = new OpenMeteoClient.GeoCoord(48.99, 2.99, "Paris", "FR");
        var cached = new OpenMeteoClient.CachedSnapshot<>(
                staleCoord, T0.minusSeconds(7200).toEpochMilli());
        when(valueOps.get("weather:geocode:paris")).thenReturn(cached);

        mockServer.expect(requestTo(org.hamcrest.Matchers.startsWith("https://")))
                .andRespond(withServerError());

        Optional<OpenMeteoClient.GeoCoord> coord = client.geocode("Paris");

        // HTTP fail mais cache stale dispo → on renvoie le stale
        assertTrue(coord.isPresent());
        assertEquals(48.99, coord.get().latitude(), 0.001);
        mockServer.verify();
    }

    @Test
    void geocode_httpFailure_andNoCachedValue_returnsEmpty() {
        mockServer.expect(requestTo(org.hamcrest.Matchers.startsWith("https://")))
                .andRespond(withServerError());

        assertTrue(client.geocode("Paris").isEmpty());
        mockServer.verify();
    }

    @Test
    void geocode_noResults_returnsEmpty() {
        mockServer.expect(requestTo(org.hamcrest.Matchers.startsWith("https://")))
                .andRespond(withSuccess("{\"results\":[]}", MediaType.APPLICATION_JSON));

        assertTrue(client.geocode("VilleInconnue").isEmpty());
        mockServer.verify();
    }

    @Test
    void geocode_blankInput_returnsEmptyWithoutHttp() {
        assertTrue(client.geocode("").isEmpty());
        assertTrue(client.geocode("  ").isEmpty());
        assertTrue(client.geocode(null).isEmpty());
        verify(valueOps, never()).get(anyString());
    }

    // ─── forecast ───────────────────────────────────────────────────────────

    @Test
    void forecast_parsesDailyArrays_andWritesSnapshot() {
        OpenMeteoClient.GeoCoord paris = new OpenMeteoClient.GeoCoord(
                48.8566, 2.3522, "Paris", "FR");

        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("/v1/forecast")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {
                          "daily": {
                            "time": ["2026-05-26","2026-05-27","2026-05-28"],
                            "temperature_2m_max": [22.3, 19.5, 18.0],
                            "temperature_2m_min": [12.1, 11.0, 10.5],
                            "precipitation_sum": [0.0, 5.2, 12.5],
                            "weathercode": [0, 61, 80]
                          }
                        }
                        """, MediaType.APPLICATION_JSON));

        Optional<OpenMeteoClient.ForecastSnapshot> snap = client.forecast(paris, 3);

        assertTrue(snap.isPresent());
        assertFalse(snap.get().stale());
        assertEquals(3, snap.get().items().size());

        OpenMeteoClient.DailyForecast d0 = snap.get().items().get(0);
        assertEquals("2026-05-26", d0.date().toString());
        assertEquals(22.3, d0.tempMax(), 0.001);
        assertEquals(0, d0.weatherCode());

        // Cache write avec stale TTL = 24h
        verify(valueOps).set(eq("weather:forecast:48.8566:2.3522:3"),
                any(OpenMeteoClient.CachedSnapshot.class),
                eq(Duration.ofHours(24)));
        mockServer.verify();
    }

    @Test
    void forecast_clampsDaysBetween1And7() {
        OpenMeteoClient.GeoCoord paris = new OpenMeteoClient.GeoCoord(
                48.8566, 2.3522, "Paris", "FR");

        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("forecast_days=7")))
                .andRespond(withSuccess("""
                        {"daily":{"time":[],"temperature_2m_max":[],"temperature_2m_min":[],
                                  "precipitation_sum":[],"weathercode":[]}}
                        """, MediaType.APPLICATION_JSON));

        client.forecast(paris, 99);

        verify(valueOps).set(eq("weather:forecast:48.8566:2.3522:7"),
                any(OpenMeteoClient.CachedSnapshot.class),
                eq(Duration.ofHours(24)));
    }

    @Test
    void forecast_nullCoord_returnsEmpty() {
        assertTrue(client.forecast(null, 5).isEmpty());
        verifyNoInteractions(valueOps);
    }

    @Test
    void forecast_httpFailure_andNoCachedValue_returnsEmpty() {
        OpenMeteoClient.GeoCoord paris = new OpenMeteoClient.GeoCoord(
                48.0, 2.0, "Paris", "FR");
        mockServer.expect(requestTo(org.hamcrest.Matchers.startsWith("https://")))
                .andRespond(withServerError());

        assertTrue(client.forecast(paris, 5).isEmpty());
        mockServer.verify();
    }

    @Test
    void forecast_httpFailure_returnsStaleSnapshot_withFlag() {
        OpenMeteoClient.GeoCoord paris = new OpenMeteoClient.GeoCoord(
                48.0, 2.0, "Paris", "FR");

        // Cache stale (3h old)
        var cachedResponse = new OpenMeteoClient.ForecastResponse();
        cachedResponse.daily = new OpenMeteoClient.Daily();
        cachedResponse.daily.time = java.util.List.of("2026-05-26");
        cachedResponse.daily.temperature_2m_max = java.util.List.of(20.0);
        cachedResponse.daily.temperature_2m_min = java.util.List.of(10.0);
        cachedResponse.daily.precipitation_sum = java.util.List.of(0.0);
        cachedResponse.daily.weathercode = java.util.List.of(0);
        var cached = new OpenMeteoClient.CachedSnapshot<>(
                cachedResponse, T0.minusSeconds(10800).toEpochMilli());
        when(valueOps.get("weather:forecast:48.0:2.0:5")).thenReturn(cached);

        mockServer.expect(requestTo(org.hamcrest.Matchers.startsWith("https://")))
                .andRespond(withServerError());

        Optional<OpenMeteoClient.ForecastSnapshot> snap = client.forecast(paris, 5);

        assertTrue(snap.isPresent());
        // Le flag stale doit etre vrai pour signaler au caller que c'est cache
        assertTrue(snap.get().stale(), "snapshot must be flagged stale");
        assertEquals(1, snap.get().items().size());
        assertEquals(20.0, snap.get().items().get(0).tempMax(), 0.001);
        mockServer.verify();
    }

    @Test
    void forecast_freshCacheHit_returnsNonStaleSnapshot_andSkipsHttp() {
        OpenMeteoClient.GeoCoord paris = new OpenMeteoClient.GeoCoord(48.0, 2.0, "Paris", "FR");
        var fresh = new OpenMeteoClient.ForecastResponse();
        fresh.daily = new OpenMeteoClient.Daily();
        fresh.daily.time = java.util.List.of("2026-05-26");
        fresh.daily.temperature_2m_max = java.util.List.of(25.0);
        fresh.daily.temperature_2m_min = java.util.List.of(15.0);
        fresh.daily.precipitation_sum = java.util.List.of(0.0);
        fresh.daily.weathercode = java.util.List.of(0);
        var cached = new OpenMeteoClient.CachedSnapshot<>(fresh, T0.toEpochMilli());
        when(valueOps.get("weather:forecast:48.0:2.0:5")).thenReturn(cached);

        Optional<OpenMeteoClient.ForecastSnapshot> snap = client.forecast(paris, 5);

        assertTrue(snap.isPresent());
        assertFalse(snap.get().stale());
        assertEquals(25.0, snap.get().items().get(0).tempMax(), 0.001);
        verify(valueOps, never()).set(anyString(), any(), any(Duration.class));
    }

    @Test
    void serializerSanity_objectMapperCanRoundtripDtos() throws Exception {
        ObjectMapper om = new ObjectMapper().findAndRegisterModules();
        var coord = new OpenMeteoClient.GeoCoord(48.0, 2.0, "Paris", "FR");
        String json = om.writeValueAsString(coord);
        var back = om.readValue(json, OpenMeteoClient.GeoCoord.class);
        assertEquals(coord, back);
    }
}
