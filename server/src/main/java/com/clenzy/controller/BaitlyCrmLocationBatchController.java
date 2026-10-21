package com.clenzy.controller;

import com.clenzy.service.BaitlyCrmLocationBatches;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/prospect-location-batches")
@PreAuthorize("isAuthenticated() and hasPermission(null, 'baitly-crm:view') and hasPermission(null, 'baitly-crm:manage')")
public class BaitlyCrmLocationBatchController {
    private final BaitlyCrmLocationBatches batches;
    public BaitlyCrmLocationBatchController(BaitlyCrmLocationBatches batches){this.batches=batches;}
    @GetMapping("/config") public Map<String,Object> config(@AuthenticationPrincipal Jwt jwt){return batches.config(jwt.getSubject());}
    @GetMapping public Map<String,Object> latest(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="0") int page){return batches.latest(jwt.getSubject(),page);}
    @PostMapping public Map<String,Object> start(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody BaitlyCrmLocationBatches.Start input){return batches.start(jwt.getSubject(),input);}
    @PostMapping("/{id}/cancel") public void cancel(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){batches.cancel(jwt.getSubject(),id);}
    @PostMapping("/{id}/contacts/{prospect}/confirm") public void confirm(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@PathVariable long prospect,@Valid @RequestBody BaitlyCrmLocationBatches.Choice choice){batches.confirm(jwt.getSubject(),id,prospect,choice);}
    @PostMapping("/{id}/contacts/{prospect}/skip") public void skip(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@PathVariable long prospect){batches.skip(jwt.getSubject(),id,prospect);}
}
