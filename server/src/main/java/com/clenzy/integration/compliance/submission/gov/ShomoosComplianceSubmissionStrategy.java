package com.clenzy.integration.compliance.submission.gov;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.submission.ComplianceProviderPendingException;
import com.clenzy.integration.compliance.submission.ComplianceSubmissionStrategy;
import com.clenzy.integration.compliance.submission.SubmissionResult;
import com.clenzy.model.GuestDeclaration;
import org.springframework.stereotype.Service;

/**
 * Stratégie Shomoos Arabie Saoudite (enregistrement voyageurs hébergement) —
 * <b>stub honnête</b>.
 *
 * <p>Shomoos (شموس) est la plateforme nationale d'enregistrement des voyageurs
 * pour les établissements d'hébergement saoudiens (obligatoire, contrôlée par le
 * ministère de l'Intérieur). L'accès API est réservé aux établissements licenciés
 * et aux intégrateurs conventionnés : specs et credentials sont délivrés après
 * enregistrement officiel. On NE devine PAS de contrat HTTP : la stratégie lève
 * une {@link ComplianceProviderPendingException} explicite, tracée par
 * l'orchestrateur (déclaration non SUBMITTED).</p>
 */
@Service
public class ShomoosComplianceSubmissionStrategy implements ComplianceSubmissionStrategy {

    @Override
    public ComplianceProviderType provider() {
        return ComplianceProviderType.SHOMOOS;
    }

    @Override
    public SubmissionResult submit(GuestDeclaration declaration, ComplianceConnection connection, String apiKey) {
        throw new ComplianceProviderPendingException(ComplianceProviderType.SHOMOOS,
                "Intégration directe Shomoos (Arabie Saoudite) en attente de specs et credentials "
                        + "officiels (plateforme nationale d'enregistrement hébergement — accès réservé "
                        + "aux établissements licenciés et intégrateurs conventionnés).");
    }
}
