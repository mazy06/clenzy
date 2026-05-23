package com.clenzy.payment.payout.openbanking;

/**
 * Providers Open Banking PIS supportés par Clenzy.
 *
 * <h2>Différences clés</h2>
 * <ul>
 *   <li><strong>GOCARDLESS</strong> : UK FCA, gratuit jusqu'à 50 connections/mois,
 *       couverture 2400+ banques EU. API REST simple. Bon pour démarrer.</li>
 *   <li><strong>TINK</strong> : VISA-owned, leader EU, plus de banques connectées
 *       mais pricing dès le 1er virement. Pour scale-up futur.</li>
 * </ul>
 *
 * <p>Note : ces noms sont utilisés comme valeurs string dans
 * {@code owner_payout_config.open_banking_provider} (pas un enum SQL pour
 * éviter une migration si on ajoute un provider).</p>
 */
public enum OpenBankingProvider {
    GOCARDLESS,
    TINK
}
