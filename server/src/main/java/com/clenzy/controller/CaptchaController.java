package com.clenzy.controller;

import com.clenzy.service.CaptchaService;
import com.clenzy.service.CaptchaService.CaptchaChallenge;
import com.clenzy.service.CaptchaService.CaptchaVerificationResult;
import com.clenzy.service.LoginProtectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller pour le CAPTCHA puzzle slider.
 *
 * Endpoints publics (pas d'authentification requise) :
 * - POST /api/auth/captcha/generate : genere un nouveau challenge puzzle
 * - POST /api/auth/captcha/verify   : verifie la reponse de l'utilisateur
 *
 * Le CAPTCHA est declenche automatiquement par le frontend quand le backend
 * retourne captchaRequired=true dans la reponse de /api/auth/login.
 */
@RestController
@RequestMapping("/api/auth/captcha")
@Tag(name = "CAPTCHA", description = "Puzzle slider CAPTCHA pour protection anti-bot")
public class CaptchaController {

    private final CaptchaService captchaService;
    private final LoginProtectionService loginProtectionService;

    public CaptchaController(CaptchaService captchaService, LoginProtectionService loginProtectionService) {
        this.captchaService = captchaService;
        this.loginProtectionService = loginProtectionService;
    }

    @PostMapping("/generate")
    @Operation(summary = "Generer un challenge CAPTCHA puzzle slider",
            description = "Retourne une image de fond avec un trou, une piece de puzzle, " +
                    "la position Y de la piece, et un token de verification. " +
                    "L'utilisateur doit glisser la piece a la bonne position X.")
    public ResponseEntity<CaptchaChallenge> generate() {
        CaptchaChallenge challenge = captchaService.generateChallenge();
        return ResponseEntity.ok(challenge);
    }

    public record CaptchaVerifyRequest(String token, int x) {}

    @PostMapping("/verify")
    @Operation(summary = "Verifier la reponse CAPTCHA",
            description = "Verifie que la position X soumise correspond a la solution. " +
                    "Tolerance de ±7 pixels. Maximum 3 tentatives par challenge.")
    public ResponseEntity<?> verify(@RequestBody CaptchaVerifyRequest request) {
        if (request == null || request.token() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Token et position X requis"
            ));
        }

        CaptchaVerificationResult result = captchaService.verify(request.token(), request.x());

        if (result.success()) {
            // Marquer le token comme verifie dans Redis pour le login
            loginProtectionService.markCaptchaVerified(request.token());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "captchaToken", request.token()
            ));
        } else {
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", result.message() != null ? result.message() : "Verification echouee"
            ));
        }
    }
}
