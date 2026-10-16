package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.BaitlyNetworkService;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/mobile/network") @PreAuthorize("isAuthenticated()")
public class BaitlyNetworkController {
    private final BaitlyNetworkService service;
    public BaitlyNetworkController(BaitlyNetworkService service){this.service=service;}
    public record Invite(@jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Positive Long providerId){}
    public record Token(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(min=72,max=72) String token){}
    @GetMapping("/members") public Page<com.clenzy.marketplace.dto.CatalogProviderDto> members(@RequestParam(defaultValue="0") int page){return service.members(page);}
    @GetMapping public Page<BaitlyNetworkService.Link> list(@RequestParam(defaultValue="false") boolean received,@RequestParam(defaultValue="0") int page,@AuthenticationPrincipal Jwt jwt){return service.list(received,jwt.getSubject(),page);}
    @PostMapping public BaitlyNetworkService.Invitation invite(@jakarta.validation.Valid @RequestBody Invite invite,@AuthenticationPrincipal Jwt jwt){return service.invite(invite.providerId(),jwt.getSubject());}
    @PostMapping("/accept-token") public BaitlyNetworkService.Link accept(@jakarta.validation.Valid @RequestBody Token token,@AuthenticationPrincipal Jwt jwt){return service.accept(token.token(),jwt.getSubject());}
    @PostMapping("/{id}/accept") public BaitlyNetworkService.Link accept(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){return service.decide(id,true,jwt.getSubject());}
    @PostMapping("/{id}/leave") public BaitlyNetworkService.Link leave(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){return service.decide(id,false,jwt.getSubject());}
    @DeleteMapping("/{id}") public void revoke(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){service.revoke(id,jwt.getSubject());}
}
