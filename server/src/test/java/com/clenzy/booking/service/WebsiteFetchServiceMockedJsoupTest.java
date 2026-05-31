package com.clenzy.booking.service;

import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

/**
 * Complement à {@link WebsiteFetchServiceTest} — couvre les chemins
 * d'execution reels du fetch via {@code mockStatic(Jsoup.class)}.
 *
 * <p>Le test parent ne couvre que la validation. Cette classe exerce
 * le parsing HTML, l'extraction CSS inline, le filtrage des liens
 * stylesheets (first-party vs CDN vs tiers), le cap a 5 sheets, etc.</p>
 */
class WebsiteFetchServiceMockedJsoupTest {

    private WebsiteFetchService service;

    @BeforeEach
    void setUp() {
        service = new WebsiteFetchService();
        ReflectionTestUtils.setField(service, "timeoutSeconds", 15);
        ReflectionTestUtils.setField(service, "maxContentLengthKb", 512);
    }

    /** Build a chained Connection mock that returns the supplied Document on .get(). */
    private static Connection chain(Document doc) throws java.io.IOException {
        Connection c = mock(Connection.class);
        lenient().when(c.userAgent(anyString())).thenReturn(c);
        lenient().when(c.timeout(anyInt())).thenReturn(c);
        lenient().when(c.maxBodySize(anyInt())).thenReturn(c);
        lenient().when(c.followRedirects(true)).thenReturn(c);
        lenient().when(c.ignoreContentType(true)).thenReturn(c);
        lenient().when(c.get()).thenReturn(doc);
        return c;
    }

    @Test
    @DisplayName("fetchWebsite returns body html + concatenated inline CSS (scripts removed)")
    void fetchWebsite_inlineStylesAndScriptStripping() throws Exception {
        String html = "<html><head><style>.a{color:red}</style>" +
                "<style>.b{color:blue}</style></head><body><h1>Hello</h1>" +
                "<script>alert(1)</script></body></html>";
        Document doc = Jsoup.parse(html, "https://www.example.com/");

        Connection conn = chain(doc);

        try (MockedStatic<Jsoup> mocked = mockStatic(Jsoup.class)) {
            mocked.when(() -> Jsoup.connect("https://www.example.com/")).thenReturn(conn);

            WebsiteFetchService.WebsiteContent content =
                    service.fetchWebsite("https://www.example.com/");

            assertThat(content.html()).contains("Hello");
            assertThat(content.html()).doesNotContain("alert(1)");
            assertThat(content.css()).contains(".a{color:red}");
            assertThat(content.css()).contains(".b{color:blue}");
            assertThat(content.contentHash()).hasSize(64);
        }
    }

    @Test
    @DisplayName("fetchWebsite skips third-party stylesheets (not first-party + not common CDN)")
    void fetchWebsite_thirdPartyStylesheets_skipped() throws Exception {
        String html = "<html><head>" +
                "<link rel=\"stylesheet\" href=\"https://attacker-cdn.example/evil.css\">" +
                "</head><body>hi</body></html>";
        Document doc = Jsoup.parse(html, "https://www.example.com/");

        Connection conn = chain(doc);

        try (MockedStatic<Jsoup> mocked = mockStatic(Jsoup.class)) {
            mocked.when(() -> Jsoup.connect("https://www.example.com/")).thenReturn(conn);

            WebsiteFetchService.WebsiteContent content =
                    service.fetchWebsite("https://www.example.com/");

            assertThat(content.css()).isEmpty(); // 3rd party CSS NOT fetched
        }
    }

    @Test
    @DisplayName("fetchWebsite fetches first-party stylesheets and concatenates them")
    void fetchWebsite_firstPartyStylesheet_fetched() throws Exception {
        String html = "<html><head>" +
                "<link rel=\"stylesheet\" href=\"https://www.example.com/site.css\">" +
                "</head><body>hi</body></html>";
        Document doc = Jsoup.parse(html, "https://www.example.com/");
        Document cssDoc = Jsoup.parse("body{color:teal}", "");

        Connection siteConn = chain(doc);
        Connection cssConn = chain(cssDoc);

        try (MockedStatic<Jsoup> mocked = mockStatic(Jsoup.class)) {
            mocked.when(() -> Jsoup.connect("https://www.example.com/")).thenReturn(siteConn);
            mocked.when(() -> Jsoup.connect("https://www.example.com/site.css")).thenReturn(cssConn);

            WebsiteFetchService.WebsiteContent content =
                    service.fetchWebsite("https://www.example.com/");

            assertThat(content.css()).contains("teal");
            assertThat(content.css()).contains("https://www.example.com/site.css");
        }
    }

    @Test
    @DisplayName("fetchWebsite continues when a stylesheet fetch fails (try/catch swallow)")
    void fetchWebsite_failingStylesheet_doesNotCrash() throws Exception {
        String html = "<html><head>" +
                "<link rel=\"stylesheet\" href=\"https://www.example.com/broken.css\">" +
                "</head><body>hi</body></html>";
        Document doc = Jsoup.parse(html, "https://www.example.com/");

        Connection siteConn = chain(doc);
        Connection brokenCss = mock(Connection.class);
        lenient().when(brokenCss.userAgent(anyString())).thenReturn(brokenCss);
        lenient().when(brokenCss.timeout(anyInt())).thenReturn(brokenCss);
        lenient().when(brokenCss.maxBodySize(anyInt())).thenReturn(brokenCss);
        lenient().when(brokenCss.followRedirects(true)).thenReturn(brokenCss);
        lenient().when(brokenCss.ignoreContentType(true)).thenReturn(brokenCss);
        lenient().when(brokenCss.get()).thenThrow(new java.io.IOException("timeout"));

        try (MockedStatic<Jsoup> mocked = mockStatic(Jsoup.class)) {
            mocked.when(() -> Jsoup.connect("https://www.example.com/")).thenReturn(siteConn);
            mocked.when(() -> Jsoup.connect("https://www.example.com/broken.css")).thenReturn(brokenCss);

            WebsiteFetchService.WebsiteContent content =
                    service.fetchWebsite("https://www.example.com/");

            assertThat(content.html()).contains("hi");
            assertThat(content.css()).isEmpty();
        }
    }

    @Test
    @DisplayName("fetchWebsite handles link tag without an href attribute")
    void fetchWebsite_noHrefAttribute_handled() throws Exception {
        String html = "<html><head>" +
                "<link rel=\"stylesheet\">" +
                "</head><body>hi</body></html>";
        Document doc = Jsoup.parse(html, "https://www.example.com/");
        Connection conn = chain(doc);

        try (MockedStatic<Jsoup> mocked = mockStatic(Jsoup.class)) {
            mocked.when(() -> Jsoup.connect("https://www.example.com/")).thenReturn(conn);

            WebsiteFetchService.WebsiteContent content =
                    service.fetchWebsite("https://www.example.com/");

            assertThat(content.css()).isEmpty();
        }
    }

    @Test
    @DisplayName("fetchWebsite caps fetched stylesheets at 5")
    void fetchWebsite_capsAt5Stylesheets() throws Exception {
        StringBuilder linkTags = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            linkTags.append(String.format(
                    "<link rel=\"stylesheet\" href=\"https://www.example.com/s%d.css\">", i));
        }
        String html = "<html><head>" + linkTags + "</head><body>hi</body></html>";
        Document doc = Jsoup.parse(html, "https://www.example.com/");
        Document cssDoc = Jsoup.parse("body{}", "");

        Connection siteConn = chain(doc);

        try (MockedStatic<Jsoup> mocked = mockStatic(Jsoup.class)) {
            mocked.when(() -> Jsoup.connect("https://www.example.com/")).thenReturn(siteConn);
            for (int idx = 0; idx < 8; idx++) {
                final int i = idx;
                Connection cssConn = chain(cssDoc);
                mocked.when(() -> Jsoup.connect("https://www.example.com/s" + i + ".css"))
                        .thenReturn(cssConn);
            }

            WebsiteFetchService.WebsiteContent content =
                    service.fetchWebsite("https://www.example.com/");

            int sheetCount = content.css().split("/\\* https://www\\.example\\.com").length - 1;
            assertThat(sheetCount).isLessThanOrEqualTo(5);
        }
    }

    @Test
    @DisplayName("fetchWebsite accepts cdnjs.cloudflare.com (common CDN)")
    void fetchWebsite_cloudflareCdn_fetched() throws Exception {
        String html = "<html><head>" +
                "<link rel=\"stylesheet\" href=\"https://cdnjs.cloudflare.com/x/style.css\">" +
                "</head><body>hi</body></html>";
        Document doc = Jsoup.parse(html, "https://www.example.com/");
        Document cssDoc = Jsoup.parse("h1{color:gold}", "");

        Connection siteConn = chain(doc);
        Connection cssConn = chain(cssDoc);

        try (MockedStatic<Jsoup> mocked = mockStatic(Jsoup.class)) {
            mocked.when(() -> Jsoup.connect("https://www.example.com/")).thenReturn(siteConn);
            mocked.when(() -> Jsoup.connect("https://cdnjs.cloudflare.com/x/style.css")).thenReturn(cssConn);

            WebsiteFetchService.WebsiteContent content =
                    service.fetchWebsite("https://www.example.com/");

            assertThat(content.css()).contains("gold");
        }
    }

    @Test
    @DisplayName("fetchWebsite accepts googleapis.com CDN")
    void fetchWebsite_googleApisCdn_fetched() throws Exception {
        String html = "<html><head>" +
                "<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css?family=Inter\">" +
                "</head><body>hi</body></html>";
        Document doc = Jsoup.parse(html, "https://www.example.com/");
        Document cssDoc = Jsoup.parse("@font-face{}", "");

        Connection siteConn = chain(doc);
        Connection cssConn = chain(cssDoc);

        try (MockedStatic<Jsoup> mocked = mockStatic(Jsoup.class)) {
            mocked.when(() -> Jsoup.connect("https://www.example.com/")).thenReturn(siteConn);
            mocked.when(() -> Jsoup.connect("https://fonts.googleapis.com/css?family=Inter"))
                    .thenReturn(cssConn);

            WebsiteFetchService.WebsiteContent content =
                    service.fetchWebsite("https://www.example.com/");

            assertThat(content.css()).contains("font-face");
        }
    }

    @Test
    @DisplayName("fetchWebsite handles minimal HTML with body but no styles")
    void fetchWebsite_noStyles_emptyCss() throws Exception {
        Document doc = Jsoup.parse("<html><body>just text</body></html>", "https://www.example.com/");
        Connection conn = chain(doc);

        try (MockedStatic<Jsoup> mocked = mockStatic(Jsoup.class)) {
            mocked.when(() -> Jsoup.connect("https://www.example.com/")).thenReturn(conn);

            WebsiteFetchService.WebsiteContent content =
                    service.fetchWebsite("https://www.example.com/");

            assertThat(content.html()).contains("just text");
            assertThat(content.css()).isEmpty();
            assertThat(content.contentHash()).hasSize(64);
        }
    }
}
