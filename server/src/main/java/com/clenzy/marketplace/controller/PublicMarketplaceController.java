package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.dto.ApplicationDocumentDto;
import com.clenzy.marketplace.dto.ApplicationStatusDto;
import com.clenzy.marketplace.dto.ProviderApplicationRequest;
import com.clenzy.marketplace.dto.ServiceCategoryDto;
import com.clenzy.model.ProviderDocument;
import com.clenzy.marketplace.service.MarketplaceApplicationDocumentService;
import com.clenzy.marketplace.service.MarketplaceActivationService;
import com.clenzy.marketplace.service.MarketplaceApplicationService;
import com.clenzy.marketplace.service.MarketplaceCatalogService;
import com.clenzy.marketplace.service.MarketplacePublicRateLimiter;
import com.clenzy.service.LoginProtectionService;
import com.clenzy.service.ProviderDocumentService;
import com.clenzy.service.UserService;
import com.clenzy.util.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Candidature des professionnels depuis le site public.
 *
 * <p>Couvert par {@code /api/public/**} en acces libre dans
 * {@code SecurityConfigProd} : aucune authentification. Cette surface est donc
 * hostile par defaut — limite de debit, validation stricte, et surtout aucun
 * champ d'etat dans le contrat d'entree (statut, verification, organisation et
 * reputation sont fixes par le serveur).</p>
 *
 * <p>Le catalogue lui-meme n'est PAS expose ici : les fiches ne sortent que par
 * l'API d'administration, gardee par {@code SUPER_ADMIN} / {@code SUPER_MANAGER}.
 * Ouvrir la liste publiquement diffuserait les coordonnees de tous les
 * professionnels inscrits.</p>
 */
@RestController
@RequestMapping("/api/public/marketplace")
public class PublicMarketplaceController {

    private static final Logger log = LoggerFactory.getLogger(PublicMarketplaceController.class);

    private final MarketplaceApplicationService applicationService;
    private final MarketplaceApplicationDocumentService documentService;
    private final MarketplaceCatalogService catalogService;
    private final MarketplacePublicRateLimiter rateLimiter;
    private final LoginProtectionService loginProtectionService;
    private final MarketplaceActivationService activationService;

    /**
     * Interrupteur du captcha sur le formulaire public.
     *
     * <p>{@code false} par defaut. Il doit s'allumer EN MEME TEMPS que la cle
     * publique du site (VITE_TURNSTILE_SITE_KEY) : sans widget, aucun jeton
     * n'est envoye, et toute candidature serait refusee.</p>
     */
    @Value("${clenzy.marketplace.captcha-enabled:false}")
    private boolean captchaEnabled;

    public PublicMarketplaceController(MarketplaceApplicationService applicationService,
                                       MarketplaceApplicationDocumentService documentService,
                                       MarketplaceCatalogService catalogService,
                                       MarketplacePublicRateLimiter rateLimiter,
                                       LoginProtectionService loginProtectionService,
                                       MarketplaceActivationService activationService) {
        this.applicationService = applicationService;
        this.documentService = documentService;
        this.catalogService = catalogService;
        this.rateLimiter = rateLimiter;
        this.loginProtectionService = loginProtectionService;
        this.activationService = activationService;
    }

    /**
     * Categories proposees dans le formulaire d'inscription.
     *
     * <p>Seule donnee publique de la place de marche : un referentiel de
     * metiers, sans aucune information sur les professionnels inscrits.</p>
     */
    @GetMapping("/categories")
    public List<ServiceCategoryDto> categories() {
        return catalogService.getCategories();
    }

    /**
     * Version courante des conditions prestataire.
     *
     * <p>Le formulaire l'affiche et la renvoie a la soumission : le serveur
     * refuse une candidature qui annonce une version perimee, plutot que
     * d'enregistrer une preuve designant le mauvais document.</p>
     */
    @GetMapping("/terms-version")
    public Map<String, String> termsVersion() {
        return Map.of("version", UserService.PROVIDER_TERMS_VERSION);
    }

    @PostMapping("/applications")
    public ResponseEntity<Map<String, Object>> apply(
            @Valid @RequestBody ProviderApplicationRequest request,
            HttpServletRequest httpRequest) {

        if (!rateLimiter.tryAcquireApplication(httpRequest)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("status", "error",
                    "message", "Trop de tentatives. Reessayez dans une heure."));
        }

        // Captcha ETEINT par defaut, et volontairement : il sera allume quand le
        // parcours complet sera stabilise. Toute la plomberie reste en place —
        // champ de requete, widget, validation — pour que l'activation soit une
        // ligne de configuration et non une reprise de code.
        //
        // Place apres la limite de debit, qui ne coute qu'un INCR Redis :
        // verifier le captcha d'abord ferait payer un aller-retour reseau a
        // chaque martelement, ce qui est exactement ce qu'on cherche a eviter.
        if (captchaEnabled && !loginProtectionService.validateCaptchaToken(request.captchaToken())) {
            return ResponseEntity.badRequest()
                .body(Map.of("status", "error",
                    "message", "Verification anti-robot echouee. Rechargez la page et reessayez."));
        }

        try {
            // Resolue par ClientIpResolver, jamais par le premier element de
            // X-Forwarded-For : les entrees de gauche sont fournies par le
            // client, et une preuve forgeable n'est pas une preuve.
            String clientIp = ClientIpResolver.resolve(
                httpRequest.getRemoteAddr(),
                httpRequest.getHeader("X-Forwarded-For"),
                httpRequest.getHeader("X-Real-IP"));

            var receipt = applicationService.apply(request, clientIp);
            // L'identifiant interne ne sort pas : le candidat n'a rien a en
            // faire, et le rendre public donnerait le volume du catalogue. Le
            // jeton de depot, lui, sort UNE FOIS — la base n'en garde que
            // l'empreinte et il n'est plus recuperable ensuite.
            log.info("Candidature place de marche enregistree (id={})", receipt.id());
            return ResponseEntity.status(HttpStatus.CREATED)
                .header("Set-Cookie", com.clenzy.marketplace.service.MarketplaceApplicationSession.cookie(receipt.uploadToken()))
                .body(Map.of("status", "ok",
                    "message", "Votre candidature a bien ete enregistree. "
                             + "Deposez vos justificatifs pour que nous puissions l'instruire."));

        } catch (MarketplaceApplicationService.DuplicateApplicationException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("status", "error", "message", e.getMessage()));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    /**
     * A qui appartient ce lien d'activation.
     *
     * <p>Le formulaire l'affiche avant la saisie : voir son nom commercial
     * rassure sur l'origine du courriel, et distingue un lien legitime d'un lien
     * fabrique.</p>
     */
    @GetMapping("/activation/{token}")
    public ResponseEntity<?> activationTarget(@PathVariable String token) {
        try {
            return ResponseEntity.ok(Map.of("displayName", activationService.describe(token)));
        } catch (MarketplaceActivationService.InvalidActivationTokenException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    /** Le prestataire pose son mot de passe, sur nos pages. */
    @PostMapping("/activation")
    public ResponseEntity<Map<String, Object>> activate(
            @Valid @RequestBody ActivationRequest request,
            HttpServletRequest httpRequest) {

        // Meme limite que le depot : un formulaire public qui pose un mot de
        // passe ne doit pas pouvoir etre martele.
        if (!rateLimiter.tryAcquireUpload(httpRequest)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("status", "error",
                    "message", "Trop de tentatives. Reessayez dans une heure."));
        }
        try {
            activationService.activate(request.token(), request.password());
            return ResponseEntity.ok(Map.of("status", "ok",
                "message", "Votre mot de passe est enregistré. Vous pouvez vous connecter."));
        } catch (MarketplaceActivationService.ActivationRecoveryException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("status", "activation_recovery", "message", e.getMessage()));
        } catch (MarketplaceActivationService.InvalidActivationTokenException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("status", "error", "message", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    /**
     * @param password jamais journalise, jamais persiste : il part vers Keycloak
     *                 et rien d'autre.
     */
    public record ActivationRequest(
        @jakarta.validation.constraints.NotBlank(message = "Lien d'activation manquant.")
        String token,

        @jakarta.validation.constraints.NotBlank(message = "Le mot de passe est requis.")
        @jakarta.validation.constraints.Size(
            min = 8, max = 200,
            message = "Le mot de passe doit contenir au moins 8 caractères.")
        String password
    ) {}

    /**
     * Confirmation de l'adresse par son titulaire.
     *
     * <p>Reponse volontairement identique qu'il existe ou non un dossier :
     * distinguer les deux transformerait cet endpoint en oracle permettant de
     * savoir si une adresse a candidate.</p>
     */
    @PostMapping("/applications/confirm/{token}")
    public ResponseEntity<Map<String, Object>> confirmEmail(@PathVariable String token) {
        boolean confirmed = applicationService.confirmEmail(token);
        if (!confirmed) {
            log.info("Confirmation d'adresse avec un jeton inconnu ou deja consomme");
        }
        return ResponseEntity.ok(Map.of("status", "ok",
            "message", "Merci. Si une candidature correspond a ce lien, son adresse est confirmee."));
    }

    /**
     * État d'un dossier, identifié par le cookie HttpOnly.
     * Le chemin contient uniquement « session », jamais le secret.
     */
    @GetMapping("/applications/{token}/status")
    public ResponseEntity<?> applicationStatus(@PathVariable String token, HttpServletRequest httpRequest) {
        try {
            var view = documentService.describe(com.clenzy.marketplace.service.MarketplaceApplicationSession.resolve(token, httpRequest));
            return ResponseEntity.ok(new ApplicationStatusDto(
                view.displayName(),
                view.status().name(),
                view.submittedAt(),
                ProviderDocumentService.REQUIRED_TYPES.stream().map(Enum::name).toList(),
                view.documents().stream().map(ApplicationDocumentDto::from).toList()));
        } catch (MarketplaceApplicationDocumentService.InvalidUploadTokenException e) {
            return tokenRefused(e);
        }
    }

    @PostMapping("/applications/{token}/documents")
    public ResponseEntity<?> uploadDocument(
            @PathVariable String token,
            @RequestParam("type") String type,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "expiresAt", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiresAt,
            HttpServletRequest httpRequest) {

        if (!rateLimiter.tryAcquireUpload(httpRequest)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("status", "error",
                    "message", "Trop de depots. Reessayez dans une heure."));
        }

        try {
            var document = documentService.upload(com.clenzy.marketplace.service.MarketplaceApplicationSession.resolve(token, httpRequest), parseType(type), file, expiresAt);
            return ResponseEntity.status(HttpStatus.CREATED).body(ApplicationDocumentDto.from(document));

        } catch (MarketplaceApplicationDocumentService.InvalidUploadTokenException e) {
            return tokenRefused(e);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                .body(Map.of("status", "error", "message", e.getMessage()));
        } catch (IOException e) {
            log.error("Depot de piece impossible", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("status", "error", "message", "Le depot a echoue. Reessayez."));
        }
    }

    @DeleteMapping("/applications/{token}/documents/{documentId}")
    public ResponseEntity<?> deleteDocument(@PathVariable String token,
                                            @PathVariable Long documentId, HttpServletRequest httpRequest) {
        try {
            documentService.delete(com.clenzy.marketplace.service.MarketplaceApplicationSession.resolve(token, httpRequest), documentId);
            return ResponseEntity.noContent().build();
        } catch (MarketplaceApplicationDocumentService.InvalidUploadTokenException e) {
            return tokenRefused(e);
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    /**
     * Retrait de la candidature par son auteur.
     *
     * <p>Droit a l'effacement exerce directement. La fiche, ses prestations, ses
     * justificatifs et leurs binaires disparaissent — il ne reste rien a
     * reclamer plus tard, ce qui est exactement le but.</p>
     */
    @DeleteMapping("/applications/{token}")
    public ResponseEntity<?> withdrawApplication(@PathVariable String token, HttpServletRequest httpRequest) {
        try {
            documentService.withdraw(com.clenzy.marketplace.service.MarketplaceApplicationSession.resolve(token, httpRequest));
            return ResponseEntity.noContent()
                    .header("Set-Cookie", com.clenzy.marketplace.service.MarketplaceApplicationSession.cookie("")).build();
        } catch (MarketplaceApplicationDocumentService.InvalidUploadTokenException e) {
            return tokenRefused(e);
        }
    }

    public record LegacyApplicationSession(@jakarta.validation.constraints.NotBlank String token) {}

    /** Échange du jeton des anciens clients ; aucune écriture persistante côté JavaScript. */
    @PostMapping("/applications/session")
    public ResponseEntity<?> migrateApplicationSession(@Valid @RequestBody LegacyApplicationSession body,
                                                       HttpServletRequest httpRequest) {
        try {
            com.clenzy.marketplace.service.MarketplaceApplicationSession.requireBrowserRequest(httpRequest);
            documentService.describe(body.token());
            return ResponseEntity.noContent().header("Set-Cookie",
                    com.clenzy.marketplace.service.MarketplaceApplicationSession.cookie(body.token())).build();
        } catch (MarketplaceApplicationDocumentService.InvalidUploadTokenException e) { return tokenRefused(e); }
    }

    /**
     * 404 et non 403 : repondre « interdit » confirmerait qu'un jeton existe.
     * Un jeton inconnu, expire, ou dont le dossier est clos donnent la meme
     * reponse.
     */
    private ResponseEntity<Map<String, Object>> tokenRefused(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("status", "error", "message", e.getMessage()));
    }

    private ProviderDocument.DocumentType parseType(String raw) {
        try {
            return ProviderDocument.DocumentType.valueOf(raw.trim().toUpperCase());
        } catch (Exception e) {
            throw new IllegalArgumentException("Type de justificatif inconnu : " + raw);
        }
    }
}
