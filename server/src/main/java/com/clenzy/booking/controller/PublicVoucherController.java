package com.clenzy.booking.controller;

import com.clenzy.dto.voucher.VoucherValidationRequestDto;
import com.clenzy.dto.voucher.VoucherValidationResponseDto;
import com.clenzy.service.voucher.BookingVoucherService;
import com.clenzy.service.voucher.VoucherApplyResult;
import com.clenzy.service.voucher.VoucherEngine;
import com.clenzy.service.voucher.VoucherValidationError;
import com.clenzy.service.voucher.VoucherValidationResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints publics pour la validation d'un voucher cote booking engine
 * (utilises par le widget guest avant la confirmation du booking).
 *
 * <h3>Endpoint principal</h3>
 * {@code POST /api/public/vouchers/validate} : prend un code + contexte
 * (property, dates, montant) et renvoie soit le discount calcule, soit un
 * code d'erreur i18n-ready.
 *
 * <h3>Pas d'auth</h3>
 * Endpoint public ({@code permitAll}). N'expose AUCUNE info sur le voucher
 * lui-meme (juste le resultat du calcul). Pas d'enumeration possible (le
 * voucher est verifie pour CE contexte de booking precis, pas dans l'absolu).
 *
 * <h3>Rate limiting</h3>
 * Limite a 20 req/min/IP via {@code RateLimitInterceptor} (cas specifique
 * {@code voucher-validate:<ip>}). Bloque le brute-force de codes voucher.
 */
/**
 * <p><b>Securite</b> : pas de {@code @PreAuthorize("permitAll()")} explicite
 * (interdit par la regle CLAUDE.md Security §1). Le path {@code /api/public/**}
 * est deja {@code permitAll()} dans {@code SecurityConfigProd}, donc
 * l'annotation serait redondante.</p>
 */
@RestController
@RequestMapping("/api/public/vouchers")
@Tag(name = "Public Vouchers", description = "Validation cote booking engine guest")
public class PublicVoucherController {

    private static final Logger log = LoggerFactory.getLogger(PublicVoucherController.class);

    private final VoucherEngine voucherEngine;
    private final BookingVoucherService voucherService;

    public PublicVoucherController(
        VoucherEngine voucherEngine,
        BookingVoucherService voucherService
    ) {
        this.voucherEngine = voucherEngine;
        this.voucherService = voucherService;
    }

    @PostMapping("/validate")
    @Operation(summary = "Valide un code voucher et renvoie le discount calcule")
    public VoucherValidationResponseDto validate(
        @RequestBody @Valid VoucherValidationRequestDto request
    ) {
        // Prevention de l'oracle d'enumeration cross-tenant : sans la
        // verification orgId == property.organizationId, un attaquant
        // pouvait passer (orgId=X, propertyId=Y_d'une_autre_org) et inferer
        // l'existence d'un code chez X via les codes d'erreur (NOT_FOUND vs
        // PAUSED vs EXPIRED). En cas de mismatch, on renvoie NOT_FOUND (pas
        // UNAUTHORIZED, pour ne pas confirmer l'existence de la property).
        if (!voucherService.propertyBelongsToOrganization(request.propertyId(), request.organizationId())) {
            log.warn("Voucher validation refused : property {} hors org {} (possible enumeration)",
                request.propertyId(), request.organizationId());
            return VoucherValidationResponseDto.invalid(
                VoucherValidationError.NOT_FOUND, "Code voucher inconnu pour cette org");
        }

        VoucherValidationResult result = voucherEngine.validate(
            request.organizationId(),
            request.code(),
            request.propertyId(),
            request.stayNights(),
            request.subtotal(),
            request.guestEmail(),
            request.channel()
        );

        if (result instanceof VoucherValidationResult.Invalid invalid) {
            log.info("Voucher validation refused : orgId={}, code={}, reason={}",
                request.organizationId(), request.code(), invalid.reason());
            return VoucherValidationResponseDto.invalid(invalid.reason(), invalid.message());
        }

        VoucherValidationResult.Valid valid = (VoucherValidationResult.Valid) result;
        VoucherApplyResult applied = voucherEngine.apply(valid.voucher(), request.subtotal(), request.stayNights());

        log.info("Voucher validated : orgId={}, code={}, discount={}",
            request.organizationId(), valid.voucher().getCode(), applied.discountApplied());

        return VoucherValidationResponseDto.valid(
            valid.voucher().getCode(),
            applied.discountApplied(),
            applied.finalTotal()
        );
    }
}
