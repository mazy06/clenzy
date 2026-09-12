package com.clenzy.service.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Optional;

/**
 * Reduit une image a une vignette CARREE, en JPEG.
 *
 * <p>Les avatars sont stockes en 192x192 et affiches entre 26 et 44 px — 52 a 88 px
 * sur un ecran a densite double. Servir l'original, c'est envoyer sept fois les
 * pixels necessaires ; sur un planning qui montre cinquante voyageurs, la
 * difference se compte en centaines de kilo-octets.</p>
 *
 * <p>JPEG et non WebP : l'encodeur WebP n'est pas dans le JDK et demanderait une
 * dependance de plus pour gagner ~30 % sur des fichiers deja tombes a un ou deux
 * kilo-octets. Le jour ou une dependance image entre dans le projet pour une
 * autre raison, c'est ici qu'il faudra revenir.</p>
 *
 * <p>Le recadrage est CENTRE : l'interface pose ces images dans un disque, un
 * redimensionnement qui deformerait les proportions se verrait immediatement.</p>
 */
public final class ImageThumbnailer {

    private static final Logger log = LoggerFactory.getLogger(ImageThumbnailer.class);
    private static final float JPEG_QUALITY_HINT = 0.82f;

    private ImageThumbnailer() {
    }

    /**
     * Vignette carree de {@code size} pixels, ou {@link Optional#empty()} si les
     * octets ne sont pas une image lisible par le JDK.
     *
     * <p>Ne leve jamais : l'appelant sert alors l'original, ce qui est lourd mais
     * juste. Une photo illisible ne doit pas faire disparaitre l'avatar.</p>
     */
    public static Optional<byte[]> square(byte[] source, int size) {
        if (source == null || source.length == 0 || size <= 0) return Optional.empty();
        try {
            BufferedImage original = ImageIO.read(new ByteArrayInputStream(source));
            if (original == null) return Optional.empty();

            // Recadrage centre sur le plus petit cote, puis mise a l'echelle.
            int side = Math.min(original.getWidth(), original.getHeight());
            int x = (original.getWidth() - side) / 2;
            int y = (original.getHeight() - side) / 2;
            BufferedImage cropped = original.getSubimage(x, y, side, side);

            // TYPE_INT_RGB et non ARGB : le JPEG n'a pas de canal alpha, et un
            // PNG transparent encode en ARGB ressort avec un fond noir.
            BufferedImage thumb = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = thumb.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                        RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g.setRenderingHint(RenderingHints.KEY_RENDERING,
                        RenderingHints.VALUE_RENDER_QUALITY);
                g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,
                        RenderingHints.VALUE_ANTIALIAS_ON);
                g.setColor(java.awt.Color.WHITE);
                g.fillRect(0, 0, size, size);
                g.drawImage(cropped, 0, 0, size, size, null);
            } finally {
                g.dispose();
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream(4096);
            if (!writeJpeg(thumb, out)) return Optional.empty();
            return Optional.of(out.toByteArray());
        } catch (Exception e) {
            log.debug("Vignette impossible ({} octets) : {}", source.length, e.getMessage());
            return Optional.empty();
        }
    }

    /** Ecrit en JPEG avec un reglage de qualite explicite (le defaut est plus lourd). */
    private static boolean writeJpeg(BufferedImage image, ByteArrayOutputStream out) throws java.io.IOException {
        var writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) return false;
        var writer = writers.next();
        try (var stream = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(stream);
            var params = writer.getDefaultWriteParam();
            params.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
            params.setCompressionQuality(JPEG_QUALITY_HINT);
            writer.write(null, new javax.imageio.IIOImage(image, null, null), params);
        } finally {
            writer.dispose();
        }
        return true;
    }
}
