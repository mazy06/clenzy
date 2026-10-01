package com.clenzy.service;

import java.util.Base64;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Petites photos raster intégrées uniquement : aucune URL distante ni SVG actif. */
final class StockItemVisualValidator {
    private static final int MAX_BYTES = 256 * 1024;
    private static final Pattern KEY = Pattern.compile("[a-z0-9][a-z0-9-]{0,79}");
    private static final Pattern PHOTO = Pattern.compile("^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$");

    private StockItemVisualValidator() {}

    static void validate(String catalogKey, String photoUrl) {
        if (catalogKey != null && !KEY.matcher(catalogKey).matches()) badRequest();
        if (photoUrl == null) return;
        if (photoUrl.length() > ((MAX_BYTES + 2) / 3) * 4 + 32) badRequest();
        var match = PHOTO.matcher(photoUrl);
        if (!match.matches()) badRequest();
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(match.group(2));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Photo d’article invalide");
        }
        if (bytes.length < 12 || bytes.length > MAX_BYTES) badRequest();
        boolean valid = switch (match.group(1)) {
            case "jpeg" -> (bytes[0] & 255) == 255 && (bytes[1] & 255) == 216 && (bytes[2] & 255) == 255;
            case "png" -> (bytes[0] & 255) == 137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71
                    && bytes[4] == 13 && bytes[5] == 10 && bytes[6] == 26 && bytes[7] == 10;
            case "webp" -> bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                    && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P';
            default -> false;
        };
        if (!valid) badRequest();
    }

    private static void badRequest() {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Visuel d’article invalide (JPEG, PNG ou WebP, 256 Ko maximum)");
    }
}
