package com.clenzy.booking.service;

import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link WebsiteFetchService}.
 *
 * <p>The service performs real Jsoup HTTP calls in fetchWebsite. We cover the URL
 * validation branches via the public method (it throws before any network I/O),
 * and the private sha256/extractHost helpers via reflection.</p>
 */
class WebsiteFetchServiceTest {

    private WebsiteFetchService service;

    @BeforeEach
    void setUp() {
        service = new WebsiteFetchService();
        ReflectionTestUtils.setField(service, "timeoutSeconds", 15);
        ReflectionTestUtils.setField(service, "maxContentLengthKb", 512);
    }

    @Nested
    @DisplayName("URL validation - via fetchWebsite()")
    class UrlValidation {

        @Test
        void rejectsNullUrl() {
            assertThatThrownBy(() -> service.fetchWebsite(null))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void rejectsBlankUrl() {
            assertThatThrownBy(() -> service.fetchWebsite("   "))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void rejectsMalformedUrl() {
            assertThatThrownBy(() -> service.fetchWebsite("ht tp://nope"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("invalide");
        }

        @Test
        void rejectsHttpUrl() {
            assertThatThrownBy(() -> service.fetchWebsite("http://example.com"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("HTTPS");
        }

        @Test
        void rejectsFtpUrl() {
            assertThatThrownBy(() -> service.fetchWebsite("ftp://example.com"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("HTTPS");
        }

        @Test
        void rejectsUrlWithoutHost() {
            assertThatThrownBy(() -> service.fetchWebsite("https:///path"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void rejectsLoopbackIp() {
            assertThatThrownBy(() -> service.fetchWebsite("https://127.0.0.1/"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void rejectsLocalhost() {
            assertThatThrownBy(() -> service.fetchWebsite("https://localhost/"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void rejectsRfc1918Private10() {
            assertThatThrownBy(() -> service.fetchWebsite("https://10.0.0.1/"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void rejectsRfc1918Private192() {
            assertThatThrownBy(() -> service.fetchWebsite("https://192.168.0.1/"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void rejectsRfc1918Private172() {
            assertThatThrownBy(() -> service.fetchWebsite("https://172.16.0.1/"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void rejectsLinkLocal() {
            assertThatThrownBy(() -> service.fetchWebsite("https://169.254.1.1/"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void rejectsAnyLocal() {
            assertThatThrownBy(() -> service.fetchWebsite("https://0.0.0.0/"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void rejectsUnresolvableHost() {
            assertThatThrownBy(() -> service.fetchWebsite(
                    "https://invalid-host-clenzy-test-xyz-12345.example.invalid/"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("extractHost (private helper)")
    class ExtractHost {

        @Test
        void returnsHostForValidUrl() throws Exception {
            Method m = WebsiteFetchService.class.getDeclaredMethod("extractHost", String.class);
            m.setAccessible(true);
            String host = (String) m.invoke(service, "https://www.example.com/path");
            assertThat(host).isEqualTo("www.example.com");
        }

        @Test
        void returnsNullForMalformed() throws Exception {
            Method m = WebsiteFetchService.class.getDeclaredMethod("extractHost", String.class);
            m.setAccessible(true);
            String host = (String) m.invoke(service, "no spaces allowed:/url");
            // URI parses some malformed inputs with null host; either null or empty is acceptable
            // for an invalid input. The contract is "no crash and no host returned".
            assertThat(host == null || host.isEmpty()).isTrue();
        }

        @Test
        void returnsHostWithoutPath() throws Exception {
            Method m = WebsiteFetchService.class.getDeclaredMethod("extractHost", String.class);
            m.setAccessible(true);
            String host = (String) m.invoke(service, "https://example.com");
            assertThat(host).isEqualTo("example.com");
        }
    }

    @Nested
    @DisplayName("sha256 (private helper)")
    class Sha256 {

        @Test
        void deterministicAndCorrectLengthForEmpty() throws Exception {
            Method m = WebsiteFetchService.class.getDeclaredMethod("sha256", String.class);
            m.setAccessible(true);
            String hash = (String) m.invoke(service, "");
            assertThat(hash).hasSize(64);
            // SHA-256 of empty string
            assertThat(hash).isEqualTo("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        }

        @Test
        void differentInputsProduceDifferentHashes() throws Exception {
            Method m = WebsiteFetchService.class.getDeclaredMethod("sha256", String.class);
            m.setAccessible(true);
            String h1 = (String) m.invoke(service, "hello");
            String h2 = (String) m.invoke(service, "world");
            assertThat(h1).isNotEqualTo(h2);
            assertThat(h1).hasSize(64);
        }

        @Test
        void sameInputProducesSameHash() throws Exception {
            Method m = WebsiteFetchService.class.getDeclaredMethod("sha256", String.class);
            m.setAccessible(true);
            String h1 = (String) m.invoke(service, "clenzy");
            String h2 = (String) m.invoke(service, "clenzy");
            assertThat(h1).isEqualTo(h2);
        }

        @Test
        void handlesUtf8Bytes() throws Exception {
            Method m = WebsiteFetchService.class.getDeclaredMethod("sha256", String.class);
            m.setAccessible(true);
            String h = (String) m.invoke(service, "Crêpe — café ☕");
            assertThat(h).hasSize(64);
            assertThat(h).matches("[0-9a-f]+");
        }
    }

    @Nested
    @DisplayName("WebsiteContent record")
    class ContentRecord {

        @Test
        void recordAccessors() {
            WebsiteFetchService.WebsiteContent content = new WebsiteFetchService.WebsiteContent(
                    "<body>hi</body>", "/* css */", "abc123");
            assertThat(content.html()).isEqualTo("<body>hi</body>");
            assertThat(content.css()).isEqualTo("/* css */");
            assertThat(content.contentHash()).isEqualTo("abc123");
        }
    }

    @Nested
    @DisplayName("fetchWebsite happy paths via mockStatic(Jsoup.connect)")
    class FetchWebsiteMocked {

        /** Build a chained Connection mock that returns the supplied Document on .get(). */
        private static Connection chain(Document doc) throws java.io.IOException {
            Connection c = mock(Connection.class);
            lenient().when(c.userAgent(anyString())).thenReturn(c);
            lenient().when(c.timeout(anyInt())).thenReturn(c);
            lenient().when(c.maxBodySize(anyInt())).thenReturn(c);
            lenient().when(c.followRedirects(anyBoolean())).thenReturn(c);
            lenient().when(c.ignoreContentType(anyBoolean())).thenReturn(c);
            lenient().when(c.get()).thenReturn(doc);
            return c;
        }

        @Test
        @DisplayName("fetchWebsite returns body html and concatenated inline CSS")
        void fetchWebsite_inlineStyles_concatenated() throws Exception {
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
                assertThat(content.html()).doesNotContain("alert(1)"); // script removed
                assertThat(content.css()).contains(".a{color:red}");
                assertThat(content.css()).contains(".b{color:blue}");
                assertThat(content.contentHash()).hasSize(64);
            }
        }

        @Test
        @DisplayName("fetchWebsite skips empty <body> => html=''")
        void fetchWebsite_handlesNoBody() throws Exception {
            // Document with NO body element (just head). Jsoup.parse will inject one,
            // so we exercise the empty-body branch via a synthetic parse.
            Document doc = Jsoup.parse("<html><head><title>t</title></head></html>",
                    "https://www.example.com/");
            Connection conn = chain(doc);

            try (MockedStatic<Jsoup> mocked = mockStatic(Jsoup.class)) {
                mocked.when(() -> Jsoup.connect("https://www.example.com/")).thenReturn(conn);

                WebsiteFetchService.WebsiteContent content =
                        service.fetchWebsite("https://www.example.com/");

                assertThat(content.html()).isEmpty();
            }
        }

        @Test
        @DisplayName("fetchWebsite ignores third-party stylesheets (not first-party + not common CDN)")
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
        @DisplayName("fetchWebsite fetches first-party stylesheets")
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
        @DisplayName("fetchWebsite gracefully handles failing stylesheet fetch (logs and continues)")
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
            lenient().when(brokenCss.followRedirects(anyBoolean())).thenReturn(brokenCss);
            lenient().when(brokenCss.ignoreContentType(anyBoolean())).thenReturn(brokenCss);
            lenient().when(brokenCss.get()).thenThrow(new java.io.IOException("timeout"));

            try (MockedStatic<Jsoup> mocked = mockStatic(Jsoup.class)) {
                mocked.when(() -> Jsoup.connect("https://www.example.com/")).thenReturn(siteConn);
                mocked.when(() -> Jsoup.connect("https://www.example.com/broken.css")).thenReturn(brokenCss);

                WebsiteFetchService.WebsiteContent content =
                        service.fetchWebsite("https://www.example.com/");

                assertThat(content.html()).contains("hi");
                assertThat(content.css()).isEmpty(); // broken sheet -> CSS not appended
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
        @DisplayName("fetchWebsite caps fetched sheets at 5 (loop guard)")
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

                // Should contain at most 5 sheet comments
                int sheetCount = content.css().split("/\\* https://www\\.example\\.com").length - 1;
                assertThat(sheetCount).isLessThanOrEqualTo(5);
            }
        }

        @Test
        @DisplayName("fetchWebsite accepts common CDN (cdnjs.cloudflare.com)")
        void fetchWebsite_commonCdn_fetched() throws Exception {
            String html = "<html><head>" +
                    "<link rel=\"stylesheet\" href=\"https://cdnjs.cloudflare.com/x/style.css\">" +
                    "</head><body>hi</body></html>";
            Document doc = Jsoup.parse(html, "https://www.example.com/");
            Document cssDoc = Jsoup.parse("h1{color:gold}", "");

            Connection siteConn = chain(doc);
            Connection cssConn = chain(cssDoc);

            try (MockedStatic<Jsoup> mocked = mockStatic(Jsoup.class)) {
                mocked.when(() -> Jsoup.connect("https://www.example.com/")).thenReturn(siteConn);
                mocked.when(() -> Jsoup.connect("https://cdnjs.cloudflare.com/x/style.css"))
                        .thenReturn(cssConn);

                WebsiteFetchService.WebsiteContent content =
                        service.fetchWebsite("https://www.example.com/");

                assertThat(content.css()).contains("gold");
            }
        }
    }
}
