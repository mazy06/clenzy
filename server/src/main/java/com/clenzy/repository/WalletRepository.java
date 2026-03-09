package com.clenzy.repository;

import com.clenzy.model.Wallet;
import com.clenzy.model.WalletType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, Long> {

    Optional<Wallet> findByOrganizationIdAndWalletTypeAndOwnerIdAndCurrency(
        Long organizationId, WalletType walletType, Long ownerId, String currency);

    Optional<Wallet> findByOrganizationIdAndWalletTypeAndOwnerIdIsNullAndCurrency(
        Long organizationId, WalletType walletType, String currency);

    List<Wallet> findByOrganizationId(Long organizationId);

    List<Wallet> findByOrganizationIdAndWalletType(Long organizationId, WalletType walletType);

    List<Wallet> findByOwnerId(Long ownerId);
}
