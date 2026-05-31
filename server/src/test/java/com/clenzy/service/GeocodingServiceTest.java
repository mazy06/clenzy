package com.clenzy.service;

import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GeocodingServiceTest {

    @Mock private PropertyRepository propertyRepository;

    private GeocodingService service;
    private HttpClient httpClient;

    @BeforeEach
    void setUp() {
        service = new GeocodingService(propertyRepository);
        // Swap the internal HttpClient with a Mockito mock to avoid real network calls.
        httpClient = mock(HttpClient.class);
        ReflectionTestUtils.setField(service, "httpClient", httpClient);
    }

    @SuppressWarnings("unchecked")
    private HttpResponse<String> buildResponse(int status, String body) {
        // Builds a stand-alone mock — never call inside a when(...) expression
        // (would trip Mockito's UnfinishedStubbingException).
        HttpResponse<String> response = (HttpResponse<String>) mock(HttpResponse.class);
        lenient().when(response.statusCode()).thenReturn(status);
        lenient().when(response.body()).thenReturn(body);
        return response;
    }

    @Nested
    @DisplayName("geocode")
    class GeocodeMethod {

        @Test
        void whenQueryIsNull_thenReturnsNull() {
            assertThat(service.geocode(null, null)).isNull();
        }

        @Test
        void whenQueryIsBlank_thenReturnsNull() {
            assertThat(service.geocode("   ", null)).isNull();
        }

        @SuppressWarnings("unchecked")
        @Test
        void whenNominatimReturnsResults_thenParsesCoordinates() throws Exception {
            HttpResponse<String> resp = buildResponse(200,
                    "[{\"lat\":\"48.8566\",\"lon\":\"2.3522\",\"address\":{\"country_code\":\"fr\"}}]");
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);

            GeocodingService.GeocodeResult result = service.geocode("Paris", null);

            assertThat(result).isNotNull();
            assertThat(result.latitude()).isEqualByComparingTo(new BigDecimal("48.8566"));
            assertThat(result.longitude()).isEqualByComparingTo(new BigDecimal("2.3522"));
            assertThat(result.countryCode()).isEqualTo("FR");
        }

        @SuppressWarnings("unchecked")
        @Test
        void whenCountryCodeProvided_thenRestrictsQuery() throws Exception {
            HttpResponse<String> resp = buildResponse(200,
                    "[{\"lat\":\"40.4168\",\"lon\":\"-3.7038\",\"address\":{\"country_code\":\"es\"}}]");
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);

            GeocodingService.GeocodeResult result = service.geocode("Madrid", "ES");

            assertThat(result).isNotNull();
            assertThat(result.countryCode()).isEqualTo("ES");
        }

        @SuppressWarnings("unchecked")
        @Test
        void whenAddressHasNoCountryCode_thenReturnsNullCc() throws Exception {
            HttpResponse<String> resp = buildResponse(200,
                    "[{\"lat\":\"10.0\",\"lon\":\"20.0\",\"address\":{}}]");
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);

            GeocodingService.GeocodeResult result = service.geocode("Nowhere", null);

            assertThat(result).isNotNull();
            assertThat(result.countryCode()).isNull();
        }

        @SuppressWarnings("unchecked")
        @Test
        void whenNoAddressNode_thenReturnsNullCc() throws Exception {
            HttpResponse<String> resp = buildResponse(200,
                    "[{\"lat\":\"1.0\",\"lon\":\"2.0\"}]");
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);

            GeocodingService.GeocodeResult result = service.geocode("Somewhere", null);

            assertThat(result).isNotNull();
            assertThat(result.countryCode()).isNull();
        }

        @SuppressWarnings("unchecked")
        @Test
        void whenNominatimReturnsHttp500_thenReturnsNull() throws Exception {
            HttpResponse<String> resp = buildResponse(500, "error");
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);

            assertThat(service.geocode("Anywhere", null)).isNull();
        }

        @SuppressWarnings("unchecked")
        @Test
        void whenNominatimReturnsEmptyArray_thenReturnsNull() throws Exception {
            HttpResponse<String> resp = buildResponse(200, "[]");
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);

            assertThat(service.geocode("Unknown Place", null)).isNull();
        }

        @SuppressWarnings("unchecked")
        @Test
        void whenNominatimReturnsNonArray_thenReturnsNull() throws Exception {
            HttpResponse<String> resp = buildResponse(200, "{\"error\":\"nope\"}");
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);

            assertThat(service.geocode("Anything", null)).isNull();
        }

        @SuppressWarnings("unchecked")
        @Test
        void whenHttpClientThrowsIOException_thenReturnsNull() throws Exception {
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                    .thenThrow(new IOException("network down"));

            assertThat(service.geocode("Paris", null)).isNull();
        }

        @SuppressWarnings("unchecked")
        @Test
        void whenHttpClientThrowsInterrupted_thenReturnsNullAndInterruptsThread() throws Exception {
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                    .thenThrow(new InterruptedException("stop"));

            GeocodingService.GeocodeResult result = service.geocode("Paris", null);

            assertThat(result).isNull();
            assertThat(Thread.interrupted()).isTrue();
        }

        @SuppressWarnings("unchecked")
        @Test
        void whenCountryCodeIsBlank_thenIgnoresIt() throws Exception {
            HttpResponse<String> resp = buildResponse(200,
                    "[{\"lat\":\"1.0\",\"lon\":\"2.0\",\"address\":{\"country_code\":\"us\"}}]");
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);

            GeocodingService.GeocodeResult result = service.geocode("New York", "  ");

            assertThat(result).isNotNull();
        }
    }

    @Nested
    @DisplayName("retroGeocodeMissing")
    class RetroGeocodeMissing {

        // The rate limit sleep (1.1s/property) makes large lists slow.
        // Each test below intentionally limits to <=2 properties.

        @Test
        void whenNoPropertiesMissing_thenReturnsZeros() {
            when(propertyRepository.findAllWithoutCoordinates()).thenReturn(List.of());

            GeocodingService.RetroGeocodeReport report = service.retroGeocodeMissing();

            assertThat(report.total()).isEqualTo(0);
            assertThat(report.updated()).isEqualTo(0);
            assertThat(report.skipped()).isEqualTo(0);
            assertThat(report.failed()).isEqualTo(0);
        }

        @Test
        void whenPropertyHasBlankAddress_thenSkipped() {
            Property p = new Property();
            p.setId(1L);
            // No address/postal/city/country -> buildAddressQuery returns blank
            when(propertyRepository.findAllWithoutCoordinates()).thenReturn(List.of(p));

            GeocodingService.RetroGeocodeReport report = service.retroGeocodeMissing();

            assertThat(report.total()).isEqualTo(1);
            assertThat(report.skipped()).isEqualTo(1);
            assertThat(report.updated()).isEqualTo(0);
            verify(propertyRepository, never()).save(any());
        }

        @SuppressWarnings("unchecked")
        @Test
        void whenGeocodeSucceeds_thenUpdatesAndSaves() throws Exception {
            Property p = new Property();
            p.setId(2L);
            p.setAddress("10 rue de Rivoli");
            p.setCity("Paris");
            p.setCountry("France");
            when(propertyRepository.findAllWithoutCoordinates()).thenReturn(List.of(p));
            HttpResponse<String> resp = buildResponse(200,
                    "[{\"lat\":\"48.8566\",\"lon\":\"2.3522\",\"address\":{\"country_code\":\"fr\"}}]");
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);

            GeocodingService.RetroGeocodeReport report = service.retroGeocodeMissing();

            assertThat(report.updated()).isEqualTo(1);
            assertThat(p.getLatitude()).isEqualByComparingTo(new BigDecimal("48.8566"));
            assertThat(p.getLongitude()).isEqualByComparingTo(new BigDecimal("2.3522"));
            assertThat(p.getCountryCode()).isEqualTo("FR");
            verify(propertyRepository, times(1)).save(p);
        }

        @SuppressWarnings("unchecked")
        @Test
        void whenGeocodeFails_thenFailedIncremented() throws Exception {
            Property p = new Property();
            p.setId(3L);
            p.setAddress("invalid place 12345");
            when(propertyRepository.findAllWithoutCoordinates()).thenReturn(List.of(p));
            HttpResponse<String> resp = buildResponse(200, "[]");
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);

            GeocodingService.RetroGeocodeReport report = service.retroGeocodeMissing();

            assertThat(report.failed()).isEqualTo(1);
            verify(propertyRepository, never()).save(any());
        }

        @SuppressWarnings("unchecked")
        @Test
        void whenPropertyHasExistingCountryCode_thenDoesNotOverwrite() throws Exception {
            Property p = new Property();
            p.setId(4L);
            p.setAddress("Berlin");
            p.setCountryCode("DE");
            when(propertyRepository.findAllWithoutCoordinates()).thenReturn(List.of(p));
            HttpResponse<String> resp = buildResponse(200,
                    "[{\"lat\":\"52.52\",\"lon\":\"13.405\",\"address\":{\"country_code\":\"de\"}}]");
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(resp);

            service.retroGeocodeMissing();

            assertThat(p.getCountryCode()).isEqualTo("DE"); // Not overwritten
        }
    }

    @Nested
    @DisplayName("GeocodeResult record")
    class GeocodeResultRecord {

        @Test
        void recordAccessors_returnValues() {
            GeocodingService.GeocodeResult r = new GeocodingService.GeocodeResult(
                    new BigDecimal("1.0"), new BigDecimal("2.0"), "FR");
            assertThat(r.latitude()).isEqualByComparingTo("1.0");
            assertThat(r.longitude()).isEqualByComparingTo("2.0");
            assertThat(r.countryCode()).isEqualTo("FR");
        }
    }

    @Nested
    @DisplayName("RetroGeocodeReport record")
    class RetroReportRecord {

        @Test
        void recordHoldsAllCounters() {
            GeocodingService.RetroGeocodeReport r = new GeocodingService.RetroGeocodeReport(
                    10, 7, 1, 2);
            assertThat(r.total()).isEqualTo(10);
            assertThat(r.updated()).isEqualTo(7);
            assertThat(r.skipped()).isEqualTo(1);
            assertThat(r.failed()).isEqualTo(2);
        }
    }

    // Suppress unused for the static Optional helper
    @SuppressWarnings("unused")
    private static <T> Optional<T> emptyOpt() {
        return Optional.empty();
    }
}
