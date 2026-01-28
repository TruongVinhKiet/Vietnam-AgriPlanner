package com.agriplanner.service;

import com.agriplanner.dto.*;
import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class CartService {
    private final CartItemRepository cartItemRepository;
    private final ShopItemRepository shopItemRepository;
    private final UserRepository userRepository;

    public CartDTO getCart(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        List<CartItem> items = cartItemRepository.findByUserIdOrderByAddedAtDesc(user.getId());
        
        List<CartItemDTO> itemDTOs = items.stream()
                .map(this::toCartItemDTO)
                .collect(Collectors.toList());
        
        int totalQuantity = items.stream()
                .mapToInt(CartItem::getQuantity)
                .sum();
        
        BigDecimal totalValue = items.stream()
                .map(item -> item.getShopItem().getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        return CartDTO.builder()
                .items(itemDTOs)
                .totalItems(items.size())
                .totalQuantity(totalQuantity)
                .totalValue(totalValue)
                .build();
    }

    @Transactional
    public CartItemDTO addToCart(AddToCartRequest request) {
        User user = userRepository.findByEmail(request.getUserEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        ShopItem shopItem = shopItemRepository.findById(request.getShopItemId())
                .orElseThrow(() -> new RuntimeException("Shop item not found"));
        
        // Check if item already in cart
        CartItem cartItem = cartItemRepository.findByUserIdAndShopItemId(user.getId(), shopItem.getId())
                .orElse(null);
        
        if (cartItem != null) {
            // Update quantity
            cartItem.setQuantity(cartItem.getQuantity() + (request.getQuantity() != null ? request.getQuantity() : 1));
        } else {
            // Create new cart item
            cartItem = CartItem.builder()
                    .user(user)
                    .shopItem(shopItem)
                    .quantity(request.getQuantity() != null ? request.getQuantity() : 1)
                    .build();
        }
        
        cartItem = cartItemRepository.save(cartItem);
        return toCartItemDTO(cartItem);
    }

    @Transactional
    public void updateCartItemQuantity(Long cartItemId, Integer quantity, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        CartItem cartItem = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new RuntimeException("Cart item not found"));
        
        if (!cartItem.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Not authorized");
        }
        
        if (quantity <= 0) {
            cartItemRepository.delete(cartItem);
        } else {
            cartItem.setQuantity(quantity);
            cartItemRepository.save(cartItem);
        }
    }

    @Transactional
    public void removeFromCart(Long cartItemId, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        CartItem cartItem = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new RuntimeException("Cart item not found"));
        
        if (!cartItem.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Not authorized");
        }
        
        cartItemRepository.delete(cartItem);
    }

    @Transactional
    public void clearCart(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        cartItemRepository.deleteByUserId(user.getId());
    }

    public int getCartCount(String userEmail) {
        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) return 0;
        return cartItemRepository.countByUserId(user.getId());
    }

    private CartItemDTO toCartItemDTO(CartItem item) {
        ShopItem shopItem = item.getShopItem();
        return CartItemDTO.builder()
                .id(item.getId())
                .shopItemId(shopItem.getId())
                .itemName(shopItem.getName())
                .itemCategory(shopItem.getCategory())
                .itemUnit(shopItem.getUnit())
                .imageUrl(shopItem.getImageUrl())
                .iconName(shopItem.getIconName())
                .unitPrice(shopItem.getPrice())
                .quantity(item.getQuantity())
                .subtotal(shopItem.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .addedAt(item.getAddedAt())
                .build();
    }
}
