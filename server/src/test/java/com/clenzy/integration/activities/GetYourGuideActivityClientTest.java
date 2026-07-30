package com.clenzy.integration.activities;

import com.clenzy.dto.ActivityDto;
import com.clenzy.model.ActivityAffiliateConfig;
import com.clenzy.model.ActivityProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.hamcrest.Matchers.containsString;

/**
 * Verifie l'appel et le mapping contre la specification OpenAPI publique de
 * GetYourGuide (partner-api-spec) : c'est le seul contrat verifiable sans compte
 * partenaire.
 */
class GetYourGuideActivityClientTest {

    private static final String BASE_URL = "https://api.example.test";

    private RestTemplate restTemplate;
    private MockRestServiceServer server;
    private GetYourGuideActivityClient client;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        server = MockRestServiceServer.createServer(restTemplate);
        client = new GetYourGuideActivityClient(restTemplate, BASE_URL);
    }

    private ActivityAffiliateConfig config(String apiKey, String affiliateId) {
        ActivityAffiliateConfig c = new ActivityAffiliateConfig();
        c.setProvider(ActivityProvider.GETYOURGUIDE);
        c.setApiKey(apiKey);
        c.setAffiliateId(affiliateId);
        return c;
    }

    @Test
    void callsToursEndpoint_withAccessTokenAndCoordinates() {
        server.expect(requestTo(containsString("/1/tours")))
            .andExpect(header("X-ACCESS-TOKEN", "secret-key"))
            .andExpect(queryParam("cnt_language", "fr"))
            .andExpect(queryParam("currency", "EUR"))
            .andExpect(queryParam("limit", "5"))
            // coordinates[] est un tableau repete (latitude, longitude, rayon).
            // Verifie sur l'URI brute : le matcher queryParam ne retrouve pas la
            // cle une fois les crochets encodes par le client HTTP.
            .andExpect(requestTo(containsString("=48.85")))
            .andExpect(requestTo(containsString("=2.34")))
            .andExpect(requestTo(containsString("=20")))
            .andRespond(withSuccess("{\"data\":{\"tours\":[]}}", MediaType.APPLICATION_JSON));

        client.search(new ActivitySearchQuery(48.85, 2.34, "Paris", "fr", 5),
            config("secret-key", "PARTNER-1"));

        server.verify();
    }

    @Test
    void mapsTourFields_asDescribedByTheSpec() {
        String body = """
            {
              "data": {
                "tours": [{
                  "title": "Croisière sur la Seine",
                  "url": "https://www.getyourguide.com/paris-l16/seine-cruise-t123/",
                  "overall_rating": 4.6,
                  "number_of_ratings": 812,
                  "price": { "values": { "amount": 32.5 } },
                  "durations": [{ "duration": 2, "unit": "hour" }],
                  "pictures": [{ "ssl_url": "https://img.gyg.test/tour-[format_id].jpg" }]
                }]
              }
            }
            """;
        server.expect(requestTo(containsString("/1/tours")))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        List<ActivityDto> activities = client.search(
            new ActivitySearchQuery(48.85, 2.34, "Paris", "fr", 5), config("k", "PARTNER-1"));

        assertThat(activities).singleElement().satisfies(a -> {
            assertThat(a.provider()).isEqualTo("GETYOURGUIDE");
            assertThat(a.title()).isEqualTo("Croisière sur la Seine");
            assertThat(a.rating()).isEqualTo(4.6);
            assertThat(a.reviewCount()).isEqualTo(812);
            assertThat(a.price()).isEqualTo("33");
            assertThat(a.currency()).isEqualTo("EUR");
            assertThat(a.durationLabel()).isEqualTo("2 hour");
            // Le segment [format_id] doit etre substitue, sinon le lien est mort.
            assertThat(a.imageUrl()).isEqualTo("https://img.gyg.test/tour-97.jpg");
            assertThat(a.bookingUrl()).contains("partner_id=PARTNER-1");
        });
    }

    @Test
    void doesNotDuplicatePartnerId_whenTheUrlAlreadyCarriesIt() {
        String body = """
            {"data":{"tours":[{
              "title":"T","url":"https://www.getyourguide.com/t123/?partner_id=ALREADY"
            }]}}
            """;
        server.expect(requestTo(containsString("/1/tours")))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        List<ActivityDto> activities = client.search(
            new ActivitySearchQuery(48.85, 2.34, "Paris", "fr", 5), config("k", "PARTNER-1"));

        assertThat(activities).singleElement()
            .satisfies(a -> assertThat(a.bookingUrl()).isEqualTo(
                "https://www.getyourguide.com/t123/?partner_id=ALREADY"));
    }

    @Test
    void staysInert_withoutApiKey() {
        List<ActivityDto> activities = client.search(
            new ActivitySearchQuery(48.85, 2.34, "Paris", "fr", 5), config(null, "PARTNER-1"));

        assertThat(activities).isEmpty();
        server.verify(); // aucun appel emis
    }

    @Test
    void returnsEmpty_whenTheCatalogFails_soOtherProvidersStillShow() {
        server.expect(requestTo(containsString("/1/tours")))
            .andRespond(withServerError());

        List<ActivityDto> activities = client.search(
            new ActivitySearchQuery(48.85, 2.34, "Paris", "fr", 5), config("k", "PARTNER-1"));

        assertThat(activities).isEmpty();
    }

    @Test
    void returnsEmpty_withoutCoordinates() {
        List<ActivityDto> activities = client.search(
            new ActivitySearchQuery(null, null, "Paris", "fr", 5), config("k", "PARTNER-1"));

        assertThat(activities).isEmpty();
        server.verify();
    }
}
