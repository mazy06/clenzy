package com.clenzy.service;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.model.UserRole;
import com.clenzy.repository.UserRepository;
import com.clenzy.util.StringUtils;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.CONFLICT;

/** Compte indépendant : ni abonnement PMS, ni organisation cliente, ni versement à l'inscription. */
@Service
public class BaitlySupplierRegistration {
    private final BaitlySupplierPurchaseService purchases;
    private final KeycloakService identities;
    private final UserRepository users;
    public BaitlySupplierRegistration(BaitlySupplierPurchaseService purchases,KeycloakService identities,UserRepository users) {
        this.purchases=purchases;this.identities=identities;this.users=users;
    }
    public void register(String token,String email,String firstName,String lastName) {
        String normalized=email.trim().toLowerCase(Locale.ROOT);
        // La clé durable est créée avec la facture, jamais avec une tentative réseau ni avec un paramètre client.
        String operation=purchases.registrationOperation(token,normalized);
        if(users.findByEmailHash(StringUtils.computeEmailHash(normalized)).isPresent())
            throw new ResponseStatusException(CONFLICT,"Un compte existe déjà. Connectez-vous pour accepter l'invitation.");
        var request=new CreateUserDto();request.setEmail(normalized);request.setFirstName(firstName.trim());request.setLastName(lastName.trim());
        request.setRole(UserRole.HOST.name());
        String subject=identities.createMarketplaceUser(request,operation);
        identities.sendSupplierActivation(subject);
        // Le profil local est créé par /me uniquement après une session JWT avec email_verified=true.
        // Une réponse perdue reprend le même compte distant ; aucun utilisateur ni adhésion n'est créé ici.
    }
}
