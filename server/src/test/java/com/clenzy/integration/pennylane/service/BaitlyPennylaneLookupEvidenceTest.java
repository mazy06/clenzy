package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.config.PennylaneConfig;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import java.util.*;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** Réponses API v2 synthétiques : une réponse ambiguë ne prouve jamais une absence. */
class BaitlyPennylaneLookupEvidenceTest {
    static Stream<String> parties() { return Stream.of("customers", "suppliers"); }
    static Stream<org.junit.jupiter.params.provider.Arguments> invalidPages() {
        return parties().flatMap(party -> Stream.of(
            "null", "{}", "{\"customers\":[],\"suppliers\":[]}",
            "{\"items\":null,\"has_more\":false,\"next_cursor\":null}",
            "{\"items\":{},\"has_more\":false,\"next_cursor\":null}",
            "{\"items\":[],\"next_cursor\":null}",
            "{\"items\":[],\"has_more\":false}",
            "{\"items\":[],\"has_more\":true,\"next_cursor\":null}",
            "{\"items\":[],\"has_more\":false,\"next_cursor\":\"synthetic-cursor\"}",
            "{\"items\":[],\"has_more\":false,\"next_cursor\":null,\"error\":\"synthetic-private@example.invalid\"}",
            page("[null]"), page("[\"synthetic-private@example.invalid\"]"),
            page("[{\"id\":1,\"external_reference\":\"other-reference\"}]"),
            page("[{\"id\":1}]"),
            page("[{\"id\":0,\"external_reference\":\"synthetic-reference\"}]"),
            page("[{\"id\":1.5,\"external_reference\":\"synthetic-reference\"}]"),
            page("[{\"id\":\"1\",\"external_reference\":\"synthetic-reference\"}]"),
            page("[{\"id\":1,\"external_reference\":\"synthetic-reference\"},{\"id\":2,\"external_reference\":\"synthetic-reference\"}]")
        ).map(body -> org.junit.jupiter.params.provider.Arguments.of(party, body)));
    }
    static String page(String items) { return "{\"items\":"+items+",\"has_more\":false,\"next_cursor\":null}"; }
    @ParameterizedTest @MethodSource("invalidPages")
    void malformedOrAmbiguousSearchNeverAuthorizesCreation(String party, String body) {
        var fixture = new Fixture(party, body);
        assertThatThrownBy(() -> fixture.lookup(party))
            .isInstanceOf(BaitlyPennylaneDiagnostics.Failure.class).hasNoCause()
            .satisfies(error -> {
                assertThat(BaitlyPennylaneDiagnostics.reason(error)).isEqualTo(BaitlyPennylaneDiagnostics.Reason.INVALID_RESPONSE);
                assertThat(error.getMessage()).doesNotContain("synthetic-private", body);
                assertThat(error.getSuppressed()).isEmpty();
            });
        fixture.server.verify();
    }
    @ParameterizedTest @MethodSource("parties")
    void onlyAnExplicitTerminalEmptyPageProvesAbsence(String party) {
        var fixture = new Fixture(party, page("[]"));
        assertThat(fixture.lookup(party)).isEmpty(); fixture.server.verify();
    }
    @ParameterizedTest @MethodSource("parties")
    void exactUniqueMatchIsReused(String party) {
        var fixture = new Fixture(party, page("[{\"id\":42,\"external_reference\":\"synthetic-reference\"}]"));
        assertThat(fixture.lookup(party)).hasValueSatisfying(item -> assertThat(item.get("id")).isEqualTo(42));
        fixture.server.verify();
    }
    static class Fixture {
        final PennylaneAccountingClient client;
        final MockRestServiceServer server;
        Fixture(String party, String body) {
            var config = mock(PennylaneConfig.class);
            when(config.getAccountingApiBaseUrl()).thenReturn("https://accounting.example.invalid");
            var oauth = mock(PennylaneOAuthService.class);
            when(oauth.getValidAccessToken(7L)).thenReturn("synthetic-token");
            client = new PennylaneAccountingClient(config, oauth);
            server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(client,"restTemplate")).build();
            server.expect(request -> {
                assertThat(request.getURI().getPath()).isEqualTo("/"+party);
                assertThat(request.getURI().getQuery()).contains("limit=2");
            }).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
        }
        Optional<Map<String,Object>> lookup(String party) {
            return party.equals("customers") ? client.findCustomerByExternalRef(7L,"synthetic-reference")
                : client.findSupplierByExternalRef(7L,"synthetic-reference");
        }
    }
}
