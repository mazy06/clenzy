package com.clenzy.service;

import com.clenzy.service.storage.BinaryAssetStorage;
import com.clenzy.service.storage.ImageThumbnailer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Stockage des photos de profil des voyageurs.
 *
 * <p>Delegue a {@link BinaryAssetStorage} — Postgres BYTEA aujourd'hui, S3 le
 * jour ou l'on bascule {@code clenzy.storage.binary-assets}. Le
 * {@code storage_key} suit la convention {@code "guests/{guestId}/{uuid}.{ext}"}
 * et se range a cote de {@code "users/{userId}/..."} pose par
 * {@link UserAvatarStorageService}.</p>
 *
 * <h3>Pourquoi un service distinct de celui des utilisateurs</h3>
 * <p>Le service des utilisateurs entre par un {@code MultipartFile} : il valide
 * un formulaire d'upload. Les photos voyageurs arrivent en octets — d'un import
 * de canal, d'un jeu de demonstration — et n'ont pas de formulaire. Partager le
 * code aurait demande de generaliser une API de validation dont un seul des deux
 * appelants a besoin, pour economiser une trentaine de lignes.</p>
 */
@Service
public class GuestPhotoStorageService {

    /** Formats acceptes. Meme liste que les avatars utilisateurs. */
    private static final java.util.Set<String> ALLOWED_CONTENT_TYPES =
            java.util.Set.of("image/jpeg", "image/png", "image/webp");

    /** Plafond volontairement bas : un avatar s'affiche entre 26 et 44 px. */
    public static final long MAX_BYTES = 2L * 1024 * 1024;

    /** Cote de la vignette servie a l'ecran. L'avatar s'affiche entre 26 et 44 px
     *  CSS, soit 88 px au maximum sur un ecran a densite double. */
    private static final int DISPLAY_SIZE_PX = 96;

    /** Suffixe de la cle derivee. Le `.jpg` final garde `contentTypeFor` juste. */
    private static final String THUMB_SUFFIX = ".t" + DISPLAY_SIZE_PX + ".jpg";

    private static final Logger log = LoggerFactory.getLogger(GuestPhotoStorageService.class);

    private final BinaryAssetStorage storage;

    public GuestPhotoStorageService(BinaryAssetStorage storage) {
        this.storage = storage;
    }

    /**
     * Persiste la photo et retourne le {@code storage_key} a poser sur
     * {@code guests.avatar_url}.
     *
     * @throws IllegalArgumentException si le format ou la taille est refuse
     */
    public String store(Long guestId, String contentType, byte[] bytes) {
        if (guestId == null) throw new IllegalArgumentException("guestId est obligatoire");
        if (bytes == null || bytes.length == 0) throw new IllegalArgumentException("Photo vide");
        if (bytes.length > MAX_BYTES) {
            throw new IllegalArgumentException("Photo trop lourde (max " + (MAX_BYTES / 1024) + " Ko)");
        }
        String type = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        if (!ALLOWED_CONTENT_TYPES.contains(type)) {
            throw new IllegalArgumentException("Format non supporte : " + contentType);
        }
        String key = "guests/" + guestId + "/" + UUID.randomUUID() + "." + extensionFor(type);
        storage.store(key, type, bytes);
        return key;
    }

    /** Une photo prete a etre servie : ses octets ET son type MIME. */
    public record StoredPhoto(Resource resource, String contentType) {}

    /**
     * Charge la photo ET son type MIME en UNE lecture, ou {@link Optional#empty()}
     * si la cle ne designe rien — un objet efface hors flux Baitly ne doit pas
     * faire remonter une erreur 500.
     *
     * <p><b>Pourquoi cette methode existe.</b> L'appelant faisait
     * {@code load(key)} puis {@code contentTypeFor(key)} ; or les deux passaient
     * par {@code storage.load}, qui ramene TOUT le BYTEA. Chaque avatar etait
     * donc lu deux fois dans Postgres, la seconde lecture n'etant gardee que
     * pour son {@code content_type} — une chaine de dix caracteres. Sur un
     * planning qui en affiche cinquante, cela faisait cinquante lectures
     * d'image entierement jetees. {@code StoredBinaryAsset} portait le type
     * depuis le debut.</p>
     */
    public Optional<StoredPhoto> loadWithContentType(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return Optional.empty();
        return storage.load(storageKey)
                .map(asset -> new StoredPhoto(
                        new ByteArrayResource(asset.bytes()),
                        asset.contentType() == null ? "application/octet-stream" : asset.contentType()));
    }

    /**
     * Charge la photo pour le streaming HTTP, ou {@link Optional#empty()} si la
     * cle ne designe rien.
     *
     * <p>Prefere {@link #loadWithContentType} quand le type MIME est aussi
     * necessaire : deux appels ici coutent deux lectures du BYTEA.</p>
     */
    public Optional<Resource> load(String storageKey) {
        return loadWithContentType(storageKey).map(StoredPhoto::resource);
    }

    /**
     * La photo TELLE QU'ELLE SERA AFFICHEE : une vignette carree de
     * {@value #DISPLAY_SIZE_PX} px, fabriquee a la premiere demande puis rangee
     * a cote de l'original.
     *
     * <p>Les originaux font 192x192 pour une pastille de 26 px : sept fois les
     * pixels necessaires, cinquante fois par planning. La vignette tombe a un ou
     * deux kilo-octets.</p>
     *
     * <p><b>Derivee, jamais destructrice.</b> L'original reste en place sous sa
     * cle : c'est lui qui sert de source si la vignette doit etre refaite, et
     * c'est lui qu'on sert si la fabrication echoue. Le pire cas est donc l'etat
     * d'avant.</p>
     *
     * <p>La fabrication ecrit pendant un GET — c'est un remplissage de cache, pas
     * un effet metier. Deux requetes simultanees peuvent la faire deux fois : le
     * resultat est identique, et l'echec eventuel du second enregistrement est
     * avale au profit de l'original.</p>
     */
    public Optional<StoredPhoto> loadForDisplay(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return Optional.empty();

        final String thumbKey = storageKey + THUMB_SUFFIX;
        Optional<StoredPhoto> cached = loadWithContentType(thumbKey);
        if (cached.isPresent()) return cached;

        Optional<BinaryAssetStorage.StoredBinaryAsset> original = storage.load(storageKey);
        if (original.isEmpty()) return Optional.empty();

        byte[] bytes = original.get().bytes();
        Optional<byte[]> thumb = ImageThumbnailer.square(bytes, DISPLAY_SIZE_PX);
        if (thumb.isEmpty()) {
            // Image illisible par le JDK : on sert l'original plutot que rien.
            return Optional.of(new StoredPhoto(new ByteArrayResource(bytes), contentTypeFor(storageKey)));
        }

        try {
            storage.store(thumbKey, "image/jpeg", thumb.get());
        } catch (Exception e) {
            // Course avec une autre requete, ou stockage indisponible : la
            // vignette est deja calculee, on la sert sans l'avoir rangee.
            log.debug("Vignette non rangee pour {} : {}", thumbKey, e.getMessage());
        }
        return Optional.of(new StoredPhoto(new ByteArrayResource(thumb.get()), "image/jpeg"));
    }

    public void delete(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return;
        storage.delete(storageKey);
        // La vignette derivee part avec son original, sans quoi elle survivrait
        // seule sous une cle que plus personne ne demande.
        try {
            storage.delete(storageKey + THUMB_SUFFIX);
        } catch (Exception e) {
            log.debug("Vignette non supprimee pour {} : {}", storageKey, e.getMessage());
        }
    }

    /** Content type deduit de l'extension du storage_key, sinon relu avec les octets. */
    public String contentTypeFor(String storageKey) {
        if (storageKey == null) return "application/octet-stream";
        String lower = storageKey.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        return storage.load(storageKey)
                .map(asset -> asset.contentType())
                .orElse("application/octet-stream");
    }

    private static String extensionFor(String contentType) {
        return switch (contentType) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
    }
}
