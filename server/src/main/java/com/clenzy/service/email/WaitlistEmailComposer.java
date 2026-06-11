package com.clenzy.service.email;

import com.clenzy.model.WaitlistSignup;
import com.clenzy.util.StringUtils;
import org.springframework.stereotype.Component;

/**
 * Contenu metier de la notification interne d'inscription a la waitlist de
 * lancement (sujet + tableau recap de l'inscrit).
 *
 * <p>Extrait de {@code EmailService} (G2) — rendu strictement identique.
 * La couche transport (MIME, From, deliverability) reste dans
 * {@code EmailService} ; le contenu metier waitlist vit ici.</p>
 */
@Component
public class WaitlistEmailComposer {

    /** Sujet de la notification interne ("Nouvelle inscription waitlist — #N — Nom"). */
    public String subject(WaitlistSignup s, long position) {
        return "Nouvelle inscription waitlist — #" + position
                + (s.getFullName() != null ? " — " + s.getFullName() : "");
    }

    /** Corps HTML de la notification interne (tableau recap, valeurs echappees). */
    public String renderWaitlistHtml(WaitlistSignup s, long position) {
        String name = s.getFullName() != null ? StringUtils.escapeHtml(s.getFullName()) : "—";
        String email = s.getEmail() != null ? StringUtils.escapeHtml(s.getEmail()) : "—";
        String phone = s.getPhone() != null ? StringUtils.escapeHtml(s.getPhone()) : "—";
        String city = s.getCity() != null ? StringUtils.escapeHtml(s.getCity()) : "—";
        String props = s.getPropertyCount() != null ? StringUtils.escapeHtml(s.getPropertyCount()) : "—";
        String source = s.getSource() != null ? StringUtils.escapeHtml(s.getSource()) : "—";

        return """
                <h2 style="font-family:Arial,sans-serif;color:#2b2b2b;">Nouvelle inscription waitlist</h2>
                <p style="font-family:Arial,sans-serif;color:#444;">Position d'arrivée : <strong>#%d</strong></p>
                <table style="font-family:Arial,sans-serif;color:#444;border-collapse:collapse;">
                  <tr><td style="padding:4px 16px 4px 0;"><strong>Nom</strong></td><td>%s</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;"><strong>Email</strong></td><td>%s</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;"><strong>Téléphone</strong></td><td>%s</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;"><strong>Ville</strong></td><td>%s</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;"><strong>Nb de biens</strong></td><td>%s</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;"><strong>Source</strong></td><td>%s</td></tr>
                </table>
                """.formatted(position, name, email, phone, city, props, source);
    }
}
