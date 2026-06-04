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
}
