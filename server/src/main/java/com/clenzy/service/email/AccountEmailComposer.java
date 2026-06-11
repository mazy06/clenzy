package com.clenzy.service.email;

import com.clenzy.util.StringUtils;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Contenu metier des emails du cycle de vie du compte utilisateur :
 * bienvenue (identifiants de connexion) et confirmation d'inscription
 * (lien de creation de mot de passe).
 *
 * <p>Extrait de {@code EmailService} (G2) — rendu strictement identique.
 * La couche transport (MIME, From, deliverability) reste dans
 * {@code EmailService} ; le contenu metier compte vit ici.</p>
 */
@Component
public class AccountEmailComposer {

    /** Corps HTML de l'email de bienvenue (recap nom/email/role + CTA login). */
    public String renderWelcomeHtml(String firstName, String lastName, String email,
                                    String roleName, String loginUrl) {
        String safeName = StringUtils.escapeHtml(firstName);
        String safeFullName = StringUtils.escapeHtml(firstName + " " + lastName);
        String safeEmail = StringUtils.escapeHtml(email);
        String safeRole = StringUtils.escapeHtml(roleName != null ? RoleEmailLabels.displayName(roleName) : "Utilisateur");
        String safeUrl = StringUtils.escapeHtml(loginUrl);

        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>"
                + "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>"
                // Header
                + "<div style='background:linear-gradient(135deg,#A6C0CE 0%,#6B8A9A 100%);padding:30px;border-radius:10px 10px 0 0;text-align:center;'>"
                + "<h1 style='color:white;margin:0;font-size:24px;'>Bienvenue sur Clenzy !</h1>"
                + "<p style='color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;'>Votre compte a ete cree avec succes</p>"
                + "</div>"
                // Body
                + "<div style='background:#ffffff;padding:30px;border:1px solid #e2e8f0;'>"
                + "<p style='font-size:16px;color:#334155;'>Bonjour " + safeName + ",</p>"
                + "<p style='font-size:15px;color:#475569;'>Votre compte Clenzy a ete cree. "
                + "Voici vos informations de connexion :</p>"
                // Info box
                + "<div style='background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px;margin:20px 0;'>"
                + "<table style='width:100%;border-collapse:collapse;'>"
                + "<tr><td style='padding:6px 0;font-weight:bold;color:#475569;width:35%;'>Nom</td>"
                + "<td style='padding:6px 0;color:#1e293b;'>" + safeFullName + "</td></tr>"
                + "<tr><td style='padding:6px 0;font-weight:bold;color:#475569;'>Email</td>"
                + "<td style='padding:6px 0;color:#1e293b;'>" + safeEmail + "</td></tr>"
                + "<tr><td style='padding:6px 0;font-weight:bold;color:#475569;'>Role</td>"
                + "<td style='padding:6px 0;color:#1e293b;'>" + safeRole + "</td></tr>"
                + "</table>"
                + "</div>"
                + "<p style='font-size:14px;color:#64748b;'>Votre mot de passe vous a ete communique par votre administrateur. "
                + "Vous pouvez le modifier a tout moment depuis votre profil.</p>"
                // CTA Button
                + "<div style='text-align:center;margin:30px 0;'>"
                + "<a href='" + safeUrl + "' style='display:inline-block;padding:14px 32px;"
                + "background:linear-gradient(135deg,#A6C0CE 0%,#6B8A9A 100%);color:white;"
                + "text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;'>"
                + "Se connecter a Clenzy</a>"
                + "</div>"
                + "</div>"
                // Footer
                + "<div style='background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;text-align:center;'>"
                + "<p style='margin:0;color:#94a3b8;font-size:12px;'>Cet email a ete envoye automatiquement. Si vous n'etes pas a l'origine de cette demande, contactez votre administrateur.</p>"
                + "</div>"
                + "</div></body></html>";
    }

    /** Corps HTML de la confirmation d'inscription (CTA creation mot de passe + expiration). */
    public String renderInscriptionConfirmationHtml(String fullName, String confirmationLink,
                                                    LocalDateTime expiresAt) {
        String safeName = StringUtils.escapeHtml(fullName);
        String safeLink = StringUtils.escapeHtml(confirmationLink);
        String expiresStr = expiresAt != null
                ? expiresAt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy a HH:mm"))
                : "72 heures";

        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>"
                + "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>"
                // Header — couleurs Clenzy
                + "<div style='background:linear-gradient(135deg,#A6C0CE 0%,#6B8A9A 100%);padding:30px;border-radius:10px 10px 0 0;text-align:center;'>"
                + "<h1 style='color:white;margin:0;font-size:24px;'>Bienvenue sur Clenzy !</h1>"
                + "</div>"
                // Body
                + "<div style='background:#ffffff;padding:30px;border:1px solid #e2e8f0;'>"
                + "<p style='font-size:16px;color:#334155;'>Bonjour " + safeName + ",</p>"
                + "<p style='font-size:15px;color:#475569;'>Votre paiement a ete confirme avec succes. "
                + "Pour finaliser votre inscription, cliquez sur le bouton ci-dessous afin de confirmer votre adresse email "
                + "et creer votre mot de passe.</p>"
                // CTA Button — gradient Clenzy
                + "<div style='text-align:center;margin:30px 0;'>"
                + "<a href='" + safeLink + "' style='display:inline-block;padding:14px 32px;"
                + "background:linear-gradient(135deg,#A6C0CE 0%,#6B8A9A 100%);color:white;"
                + "text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;'>"
                + "Creer mon mot de passe</a>"
                + "</div>"
                + "<p style='font-size:13px;color:#94a3b8;'>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>"
                + "<p style='font-size:12px;color:#6B8A9A;word-break:break-all;'>" + safeLink + "</p>"
                + "</div>"
                // Footer
                + "<div style='background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;text-align:center;'>"
                + "<p style='margin:0;color:#94a3b8;font-size:12px;'>Ce lien expire le " + StringUtils.escapeHtml(expiresStr) + ".</p>"
                + "<p style='margin:5px 0 0;color:#94a3b8;font-size:12px;'>Si vous n'avez pas demande cette inscription, vous pouvez ignorer ce message.</p>"
                + "</div>"
                + "</div></body></html>";
    }
}
