package com.clenzy.dto;

import com.clenzy.dto.validation.Create;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;

import java.time.LocalDateTime;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class UserDto {
    public Long id;

    @NotBlank(groups = Create.class)
    @Size(min = 2, max = 50)
    public String firstName;

    @NotBlank(groups = Create.class)
    @Size(min = 2, max = 50)
    public String lastName;

    @NotBlank(groups = Create.class)
    @Email
    public String email;

    @NotBlank(groups = Create.class)
    @Size(min = 8, message = "Le mot de passe doit contenir au moins 8 caractères")
    public String password;

    // Champ pour le changement de mot de passe (optionnel)
    @Size(min = 8, message = "Le nouveau mot de passe doit contenir au moins 8 caractères")
    public String newPassword;

    public String phoneNumber;
    public UserRole role;
    public UserStatus status;
    public String profilePictureUrl;
    public Boolean emailVerified;
    public Boolean phoneVerified;
    public LocalDateTime lastLogin;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;

    // Donnees du profil host (remplies lors de l'inscription via le formulaire de devis)
    public String companyName;
    public String forfait;
    public String city;
    public String postalCode;
    public String propertyType;
    public Integer propertyCount;
    public Integer surface;
    public Integer guestCapacity;

    // Donnees supplementaires du formulaire de devis
    public String bookingFrequency;
    public String cleaningSchedule;
    public String calendarSync;
    public String services;       // Stocké séparé par virgule
    public String servicesDevis;   // Stocké séparé par virgule

    // Paiement differe (admin/manager toggle)
    public Boolean deferredPayment;
}


