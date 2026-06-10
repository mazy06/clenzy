package com.clenzy.service.signature;

/**
 * Types de fournisseurs de signature electronique supportes.
 *
 * <h2>Niveaux eIDAS supportes</h2>
 * Selon l'article 25 du reglement eIDAS (UE 910/2014) :
 * <ul>
 *   <li><b>SES</b> (Simple) : pas de QTSP requis, valeur juridique faible</li>
 *   <li><b>AES</b> (Avancee) : identite signataire verifiee + integrite document</li>
 *   <li><b>QES</b> (Qualifiee) : equivalent juridique signature manuscrite. Requiert
 *       un QTSP (Qualified Trust Service Provider) certifie ANSSI ou organisme
 *       europeen equivalent (ETSI EN 319 401).</li>
 * </ul>
 *
 * <h2>Liste des providers</h2>
 * <table>
 *   <caption>Statut QTSP et niveaux disponibles</caption>
 *   <tr><th>Provider</th><th>QTSP</th><th>Niveaux</th><th>Auth</th></tr>
 *   <tr><td>YOUSIGN</td><td>ANSSI (FR)</td><td>SES + AES + QES</td><td>API key</td></tr>
 *   <tr><td>UNIVERSIGN</td><td>ANSSI (FR)</td><td>SES + AES + QES</td><td>API key</td></tr>
 *   <tr><td>DOCAPOSTE</td><td>ANSSI (FR)</td><td>SES + AES + QES + LRE</td><td>API key</td></tr>
 *   <tr><td>DOCUSIGN</td><td>via partenaires QTSP</td><td>SES + AES + QES</td><td>OAuth2</td></tr>
 *   <tr><td>PENNYLANE</td><td>(non QTSP, SES uniquement)</td><td>SES</td><td>OAuth2</td></tr>
 *   <tr><td>ODOO</td><td>(via modules tiers selon instance)</td><td>variable</td><td>API key</td></tr>
 *   <tr><td>DOCUSEAL</td><td>(non QTSP, open source self-hosted)</td><td>SES + scellement PAdES</td><td>API key (instance)</td></tr>
 *   <tr><td>CLENZY_CUSTOM</td><td>n/a</td><td>workflow interne</td><td>n/a</td></tr>
 * </table>
 */
public enum SignatureProviderType {
    PENNYLANE,
    DOCUSIGN,
    ODOO,
    /** Yousign — QTSP francais (Caen). Pure player FR, prix PME. */
    YOUSIGN,
    /** Universign (Quadient) — QTSP francais. Enterprise / banques. */
    UNIVERSIGN,
    /** DocaPoste (La Poste) — QTSP francais. Atout : LRE (lettre recommandee electronique). */
    DOCAPOSTE,
    /** DocuSeal — open source auto-hébergé (clenzy-infra). SES + scellement cryptographique du PDF. */
    DOCUSEAL,
    /** Workflow interne Clenzy (sans tiers, niveau SES uniquement). */
    CLENZY_CUSTOM
}
