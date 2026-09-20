import React from 'react';
import LegalDocPage from './LegalDocPage';
import { TERMS_SLUG } from './corpus';

/**
 * Conditions generales — page liee depuis la case obligatoire de l'inscription.
 *
 * <p>Elle servait un brouillon de dix articles, ecrit a part, qui annoncait le
 * droit francais et les tribunaux francais la ou les CGV publiees sur la
 * landing stipulent le droit marocain et le Tribunal de commerce. Deux
 * contrats pour un meme service, et c'est le brouillon que le client
 * acceptait. Elle rend maintenant le document publie.</p>
 */
export default function Cgu() {
  return <LegalDocPage slug={TERMS_SLUG} />;
}
