package com.clenzy.service.storage;

import com.clenzy.model.InterventionPhoto;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Strategie {@link InterventionPhotoBinaryStore} sur <b>stockage objet</b> S3-compatible
 * (OVH Object Storage via le client vendor-neutral {@link ObjectStorageClient}).
 *
 * <p><b>Activation</b> : uniquement quand {@code clenzy.storage.intervention-photos=object}.
 * Tant que le flag vaut {@code bytea} (defaut), ce bean n'est pas instancie et les octets
 * sont lus depuis le BYTEA — <b>aucun changement</b>.</p>
 *
 * <h2>Cle org-scopee</h2>
 * Format ecrit par le job de migration : {@code org/{orgId}/intervention-photos/{uuid}}.
 * Bucket = {@code bucketMedia} (meme bucket que les photos de propriete ; on ne cree PAS
 * de nouveau bucket). La lecture <b>verifie</b> l'{@code orgId} par parsing du prefixe
 * ({@link #assertReadableInCurrentOrg}).
 *
 * <h2>Securite (fail-closed)</h2>
 * <ul>
 *   <li>Pas d'URL publique : les octets sont lus via {@link ObjectStorageClient#get}.</li>
 *   <li>{@code assertReadableInCurrentOrg} extrait l'{@code orgId} du prefixe et le compare au
 *       tenant courant via {@link OrganizationAccessGuard} (bypass platform staff / org SYSTEM
 *       coherent avec le filtre Hibernate, que {@code findById} ne traverse pas). Cle malformee
 *       → refus, sans distinguer "non autorise" de "format invalide" (anti-enumeration).</li>
 * </ul>
 */
@Component
@ConditionalOnProperty(name = "clenzy.storage.intervention-photos", havingValue = "object")
public class ObjectInterventionPhotoStore implements InterventionPhotoBinaryStore {

    /** Prefixe org-scope : {@code org/{orgId}/intervention-photos/{uuid}}. */
    private static final Pattern KEY_PATTERN = Pattern.compile("^org/(\\d+)/intervention-photos/[^/]+$");

    private final ObjectStorageClient client;
    private final OrganizationAccessGuard organizationAccessGuard;

    public ObjectInterventionPhotoStore(ObjectStorageClient client,
                                        OrganizationAccessGuard organizationAccessGuard) {
        this.client = client;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    @Override
    public byte[] resolveBytes(InterventionPhoto photo) {
        final String storageKey = photo.getStorageKey();
        assertReadableInCurrentOrg(storageKey);
        return client.get(storageKey);
    }

    /**
     * Garde fail-closed : extrait l'{@code orgId} du prefixe {@code org/{orgId}/intervention-photos/...}
     * et le compare au tenant courant via {@link OrganizationAccessGuard}.
     */
    private void assertReadableInCurrentOrg(String storageKey) {
        if (storageKey == null) {
            throw new AccessDeniedException("Photo d'intervention non autorisee");
        }
        final Matcher matcher = KEY_PATTERN.matcher(storageKey);
        if (!matcher.matches()) {
            throw new AccessDeniedException("Photo d'intervention non autorisee");
        }
        final long keyOrgId;
        try {
            keyOrgId = Long.parseLong(matcher.group(1));
        } catch (NumberFormatException e) {
            throw new AccessDeniedException("Photo d'intervention non autorisee");
        }
        organizationAccessGuard.requireSameOrganization(keyOrgId, "Photo d'intervention non autorisee");
    }
}
