package com.clenzy.fiscal.einvoicing.francepdp;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Compléments explicitement déclarés, jamais déduits d'une adresse libre ou d'un autre client. */
public record BaitlyCiiPreparation(@NotNull @Valid Party seller, @NotNull @Valid Party buyer, @NotNull @Valid Terms terms) {
    public record Terms(
        @NotBlank @Pattern(regexp="B1|S1|M1") String processCode,
        @NotBlank @Size(max=2000) String recoveryCosts,
        @NotBlank @Size(max=2000) String latePenalties,
        @NotBlank @Size(max=2000) String discount
    ) {}
    public record Party(
        @NotBlank @Pattern(regexp="[0-9]{5}") String postcode,
        @NotBlank @Size(max=100) String city,
        @NotBlank @Pattern(regexp="[0-9]{9}") String legalId,
        @NotBlank @Size(max=100) @Pattern(regexp="[0-9]{9}(_[A-Za-z0-9_-]+)?") String routingId
    ) {}
}
