package com.agriplanner.controller;

import com.agriplanner.dto.AddressDTO.*;
import com.agriplanner.service.AddressService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/addresses")
@RequiredArgsConstructor
public class AddressController {
    
    private final AddressService addressService;
    private final com.agriplanner.repository.UserRepository userRepository;
    
    @PostMapping
    public ResponseEntity<AddressResponse> createAddress(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody CreateAddressRequest request) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(addressService.createAddress(userId, request));
    }
    
    @GetMapping
    public ResponseEntity<List<AddressResponse>> getMyAddresses(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(addressService.getUserAddresses(userId));
    }
    
    @GetMapping("/{addressId}")
    public ResponseEntity<AddressResponse> getAddress(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long addressId) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(addressService.getAddress(userId, addressId));
    }
    
    @GetMapping("/default")
    public ResponseEntity<AddressResponse> getDefaultAddress(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUserId(userDetails);
        AddressResponse address = addressService.getDefaultAddress(userId);
        if (address == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(address);
    }
    
    @PutMapping("/{addressId}")
    public ResponseEntity<AddressResponse> updateAddress(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long addressId,
            @RequestBody UpdateAddressRequest request) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(addressService.updateAddress(userId, addressId, request));
    }
    
    @DeleteMapping("/{addressId}")
    public ResponseEntity<Void> deleteAddress(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long addressId) {
        Long userId = getUserId(userDetails);
        addressService.deleteAddress(userId, addressId);
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/{addressId}/set-default")
    public ResponseEntity<AddressResponse> setDefault(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long addressId) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(addressService.setDefault(userId, addressId));
    }
    
    private Long getUserId(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
    }
}
