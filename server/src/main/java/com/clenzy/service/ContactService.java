package com.clenzy.service;

import com.clenzy.dto.ContactMessageDto;
import com.clenzy.dto.ContactAttachmentDto;
import com.clenzy.model.*;
import com.clenzy.repository.ContactMessageRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.service.PortfolioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class ContactService {
    
    @Autowired
    private ContactMessageRepository contactMessageRepository;
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private PropertyRepository propertyRepository;
    
    @Autowired
    private TeamRepository teamRepository;
    
    @Autowired
    private PortfolioService portfolioService;
    
    @Autowired
    private ManagerService managerService;
    
    @Autowired
    private com.clenzy.repository.ManagerUserRepository managerUserRepository;
    
    // Dossier de stockage des fichiers
    private static final String UPLOAD_DIR = "uploads/contact/";
    
    /**
     * Créer un nouveau message de contact avec routage automatique
     */
    public ContactMessageDto createContactMessage(ContactMessageDto messageDto, List<MultipartFile> files) {
        // Validation des utilisateurs
        User sender = userRepository.findById(messageDto.getSenderId())
            .orElseThrow(() -> new RuntimeException("Expéditeur non trouvé"));
        
        User recipient = userRepository.findById(messageDto.getRecipientId())
            .orElseThrow(() -> new RuntimeException("Destinataire non trouvé"));
        
        // Validation des permissions d'envoi selon les règles métier
        if (!canSendMessage(sender.getId(), recipient.getId())) {
            throw new RuntimeException("Vous n'êtes pas autorisé à envoyer un message à cet utilisateur");
        }
        
        // Validation de la propriété si spécifiée
        Property property = null;
        if (messageDto.getPropertyId() != null) {
            property = propertyRepository.findById(messageDto.getPropertyId())
                .orElseThrow(() -> new RuntimeException("Propriété non trouvée"));
        }
        
        // Détermination automatique de la priorité basée sur le type de message
        ContactPriority priority = determinePriority(messageDto.getMessageType());
        
        // Création du message
        ContactMessage message = new ContactMessage(
            sender, recipient, messageDto.getMessageType(), 
            priority, messageDto.getSubject(), messageDto.getContent()
        );
        message.setProperty(property);
        
        // Sauvegarde du message
        ContactMessage savedMessage = contactMessageRepository.save(message);
        
        // Gestion des pièces jointes
        if (files != null && !files.isEmpty()) {
            List<ContactAttachment> attachments = saveAttachments(savedMessage, files);
            savedMessage.setAttachments(attachments);
        }
        
        return convertToDto(savedMessage);
    }
    
    /**
     * Déterminer automatiquement la priorité basée sur le type de message
     */
    private ContactPriority determinePriority(ContactMessageType messageType) {
        switch (messageType) {
            case QUESTION_FACTURATION:
            case CLARIFICATION_CONTRAT:
            case DEMANDE_RENDEZ_VOUS:
                return ContactPriority.MOYENNE;
            case DEMANDE_ADMINISTRATIVE:
            case QUESTION_PORTEFEUILLE:
            case SUGGESTION:
            case REMARQUE_FEEDBACK:
            case QUESTION_GENERALE:
                return ContactPriority.BASSE;
            case PROBLEME_COMMUNICATION:
                return ContactPriority.MOYENNE;
            default:
                return ContactPriority.BASSE;
        }
    }
    
    /**
     * Sauvegarder les pièces jointes
     */
    private List<ContactAttachment> saveAttachments(ContactMessage message, List<MultipartFile> files) {
        try {
            // Créer le dossier de stockage s'il n'existe pas
            Path uploadPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            
            return files.stream()
                .filter(file -> !file.isEmpty())
                .map(file -> {
                    try {
                        String fileName = UUID.randomUUID().toString() + "_" + file.getOriginalFilename();
                        Path filePath = uploadPath.resolve(fileName);
                        Files.copy(file.getInputStream(), filePath);
                        
                        ContactAttachment attachment = new ContactAttachment(
                            message, file.getOriginalFilename(), filePath.toString(),
                            file.getContentType(), file.getSize()
                        );
                        
                        return attachment;
                    } catch (IOException e) {
                        throw new RuntimeException("Erreur lors de la sauvegarde du fichier: " + e.getMessage());
                    }
                })
                .collect(Collectors.toList());
                
        } catch (IOException e) {
            throw new RuntimeException("Erreur lors de la création du dossier de stockage: " + e.getMessage());
        }
    }
    
    /**
     * Trouver le destinataire approprié pour un HOST
     */
    public User findRecipientForHost(User host) {
        try {
            // Utiliser le PortfolioService pour trouver le manager du portefeuille
            return portfolioService.findManagerForHost(host);
        } catch (RuntimeException e) {
            // Fallback : retourner le premier MANAGER trouvé si pas de portefeuille configuré
            List<User> allUsers = userRepository.findAll();
            return allUsers.stream()
                .filter(user -> UserRole.MANAGER.equals(user.getRole()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Aucun manager trouvé"));
        }
    }
    
    /**
     * Trouver le destinataire approprié pour une équipe
     */
    public User findRecipientForTeam(Team team) {
        // Retourner le manager de l'équipe ou un manager par défaut
        List<User> allUsers = userRepository.findAll();
        return allUsers.stream()
            .filter(user -> UserRole.MANAGER.equals(user.getRole()))
            .findFirst()
            .orElseThrow(() -> new RuntimeException("Aucun manager trouvé"));
    }
    
    /**
     * Trouver le destinataire approprié pour un membre d'équipe individuel
     */
    public User findRecipientForTeamMember(User teamMember) {
        try {
            // Utiliser le PortfolioService pour trouver le manager du portefeuille
            return portfolioService.findManagerForTeamMember(teamMember);
        } catch (RuntimeException e) {
            // Fallback : retourner le premier MANAGER trouvé si pas de portefeuille configuré
            List<User> allUsers = userRepository.findAll();
            return allUsers.stream()
                .filter(user -> UserRole.MANAGER.equals(user.getRole()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Aucun manager trouvé"));
        }
    }
    
    /**
     * Récupérer les messages reçus par un utilisateur
     */
    public Page<ContactMessageDto> getReceivedMessages(Long userId, Pageable pageable) {
        Page<ContactMessage> messages = contactMessageRepository.findByRecipientIdOrderByCreatedAtDesc(userId, pageable);
        return messages.map(this::convertToDto);
    }
    
    /**
     * Récupérer les messages envoyés par un utilisateur
     */
    public Page<ContactMessageDto> getSentMessages(Long userId, Pageable pageable) {
        Page<ContactMessage> messages = contactMessageRepository.findBySenderIdOrderByCreatedAtDesc(userId, pageable);
        return messages.map(this::convertToDto);
    }
    
    /**
     * Récupérer un message par son ID
     */
    public ContactMessageDto getMessageById(Long messageId) {
        ContactMessage message = contactMessageRepository.findById(messageId)
            .orElseThrow(() -> new RuntimeException("Message non trouvé"));
        return convertToDto(message);
    }
    
    /**
     * Mettre à jour le statut d'un message
     */
    public ContactMessageDto updateMessageStatus(Long messageId, ContactStatus status) {
        ContactMessage message = contactMessageRepository.findById(messageId)
            .orElseThrow(() -> new RuntimeException("Message non trouvé"));
        message.setStatus(status);
        ContactMessage savedMessage = contactMessageRepository.save(message);
        return convertToDto(savedMessage);
    }
    
    /**
     * Compter les messages non lus pour un utilisateur
     */
    public long countUnreadMessages(Long userId) {
        return contactMessageRepository.countUnreadMessagesForRecipient(userId);
    }
    
    /**
     * Récupérer les messages urgents pour un utilisateur
     */
    public List<ContactMessageDto> getUrgentMessages(Long userId) {
        List<ContactMessage> urgentMessages = contactMessageRepository.findUrgentMessagesForRecipient(userId);
        return urgentMessages.stream()
            .map(this::convertToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Conversion vers DTO
     */
    private ContactMessageDto convertToDto(ContactMessage message) {
        ContactMessageDto dto = new ContactMessageDto(
            message.getSender().getId(),
            message.getRecipient().getId(),
            message.getMessageType(),
            message.getPriority(),
            message.getSubject(),
            message.getContent()
        );
        
        dto.setId(message.getId());
        dto.setPropertyId(message.getProperty() != null ? message.getProperty().getId() : null);
        dto.setStatus(message.getStatus());
        dto.setCreatedAt(message.getCreatedAt());
        dto.setUpdatedAt(message.getUpdatedAt());
        
        // Informations complémentaires
        dto.setSenderName(message.getSender().getFirstName() + " " + message.getSender().getLastName());
        dto.setRecipientName(message.getRecipient().getFirstName() + " " + message.getRecipient().getLastName());
        dto.setPropertyName(message.getProperty() != null ? message.getProperty().getName() : null);
        
        // Pièces jointes
        if (message.getAttachments() != null) {
            List<ContactAttachmentDto> attachmentDtos = message.getAttachments().stream()
                .map(this::convertAttachmentToDto)
                .collect(Collectors.toList());
            dto.setAttachments(attachmentDtos);
        }
        
        return dto;
    }
    
    /**
     * Conversion des pièces jointes vers DTO
     */
    private ContactAttachmentDto convertAttachmentToDto(ContactAttachment attachment) {
        ContactAttachmentDto dto = new ContactAttachmentDto(
            attachment.getMessage().getId(),
            attachment.getFileName(),
            attachment.getFilePath(),
            attachment.getFileType(),
            attachment.getFileSize()
        );
        dto.setId(attachment.getId());
        dto.setUploadedAt(attachment.getUploadedAt());
        return dto;
    }
    
    /**
     * Récupérer les destinataires autorisés pour un utilisateur selon les règles métier
     */
    @Transactional(readOnly = true)
    public List<User> getAuthorizedRecipients(Long senderId) {
        System.out.println("🔄 ContactService - Récupération des destinataires autorisés pour l'utilisateur " + senderId);
        
        User sender = userRepository.findById(senderId)
            .orElseThrow(() -> new RuntimeException("Expéditeur non trouvé"));
        
        List<User> authorizedRecipients = new java.util.ArrayList<>();
        
        // Règle 1: ADMIN et MANAGER peuvent envoyer à tout le monde
        if (sender.getRole() == com.clenzy.model.UserRole.ADMIN || sender.getRole() == com.clenzy.model.UserRole.MANAGER) {
            System.out.println("📊 ContactService - " + sender.getRole() + " peut envoyer à tout le monde");
            authorizedRecipients = userRepository.findAll();
        } else {
            // Règle 2: HOST, HOUSEKEEPER, TECHNICIAN, SUPERVISOR peuvent envoyer UNIQUEMENT à leur manager associé
            System.out.println("📊 ContactService - " + sender.getRole() + " peut envoyer uniquement à son manager associé");
            
            // Récupérer le manager associé via les associations
            com.clenzy.dto.ManagerAssociationsDto associations = managerService.getManagerAssociations(senderId);
            
            // Extraire les managers uniques des associations
            java.util.Set<Long> managerIds = new java.util.HashSet<>();
            
            // Pour les utilisateurs opérationnels, on doit trouver leur manager associé
            // Cette logique sera simplifiée - on cherche directement les managers qui ont cet utilisateur dans leurs associations
            
            // Chercher dans les associations manager-utilisateur
            List<com.clenzy.model.ManagerUser> managerUsers = managerUserRepository.findByUserIdAndIsActiveTrue(senderId);
            for (com.clenzy.model.ManagerUser managerUser : managerUsers) {
                managerIds.add(managerUser.getManagerId());
            }
            
            // Chercher dans les associations manager-équipe si l'utilisateur fait partie d'une équipe
            // (Cette partie nécessiterait une relation inverse équipe-utilisateur)
            
            // Récupérer les utilisateurs managers
            for (Long managerId : managerIds) {
                userRepository.findById(managerId).ifPresent(authorizedRecipients::add);
            }
            
            System.out.println("📊 ContactService - " + authorizedRecipients.size() + " destinataires autorisés trouvés pour " + sender.getRole());
        }
        
        return authorizedRecipients;
    }
    
    /**
     * Valider si un utilisateur peut envoyer un message à un destinataire
     */
    @Transactional(readOnly = true)
    public boolean canSendMessage(Long senderId, Long recipientId) {
        List<User> authorizedRecipients = getAuthorizedRecipients(senderId);
        return authorizedRecipients.stream().anyMatch(user -> user.getId().equals(recipientId));
    }
}
