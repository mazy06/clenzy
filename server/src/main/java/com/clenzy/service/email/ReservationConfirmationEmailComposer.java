package com.clenzy.service.email;

import com.clenzy.model.Reservation;
import com.clenzy.util.StringUtils;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Contenu metier de l'email de confirmation de reservation (booking direct,
 * CLZ-P0-11). Composant pur (aucune injection de service) : la couche transport
 * (MIME, From, deliverability, wrapper HTML) reste dans {@code EmailService} /
 * {@code EmailWrapperService}.
 *
 * <p>Securite : tout champ controle par le guest ({@code guestName}, nom de
 * propriete) est echappe via {@link StringUtils#escapeHtml} (regle securite #4).
 * Montant en devise de la reservation ; dates au format jour/mois/annee (les
 * dates de sejour sont des {@code LocalDate}, independantes du fuseau).</p>
 *
 * <p>i18n : FR par defaut, EN si la langue du guest commence par "en". L'arabe et
 * le rendu RTL, ainsi que les rappels (J-7/J-1) et les templates editables,
 * relevent du reste de CLZ-P0-11 (sous-taches a venir).</p>
 */
@Component
public class ReservationConfirmationEmailComposer {

    public static final String WRAPPER_STYLE = "NOTIFICATION_GUEST";

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public String wrapperStyle() {
        return WRAPPER_STYLE;
    }

    public String subject(Reservation reservation) {
        String code = orEmpty(reservation.getConfirmationCode());
        return isEnglish(reservation)
                ? "Your booking is confirmed — " + code
                : "Votre reservation est confirmee — " + code;
    }

    public String body(Reservation reservation) {
        boolean en = isEnglish(reservation);
        String guest = StringUtils.escapeHtml(orEmpty(reservation.getGuestName()));
        String property = StringUtils.escapeHtml(
                reservation.getProperty() != null ? orEmpty(reservation.getProperty().getName()) : "");
        String checkIn = reservation.getCheckIn() != null ? DATE.format(reservation.getCheckIn()) : "-";
        String checkOut = reservation.getCheckOut() != null ? DATE.format(reservation.getCheckOut()) : "-";
        String amount = formatAmount(reservation.getTotalPrice(), reservation.getCurrency());
        String code = orEmpty(reservation.getConfirmationCode());

        if (en) {
            return "Hello " + guest + ",\n\n"
                    + "Your booking at *" + property + "* is confirmed.\n\n"
                    + "• Confirmation code: *" + code + "*\n"
                    + "• Check-in: " + checkIn + "\n"
                    + "• Check-out: " + checkOut + "\n"
                    + "• Total: " + amount + "\n\n"
                    + "We look forward to welcoming you.";
        }
        return "Bonjour " + guest + ",\n\n"
                + "Votre reservation au *" + property + "* est confirmee.\n\n"
                + "• Code de confirmation : *" + code + "*\n"
                + "• Arrivee : " + checkIn + "\n"
                + "• Depart : " + checkOut + "\n"
                + "• Total : " + amount + "\n\n"
                + "Nous avons hate de vous accueillir.";
    }

    private boolean isEnglish(Reservation reservation) {
        String lang = reservation.getGuest() != null ? reservation.getGuest().getLanguage() : null;
        return lang != null && lang.trim().toLowerCase(Locale.ROOT).startsWith("en");
    }

    private String formatAmount(BigDecimal amount, String currency) {
        if (amount == null) {
            return "-";
        }
        String cur = (currency != null && !currency.isBlank()) ? currency.trim().toUpperCase(Locale.ROOT) : "";
        return cur.isEmpty() ? amount.toPlainString() : amount.toPlainString() + " " + cur;
    }

    private String orEmpty(String value) {
        return value != null ? value : "";
    }
}
