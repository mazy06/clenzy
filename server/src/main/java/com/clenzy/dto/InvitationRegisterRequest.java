package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Requete pour creer un compte ET accepter une invitation en un seul appel.
 *
 * <p>Utilisee par le flow d'invitation self-service ({@code POST /api/invitations/register}) :
 * le user clique sur le lien d'invitation, remplit ses infos + mot de passe directement
 * sur la page Clenzy, et est connecte automatiquement (pas de redirection Keycloak).</p>
 *
 * <p>L'email est determine par l'invitation elle-meme (cote serveur, depuis le token)
 * pour eviter qu'un attaquant ne puisse creer un compte avec un email different de
 * celui invite.</p>
 */
public class InvitationRegisterRequest {

    @NotBlank(message = "Le token d'invitation est requis")
    private String token;

    @NotBlank(message = "Le prenom est requis")
    @Size(max = 100, message = "Le prenom est trop long")
    private String firstName;

    @NotBlank(message = "Le nom est requis")
    @Size(max = 100, message = "Le nom est trop long")
    private String lastName;

    /** Optionnel — utile pour les notifications SMS. */
    @Size(max = 32, message = "Le numero de telephone est trop long")
    private String phoneNumber;

    @NotBlank(message = "Le mot de passe est requis")
    @Size(min = 8, message = "Le mot de passe doit contenir au moins 8 caracteres")
    private String password;

    public InvitationRegisterRequest() {}

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
