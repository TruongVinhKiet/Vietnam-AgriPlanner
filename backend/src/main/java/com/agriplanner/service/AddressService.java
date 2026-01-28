package com.agriplanner.service;

import com.agriplanner.dto.AddressDTO.*;
import com.agriplanner.model.User;
import com.agriplanner.model.UserAddress;
import com.agriplanner.repository.UserAddressRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AddressService {
    
    private final UserAddressRepository addressRepository;
    private final UserRepository userRepository;
    
    @Transactional
    public AddressResponse createAddress(Long userId, CreateAddressRequest request) {
        User user = userRepository.findById(Objects.requireNonNull(userId, "User ID cannot be null"))
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        UserAddress address = UserAddress.builder()
                .user(user)
                .fullAddress(request.getFullAddress())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .isDefault(request.getIsDefault() != null ? request.getIsDefault() : false)
                .label(request.getLabel())
                .receiverName(request.getReceiverName())
                .receiverPhone(request.getReceiverPhone())
                .build();
        
        // If this is set as default, clear other defaults
        if (Boolean.TRUE.equals(address.getIsDefault())) {
            addressRepository.clearDefaultExcept(userId, -1L);
        }
        
        // If this is first address, make it default
        if (addressRepository.countByUserId(userId) == 0) {
            address.setIsDefault(true);
        }
        
        UserAddress saved = addressRepository.save(address);
        
        // Update user's default address if needed
        if (Boolean.TRUE.equals(saved.getIsDefault())) {
            user.setDefaultAddress(saved.getFullAddress());
            user.setAddressLat(saved.getLatitude());
            user.setAddressLng(saved.getLongitude());
            userRepository.save(user);
        }
        
        return mapToResponse(saved);
    }
    
    @Transactional(readOnly = true)
    public List<AddressResponse> getUserAddresses(Long userId) {
        return addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(userId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public AddressResponse getAddress(Long userId, Long addressId) {
        UserAddress address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new RuntimeException("Address not found"));
        return mapToResponse(address);
    }
    
    @Transactional(readOnly = true)
    public AddressResponse getDefaultAddress(Long userId) {
        return addressRepository.findByUserIdAndIsDefaultTrue(userId)
                .map(this::mapToResponse)
                .orElse(null);
    }
    
    @Transactional
    public AddressResponse updateAddress(Long userId, Long addressId, UpdateAddressRequest request) {
        UserAddress address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new RuntimeException("Address not found"));
        
        if (request.getFullAddress() != null) {
            address.setFullAddress(request.getFullAddress());
        }
        if (request.getLatitude() != null) {
            address.setLatitude(request.getLatitude());
        }
        if (request.getLongitude() != null) {
            address.setLongitude(request.getLongitude());
        }
        if (request.getLabel() != null) {
            address.setLabel(request.getLabel());
        }
        if (request.getReceiverName() != null) {
            address.setReceiverName(request.getReceiverName());
        }
        if (request.getReceiverPhone() != null) {
            address.setReceiverPhone(request.getReceiverPhone());
        }
        if (request.getIsDefault() != null && request.getIsDefault()) {
            addressRepository.clearDefaultExcept(userId, addressId);
            address.setIsDefault(true);
            
            // Update user's default address
            User user = address.getUser();
            user.setDefaultAddress(address.getFullAddress());
            user.setAddressLat(address.getLatitude());
            user.setAddressLng(address.getLongitude());
            userRepository.save(user);
        }
        
        address.setUpdatedAt(ZonedDateTime.now());
        return mapToResponse(addressRepository.save(address));
    }
    
    @Transactional
    public void deleteAddress(Long userId, Long addressId) {
        UserAddress address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new RuntimeException("Address not found"));
        
        boolean wasDefault = Boolean.TRUE.equals(address.getIsDefault());
        addressRepository.delete(address);
        
        // If deleted address was default, make another one default
        if (wasDefault) {
            List<UserAddress> remaining = addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(userId);
            if (!remaining.isEmpty()) {
                UserAddress newDefault = remaining.get(0);
                newDefault.setIsDefault(true);
                addressRepository.save(newDefault);
                
                User user = userRepository.findById(Objects.requireNonNull(userId, "User ID cannot be null")).orElse(null);
                if (user != null) {
                    user.setDefaultAddress(newDefault.getFullAddress());
                    user.setAddressLat(newDefault.getLatitude());
                    user.setAddressLng(newDefault.getLongitude());
                    userRepository.save(user);
                }
            }
        }
    }
    
    @Transactional
    public AddressResponse setDefault(Long userId, Long addressId) {
        UserAddress address = addressRepository.findByIdAndUserId(Objects.requireNonNull(addressId, "Address ID cannot be null"), 
                Objects.requireNonNull(userId, "User ID cannot be null"))
                .orElseThrow(() -> new RuntimeException("Address not found"));
        
        addressRepository.clearDefaultExcept(userId, addressId);
        address.setIsDefault(true);
        
        // Update user's default address
        User user = address.getUser();
        user.setDefaultAddress(address.getFullAddress());
        user.setAddressLat(address.getLatitude());
        user.setAddressLng(address.getLongitude());
        userRepository.save(user);
        
        return mapToResponse(addressRepository.save(address));
    }
    
    private AddressResponse mapToResponse(UserAddress address) {
        return AddressResponse.builder()
                .id(address.getId())
                .fullAddress(address.getFullAddress())
                .latitude(address.getLatitude())
                .longitude(address.getLongitude())
                .isDefault(address.getIsDefault())
                .label(address.getLabel())
                .receiverName(address.getReceiverName())
                .receiverPhone(address.getReceiverPhone())
                .createdAt(address.getCreatedAt())
                .build();
    }
}
