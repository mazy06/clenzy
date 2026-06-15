package com.clenzy.service.email;

import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Contenu de l'email de confirmation de reservation (CLZ-P0-11) : i18n FR/EN,
 * formats, et echappement HTML des champs guest (securite #4).
 */
class ReservationConfirmationEmailComposerTest {

    private final ReservationConfirmationEmailComposer composer = new ReservationConfirmationEmailComposer();

    private Reservation reservation(String guestName, String language) {
        Property property = new Property();
        property.setName("Villa Test");

        Reservation r = new Reservation();
        r.setGuestName(guestName);
        r.setProperty(property);
        r.setConfirmationCode("RES-ABC123");
        r.setCheckIn(LocalDate.of(2026, 7, 1));
        r.setCheckOut(LocalDate.of(2026, 7, 5));
        r.setTotalPrice(new BigDecimal("450.00"));
        r.setCurrency("EUR");
        if (language != null) {
            Guest guest = new Guest();
            guest.setLanguage(language);
            r.setGuest(guest);
        }
        return r;
    }

    @Test
    void frenchByDefault() {
        Reservation r = reservation("Jean Dupont", null);

        assertThat(composer.subject(r)).contains("confirmee").contains("RES-ABC123");
        assertThat(composer.body(r))
                .contains("Bonjour Jean Dupont")
                .contains("Villa Test")
                .contains("01/07/2026")
                .contains("05/07/2026")
                .contains("450.00 EUR");
    }

    @Test
    void englishWhenGuestLanguageIsEn() {
        Reservation r = reservation("John Doe", "en");

        assertThat(composer.subject(r)).contains("confirmed");
        assertThat(composer.body(r)).contains("Hello John Doe").contains("Check-in");
    }

    @Test
    void escapesGuestControlledInput() {
        Reservation r = reservation("<script>alert(1)</script>", null);

        String body = composer.body(r);
        assertThat(body).doesNotContain("<script>");
        assertThat(body).contains("&lt;script&gt;");
    }

    @Test
    void wrapperStyleIsGuestNotification() {
        assertThat(composer.wrapperStyle()).isEqualTo("NOTIFICATION_GUEST");
    }
}
