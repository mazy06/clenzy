package com.clenzy.booking.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("required");
        }

        @Test
        void rejectsBlankUrl() {
            assertThatThrownBy(() -> service.fetchWebsite("   "))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("required");
        }

        @Test
        void rejectsMalformedUrl() {
            assertThatThrownBy(() -> service.fetchWebsite("ht tp://nope"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Invalid");
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
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Internal");
        }

        @Test
        void rejectsLocalhost() {
            assertThatThrownBy(() -> service.fetchWebsite("https://localhost/"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Internal");
        }

        @Test
        void rejectsRfc1918Private10() {
            assertThatThrownBy(() -> service.fetchWebsite("https://10.0.0.1/"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Internal");
        }

        @Test
        void rejectsRfc1918Private192() {
            assertThatThrownBy(() -> service.fetchWebsite("https://192.168.0.1/"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Internal");
        }

        @Test
        void rejectsRfc1918Private172() {
            assertThatThrownBy(() -> service.fetchWebsite("https://172.16.0.1/"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Internal");
        }

        @Test
        void rejectsLinkLocal() {
            assertThatThrownBy(() -> service.fetchWebsite("https://169.254.1.1/"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Internal");
        }

        @Test
        void rejectsAnyLocal() {
            assertThatThrownBy(() -> service.fetchWebsite("https://0.0.0.0/"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Internal");
        }

        @Test
        void rejectsUnresolvableHost() {
            assertThatThrownBy(() -> service.fetchWebsite(
                    "https://invalid-host-clenzy-test-xyz-12345.example.invalid/"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Cannot resolve");
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
}
