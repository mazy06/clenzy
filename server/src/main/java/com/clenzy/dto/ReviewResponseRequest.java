package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;

public record ReviewResponseRequest(@NotBlank String response) {}
