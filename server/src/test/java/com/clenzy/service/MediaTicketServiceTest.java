package com.clenzy.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("MediaTicketService")
class MediaTicketServiceTest {

    private final MediaTicketService service = new MediaTicketService("unit-test-secret");

    @Test
    @DisplayName("mint puis verify -> valide")
    void mintThenVerify() {
        String ticket = service.mint("cam_abc");
        assertThat(ticket).isNotNull();
        assertThat(service.verify("cam_abc", ticket)).isTrue();
    }

    @Test
    @DisplayName("ticket d'un flux invalide pour un autre flux")
    void wrongStream() {
        String ticket = service.mint("cam_abc");
        assertThat(service.verify("cam_other", ticket)).isFalse();
    }

    @Test
    @DisplayName("ticket falsifie -> invalide")
    void tampered() {
        String ticket = service.mint("cam_abc");
        char last = ticket.charAt(ticket.length() - 1);
        String flipped = ticket.substring(0, ticket.length() - 1) + (last == 'A' ? 'B' : 'A');
        assertThat(service.verify("cam_abc", flipped)).isFalse();
    }

    @Test
    @DisplayName("ticket expire -> invalide (signature correcte mais exp passe)")
    void expired() {
        long pastExp = Instant.now().getEpochSecond() - 10;
        String expired = pastExp + "." + service.sign("cam_abc", pastExp);
        assertThat(service.verify("cam_abc", expired)).isFalse();
    }

    @Test
    @DisplayName("formats invalides / null -> invalide")
    void malformed() {
        assertThat(service.verify("cam_abc", null)).isFalse();
        assertThat(service.verify("cam_abc", "no-dot")).isFalse();
        assertThat(service.verify("cam_abc", "notanumber.sig")).isFalse();
        assertThat(service.verify(null, service.mint("cam_abc"))).isFalse();
        assertThat(service.mint(null)).isNull();
        assertThat(service.mint("  ")).isNull();
    }

    @Test
    @DisplayName("cle differente -> ticket non transferable")
    void differentKey() {
        String ticket = service.mint("cam_abc");
        MediaTicketService other = new MediaTicketService("another-secret");
        assertThat(other.verify("cam_abc", ticket)).isFalse();
    }

    @Test
    @DisplayName("mintForImmutable : verifiable, et beaucoup plus stable que la fenetre courte")
    void immutableTicketIsLongLived() {
        // Une photo de profil ne change pas : son URL ne doit pas tourner quatre
        // fois par heure, sinon le navigateur rejette tout son cache d'avatars.
        String court = service.mint("guest-photo:42");
        String long_ = service.mintForImmutable("guest-photo:42");

        assertThat(service.verify("guest-photo:42", long_)).isTrue();

        long expCourt = Long.parseLong(court.substring(0, court.indexOf('.')));
        long expLong = Long.parseLong(long_.substring(0, long_.indexOf('.')));
        long now = Instant.now().getEpochSecond();

        assertThat(expCourt - now).isLessThanOrEqualTo(1800);      // 2 x 15 min
        assertThat(expLong - now).isGreaterThan(12 * 3600);        // au moins 12 h
    }

    @Test
    @DisplayName("verify ignore la fenetre : il lit l'expiration DANS le ticket")
    void verifyIsWindowAgnostic() {
        // C'est ce qui permet aux deux durees de cohabiter sans toucher a verify,
        // et aux tickets deja en circulation de rester valides.
        assertThat(service.verify("s", service.mint("s"))).isTrue();
        assertThat(service.verify("s", service.mintForImmutable("s"))).isTrue();
    }
}
