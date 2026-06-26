package com.clenzy.service.storage;

import com.clenzy.service.PhotoStorageService;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Implementation {@link PhotoStorageService} sur <b>stockage objet</b> S3-compatible
 * (OVH Object Storage via le client MinIO vendor-neutral {@link ObjectStorageClient}).
 *
 * <p><b>Activation</b> : uniquement quand {@code clenzy.storage.photos=object}. Devient
 * alors l'impl {@code @Primary} (mutuellement exclusive avec {@code LocalPhotoStorageService},
 * voir le flag {@code clenzy.storage.photos}). Defaut = {@code bytea} → BYTEA conserve,
 * aucun changement de comportement.</p>
 *
 * <h2>Cle org-scopee</h2>
 * Format : {@code org/{orgId}/photos/{uuid}}. L'{@code orgId} est resolu via
 * {@link TenantContext} a l'ecriture, et <b>verifie</b> par parsing du prefixe a la
 * lecture controlee client ({@link #assertReadableInCurrentOrg}).
 *
 * <h2>Securite (fail-closed)</h2>
 * <ul>
 *   <li>Pas d'URL publique : l'acces de lecture passe par une URL presignee a TTL court
 *       cote appelant ({@link ObjectStorageClient#presignGet}).</li>
 *   <li>{@code assertReadableInCurrentOrg} extrait l'{@code orgId} du prefixe de la cle
 *       et le compare au tenant courant via {@link OrganizationAccessGuard} (bypass
 *       platform staff / org SYSTEM coherent avec le filtre Hibernate). Cle malformee
 *       → refus.</li>
 * </ul>
 */
@Service
@Primary
@ConditionalOnProperty(name = "clenzy.storage.photos", havingValue = "object")
public class ObjectStoragePhotoService implements PhotoStorageService {

    private static final Logger log = LoggerFactory.getLogger(ObjectStoragePhotoService.class);

    /** Prefixe org-scope : {@code org/{orgId}/photos/{uuid}}. */
    private static final Pattern KEY_PATTERN = Pattern.compile("^org/(\\d+)/photos/[^/]+$");

    private final ObjectStorageClient client;
    private final TenantContext tenantContext;
    private final OrganizationAccessGuard organizationAccessGuard;

    public ObjectStoragePhotoService(ObjectStorageClient client,
                                     TenantContext tenantContext,
                                     OrganizationAccessGuard organizationAccessGuard) {
        this.client = client;
        this.tenantContext = tenantContext;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    @Override
    public String store(byte[] data, String contentType, String originalFilename) {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        final String key = "org/" + orgId + "/photos/" + UUID.randomUUID();
        client.put(key, data, contentType);
        log.info("Stored photo in object storage: orgId={}, key={}, size={}", orgId, key, data.length);
        return key;
    }

    @Override
    public byte[] retrieve(String storageKey) {
        return client.get(storageKey);
    }

    /**
     * Garde fail-closed : extrait l'{@code orgId} du prefixe {@code org/{orgId}/photos/...}
     * et le compare au tenant courant via {@link OrganizationAccessGuard}
     * (bypass platform staff / org SYSTEM). Cle malformee → refus, sans distinguer
     * "non autorise" de "format invalide" (anti-enumeration).
     */
    @Override
    public void assertReadableInCurrentOrg(String storageKey) {
        if (storageKey == null) {
            throw new AccessDeniedException("Attachment non autorise");
        }
        final Matcher matcher = KEY_PATTERN.matcher(storageKey);
        if (!matcher.matches()) {
            throw new AccessDeniedException("Attachment non autorise");
        }
        final long keyOrgId;
        try {
            keyOrgId = Long.parseLong(matcher.group(1));
        } catch (NumberFormatException e) {
            throw new AccessDeniedException("Attachment non autorise");
        }
        organizationAccessGuard.requireSameOrganization(keyOrgId, "Attachment non autorise");
    }

    @Override
    public void delete(String storageKey) {
        client.delete(storageKey);
    }
}
