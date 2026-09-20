import React from 'react';
import LegalDocPage from './LegalDocPage';

/**
 * Mentions legales — troisieme document du corpus, qui n'avait pas d'ecran
 * dans le PMS.
 *
 * <p>C'est le seul document qui identifie l'editeur : forme juridique, ICE,
 * registre de commerce, identifiant fiscal, directeur de la publication,
 * hebergeur. Le PMS n'en servait aucun, et ses anciennes CGU parlaient de
 * « la societe Baitly » sans pays ni immatriculation.</p>
 */
export default function MentionsLegales() {
  return <LegalDocPage slug="mentions-legales" />;
}
