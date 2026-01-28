package com.agriplanner.controller;

import com.agriplanner.dto.*;
import com.agriplanner.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CartController {
    private final CartService cartService;

    @GetMapping
    public ResponseEntity<CartDTO> getCart(@RequestParam String userEmail) {
        return ResponseEntity.ok(cartService.getCart(userEmail));
    }

    @GetMapping("/count")
    public ResponseEntity<Map<String, Integer>> getCartCount(@RequestParam String userEmail) {
        return ResponseEntity.ok(Map.of("count", cartService.getCartCount(userEmail)));
    }

    @PostMapping("/add")
    public ResponseEntity<?> addToCart(@RequestBody AddToCartRequest request) {
        try {
            CartItemDTO item = cartService.addToCart(request);
            return ResponseEntity.ok(item);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/quantity")
    public ResponseEntity<?> updateQuantity(
            @PathVariable Long id,
            @RequestParam Integer quantity,
            @RequestParam String userEmail) {
        try {
            cartService.updateCartItemQuantity(id, quantity, userEmail);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> removeFromCart(
            @PathVariable Long id,
            @RequestParam String userEmail) {
        try {
            cartService.removeFromCart(id, userEmail);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/clear")
    public ResponseEntity<?> clearCart(@RequestParam String userEmail) {
        try {
            cartService.clearCart(userEmail);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
