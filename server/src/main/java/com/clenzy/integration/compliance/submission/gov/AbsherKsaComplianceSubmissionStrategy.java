package com.clenzy.integration.compliance.submission.gov;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.submission.ComplianceProviderPendingException;
import com.clenzy.integration.compliance.submission.ComplianceSubmissionStrategy;
import com.clenzy.integration.compliance.submission.SubmissionResult;
import com.clenzy.model.GuestDeclaration;
import org.springframework.stereotype.Service;

/**
 * Stratégie Absher Arabie Saoudite (MOI / Tawakkalna) — <b>stub honnête</b>.
 *
 * <p>La déclaration des voyageurs en Arabie Saoudite passe par la plateforme
 * gouvernementale Absher (ministère de l'Intérieur), <b>sans API publique ouverte</b>
 * aux intégrateurs tiers. Une vraie intégration nécessite un <b>partenariat officiel</b>
 * (habilitation, specs et credentials délivrés par l'autorité saoudienne). On NE simule
 * PAS d'appel HTTP : la stratégie lève une {@link ComplianceProviderPendingException}
 * explicite, tracée par l'orchestrateur (déclaration non SUBMITTED).</p>
 */
@Service
public class AbsherKsaComplianceSubmissionStrategy implements ComplianceSubmissionStrategy {

    @Override
    public ComplianceProviderType provider() {
        return ComplianceProviderType.ABSHER_KSA;
    }

    @Override
    public SubmissionResult submit(GuestDeclaration declaration, ComplianceConnection connection, String apiKey) {
        throw new ComplianceProviderPendingException(ComplianceProviderType.ABSHER_KSA,
                "Intégration directe Absher (Arabie Saoudite) en attente de specs et credentials "
                        + "officiels (plateforme gouvernementale MOI/Tawakkalna sans API publique — "
                        + "partenariat requis).");
    }
}
