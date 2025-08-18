package com.clenzy.service;

import com.clenzy.dto.UserDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
@Transactional
public class UserService {
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserDto create(UserDto dto) {
        User user = new User();
        user.setFirstName(dto.firstName);
        user.setLastName(dto.lastName);
        user.setEmail(dto.email);
        user.setPhoneNumber(dto.phoneNumber);
        user.setRole(dto.role);
        user.setStatus(dto.status);
        // password will be set elsewhere (auth flow)
        user = userRepository.save(user);
        return toDto(user);
    }

    public UserDto update(Long id, UserDto dto) {
        User user = userRepository.findById(id).orElseThrow(() -> new NotFoundException("User not found"));
        if (dto.firstName != null) user.setFirstName(dto.firstName);
        if (dto.lastName != null) user.setLastName(dto.lastName);
        if (dto.phoneNumber != null) user.setPhoneNumber(dto.phoneNumber);
        if (dto.role != null) user.setRole(dto.role);
        if (dto.status != null) user.setStatus(dto.status);
        if (dto.profilePictureUrl != null) user.setProfilePictureUrl(dto.profilePictureUrl);
        user = userRepository.save(user);
        return toDto(user);
    }

    @Transactional(readOnly = true)
    public UserDto getById(Long id) {
        User user = userRepository.findById(id).orElseThrow(() -> new NotFoundException("User not found"));
        return toDto(user);
    }

    @Transactional(readOnly = true)
    public List<UserDto> list() {
        return userRepository.findAll().stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<UserDto> list(Pageable pageable) {
        return userRepository.findAll(pageable).map(this::toDto);
    }

    public void delete(Long id) {
        if (!userRepository.existsById(id)) throw new NotFoundException("User not found");
        userRepository.deleteById(id);
    }

    private UserDto toDto(User user) {
        UserDto dto = new UserDto();
        dto.id = user.getId();
        dto.firstName = user.getFirstName();
        dto.lastName = user.getLastName();
        dto.email = user.getEmail();
        dto.phoneNumber = user.getPhoneNumber();
        dto.role = user.getRole();
        dto.status = user.getStatus();
        dto.profilePictureUrl = user.getProfilePictureUrl();
        dto.emailVerified = user.isEmailVerified();
        dto.phoneVerified = user.isPhoneVerified();
        dto.lastLogin = user.getLastLogin();
        dto.createdAt = user.getCreatedAt();
        dto.updatedAt = user.getUpdatedAt();
        return dto;
    }
}


