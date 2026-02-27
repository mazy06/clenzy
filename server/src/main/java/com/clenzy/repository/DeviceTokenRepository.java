package com.clenzy.repository;

import com.clenzy.model.DeviceToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceTokenRepository extends JpaRepository<DeviceToken, Long> {

    /** Tous les tokens d'un utilisateur */
    List<DeviceToken> findByUserId(String userId);

    /** Trouver un token par sa valeur */
    Optional<DeviceToken> findByToken(String token);

    /** Supprimer un token par sa valeur */
    void deleteByToken(String token);

    /** Supprimer tous les tokens d'un utilisateur (logout / suppression compte) */
    @Modifying
    @Query("DELETE FROM DeviceToken d WHERE d.userId = :userId")
    int deleteAllByUserId(@Param("userId") String userId);
}
