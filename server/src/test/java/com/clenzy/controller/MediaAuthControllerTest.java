package com.clenzy.controller;

import com.clenzy.service.MediaTicketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("MediaAuthController")
class MediaAuthControllerTest {

    private final MediaTicketService tickets = new MediaTicketService("ctrl-test-secret");
    private final MediaAuthController controller = new MediaAuthController(tickets);

    @Test
    @DisplayName("ticket valide (headers directs) -> 200")
    void validTicketHeaders() {
        String ticket = tickets.mint("cam_abc");
        assertThat(controller.verify("cam_abc", ticket, null).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("ticket valide via X-Original-URI -> 200")
    void validTicketViaOriginalUri() {
        String ticket = tickets.mint("cam_abc");
        String uri = "/media/api/frame.jpeg?src=cam_abc&t=" + ticket;
        assertThat(controller.verify(null, null, uri).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("ticket invalide / absent -> 403")
    void invalidTicket() {
        assertThat(controller.verify("cam_abc", "bad", null).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(controller.verify("cam_abc", null, null).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(controller.verify(null, null, null).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(controller.verify(null, null, "/media/api/frame.jpeg?src=cam_abc&t=bad").getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("ticket d'un autre flux via URI -> 403")
    void wrongStreamViaUri() {
        String ticket = tickets.mint("cam_abc");
        String uri = "/media/api/frame.jpeg?src=cam_other&t=" + ticket;
        assertThat(controller.verify(null, null, uri).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
