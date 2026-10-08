import { useEffect, useState } from 'react';
import keycloak, { authReadyPromise, keycloakInitPromise } from '../keycloak';

/**
 * Hook reactif qui retourne l'etat d'authentification Keycloak courant.
 *
 * <p>Necessaire car {@code keycloak.authenticated} est un champ mute en
 * dehors de React : les consumers qui font {@code if (keycloak.authenticated)}
 * dans un useEffect ne se re-evaluent pas quand l'etat change. Ce hook
 * subscribe aux 2 sources d'evenement d'auth pour declencher un re-render :</p>
 *
 * <ul>
 *   <li>{@code keycloak-auth-success} : evenement window dispatche depuis
 *       Login.tsx, InscriptionConfirm.tsx ET useAuth#handleAuthSuccess
 *       (couvre login API direct + restore SSO check-sso).</li>
 *   <li>{@code keycloak-auth-logout} : dispatche depuis useAuth#handleAuthLogout
 *       (clear de session).</li>
 * </ul>
 *
 * <p>Usage typique : gating de queries react-query pour ne pas spammer 401</p>
 * <pre>
 *   const isAuthed = useIsAuthenticated();
 *   const { data } = useQuery({ ..., enabled: isAuthed });
 * </pre>
 */
export function useIsAuthenticated(): boolean {
  const [authed, setAuthed] = useState<boolean>(() => Boolean(keycloak.authenticated));

  useEffect(() => {
    let active = true;
    const onSuccess = () => setAuthed(true);
    const onLogout = () => setAuthed(false);
    const syncRestoredSession = () => {
      if (active) setAuthed(Boolean(keycloak.authenticated));
    };

    window.addEventListener('keycloak-auth-success', onSuccess);
    window.addEventListener('keycloak-auth-logout', onLogout);

    // Filet de securite : si keycloak.authenticated a basculé entre l'init
    // du useState et le mount du useEffect (race init Keycloak), resynchroniser.
    setAuthed(Boolean(keycloak.authenticated));

    // Le bootstrap par cookie HttpOnly ne declenche pas onAuthSuccess.
    // Les providers montes avant sa resolution doivent aussi apprendre que
    // la session est prete, sinon leurs choix ne sont jamais sauvegardes.
    // Relire l'etat courant (pas la valeur de la promesse) respecte un logout
    // intervenu entre-temps et la fin plus tardive du check-sso.
    void authReadyPromise.then(syncRestoredSession, syncRestoredSession);
    void keycloakInitPromise.then(syncRestoredSession, syncRestoredSession);

    return () => {
      active = false;
      window.removeEventListener('keycloak-auth-success', onSuccess);
      window.removeEventListener('keycloak-auth-logout', onLogout);
    };
  }, []);

  return authed;
}
