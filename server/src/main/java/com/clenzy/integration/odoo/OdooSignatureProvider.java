package com.clenzy.integration.odoo;

import com.clenzy.integration.odoo.service.OdooService;
import com.clenzy.service.signature.SignatureProvider;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.service.signature.SignatureRequest;
import com.clenzy.service.signature.SignatureResult;
import com.clenzy.service.signature.SignatureStatus;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Implementation Odoo du fournisseur de signature electronique.
 *
 * <h2>Etat actuel : stub</h2>
 * Toute l'infrastructure (entity, controller, service, frontend) est en place
 * pour permettre a une organisation de saisir ses credentials Odoo. Mais les
 * appels reels au module "Sign" d'Odoo (JSON-RPC sur /sign.request)
 * ne sont pas encore implementes — chaque methode leve
 * UnsupportedOperationException avec un message explicatif.
 *
 * <h2>Pourquoi ce stub ?</h2>
 * L'organisation propriedaire du projet n'a pas encore d'instance Odoo
 * pour tester. Une fois qu'elle aura un compte, on viendra cabler les
 * appels reels XML-RPC / JSON-RPC vers Odoo. Le stub permet de :
 *   - configurer la connexion (URL + API key) cote UI
 *   - choisir Odoo comme provider via le radio button
 *   - tester que le bean SignatureProvider est bien resolu par le registry
 *
 * <h2>Conditional activation</h2>
 * Le bean est toujours instancie (pas de @ConditionalOnProperty) — au moins
 * pour permettre au SignatureProviderRegistry de le lister comme disponible
 * dans l'enum. {@link #isAvailable()} retourne false tant que l'organisation
 * courante n'a pas de connexion configuree (verifie en runtime via OdooService).
 */
@Service
public class OdooSignatureProvider implements SignatureProvider {

    private static final Logger log = LoggerFactory.getLogger(OdooSignatureProvider.class);
    private static final String NOT_IMPLEMENTED_MSG =
            "Odoo signature provider is not yet implemented. " +
                    "Connection scaffolding is in place; signature module integration pending.";

    private final OdooService odooService;
    private final TenantContext tenantContext;

    public OdooSignatureProvider(OdooService odooService, TenantContext tenantContext) {
        this.odooService = odooService;
        this.tenantContext = tenantContext;
    }

    @Override
    public SignatureProviderType getType() {
        return SignatureProviderType.ODOO;
    }

    @Override
    public SignatureResult createSignatureRequest(SignatureRequest request) {
        log.warn("OdooSignatureProvider.createSignatureRequest called but not implemented yet");
        throw new UnsupportedOperationException(NOT_IMPLEMENTED_MSG);
    }

    @Override
    public SignatureStatus getStatus(String signatureRequestId) {
        log.warn("OdooSignatureProvider.getStatus called but not implemented yet");
        throw new UnsupportedOperationException(NOT_IMPLEMENTED_MSG);
    }

    @Override
    public byte[] getSignedDocument(String signatureRequestId) {
        log.warn("OdooSignatureProvider.getSignedDocument called but not implemented yet");
        throw new UnsupportedOperationException(NOT_IMPLEMENTED_MSG);
    }

    @Override
    public boolean isAvailable() {
        // Disponible uniquement si l'organisation courante a une connexion Odoo active.
        // L'impl reelle n'est pas encore cablee donc on garde false meme si connectee
        // — on le passera a true quand la signature sera vraiment implementee.
        try {
            Long orgId = tenantContext.getOrganizationId();
            if (orgId == null) return false;
            return odooService.isConnected(orgId) && false; // false jusqu'a impl reelle
        } catch (Exception e) {
            return false;
        }
    }
}
