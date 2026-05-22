package com.clenzy.integration.external;

import com.clenzy.integration.external.service.ExternalServiceConnectionService;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;

/**
 * Odoo — ERP polyvalent, signature via le module "Sign" (Odoo Enterprise).
 *
 * Pour la signature electronique, Odoo n'est pas un QTSP au sens strict mais
 * propose une signature SES native + AES via modules tiers. Pour une signature
 * juridiquement opposable (QES), preferer un QTSP francais (Yousign, Universign,
 * DocaPoste).
 *
 * Utilise le pattern unifie {@link AbstractExternalSignatureProvider} :
 *   - Persistance via {@link ExternalServiceConnectionService}
 *   - Test de connexion via {@code OdooConnectionTestStrategy}
 *   - Routing via {@code ExternalConnectionController} ({@code /api/integrations/external/ODOO/...})
 *
 * Stub pour les operations de signature : a cabler quand l'organisation
 * aura une instance Odoo Enterprise accessible avec le module Sign installe.
 */
@Service
public class OdooSignatureProvider extends AbstractExternalSignatureProvider {

    public OdooSignatureProvider(ExternalServiceConnectionService connectionService,
                                  TenantContext tenantContext) {
        super(connectionService, tenantContext);
    }

    @Override
    public SignatureProviderType getType() {
        return SignatureProviderType.ODOO;
    }
}
