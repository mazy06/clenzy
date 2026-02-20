package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;

public class AcceptInvitationRequest {

    @NotBlank(message = "Le token est obligatoire")
    private String token;

    public AcceptInvitationRequest() {}

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
}
