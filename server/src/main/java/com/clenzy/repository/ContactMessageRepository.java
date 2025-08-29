package com.clenzy.repository;

import com.clenzy.model.ContactMessage;
import com.clenzy.model.ContactStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContactMessageRepository extends JpaRepository<ContactMessage, Long> {
    
    // Trouver tous les messages envoyés par un utilisateur
    Page<ContactMessage> findBySenderIdOrderByCreatedAtDesc(Long senderId, Pageable pageable);
    
    // Trouver tous les messages reçus par un utilisateur
    Page<ContactMessage> findByRecipientIdOrderByCreatedAtDesc(Long recipientId, Pageable pageable);
    
    // Trouver tous les messages d'une propriété
    Page<ContactMessage> findByPropertyIdOrderByCreatedAtDesc(Long propertyId, Pageable pageable);
    
    // Trouver les messages par statut
    Page<ContactMessage> findByStatusOrderByCreatedAtDesc(ContactStatus status, Pageable pageable);
    
    // Trouver les messages par type
    Page<ContactMessage> findByMessageTypeOrderByCreatedAtDesc(String messageType, Pageable pageable);
    
    // Trouver les messages par priorité
    Page<ContactMessage> findByPriorityOrderByCreatedAtDesc(String priority, Pageable pageable);
    
    // Trouver les messages non résolus pour un destinataire
    @Query("SELECT cm FROM ContactMessage cm WHERE cm.recipient.id = :recipientId AND cm.status != 'RESOLU' ORDER BY cm.priority DESC, cm.createdAt DESC")
    Page<ContactMessage> findUnresolvedMessagesForRecipient(@Param("recipientId") Long recipientId, Pageable pageable);
    
    // Trouver les messages urgents pour un destinataire
    @Query("SELECT cm FROM ContactMessage cm WHERE cm.recipient.id = :recipientId AND cm.priority = 'URGENTE' ORDER BY cm.createdAt DESC")
    List<ContactMessage> findUrgentMessagesForRecipient(@Param("recipientId") Long recipientId);
    
    // Compter les messages non lus pour un destinataire
    @Query("SELECT COUNT(cm) FROM ContactMessage cm WHERE cm.recipient.id = :recipientId AND cm.status = 'OUVERT'")
    long countUnreadMessagesForRecipient(@Param("recipientId") Long recipientId);
}
