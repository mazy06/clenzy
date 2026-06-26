package com.clenzy.service.storage;

import com.clenzy.exception.DocumentStorageException;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Strategie {@link DocumentBinaryStore} sur <b>stockage objet</b> S3-compatible
 * (OVH Object Storage via le client vendor-neutral {@link ObjectStorageClient}).
 *
 * <p><b>Activation</b> : uniquement quand {@code clenzy.storage.documents=object}. Tant que
 * le flag vaut {@code disk} (defaut), ce bean n'est pas instancie et les services de documents
 * conservent leur comportement disque historique — <b>aucun changement</b>.</p>
 *
 * <h2>Cle org-scopee</h2>
 * La cle logique fournie par le service appelant (ex : {@code FACTURE/2026-06/<uuid>_nom.pdf})
 * est prefixee en {@code org/{orgId}/documents/<cle logique>} a l'ecriture, l'{@code orgId}
 * etant resolu via {@link TenantContext}. La cle complete est retournee comme reference
 * persistee ; les lectures la re-utilisent verbatim.
 *
 * <h2>Securite (fail-closed)</h2>
 * <ul>
 *   <li>Pas d'URL publique : la lecture des octets passe par {@link ObjectStorageClient#get}
 *       (les appelants qui exposent un lien temporaire utilisent {@link ObjectStorageClient#presignGet}).</li>
 *   <li>Avant toute lecture/suppression, {@code assertSameOrg} extrait l'{@code orgId} du prefixe
 *       de la cle et le compare au tenant courant via {@link OrganizationAccessGuard}
 *       (bypass platform staff / org SYSTEM coherent avec le filtre Hibernate). Cle hors
 *       prefixe {@code org/{orgId}/documents/} → refus.</li>
 * </ul>
 */
@Component
@ConditionalOnProperty(name = "clenzy.storage.documents", havingValue = "object")
public class ObjectDocumentBinaryStore implements DocumentBinaryStore {

    private static final Logger log = LoggerFactory.getLogger(ObjectDocumentBinaryStore.class);

    /** Prefixe org-scope : {@code org/{orgId}/documents/...}. */
    private static final Pattern KEY_PATTERN = Pattern.compile("^org/(\\d+)/documents/.+$");

    private final ObjectStorageClient client;
    private final TenantContext tenantContext;
    private final OrganizationAccessGuard organizationAccessGuard;

    public ObjectDocumentBinaryStore(ObjectStorageClient client,
                                     TenantContext tenantContext,
                                     OrganizationAccessGuard organizationAccessGuard) {
        this.client = client;
        this.tenantContext = tenantContext;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    @Override
    public String write(String logicalKey, byte[] data, String contentType) {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        final String key = "org/" + orgId + "/documents/" + logicalKey;
        client.put(client.documentsBucket(), key, data, contentType);
        log.info("Stored document in object storage: orgId={}, key={}, size={}", orgId, key, data.length);
        return key;
    }

    @Override
    public byte[] loadAsBytes(String storageRef) {
        assertSameOrg(storageRef);
        return client.get(client.documentsBucket(), storageRef);
    }

    @Override
    public Resource load(String storageRef) {
        return new ByteArrayResource(loadAsBytes(storageRef));
    }

    @Override
    public boolean exists(String storageRef) {
        if (storageRef == null || storageRef.isBlank()) {
            return false;
        }
        if (!KEY_PATTERN.matcher(storageRef).matches()) {
            return false;
        }
        return client.exists(client.documentsBucket(), storageRef);
    }

    @Override
    public void delete(String storageRef) {
        if (storageRef == null || storageRef.isBlank()) {
            return;
        }
        assertSameOrg(storageRef);
        client.delete(client.documentsBucket(), storageRef);
    }

    /**
     * Garde fail-closed : extrait l'{@code orgId} du prefixe {@code org/{orgId}/documents/...}
     * et le compare au tenant courant via {@link OrganizationAccessGuard}. Cle malformee → refus
     * (sans distinguer "non autorise" de "format invalide", anti-enumeration).
     */
    private void assertSameOrg(String storageRef) {
        if (storageRef == null) {
            throw new DocumentStorageException("Document non autorise");
        }
        final Matcher matcher = KEY_PATTERN.matcher(storageRef);
        if (!matcher.matches()) {
            throw new DocumentStorageException("Document non autorise");
        }
        final long keyOrgId;
        try {
            keyOrgId = Long.parseLong(matcher.group(1));
        } catch (NumberFormatException e) {
            throw new DocumentStorageException("Document non autorise");
        }
        try {
            organizationAccessGuard.requireSameOrganization(keyOrgId, "Document non autorise");
        } catch (AccessDeniedException e) {
            // Conserver la semantique d'exception de stockage des appelants existants.
            throw new DocumentStorageException("Document non autorise", e);
        }
    }
}
