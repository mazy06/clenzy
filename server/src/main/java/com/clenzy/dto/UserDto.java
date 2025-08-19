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

    public String phoneNumber;
    public UserRole role;
    public UserStatus status;
    public String profilePictureUrl;
    public boolean emailVerified;
    public boolean phoneVerified;
    public LocalDateTime lastLogin;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}


