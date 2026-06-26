package com.clenzy.integration.compliance.submission.gov;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.submission.ComplianceProviderPendingException;
import com.clenzy.integration.compliance.submission.ComplianceSubmissionStrategy;
import com.clenzy.integration.compliance.submission.SubmissionResult;
import com.clenzy.model.GuestDeclaration;
import org.springframework.stereotype.Service;

/**
 * Stratégie DGSN Maroc (fiche d'identification voyageur) — <b>stub honnête</b>.
 *
 * <p>La déclaration des voyageurs à la DGSN (Direction Générale de la Sûreté Nationale)
 * passe par un téléservice gouvernemental <b>sans API publique documentée</b>. Une vraie
 * intégration nécessite un <b>partenariat officiel</b> : conventionnement, specs techniques
 * et credentials délivrés par l'autorité marocaine. Tant que ces éléments ne sont pas
 * disponibles, on NE devine PAS de contrat HTTP : la stratégie lève une
 * {@link ComplianceProviderPendingException} explicite, que l'orchestrateur trace comme
 * un échec (la déclaration reste non SUBMITTED).</p>
 */
@Service
public class PoliceMaComplianceSubmissionStrategy implements ComplianceSubmissionStrategy {

    @Override
    public ComplianceProviderType provider() {
        return ComplianceProviderType.POLICE_MA;
    }

    @Override
    public SubmissionResult submit(GuestDeclaration declaration, ComplianceConnection connection, String apiKey) {
        throw new ComplianceProviderPendingException(ComplianceProviderType.POLICE_MA,
                "Intégration directe DGSN Maroc en attente de specs et credentials officiels "
                        + "(téléservice gouvernemental sans API publique — partenariat requis).");
    }
}
