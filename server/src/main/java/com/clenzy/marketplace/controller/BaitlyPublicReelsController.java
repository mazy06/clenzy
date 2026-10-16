package com.clenzy.marketplace.controller;
import com.clenzy.marketplace.service.BaitlyReels;
import com.clenzy.marketplace.service.BaitlyInstagramPrivacy;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.*;

/** Namespace already public in SecurityConfigProd; writes remain authenticated. */
@RestController @RequestMapping("/api/public/baitly-catalog") @PreAuthorize("permitAll()")
public class BaitlyPublicReelsController {
    private final BaitlyReels reels;
    private final BaitlyInstagramPrivacy privacy;
    public BaitlyPublicReelsController(BaitlyReels reels, BaitlyInstagramPrivacy privacy) { this.reels=reels; this.privacy=privacy; }
    @GetMapping("/reels") public List<BaitlyReels.ReelView> feed(@RequestParam(defaultValue="0") int page) { return reels.feed(page); }
    @GetMapping("/instagram/callback") public ResponseEntity<Void> callback(@RequestParam(required=false) String state,
            @RequestParam(required=false) String code) {
        boolean success=false;
        try { reels.callback(state,code); success=true; } catch(RuntimeException e) { /* No provider error or token exposed. */ }
        return ResponseEntity.status(302).location(URI.create("clenzy://instagram-result?success="+(success?"1":"0"))).build();
    }
    @PostMapping(value="/instagram/deauthorize", consumes=MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<Void> deauthorize(@RequestParam("signed_request") String signedRequest) {
        privacy.erase(signedRequest);
        return ResponseEntity.ok().build();
    }
    @PostMapping(value="/instagram/data-deletion", consumes=MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public Map<String,String> deleteData(@RequestParam("signed_request") String signedRequest) {
        return privacy.erase(signedRequest);
    }
    @GetMapping(value="/instagram/deletion-status/{code}", produces=MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> deletionStatus(@PathVariable String code) {
        boolean completed=privacy.completed(code);
        String message=completed ? "Les données du profil Réel associé à Instagram ont été supprimées de Baitly. Votre compte Baitly reste disponible."
            : "Ce justificatif est introuvable ou a expiré. Contactez support@baitly.fr si nécessaire.";
        // Fixed text only; neither the URL code nor any user input is interpolated.
        return ResponseEntity.status(completed ? 200 : 404).body("<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Baitly · Suppression Instagram</title><main><h1>Suppression des données Instagram</h1><p>"+message+"</p><p>Le justificatif est disponible pendant 30 jours.</p></main></html>");
    }
}
