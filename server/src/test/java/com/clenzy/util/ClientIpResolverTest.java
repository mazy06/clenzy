package com.clenzy.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests de {@link ClientIpResolver} — résolveur d'IP cliente unique partagé par
 * {@code RateLimitInterceptor} (keying du rate-limit) et
 * {@code TrustedClientIpResolver} (preuve de signature SES). L'IP ne doit pas être
 * forgeable via un en-tête {@code X-Forwarded-For} fourni par le client
 * (Z1-SEC-04 / Z4B-SECBUGS-01).
 */
class ClientIpResolverTest {

    @Nested
    @DisplayName("resolve — anti-spoofing X-Forwarded-For")
    class Resolve {

        @Test
        void whenRemoteAddrIsPublic_thenForwardedHeaderIgnored() {
            // Le pair direct n'est pas un proxy de confiance : le XFF est fourni
            // par le client et ne doit jamais être honoré.
            assertThat(ClientIpResolver.resolve("203.0.113.9", "1.2.3.4", null))
                    .isEqualTo("203.0.113.9");
        }

        @Test
        void whenClientForgesXffBehindNginx_thenRealClientIpIsKept() {
            // nginx (trusted) AJOUTE l'IP réelle en fin de chaîne : "forge, réelle".
            assertThat(ClientIpResolver.resolve("172.18.0.5", "1.2.3.4, 203.0.113.7", null))
                    .isEqualTo("203.0.113.7");
        }

        @Test
        void whenForgedXffVariesOnEachRequest_thenResolvedIpStaysStable() {
            // Un attaquant qui fait tourner le XFF ne doit pas faire tourner la
            // clé de rate-limit.
            assertThat(ClientIpResolver.resolve("172.18.0.5", "9.9.9.1, 203.0.113.7", null))
                    .isEqualTo(ClientIpResolver.resolve("172.18.0.5", "9.9.9.2, 203.0.113.7", null))
                    .isEqualTo("203.0.113.7");
        }

        @Test
        void whenMultipleTrustedProxiesInChain_thenFirstUntrustedFromRightIsUsed() {
            assertThat(ClientIpResolver.resolve("127.0.0.1", "9.9.9.9, 198.51.100.4, 10.0.0.3", null))
                    .isEqualTo("198.51.100.4");
        }

        @Test
        void whenWholeForwardedChainIsTrusted_thenFallsBackToXRealIp() {
            assertThat(ClientIpResolver.resolve("172.18.0.5", "10.0.0.2, 172.18.0.9", "10.0.0.2"))
                    .isEqualTo("10.0.0.2");
        }

        @Test
        void whenNoForwardingHeaders_thenRemoteAddrIsUsed() {
            assertThat(ClientIpResolver.resolve("172.18.0.5", null, null))
                    .isEqualTo("172.18.0.5");
        }

        @Test
        void whenForwardedChainTrustedAndNoXRealIp_thenFallsBackToRemoteAddr() {
            assertThat(ClientIpResolver.resolve("172.18.0.5", "10.0.0.2, 172.18.0.9", null))
                    .isEqualTo("172.18.0.5");
        }

        @Test
        void when172Dot32RemoteAddr_thenNotTrustedAndXffIgnored() {
            // 172.32.0.1 est PUBLIC (hors 172.16.0.0/12) : pas un proxy de confiance.
            assertThat(ClientIpResolver.resolve("172.32.0.1", "1.2.3.4", null))
                    .isEqualTo("172.32.0.1");
        }
    }

    @Nested
    @DisplayName("isTrustedProxy — CIDR exacts")
    class TrustedProxy {

        @Test
        void whenAddressInExactPrivateRanges_thenTrusted() {
            assertThat(ClientIpResolver.isTrustedProxy("127.0.0.1")).isTrue();
            assertThat(ClientIpResolver.isTrustedProxy("10.0.0.1")).isTrue();
            assertThat(ClientIpResolver.isTrustedProxy("10.255.255.255")).isTrue();
            assertThat(ClientIpResolver.isTrustedProxy("172.16.0.0")).isTrue();
            assertThat(ClientIpResolver.isTrustedProxy("172.31.255.255")).isTrue();
            assertThat(ClientIpResolver.isTrustedProxy("192.168.0.1")).isTrue();
            assertThat(ClientIpResolver.isTrustedProxy("0:0:0:0:0:0:0:1")).isTrue();
            assertThat(ClientIpResolver.isTrustedProxy("::1")).isTrue();
        }

        @Test
        void whenAddressOutsideExactCidrs_thenNotTrusted() {
            assertThat(ClientIpResolver.isTrustedProxy("172.32.0.1")).isFalse();    // hors 172.16.0.0/12
            assertThat(ClientIpResolver.isTrustedProxy("172.15.255.255")).isFalse();
            assertThat(ClientIpResolver.isTrustedProxy("172.0.0.1")).isFalse();
            assertThat(ClientIpResolver.isTrustedProxy("192.169.0.1")).isFalse();
            assertThat(ClientIpResolver.isTrustedProxy("11.0.0.1")).isFalse();
            assertThat(ClientIpResolver.isTrustedProxy("8.8.8.8")).isFalse();
        }

        @Test
        void whenAddressMalformed_thenNotTrusted() {
            assertThat(ClientIpResolver.isTrustedProxy(null)).isFalse();
            assertThat(ClientIpResolver.isTrustedProxy("")).isFalse();
            assertThat(ClientIpResolver.isTrustedProxy("not-an-ip")).isFalse();
            assertThat(ClientIpResolver.isTrustedProxy("10.0.0")).isFalse();
            assertThat(ClientIpResolver.isTrustedProxy("10.0.0.256")).isFalse();
        }
    }
}
