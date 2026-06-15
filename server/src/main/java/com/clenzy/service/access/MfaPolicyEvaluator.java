package com.clenzy.service.access;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Locale;
import java.util.Set;

/**
 * Decision de politique 2FA (CLZ-P0-09), partie applicative.
 *
 * <p>Logique pure et testable : a partir des claims d'authentification du JWT
 * ({@code amr} = methodes utilisees, {@code acr} = niveau d'assurance) et de la
 * policy de l'organisation ({@code Organization.mfaRequired}), decide si l'acces
 * satisfait l'exigence de double facteur.</p>
 *
 * <p><b>Perimetre</b> : ce composant fournit la decision. Son <b>cablage dans la
 * chaine de securite</b> (rejet/step-up) doit etre fait de façon coordonnee avec
 * la configuration du realm Keycloak (clenzy-infra : required action
 * {@code CONFIGURE_TOTP}, OTP conditionnel dans le browser flow, emission des
 * claims {@code acr}/{@code amr}). Tant que le realm n'emet pas ces claims,
 * activer l'enforcement verrouillerait les utilisateurs — voir HORS-PERIMETRE
 * (reste de CLZ-P0-09).</p>
 */
@Component
public class MfaPolicyEvaluator {

    /** Methodes d'authentification (claim {@code amr}) attestant un second facteur. */
    private static final Set<String> MFA_METHODS = Set.of("otp", "totp", "mfa", "hwk", "hotp");

    /** Valeurs de niveau d'assurance (claim {@code acr}) attestant un MFA. */
    private static final Set<String> MFA_ACR = Set.of("2", "mfa", "aal2", "loa2");

    /**
     * Vrai si les claims attestent qu'un second facteur a ete utilise.
     */
    public boolean isMfaSatisfied(Collection<String> amr, String acr) {
        if (amr != null) {
            for (String method : amr) {
                if (method != null && MFA_METHODS.contains(method.trim().toLowerCase(Locale.ROOT))) {
                    return true;
                }
            }
        }
        return acr != null && MFA_ACR.contains(acr.trim().toLowerCase(Locale.ROOT));
    }

    /**
     * Acces autorise du point de vue 2FA : soit l'organisation n'exige pas la 2FA,
     * soit elle l'exige et le second facteur a ete satisfait.
     */
    public boolean isAccessAllowed(boolean orgMfaRequired, Collection<String> amr, String acr) {
        return !orgMfaRequired || isMfaSatisfied(amr, acr);
    }
}
