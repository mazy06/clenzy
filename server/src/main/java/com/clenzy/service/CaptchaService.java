package com.clenzy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.Area;
import java.awt.geom.Ellipse2D;
import java.awt.geom.Rectangle2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service de generation et verification de CAPTCHA puzzle slider.
 *
 * Principe :
 * 1. Genere une image de fond avec un motif aleatoire
 * 2. Decoupe une piece de puzzle a une position X aleatoire
 * 3. Retourne : image de fond (avec trou), image de la piece, position Y, token
 * 4. L'utilisateur glisse la piece horizontalement
 * 5. Le backend verifie que la position X soumise correspond (tolerance ±15px)
 *
 * Les solutions sont stockees dans Redis (TTL 5min) avec fallback in-memory.
 */
@Service
public class CaptchaService {

    private static final Logger log = LoggerFactory.getLogger(CaptchaService.class);

    // Dimensions de l'image
    private static final int BG_WIDTH = 340;
    private static final int BG_HEIGHT = 200;

    // Dimensions de la piece de puzzle
    private static final int PIECE_SIZE = 50;
    private static final int KNOB_RADIUS = 8;

    // Verification — tolerance elargie pour compenser les erreurs d'arrondi CSS/scale
    private static final int TOLERANCE_PX = 15;
    private static final Duration CAPTCHA_TTL = Duration.ofMinutes(5);
    private static final int MAX_VERIFY_ATTEMPTS = 5;

    // Redis keys
    private static final String REDIS_PREFIX = "captcha:";

    private final StringRedisTemplate redisTemplate;
    private final SecureRandom random = new SecureRandom();

    // Fallback in-memory
    private final Map<String, CaptchaSolution> localSolutions = new ConcurrentHashMap<>();

    public CaptchaService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    // ─── Public API ────────────────────────────────────────────

    /**
     * Genere un nouveau challenge CAPTCHA puzzle slider.
     *
     * @return CaptchaChallenge contenant les images base64, la position Y, et le token
     */
    public CaptchaChallenge generateChallenge() {
        // Position aleatoire de la piece (pas trop pres des bords)
        int puzzleX = PIECE_SIZE + KNOB_RADIUS + random.nextInt(BG_WIDTH - 2 * PIECE_SIZE - 2 * KNOB_RADIUS);
        int puzzleY = KNOB_RADIUS + random.nextInt(BG_HEIGHT - PIECE_SIZE - 2 * KNOB_RADIUS);

        // Generer l'image de fond
        BufferedImage background = generateBackgroundImage();

        // Creer la forme du puzzle (avec encoches)
        Shape puzzleShape = createPuzzleShape(puzzleX, puzzleY);

        // Extraire la piece
        BufferedImage piece = extractPuzzlePiece(background, puzzleShape, puzzleX, puzzleY);

        // Dessiner le trou dans le fond
        BufferedImage bgWithHole = drawHole(background, puzzleShape);

        // Encoder en base64
        String bgBase64 = encodeToBase64Png(bgWithHole);
        String pieceBase64 = encodeToBase64Png(piece);

        // Generer un token et stocker la solution
        String token = UUID.randomUUID().toString();
        storeSolution(token, puzzleX);

        return new CaptchaChallenge(token, bgBase64, pieceBase64, puzzleY, BG_WIDTH, BG_HEIGHT);
    }

    /**
     * Verifie la reponse du CAPTCHA.
     *
     * @param token Le token du challenge
     * @param submittedX La position X soumise par l'utilisateur
     * @return true si la position est correcte (±tolerance)
     */
    public CaptchaVerificationResult verify(String token, int submittedX) {
        if (token == null || token.isBlank()) {
            return new CaptchaVerificationResult(false, "Token manquant");
        }

        CaptchaSolution solution = getSolution(token);
        if (solution == null) {
            return new CaptchaVerificationResult(false, "CAPTCHA expire ou invalide");
        }

        // Verifier le nombre de tentatives
        if (solution.attempts >= MAX_VERIFY_ATTEMPTS) {
            deleteSolution(token);
            return new CaptchaVerificationResult(false, "Trop de tentatives. Veuillez regenerer le CAPTCHA.");
        }

        // Incrementer le compteur de tentatives
        solution.attempts++;
        updateSolutionAttempts(token, solution);

        // Verifier la position
        int correctX = solution.correctX;
        boolean correct = Math.abs(submittedX - correctX) <= TOLERANCE_PX;

        if (correct) {
            // Supprimer la solution apres verification reussie (usage unique)
            deleteSolution(token);
            log.debug("CAPTCHA verifie avec succes (token={}, submitted={}, correct={})", token, submittedX, correctX);
            return new CaptchaVerificationResult(true, null);
        } else {
            log.debug("CAPTCHA echoue (token={}, submitted={}, correct={}, tentative={}/{})",
                    token, submittedX, correctX, solution.attempts, MAX_VERIFY_ATTEMPTS);

            if (solution.attempts >= MAX_VERIFY_ATTEMPTS) {
                deleteSolution(token);
                return new CaptchaVerificationResult(false, "Trop de tentatives. Veuillez regenerer le CAPTCHA.");
            }
            return new CaptchaVerificationResult(false, "Position incorrecte. Reessayez.");
        }
    }

    // ─── Image Generation ──────────────────────────────────────

    /**
     * Genere une image de fond avec des motifs colores aleatoires.
     */
    private BufferedImage generateBackgroundImage() {
        BufferedImage img = new BufferedImage(BG_WIDTH, BG_HEIGHT, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        // Fond gradient
        Color color1 = randomColor(80, 180);
        Color color2 = randomColor(80, 180);
        GradientPaint gradient = new GradientPaint(0, 0, color1, BG_WIDTH, BG_HEIGHT, color2);
        g.setPaint(gradient);
        g.fillRect(0, 0, BG_WIDTH, BG_HEIGHT);

        // Ajouter des formes geometriques aleatoires pour la texture
        for (int i = 0; i < 15; i++) {
            g.setColor(randomColor(60, 200, 80));
            int x = random.nextInt(BG_WIDTH);
            int y = random.nextInt(BG_HEIGHT);
            int w = 20 + random.nextInt(80);
            int h = 20 + random.nextInt(60);

            switch (random.nextInt(3)) {
                case 0 -> g.fillOval(x, y, w, h);
                case 1 -> g.fillRect(x, y, w, h);
                case 2 -> g.fillRoundRect(x, y, w, h, 10, 10);
            }
        }

        // Lignes decoratives
        g.setStroke(new BasicStroke(2));
        for (int i = 0; i < 5; i++) {
            g.setColor(randomColor(100, 220, 100));
            g.drawLine(random.nextInt(BG_WIDTH), random.nextInt(BG_HEIGHT),
                    random.nextInt(BG_WIDTH), random.nextInt(BG_HEIGHT));
        }

        // Petits cercles (dots) pour ajouter du bruit visuel
        for (int i = 0; i < 30; i++) {
            g.setColor(randomColor(80, 255, 120));
            int r = 2 + random.nextInt(6);
            g.fillOval(random.nextInt(BG_WIDTH), random.nextInt(BG_HEIGHT), r, r);
        }

        g.dispose();
        return img;
    }

    /**
     * Cree la forme de la piece de puzzle avec encoches (knobs).
     * La forme est un carre avec une encoche convexe en haut et une concave a gauche.
     */
    private Shape createPuzzleShape(int x, int y) {
        Area shape = new Area(new RoundRectangle2D.Double(x, y, PIECE_SIZE, PIECE_SIZE, 5, 5));

        // Encoche convexe en haut (bump vers l'exterieur)
        double topKnobX = x + PIECE_SIZE / 2.0 - KNOB_RADIUS;
        double topKnobY = y - KNOB_RADIUS;
        shape.add(new Area(new Ellipse2D.Double(topKnobX, topKnobY, KNOB_RADIUS * 2, KNOB_RADIUS * 2)));

        // Encoche convexe a droite
        double rightKnobX = x + PIECE_SIZE - KNOB_RADIUS;
        double rightKnobY = y + PIECE_SIZE / 2.0 - KNOB_RADIUS;
        shape.add(new Area(new Ellipse2D.Double(rightKnobX, rightKnobY, KNOB_RADIUS * 2, KNOB_RADIUS * 2)));

        // Encoche concave a gauche (creux)
        double leftKnobX = x - KNOB_RADIUS;
        double leftKnobY = y + PIECE_SIZE / 2.0 - KNOB_RADIUS;
        shape.subtract(new Area(new Ellipse2D.Double(leftKnobX, leftKnobY, KNOB_RADIUS * 2, KNOB_RADIUS * 2)));

        return shape;
    }

    /**
     * Extrait la piece de puzzle de l'image de fond.
     */
    private BufferedImage extractPuzzlePiece(BufferedImage background, Shape puzzleShape, int puzzleX, int puzzleY) {
        int pieceW = PIECE_SIZE + KNOB_RADIUS * 2;
        int pieceH = PIECE_SIZE + KNOB_RADIUS * 2;

        BufferedImage piece = new BufferedImage(pieceW, pieceH, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = piece.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        // Translater la forme pour qu'elle soit a l'origine de l'image piece
        g.translate(-(puzzleX - KNOB_RADIUS), -(puzzleY - KNOB_RADIUS));

        // Appliquer le clip (seule la forme du puzzle sera visible)
        g.setClip(puzzleShape);
        g.drawImage(background, 0, 0, null);

        // Dessiner le contour de la piece
        g.setClip(null);
        g.translate(0, 0);
        g.setColor(new Color(255, 255, 255, 200));
        g.setStroke(new BasicStroke(2.0f));
        g.draw(puzzleShape);

        // Ombre legere
        g.setColor(new Color(0, 0, 0, 40));
        g.setStroke(new BasicStroke(3.0f));
        g.translate(1, 1);
        g.draw(puzzleShape);

        g.dispose();
        return piece;
    }

    /**
     * Dessine le trou (emplacement de la piece) dans l'image de fond.
     */
    private BufferedImage drawHole(BufferedImage background, Shape puzzleShape) {
        BufferedImage result = new BufferedImage(BG_WIDTH, BG_HEIGHT, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = result.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        // Dessiner le fond
        g.drawImage(background, 0, 0, null);

        // Assombrir la zone du puzzle (le "trou")
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.6f));
        g.setColor(new Color(0, 0, 0));
        g.fill(puzzleShape);

        // Contour du trou
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.8f));
        g.setColor(new Color(255, 255, 255, 150));
        g.setStroke(new BasicStroke(1.5f));
        g.draw(puzzleShape);

        g.dispose();
        return result;
    }

    // ─── Storage (Redis + fallback local) ──────────────────────

    private void storeSolution(String token, int correctX) {
        try {
            if (redisTemplate != null) {
                redisTemplate.opsForValue().set(
                        REDIS_PREFIX + token,
                        correctX + ":0",  // format: correctX:attempts
                        CAPTCHA_TTL
                );
                return;
            }
        } catch (Exception e) {
            log.debug("Redis indisponible pour CAPTCHA, fallback local: {}", e.getMessage());
        }
        localSolutions.put(token, new CaptchaSolution(correctX));
    }

    private CaptchaSolution getSolution(String token) {
        try {
            if (redisTemplate != null) {
                String value = redisTemplate.opsForValue().get(REDIS_PREFIX + token);
                if (value != null) {
                    String[] parts = value.split(":");
                    CaptchaSolution sol = new CaptchaSolution(Integer.parseInt(parts[0]));
                    if (parts.length > 1) {
                        sol.attempts = Integer.parseInt(parts[1]);
                    }
                    return sol;
                }
                return null;
            }
        } catch (Exception e) {
            log.debug("Redis indisponible pour CAPTCHA verification: {}", e.getMessage());
        }
        return localSolutions.get(token);
    }

    private void updateSolutionAttempts(String token, CaptchaSolution solution) {
        try {
            if (redisTemplate != null) {
                Long ttl = redisTemplate.getExpire(REDIS_PREFIX + token);
                Duration remaining = (ttl != null && ttl > 0) ? Duration.ofSeconds(ttl) : CAPTCHA_TTL;
                redisTemplate.opsForValue().set(
                        REDIS_PREFIX + token,
                        solution.correctX + ":" + solution.attempts,
                        remaining
                );
            }
        } catch (Exception e) {
            log.debug("Redis indisponible pour CAPTCHA update: {}", e.getMessage());
        }
    }

    private void deleteSolution(String token) {
        try {
            if (redisTemplate != null) {
                redisTemplate.delete(REDIS_PREFIX + token);
            }
        } catch (Exception e) {
            log.debug("Redis indisponible pour CAPTCHA delete: {}", e.getMessage());
        }
        localSolutions.remove(token);
    }

    // ─── Helpers ───────────────────────────────────────────────

    private String encodeToBase64Png(BufferedImage image) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(image, "png", baos);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (Exception e) {
            log.error("Erreur encodage image CAPTCHA: {}", e.getMessage());
            return "";
        }
    }

    private Color randomColor(int minBrightness, int maxBrightness) {
        return new Color(
                minBrightness + random.nextInt(maxBrightness - minBrightness),
                minBrightness + random.nextInt(maxBrightness - minBrightness),
                minBrightness + random.nextInt(maxBrightness - minBrightness)
        );
    }

    private Color randomColor(int minBrightness, int maxBrightness, int alpha) {
        return new Color(
                minBrightness + random.nextInt(maxBrightness - minBrightness),
                minBrightness + random.nextInt(maxBrightness - minBrightness),
                minBrightness + random.nextInt(maxBrightness - minBrightness),
                alpha
        );
    }

    // ─── Records ───────────────────────────────────────────────

    /**
     * Challenge CAPTCHA retourne au frontend.
     */
    public record CaptchaChallenge(
            String token,           // Token unique pour verification
            String backgroundImage, // Image de fond (base64 PNG) avec le trou
            String puzzlePiece,     // Image de la piece (base64 PNG)
            int puzzleY,            // Position Y de la piece (le frontend place la piece a cette hauteur)
            int width,              // Largeur de l'image
            int height              // Hauteur de l'image
    ) {}

    /**
     * Resultat de verification du CAPTCHA.
     */
    public record CaptchaVerificationResult(boolean success, String message) {}

    /**
     * Solution stockee (Redis ou local).
     */
    static class CaptchaSolution {
        final int correctX;
        int attempts;

        CaptchaSolution(int correctX) {
            this.correctX = correctX;
            this.attempts = 0;
        }
    }
}
