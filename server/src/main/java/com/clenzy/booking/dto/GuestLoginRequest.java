package com.clenzy.booking.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record GuestLoginRequest(
    @NotBlank @Email String email,
    @NotBlank String password,
    @NotNull Long organizationId
) {}
