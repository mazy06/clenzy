package com.clenzy.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.net.InetAddress;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests for {@link ICalUrlValidator}.
 * Validates SSRF protection: HTTPS-only, private IP blocking,
 * cloud metadata blocking, localhost blocking, and DNS resolution.
 */
class ICalUrlValidatorTest {

    @Nested
    @DisplayName("Null and empty URLs")
    class NullAndEmpty {

        @Test
        void whenNullUrl_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve(null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("vide");
        }

        @Test
        void whenEmptyUrl_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve(""))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("vide");
        }

        @Test
        void whenBlankUrl_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("   "))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("vide");
        }
    }

    @Nested
    @DisplayName("Scheme validation")
    class SchemeValidation {

        @Test
        void whenHttpScheme_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("http://example.com/cal.ics"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("HTTPS");
        }

        @Test
        void whenFtpScheme_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("ftp://example.com/cal.ics"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("HTTPS");
        }

        @Test
        void whenNoScheme_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("example.com/cal.ics"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("Localhost blocking")
    class LocalhostBlocking {

        @Test
        void whenLocalhostHost_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("https://localhost/cal.ics"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("locales");
        }

        @Test
        void whenLoopbackIp_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("https://127.0.0.1/cal.ics"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("locales");
        }

        @Test
        void whenIpv6Loopback_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("https://[::1]/cal.ics"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("locales");
        }

        @Test
        void whenZeroAddress_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("https://0.0.0.0/cal.ics"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("locales");
        }

        @Test
        void whenDotLocalSuffix_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("https://myserver.local/cal.ics"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("locales");
        }

        @Test
        void whenDotInternalSuffix_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("https://myserver.internal/cal.ics"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("locales");
        }
    }

    @Nested
    @DisplayName("Cloud metadata blocking")
    class CloudMetadataBlocking {

        @Test
        void whenAwsMetadataEndpoint_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("https://169.254.169.254/latest/meta-data/"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("metadata");
        }

        @Test
        void whenGcpMetadataEndpoint_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("https://metadata.google.internal/computeMetadata/"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("Valid URLs")
    class ValidUrls {

        @Test
        void whenValidHttpsUrl_thenReturnsInetAddress() {
            // google.com is a reliable DNS target
            InetAddress result = ICalUrlValidator.validateAndResolve("https://www.google.com/cal.ics");

            assertThat(result).isNotNull();
            assertThat(result.isLoopbackAddress()).isFalse();
            assertThat(result.isSiteLocalAddress()).isFalse();
        }
    }

    @Nested
    @DisplayName("Missing host")
    class MissingHost {

        @Test
        void whenNoHost_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("https:///path"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("hote");
        }
    }

    @Nested
    @DisplayName("Unresolvable hosts")
    class UnresolvableHosts {

        @Test
        void whenUnresolvableHost_thenThrows() {
            assertThatThrownBy(() -> ICalUrlValidator.validateAndResolve("https://this-host-definitely-does-not-exist-1234567890.com/cal.ics"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("resoudre");
        }
    }
}
