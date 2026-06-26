package com.clenzy.integration.compliance.submission;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.model.GuestDeclaration;

/**
 * SPI de soumission d'une {@link GuestDeclaration} au téléservice de conformité
 * (déclaration de voyageurs auprès des autorités).
 *
 * <p>Une implémentation par {@link ComplianceProviderType} (Chekin / DGSN Maroc /
 * Absher KSA). Le {@link com.clenzy.integration.compliance.submission.ComplianceSubmissionService
 * orchestrateur} indexe les stratégies par {@link #provider()} et délègue.</p>
 *
 * <p><b>Contrat audit</b> : {@link #submit} est appelé <b>hors transaction DB</b>
 * (effet externe post-commit). L'implémentation reçoit la déclaration déjà déchiffrée
 * par les converters JPA, la connexion, et la clé API <b>déjà déchiffrée</b> par
 * l'orchestrateur (la stratégie ne manipule pas le chiffrement). Elle ne persiste rien :
 * elle renvoie un {@link SubmissionResult} que l'orchestrateur matérialise dans une
 * nouvelle transaction.</p>
 */
public interface ComplianceSubmissionStrategy {

    /** Provider couvert par cette stratégie. */
    ComplianceProviderType provider();

    /**
     * Transmet la déclaration au provider. Ne lève PAS pour un rejet métier
     * (retourner {@code SubmissionResult.rejected(...)}) ; peut lever une
     * {@link ComplianceProviderPendingException} pour un provider non encore
     * intégré (DGSN / Absher), que l'orchestrateur trace comme un échec explicite.
     *
     * @param declaration déclaration COMPLETED à transmettre (PII déjà déchiffrées)
     * @param connection  connexion ACTIVE de l'organisation (serverUrl + accountIdentifier)
     * @param apiKey      clé API déchiffrée par l'orchestrateur
     * @return résultat de la soumission
     */
    SubmissionResult submit(GuestDeclaration declaration, ComplianceConnection connection, String apiKey);
}
