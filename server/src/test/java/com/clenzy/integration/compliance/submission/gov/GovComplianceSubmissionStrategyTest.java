package com.clenzy.integration.compliance.submission.gov;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.submission.ComplianceProviderPendingException;
import com.clenzy.model.GuestDeclaration;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Les providers gouvernementaux (DGSN Maroc / Absher KSA) n'ont pas d'API publique :
 * la stratégie lève une {@link ComplianceProviderPendingException} explicite — jamais
 * de faux appel HTTP.
 */
class GovComplianceSubmissionStrategyTest {

    @Test
    void policeMa_provider_andPendingException() {
        PoliceMaComplianceSubmissionStrategy strategy = new PoliceMaComplianceSubmissionStrategy();
        assertThat(strategy.provider()).isEqualTo(ComplianceProviderType.POLICE_MA);

        assertThatThrownBy(() -> strategy.submit(new GuestDeclaration(), new ComplianceConnection(), "key"))
                .isInstanceOf(ComplianceProviderPendingException.class)
                .hasMessageContaining("DGSN");
    }

    @Test
    void absherKsa_provider_andPendingException() {
        AbsherKsaComplianceSubmissionStrategy strategy = new AbsherKsaComplianceSubmissionStrategy();
        assertThat(strategy.provider()).isEqualTo(ComplianceProviderType.ABSHER_KSA);

        assertThatThrownBy(() -> strategy.submit(new GuestDeclaration(), new ComplianceConnection(), "key"))
                .isInstanceOf(ComplianceProviderPendingException.class)
                .hasMessageContaining("Absher");
    }

    @Test
    void shomoos_provider_andPendingException() {
        ShomoosComplianceSubmissionStrategy strategy = new ShomoosComplianceSubmissionStrategy();
        assertThat(strategy.provider()).isEqualTo(ComplianceProviderType.SHOMOOS);

        assertThatThrownBy(() -> strategy.submit(new GuestDeclaration(), new ComplianceConnection(), "key"))
                .isInstanceOf(ComplianceProviderPendingException.class)
                .hasMessageContaining("Shomoos");
    }
}
