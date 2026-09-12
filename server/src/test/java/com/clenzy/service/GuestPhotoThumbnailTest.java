package com.clenzy.service;

import com.clenzy.service.storage.BinaryAssetStorage;
import com.clenzy.service.storage.ImageThumbnailer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La vignette des avatars : ce qui part sur le reseau doit etre a la taille
 * d'affichage, pas l'original.
 *
 * <p>Les avatars sont stockes en 192x192 et affiches entre 26 et 44 px. Un
 * planning en montre une cinquantaine : la difference se compte en centaines
 * de kilo-octets par chargement.</p>
 */
@DisplayName("Vignette des photos de voyageur")
class GuestPhotoThumbnailTest {

    /** Stockage en memoire, qui COMPTE ses lectures : c'est l'objet du test. */
    private static final class CountingStorage implements BinaryAssetStorage {
        final Map<String, StoredBinaryAsset> assets = new HashMap<>();
        int loads = 0;

        @Override public void store(String key, String contentType, byte[] bytes) {
            assets.put(key, new StoredBinaryAsset(bytes, contentType, bytes.length));
        }
        @Override public Optional<StoredBinaryAsset> load(String key) {
            loads++;
            return Optional.ofNullable(assets.get(key));
        }
        @Override public boolean exists(String key) { return assets.containsKey(key); }
        @Override public void delete(String key) { assets.remove(key); }
    }

    private static byte[] jpeg(int width, int height) throws Exception {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.decode("#6B8A9A"));
        g.fillRect(0, 0, width, height);
        g.setColor(Color.WHITE);
        g.fillOval(width / 4, height / 4, width / 2, height / 2);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "jpeg", out);
        return out.toByteArray();
    }

    @Test
    @DisplayName("une image illisible ne rend pas de vignette (et ne leve pas)")
    void unreadableBytesYieldNothing() {
        assertThat(ImageThumbnailer.square("pas une image".getBytes(), 96)).isEmpty();
        assertThat(ImageThumbnailer.square(null, 96)).isEmpty();
        assertThat(ImageThumbnailer.square(new byte[0], 96)).isEmpty();
    }

    @Test
    @DisplayName("la vignette est carree, a la bonne taille, et bien plus legere")
    void thumbnailIsSmaller() throws Exception {
        byte[] original = jpeg(192, 192);
        byte[] thumb = ImageThumbnailer.square(original, 96).orElseThrow();

        BufferedImage decoded = ImageIO.read(new java.io.ByteArrayInputStream(thumb));
        assertThat(decoded.getWidth()).isEqualTo(96);
        assertThat(decoded.getHeight()).isEqualTo(96);
        assertThat(thumb.length).isLessThan(original.length);
    }

    @Test
    @DisplayName("une image rectangulaire est recadree au centre, pas deformee")
    void rectangleIsCroppedNotSquashed() throws Exception {
        byte[] thumb = ImageThumbnailer.square(jpeg(400, 200), 96).orElseThrow();
        BufferedImage decoded = ImageIO.read(new java.io.ByteArrayInputStream(thumb));
        assertThat(decoded.getWidth()).isEqualTo(decoded.getHeight());
    }

    @Test
    @DisplayName("la vignette est fabriquee UNE fois, puis relue depuis sa cle derivee")
    void thumbnailIsBuiltOnceThenCached() throws Exception {
        CountingStorage storage = new CountingStorage();
        GuestPhotoStorageService service = new GuestPhotoStorageService(storage);
        storage.store("guests/7/a.jpg", "image/jpeg", jpeg(192, 192));

        storage.loads = 0;
        var first = service.loadForDisplay("guests/7/a.jpg").orElseThrow();
        int loadsAfterFirst = storage.loads;

        storage.loads = 0;
        var second = service.loadForDisplay("guests/7/a.jpg").orElseThrow();

        assertThat(first.contentType()).isEqualTo("image/jpeg");
        assertThat(second.contentType()).isEqualTo("image/jpeg");
        // 1er appel : vignette absente puis original lu. 2e : la vignette seule.
        assertThat(loadsAfterFirst).isEqualTo(2);
        assertThat(storage.loads).isEqualTo(1);
        assertThat(storage.assets).containsKey("guests/7/a.jpg.t96.jpg");
    }

    @Test
    @DisplayName("original illisible : on sert l'original plutot que rien")
    void unreadableOriginalFallsBack() {
        CountingStorage storage = new CountingStorage();
        GuestPhotoStorageService service = new GuestPhotoStorageService(storage);
        storage.store("guests/8/b.jpg", "image/jpeg", "pas une image".getBytes());

        var served = service.loadForDisplay("guests/8/b.jpg").orElseThrow();

        assertThat(served.contentType()).isEqualTo("image/jpeg");
        assertThat(storage.assets).doesNotContainKey("guests/8/b.jpg.t96.jpg");
    }

    @Test
    @DisplayName("supprimer l'original emporte sa vignette")
    void deleteRemovesDerivedThumbnail() throws Exception {
        CountingStorage storage = new CountingStorage();
        GuestPhotoStorageService service = new GuestPhotoStorageService(storage);
        storage.store("guests/9/c.jpg", "image/jpeg", jpeg(192, 192));
        service.loadForDisplay("guests/9/c.jpg");
        assertThat(storage.assets).containsKey("guests/9/c.jpg.t96.jpg");

        service.delete("guests/9/c.jpg");

        assertThat(storage.assets).isEmpty();
    }
}
