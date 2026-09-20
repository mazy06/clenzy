import React from 'react';
import LegalDocPage from './LegalDocPage';

/**
 * Politique de confidentialite — page publique, liee depuis l'inscription et
 * le pied de page.
 *
 * <p>Elle servait un stub qui qualifiait Baitly de RESPONSABLE DU TRAITEMENT
 * pour toutes les donnees et renvoyait a la seule CNIL. La politique publiee
 * dit l'inverse pour les donnees voyageurs — Baitly y est SOUS-TRAITANT au
 * sens de l'article 28, le client reste responsable — et designe la CNDP.
 * C'est la qualification qui decide qui repond a une demande d'acces et qui
 * porte la responsabilite en cas de violation.</p>
 */
export default function Privacy() {
  return <LegalDocPage slug="confidentialite" />;
}
