package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO pour la creation du mot de passe apres confirmation email.
 * Utilise lors de l'etape finale de l'inscription (POST /api/public/inscription/set-password).
 */
public class SetPasswordDto {

    @NotBlank(message = "Le token de confirmation est requis")
    private String token;

    @NotBlank(message = "Le mot de passe est requis")
    @Size(min = 8, message = "Le mot de passe doit contenir au moins 8 caracteres")
    private String password;

    public SetPasswordDto() {}

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
