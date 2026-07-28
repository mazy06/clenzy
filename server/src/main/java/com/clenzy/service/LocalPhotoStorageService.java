package com.clenzy.service;

import com.clenzy.model.PropertyPhoto;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.service.storage.BinaryAssetStorage;
import com.clenzy.tenant.TenantContext;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Implementation PostgreSQL (BYTEA) du {@link PhotoStorageService} — impl par defaut.
 *
 * <p><b>Activation</b> : tant que {@code clenzy.storage.photos} est absent ou vaut
 * {@code bytea} ({@code matchIfMissing = true}). Poser {@code clenzy.storage.photos=object}
 * bascule sur {@code ObjectStoragePhotoService}. Les deux conditions portant sur la meme
 * cle, il n'y a JAMAIS deux {@code @Primary} actifs simultanement.</p>
 *
 * <h2>Deux familles de cles</h2>
 * Cette impl sert deux usages qui n'ont pas la meme origine de cle :
 * <ul>
 *   <li><b>Cle org-scopee</b> {@code org/{orgId}/photos/{uuid}} — produite par {@link #store}
 *       (mediatheque du Studio) et par le job de migration. Les octets vivent dans
 *       {@code binary_asset} via {@link BinaryAssetStorage}. <b>Meme format que l'impl objet</b>,
 *       ce qui rend la bascule du flag transparente pour les appelants.</li>
 *   <li><b>Cle numerique legacy</b> {@code "1234"} — un {@code property_photos.id}. Les octets
 *       vivent dans la colonne {@code data}. Historique : conserve en lecture pour les lignes
 *       anterieures au changeset 0369, qui a remis ces cles a NULL.</li>
 * </ul>
 *
 * <p>Note : {@code PropertyPhotoService} n'appelle pas {@link #store} — a l'upload il ecrit le
 * BYTEA et laisse {@code storage_key} NULL (aucun IO reseau dans la transaction d'upload,
 * regle audit #2). Il ne delegue ici que lorsque {@code storage_key} est non-null.</p>
 */
@Service
@Primary
@ConditionalOnProperty(name = "clenzy.storage.photos", havingValue = "bytea", matchIfMissing = true)
public class LocalPhotoStorageService implements PhotoStorageService {

    /** Prefixe org-scope, identique a celui de {@code ObjectStoragePhotoService}. */
    private static final Pattern KEY_PATTERN = Pattern.compile("^org/(\\d+)/photos/[^/]+$");

    private final PropertyPhotoRepository photoRepository;
    private final OrganizationAccessGuard organizationAccessGuard;
    private final BinaryAssetStorage binaryAssetStorage;
    private final TenantContext tenantContext;

    public LocalPhotoStorageService(PropertyPhotoRepository photoRepository,
                                    OrganizationAccessGuard organizationAccessGuard,
                                    BinaryAssetStorage binaryAssetStorage,
                                    TenantContext tenantContext) {
        this.photoRepository = photoRepository;
        this.organizationAccessGuard = organizationAccessGuard;
        this.binaryAssetStorage = binaryAssetStorage;
        this.tenantContext = tenantContext;
    }

    /**
     * Persiste les octets dans {@code binary_asset} sous une cle org-scopee et la retourne.
     *
     * <p>Renvoyait auparavant le litteral {@code "pending"}, a charge de l'appelant de le
     * remplacer. Aucun appelant ne le faisait : {@code MediaLibraryService} stockait donc
     * {@code storage_key = "pending"}, et la relecture echouait en {@code NumberFormatException}
     * — la mediatheque du Studio etait cassee en mode BYTEA.</p>
     */
    @Override
    public String store(byte[] data, String contentType, String originalFilename) {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        final String key = "org/" + orgId + "/photos/" + UUID.randomUUID();
        binaryAssetStorage.store(key, contentType, data);
        return key;
    }

    @Override
    public byte[] retrieve(String storageKey) {
        if (storageKey != null && KEY_PATTERN.matcher(storageKey).matches()) {
            return binaryAssetStorage.load(storageKey)
                    .map(BinaryAssetStorage.StoredBinaryAsset::bytes)
                    .orElseThrow(() -> new IllegalArgumentException("Photo not found: " + storageKey));
        }
        final long id = parseLegacyId(storageKey);
        return photoRepository.findById(id)
                .map(PropertyPhoto::getData)
                .orElseThrow(() -> new IllegalArgumentException("Photo not found: " + storageKey));
    }

    /**
     * Garde fail-closed appelee avant {@link #retrieve} quand la cle est controlee par le client
     * (ex : refs d'attachments re-injectees dans le body du chat assistant).
     *
     * <p>Cle org-scopee → l'{@code orgId} est extrait du prefixe. Cle numerique legacy → on
     * charge la photo ({@code findById} ne traverse PAS le filtre Hibernate) et on valide son
     * {@code organizationId}. Dans les deux cas, cle malformee ou ressource absente → refus,
     * sans distinguer "non autorise" de "n'existe pas" (anti-enumeration).</p>
     */
    @Override
    public void assertReadableInCurrentOrg(String storageKey) {
        if (storageKey == null) {
            throw new AccessDeniedException("Attachment non autorise");
        }
        final Matcher matcher = KEY_PATTERN.matcher(storageKey);
        if (matcher.matches()) {
            final long keyOrgId;
            try {
                keyOrgId = Long.parseLong(matcher.group(1));
            } catch (NumberFormatException e) {
                throw new AccessDeniedException("Attachment non autorise");
            }
            organizationAccessGuard.requireSameOrganization(keyOrgId, "Attachment non autorise");
            return;
        }
        final long id;
        try {
            id = Long.parseLong(storageKey);
        } catch (NumberFormatException e) {
            throw new AccessDeniedException("Attachment non autorise");
        }
        final PropertyPhoto photo = photoRepository.findById(id)
                .orElseThrow(() -> new AccessDeniedException("Attachment non autorise"));
        organizationAccessGuard.requireSameOrganization(
                photo.getOrganizationId(), "Attachment non autorise");
    }

    /**
     * Cle org-scopee → suppression dans {@code binary_asset}. Cle numerique legacy → no-op :
     * les octets sont portes par {@code property_photos.data}, dont la suppression est geree
     * par l'appelant (cascade JPA / {@code deleteByIdAndPropertyId}).
     */
    @Override
    public void delete(String storageKey) {
        if (storageKey != null && KEY_PATTERN.matcher(storageKey).matches()) {
            binaryAssetStorage.delete(storageKey);
        }
    }

    private long parseLegacyId(String storageKey) {
        try {
            return Long.parseLong(storageKey);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Cle de stockage invalide: " + storageKey, e);
        }
    }
}
