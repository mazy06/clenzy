package com.clenzy.integration.openmeteo;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;
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

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    @SuppressWarnings("unchecked")
    private RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
    @SuppressWarnings("unchecked")
    private ValueOperations<String, Object> valueOps = mock(ValueOperations.class);
    private OpenMeteoClient client;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);

        // RedisTemplate cache miss par defaut, write no-op
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(anyString())).thenReturn(null);

        client = new OpenMeteoClient(
                restTemplate, redisTemplate,
                "https://geocoding-api.open-meteo.com",
                "https://api.open-meteo.com");
    }

    @Test
    void geocode_returnsCoords_andWritesCache() {
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
        assertEquals(2.3522, coord.get().longitude(), 0.0001);
        assertEquals("Paris", coord.get().resolvedName());
        assertEquals("FR", coord.get().countryCode());

        // Cache write : verify TTL 1h
        verify(valueOps).set(eq("weather:geocode:paris"), any(),
                eq(Duration.ofHours(1)));
        mockServer.verify();
    }

    @Test
    void geocode_cacheHit_skipsHttpCall() {
        OpenMeteoClient.GeoCoord cached = new OpenMeteoClient.GeoCoord(
                48.0, 2.0, "Paris", "FR");
        when(valueOps.get("weather:geocode:paris")).thenReturn(cached);

        Optional<OpenMeteoClient.GeoCoord> coord = client.geocode("Paris");

        assertTrue(coord.isPresent());
        assertEquals(48.0, coord.get().latitude());
        // Pas d'appel HTTP attendu — MockRestServiceServer leve une exception si trop d'appels
        verify(valueOps, never()).set(anyString(), any(), any(Duration.class));
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
        // Pas de cache check pour blank/null
        verify(valueOps, never()).get(anyString());
    }

    @Test
    void geocode_httpFailure_returnsEmpty() {
        mockServer.expect(requestTo(org.hamcrest.Matchers.startsWith("https://"))).andRespond(withServerError());

        assertTrue(client.geocode("Paris").isEmpty());
        mockServer.verify();
    }

    @Test
    void forecast_parsesDailyArrays() {
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

        Optional<List<OpenMeteoClient.DailyForecast>> daily = client.forecast(paris, 3);

        assertTrue(daily.isPresent());
        assertEquals(3, daily.get().size());

        OpenMeteoClient.DailyForecast d0 = daily.get().get(0);
        assertEquals("2026-05-26", d0.date().toString());
        assertEquals(22.3, d0.tempMax(), 0.001);
        assertEquals(12.1, d0.tempMin(), 0.001);
        assertEquals(0.0, d0.precipitationMm(), 0.001);
        assertEquals(0, d0.weatherCode());

        OpenMeteoClient.DailyForecast d1 = daily.get().get(1);
        assertEquals(61, d1.weatherCode());
        assertEquals(5.2, d1.precipitationMm(), 0.001);

        // Cache write avec TTL
        verify(valueOps).set(eq("weather:forecast:48.8566:2.3522:3"), any(),
                eq(Duration.ofHours(1)));
        mockServer.verify();
    }

    @Test
    void forecast_clampsDaysBetween1And7() {
        OpenMeteoClient.GeoCoord paris = new OpenMeteoClient.GeoCoord(
                48.8566, 2.3522, "Paris", "FR");

        // Demande 99 jours → cle de cache doit etre :7 (clamp)
        mockServer.expect(requestTo(org.hamcrest.Matchers.containsString("forecast_days=7")))
                .andRespond(withSuccess("""
                        {"daily":{"time":[],"temperature_2m_max":[],"temperature_2m_min":[],
                                  "precipitation_sum":[],"weathercode":[]}}
                        """, MediaType.APPLICATION_JSON));

        client.forecast(paris, 99);

        verify(valueOps).set(eq("weather:forecast:48.8566:2.3522:7"), any(),
                eq(Duration.ofHours(1)));
    }

    @Test
    void forecast_nullCoord_returnsEmpty() {
        assertTrue(client.forecast(null, 5).isEmpty());
        verifyNoInteractions(valueOps);
    }

    @Test
    void forecast_httpFailure_returnsEmpty() {
        OpenMeteoClient.GeoCoord paris = new OpenMeteoClient.GeoCoord(
                48.0, 2.0, "Paris", "FR");
        mockServer.expect(requestTo(org.hamcrest.Matchers.startsWith("https://"))).andRespond(withServerError());

        assertTrue(client.forecast(paris, 5).isEmpty());
        mockServer.verify();
    }

    @Test
    void serializerSanity_objectMapperCanRoundtripDtos() throws Exception {
        // Defense en profondeur : verifier que les records publics peuvent etre serialises
        // par le GenericJackson2JsonRedisSerializer (qui utilise un ObjectMapper standard).
        ObjectMapper om = new ObjectMapper().findAndRegisterModules();
        var coord = new OpenMeteoClient.GeoCoord(48.0, 2.0, "Paris", "FR");
        String json = om.writeValueAsString(coord);
        var back = om.readValue(json, OpenMeteoClient.GeoCoord.class);
        assertEquals(coord, back);
    }
}
