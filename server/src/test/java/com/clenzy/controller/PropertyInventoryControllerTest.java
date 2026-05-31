package com.clenzy.controller;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.dto.inventory.GenerateLaundryQuoteRequest;
import com.clenzy.dto.inventory.LaundryQuoteDto;
import com.clenzy.dto.inventory.PropertyInventoryItemDto;
import com.clenzy.dto.inventory.PropertyLaundryItemDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.service.PropertyInventoryService;
import com.clenzy.service.PropertyService;
import com.clenzy.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PropertyInventoryControllerTest {

    @Mock private PropertyInventoryService inventoryService;
    @Mock private PropertyService propertyService;
    @Mock private UserService userService;

    private PropertyInventoryController controller;
    private Jwt hostJwt;
    private Jwt adminJwt;

    @BeforeEach
    void setUp() {
        controller = new PropertyInventoryController(inventoryService, propertyService, userService);

        hostJwt = Jwt.withTokenValue("t").header("alg", "RS")
                .claim("sub", "host-1")
                .claim("realm_access", Map.of("roles", List.of("HOST")))
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(3600)).build();

        adminJwt = Jwt.withTokenValue("t").header("alg", "RS")
                .claim("sub", "admin-1")
                .claim("realm_access", Map.of("roles", List.of("SUPER_ADMIN")))
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(3600)).build();
    }

    private PropertyInventoryItemDto itemDto() {
        return new PropertyInventoryItemDto(1L, 10L, "Couteau", "Kitchen", 5, null);
    }

    private PropertyLaundryItemDto laundryDto() {
        return new PropertyLaundryItemDto(1L, 10L, "drap", "Drap", 2);
    }

    private LaundryQuoteDto quoteDto() {
        return new LaundryQuoteDto(1L, 10L, 99L, "PENDING", List.of(), null, "EUR", null, null, null);
    }

    private Property propWithOwner(Long propId, Long ownerId) {
        Property p = new Property();
        p.setId(propId);
        User u = new User();
        u.setId(ownerId);
        p.setOwner(u);
        return p;
    }

    @Test
    void getItems_admin_noAccessCheck() {
        when(inventoryService.getInventoryItems(10L)).thenReturn(List.of(itemDto()));

        ResponseEntity<List<PropertyInventoryItemDto>> response = controller.getItems(10L, adminJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(1);
    }

    @Test
    void getItems_host_userNotFound_throws() {
        when(userService.findByKeycloakId("host-1")).thenReturn(null);

        assertThatThrownBy(() -> controller.getItems(10L, hostJwt))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Utilisateur introuvable");
    }

    @Test
    void getItems_host_propertyNotFound_throws() {
        User u = new User();
        u.setId(7L);
        when(userService.findByKeycloakId("host-1")).thenReturn(u);
        when(propertyService.getPropertyEntityById(10L)).thenReturn(null);

        assertThatThrownBy(() -> controller.getItems(10L, hostJwt))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void getItems_host_notOwner_throws() {
        User u = new User();
        u.setId(7L);
        when(userService.findByKeycloakId("host-1")).thenReturn(u);
        when(propertyService.getPropertyEntityById(10L)).thenReturn(propWithOwner(10L, 999L));

        assertThatThrownBy(() -> controller.getItems(10L, hostJwt))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void getItems_host_owner_ok() {
        User u = new User();
        u.setId(7L);
        when(userService.findByKeycloakId("host-1")).thenReturn(u);
        when(propertyService.getPropertyEntityById(10L)).thenReturn(propWithOwner(10L, 7L));
        when(inventoryService.getInventoryItems(10L)).thenReturn(List.of(itemDto()));

        ResponseEntity<List<PropertyInventoryItemDto>> response = controller.getItems(10L, hostJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void addItem_admin_ok() {
        PropertyInventoryItemDto in = itemDto();
        when(inventoryService.addInventoryItem(10L, in)).thenReturn(in);

        ResponseEntity<PropertyInventoryItemDto> response = controller.addItem(10L, in, adminJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void updateItem_admin_ok() {
        PropertyInventoryItemDto in = itemDto();
        when(inventoryService.updateInventoryItem(10L, 1L, in)).thenReturn(in);

        ResponseEntity<PropertyInventoryItemDto> response = controller.updateItem(10L, 1L, in, adminJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void deleteItem_admin_noContent() {
        ResponseEntity<Void> response = controller.deleteItem(10L, 1L, adminJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(inventoryService).deleteInventoryItem(10L, 1L);
    }

    @Test
    void getLaundryItems_admin() {
        when(inventoryService.getLaundryItems(10L)).thenReturn(List.of(laundryDto()));

        ResponseEntity<List<PropertyLaundryItemDto>> response = controller.getLaundryItems(10L, adminJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void addLaundryItem_admin() {
        PropertyLaundryItemDto in = laundryDto();
        when(inventoryService.addLaundryItem(10L, in)).thenReturn(in);

        ResponseEntity<PropertyLaundryItemDto> response = controller.addLaundryItem(10L, in, adminJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void updateLaundryItem_admin() {
        PropertyLaundryItemDto in = laundryDto();
        when(inventoryService.updateLaundryItem(10L, 1L, in)).thenReturn(in);

        ResponseEntity<PropertyLaundryItemDto> response = controller.updateLaundryItem(10L, 1L, in, adminJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void deleteLaundryItem_admin() {
        ResponseEntity<Void> response = controller.deleteLaundryItem(10L, 1L, adminJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(inventoryService).deleteLaundryItem(10L, 1L);
    }

    @Test
    void getCatalog_returnsItems() {
        PricingConfigDto.BlanchisserieItem item = new PricingConfigDto.BlanchisserieItem("drap", "Drap", 5.0, true);
        when(inventoryService.getBlanchisserieCatalog()).thenReturn(List.of(item));

        ResponseEntity<List<PricingConfigDto.BlanchisserieItem>> response = controller.getCatalog();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(1);
    }

    @Test
    void getQuotes_admin() {
        when(inventoryService.getQuotes(10L)).thenReturn(List.of(quoteDto()));

        ResponseEntity<List<LaundryQuoteDto>> response = controller.getQuotes(10L, adminJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void generateQuote_admin() {
        GenerateLaundryQuoteRequest req = new GenerateLaundryQuoteRequest(99L, "note");
        when(inventoryService.generateQuote(10L, req)).thenReturn(quoteDto());

        ResponseEntity<LaundryQuoteDto> response = controller.generateQuote(10L, req, adminJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void confirmQuote_admin() {
        when(inventoryService.confirmQuote(10L, 1L)).thenReturn(quoteDto());

        ResponseEntity<LaundryQuoteDto> response = controller.confirmQuote(10L, 1L, adminJwt);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void host_propertyOwnerNull_denied() {
        User u = new User();
        u.setId(7L);
        when(userService.findByKeycloakId("host-1")).thenReturn(u);
        Property p = new Property();
        p.setOwner(null);
        when(propertyService.getPropertyEntityById(10L)).thenReturn(p);

        assertThatThrownBy(() -> controller.getItems(10L, hostJwt))
                .isInstanceOf(AccessDeniedException.class);
    }
}
