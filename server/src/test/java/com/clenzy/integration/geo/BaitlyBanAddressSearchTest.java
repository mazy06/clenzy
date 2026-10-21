package com.clenzy.integration.geo;

import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class BaitlyBanAddressSearchTest {
    @Test void keepsAmbiguousCandidatesAndDecodesGeoJsonLongitudeBeforeLatitude(){
        var client=new BanGeocodingClient(new RestTemplateBuilder(),"https://ban.example/geocodage");
        var server=MockRestServiceServer.bindTo((RestTemplate)ReflectionTestUtils.getField(client,"restTemplate")).build();
        server.expect(queryParam("limit","5")).andExpect(queryParam("postcode","75019")).andExpect(queryParam("index","address"))
            .andRespond(withSuccess("""
                {"features":[
                {"geometry":{"type":"Point","coordinates":[2.371479,48.894309]},"properties":{"id":"a","label":"110 rue de l'Ourcq 75019 Paris","type":"housenumber","housenumber":"110","street":"rue de l'Ourcq","postcode":"75019","city":"Paris","score":0.98}},
                {"geometry":{"type":"Point","coordinates":[2.37,48.89]},"properties":{"id":"b","label":"rue de l'Ourcq 75019 Paris","type":"street","postcode":"75019","city":"Paris","score":0.96}},
                {"geometry":{"type":"Point","coordinates":[2.37,999]},"properties":{"id":"invalid","label":"Invalid","type":"housenumber","score":0.99}}
                ]}
                """,MediaType.APPLICATION_JSON));
        var result=client.searchAddresses("110 rue de l'Ourcq 75019 Paris","75019");
        assertThat(result).hasSize(2);assertThat(result.getFirst().latitude()).isEqualTo(48.894309);
        assertThat(result.getFirst().longitude()).isEqualTo(2.371479);assertThat(result.get(1).type()).isEqualTo("street");server.verify();
    }
}
