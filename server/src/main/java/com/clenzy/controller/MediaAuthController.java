package com.clenzy.controller;

import com.clenzy.service.MediaTicketService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Endpoint interne d'autorisation des flux media, appele par nginx ({@code auth_request})
 * avant de proxifier go2rtc sur {@code /media/}. Valide le ticket HMAC scope au flux ({@code src}) :
 * 200 si valide, 403 sinon. Appele serveur-a-serveur (pas de JWT) -> {@code permitAll} dans
 * {@link com.clenzy.config.SecurityConfigProd}. La securite ne vient PAS de l'auth Spring mais
 * du ticket signe : sans ticket valide pour ce flux, reponse 403.
 *
 * <p>nginx transmet l'URI d'origine via {@code X-Original-URI} ({@code $request_uri}), dont on
 * extrait {@code src} et {@code t}. <b>Important</b> : {@code $arg_*}/{@code $args} sont VIDES dans
 * une sous-requete auth_request (la subrequest est creee sans args), seul {@code $request_uri}
 * porte la query d'origine. Les headers {@code X-Media-Src}/{@code X-Media-Ticket} restent acceptes
 * (tests, ou config nginx alternative).
 */
@RestController
@RequestMapping("/api/media")
@PreAuthorize("permitAll()")
public class MediaAuthController {

    private final MediaTicketService mediaTicketService;

    public MediaAuthController(MediaTicketService mediaTicketService) {
        this.mediaTicketService = mediaTicketService;
    }

    @GetMapping("/verify")
    public ResponseEntity<Void> verify(
            @RequestHeader(value = "X-Media-Src", required = false) String src,
            @RequestHeader(value = "X-Media-Ticket", required = false) String ticket,
            @RequestHeader(value = "X-Original-URI", required = false) String originalUri) {
        // Priorite a X-Original-URI (chemin nginx fiable) ; repli sur les headers directs.
        if ((src == null || src.isBlank()) && originalUri != null && !originalUri.isBlank()) {
            var params = UriComponentsBuilder.fromUriString(originalUri).build().getQueryParams();
            src = params.getFirst("src");
            ticket = params.getFirst("t");
        }
        return mediaTicketService.verify(src, ticket)
                ? ResponseEntity.ok().build()
                : ResponseEntity.status(403).build();
    }
}
