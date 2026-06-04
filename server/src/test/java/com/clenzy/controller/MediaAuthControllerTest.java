package com.clenzy.controller;

import com.clenzy.service.MediaTicketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("MediaAuthController")
class MediaAuthControllerTest {

    private final MediaTicketService tickets = new MediaTicketService("ctrl-test-secret");
    private final MediaAuthController controller = new MediaAuthController(tickets);

    @Test
    @DisplayName("ticket valide -> 200")
    void validTicket() {
        String ticket = tickets.mint("cam_abc");
        ResponseEntity<Void> resp = controller.verify("cam_abc", ticket);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("ticket invalide / absent -> 403")
    void invalidTicket() {
        assertThat(controller.verify("cam_abc", "bad").getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(controller.verify("cam_abc", null).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(controller.verify(null, null).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("ticket d'un autre flux -> 403")
    void wrongStream() {
        String ticket = tickets.mint("cam_abc");
        assertThat(controller.verify("cam_other", ticket).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
