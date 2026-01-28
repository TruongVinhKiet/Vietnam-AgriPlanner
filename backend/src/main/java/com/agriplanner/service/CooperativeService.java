package com.agriplanner.service;

import com.agriplanner.dto.CooperativeDTO.*;
import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("null")
public class CooperativeService {

        private final CooperativeRepository cooperativeRepository;
        private final CooperativeMemberRepository memberRepository;
        private final CooperativeTransactionRepository transactionRepository;
        private final DissolutionRequestRepository dissolutionRequestRepository;
        private final UserRepository userRepository;
        private final ChatService chatService;

        private static final String INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        private static final int INVITE_CODE_LENGTH = 6;

        // ==================== Cooperative Management ====================

        @Transactional
        public CooperativeResponse registerCooperative(Long userId, RegisterRequest request) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                // Only OWNER users can create cooperatives
                if (user.getRole() != UserRole.OWNER) {
                        throw new RuntimeException("Chỉ chủ trang trại (OWNER) mới có thể đăng ký Hợp tác xã");
                }

                // Generate unique code
                Integer maxNum = cooperativeRepository.findMaxCodeNumber();
                String code = String.format("HTX-%04d", (maxNum != null ? maxNum : 0) + 1);

                Cooperative cooperative = Cooperative.builder()
                                .name(request.getName())
                                .code(code)
                                .description(request.getDescription())
                                .address(request.getAddress())
                                .phone(request.getPhone())
                                .leader(user)
                                .maxMembers(request.getMaxMembers() != null ? request.getMaxMembers() : 50)
                                .status(Cooperative.CooperativeStatus.PENDING)
                                .build();

                cooperative = cooperativeRepository.save(cooperative);

                // Add leader as first member
                CooperativeMember leaderMember = CooperativeMember.builder()
                                .cooperative(cooperative)
                                .user(user)
                                .role(CooperativeMember.MemberRole.LEADER)
                                .build();
                memberRepository.save(leaderMember);

                log.info("[COOP] User {} registered cooperative '{}' ({})", user.getEmail(), request.getName(), code);

                return mapToResponse(cooperative, userId);
        }

        @Transactional(readOnly = true)
        public List<CooperativeResponse> getUserCooperatives(Long userId) {
                List<CooperativeMember> memberships = memberRepository.findActiveByUserId(userId);
                return memberships.stream()
                                .map(m -> mapToResponse(m.getCooperative(), userId))
                                .collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public CooperativeResponse getCooperative(Long cooperativeId, Long userId) {
                Cooperative cooperative = cooperativeRepository.findById(cooperativeId)
                                .orElseThrow(() -> new RuntimeException("Cooperative not found"));
                return mapToResponse(cooperative, userId);
        }

        @Transactional
        public CooperativeResponse joinByInviteCode(Long userId, String inviteCode) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                // Only OWNER users can join cooperatives
                if (user.getRole() != UserRole.OWNER) {
                        throw new RuntimeException("Chỉ chủ trang trại (OWNER) mới có thể tham gia Hợp tác xã");
                }

                Cooperative cooperative = cooperativeRepository.findByInviteCode(inviteCode.toUpperCase())
                                .orElseThrow(() -> new RuntimeException("Invalid invite code"));

                if (cooperative.getStatus() != Cooperative.CooperativeStatus.APPROVED) {
                        throw new RuntimeException("Cooperative is not active");
                }

                if (memberRepository.existsByCooperative_IdAndUser_Id(cooperative.getId(), userId)) {
                        throw new RuntimeException("Already a member of this cooperative");
                }

                int currentMembers = memberRepository.countByCooperative_Id(cooperative.getId());
                if (currentMembers >= cooperative.getMaxMembers()) {
                        throw new RuntimeException("Cooperative has reached maximum members");
                }

                CooperativeMember member = CooperativeMember.builder()
                                .cooperative(cooperative)
                                .user(user)
                                .role(CooperativeMember.MemberRole.MEMBER)
                                .build();
                memberRepository.save(member);

                // Add to chat group
                try {
                        chatService.addMemberToCooperativeChat(cooperative.getId(), user);
                } catch (Exception e) {
                        log.error("Failed to add user {} to cooperative chat {}", userId, cooperative.getId(), e);
                }

                log.info("[COOP] User {} joined cooperative '{}' via invite code", user.getEmail(),
                                cooperative.getName());

                return mapToResponse(cooperative, userId);
        }

        @Transactional
        public TransactionResponse deposit(Long cooperativeId, Long userId, DepositRequest request) {
                Cooperative cooperative = cooperativeRepository.findById(cooperativeId)
                                .orElseThrow(() -> new RuntimeException("Cooperative not found"));

                CooperativeMember member = memberRepository.findByCooperative_IdAndUser_Id(cooperativeId, userId)
                                .orElseThrow(() -> new RuntimeException("Not a member of this cooperative"));

                User user = member.getUser();

                // Check user balance
                if (user.getBalance().compareTo(request.getAmount()) < 0) {
                        throw new RuntimeException("Insufficient balance");
                }

                // Deduct from user
                user.setBalance(user.getBalance().subtract(request.getAmount()));
                userRepository.save(user);

                // Add to cooperative fund
                cooperative.addBalance(request.getAmount());
                cooperativeRepository.save(cooperative);

                // Update member contribution
                member.addContribution(request.getAmount());
                memberRepository.save(member);

                // Record transaction
                CooperativeTransaction tx = CooperativeTransaction.builder()
                                .cooperative(cooperative)
                                .member(member)
                                .type(CooperativeTransaction.TransactionType.DEPOSIT)
                                .amount(request.getAmount())
                                .balanceAfter(cooperative.getBalance())
                                .description(request.getDescription() != null ? request.getDescription()
                                                : "Nạp tiền vào quỹ")
                                .build();
                tx = transactionRepository.save(tx);

                log.info("[COOP] User {} deposited {} to cooperative '{}'", user.getEmail(), request.getAmount(),
                                cooperative.getName());

                return mapTransactionToResponse(tx);
        }

        @Transactional(readOnly = true)
        public List<MemberResponse> getMembers(Long cooperativeId) {
                List<CooperativeMember> members = memberRepository.findByCooperative_Id(cooperativeId);
                return members.stream()
                                .map(this::mapMemberToResponse)
                                .collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public List<TransactionResponse> getTransactions(Long cooperativeId) {
                List<CooperativeTransaction> transactions = transactionRepository
                                .findByCooperative_IdOrderByCreatedAtDesc(cooperativeId);
                return transactions.stream()
                                .map(this::mapTransactionToResponse)
                                .collect(Collectors.toList());
        }

        // ==================== Admin Functions ====================

        @Transactional(readOnly = true)
// ...
        public List<AdminCooperativeResponse> getAllPendingRegistrations() {
                return cooperativeRepository.findAllPending().stream()
                                .map(this::mapToAdminResponse)
                                .collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public List<AdminCooperativeResponse> getAllCooperatives() {
                return cooperativeRepository.findAll().stream()
                                .map(this::mapToAdminResponse)
                                .collect(Collectors.toList());
        }

        @Transactional
        public AdminCooperativeResponse approveCooperative(Long cooperativeId, Long adminUserId) {
                Cooperative cooperative = cooperativeRepository.findById(cooperativeId)
                                .orElseThrow(() -> new RuntimeException("Cooperative not found"));

                User admin = userRepository.findById(adminUserId)
                                .orElseThrow(() -> new RuntimeException("Admin not found"));

                cooperative.setStatus(Cooperative.CooperativeStatus.APPROVED);
                cooperative.setApprovedAt(ZonedDateTime.now());
                cooperative.setApprovedBy(admin);
                cooperative.setInviteCode(generateInviteCode());

                cooperative = cooperativeRepository.save(cooperative);

                log.info("[COOP] Cooperative '{}' approved by admin {}", cooperative.getName(), admin.getEmail());

                // Create cooperative chat group
                try {
                        chatService.createCooperativeChat(cooperative.getId());
                } catch (Exception e) {
                        log.error("Failed to create chat group for cooperative {}", cooperative.getId(), e);
                        // Don't fail the approval if chat creation fails, but log it
                }

                return mapToAdminResponse(cooperative);
        }

        @Transactional
        public AdminCooperativeResponse rejectCooperative(Long cooperativeId) {
                Cooperative cooperative = cooperativeRepository.findById(cooperativeId)
                                .orElseThrow(() -> new RuntimeException("Cooperative not found"));

                cooperative.setStatus(Cooperative.CooperativeStatus.REJECTED);
                cooperative = cooperativeRepository.save(cooperative);

                log.info("[COOP] Cooperative '{}' rejected", cooperative.getName());

                return mapToAdminResponse(cooperative);
        }

        // ==================== Dissolution Request Methods ====================

        @Transactional
        public DissolutionRequest submitDissolutionRequest(Long cooperativeId, Long userId,
                        String reason, String contactPhone, String contactEmail) {
                Cooperative cooperative = cooperativeRepository.findById(cooperativeId)
                                .orElseThrow(() -> new RuntimeException("Cooperative not found"));

                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                // Only leader can submit dissolution request
                CooperativeMember member = memberRepository.findByCooperative_IdAndUser_Id(cooperativeId, userId)
                                .orElseThrow(() -> new RuntimeException("Not a member of this cooperative"));

                if (!member.isLeader()) {
                        throw new RuntimeException("Chỉ trưởng nhóm mới có thể gửi yêu cầu giải thể");
                }

                // Check if there's already a pending request
                if (dissolutionRequestRepository.existsByCooperative_IdAndStatus(cooperativeId,
                                DissolutionRequest.DissolutionStatus.PENDING)) {
                        throw new RuntimeException("Đã có yêu cầu giải thể đang chờ xử lý");
                }

                DissolutionRequest request = DissolutionRequest.builder()
                                .cooperative(cooperative)
                                .requestedBy(user)
                                .reason(reason)
                                .contactPhone(contactPhone)
                                .contactEmail(contactEmail)
                                .build();

                request = dissolutionRequestRepository.save(request);
                log.info("[COOP] Dissolution request submitted for '{}' by {}", cooperative.getName(), user.getEmail());

                return request;
        }

        @Transactional(readOnly = true)
        public List<DissolutionRequest> getPendingDissolutionRequests() {
                return dissolutionRequestRepository.findByStatus(DissolutionRequest.DissolutionStatus.PENDING);
        }

        @Transactional(readOnly = true)
        public DissolutionRequest getDissolutionStatus(Long cooperativeId) {
                return dissolutionRequestRepository.findByCooperative_IdAndStatus(cooperativeId,
                                DissolutionRequest.DissolutionStatus.PENDING).orElse(null);
        }

        @Transactional
        public DissolutionRequest approveDissolution(Long requestId, Long adminUserId, String adminNotes) {
                DissolutionRequest request = dissolutionRequestRepository.findById(requestId)
                                .orElseThrow(() -> new RuntimeException("Dissolution request not found"));

                User admin = userRepository.findById(adminUserId)
                                .orElseThrow(() -> new RuntimeException("Admin not found"));

                // Dissolve the cooperative
                dissolveCooperative(request.getCooperative().getId());

                // Update request
                request.setStatus(DissolutionRequest.DissolutionStatus.APPROVED);
                request.setProcessedAt(ZonedDateTime.now());
                request.setProcessedBy(admin);
                request.setAdminNotes(adminNotes);

                request = dissolutionRequestRepository.save(request);
                log.info("[COOP] Dissolution approved for '{}' by admin {}",
                                request.getCooperative().getName(), admin.getEmail());

                return request;
        }

        @Transactional
        public DissolutionRequest rejectDissolution(Long requestId, Long adminUserId, String adminNotes) {
                DissolutionRequest request = dissolutionRequestRepository.findById(requestId)
                                .orElseThrow(() -> new RuntimeException("Dissolution request not found"));

                User admin = userRepository.findById(adminUserId)
                                .orElseThrow(() -> new RuntimeException("Admin not found"));

                request.setStatus(DissolutionRequest.DissolutionStatus.REJECTED);
                request.setProcessedAt(ZonedDateTime.now());
                request.setProcessedBy(admin);
                request.setAdminNotes(adminNotes);

                request = dissolutionRequestRepository.save(request);
                log.info("[COOP] Dissolution rejected for '{}' by admin {}",
                                request.getCooperative().getName(), admin.getEmail());

                return request;
        }

        @Transactional
        public void dissolveCooperative(Long cooperativeId) {
                Cooperative cooperative = cooperativeRepository.findById(cooperativeId)
                                .orElseThrow(() -> new RuntimeException("Cooperative not found"));

                // Remove all members
                List<CooperativeMember> members = memberRepository.findByCooperative_Id(cooperativeId);

                // Fix: Delete related transactions first to avoid FK violation
                // We fetch strictly by cooperativeId to be safe, though members are also linked
                List<CooperativeTransaction> transactions = transactionRepository
                                .findByCooperative_IdOrderByCreatedAtDesc(cooperativeId);
                transactionRepository.deleteAll(transactions);

                memberRepository.deleteAll(members);

                // Update cooperative status
                cooperative.setStatus(Cooperative.CooperativeStatus.DISSOLVED);
                cooperative.setInviteCode(null); // Invalidate invite code
                cooperativeRepository.save(cooperative);

                // Dissolve chat group
                try {
                        chatService.dissolveCooperativeChat(cooperativeId);
                } catch (Exception e) {
                        log.error("Failed to dissolve chat group for cooperative {}", cooperativeId, e);
                }

                log.info("[COOP] Cooperative '{}' dissolved, {} members removed",
                                cooperative.getName(), members.size());
        }

        @Transactional(readOnly = true)
        public CooperativeStats getCooperativeStats() {
                long pendingApprovals = cooperativeRepository.countByStatus(Cooperative.CooperativeStatus.PENDING);
                long dissolutionRequests = dissolutionRequestRepository
                                .countByStatus(DissolutionRequest.DissolutionStatus.PENDING);
                long activeCooperatives = cooperativeRepository.countByStatus(Cooperative.CooperativeStatus.APPROVED);
                long totalMembers = memberRepository.count();
                BigDecimal totalFunds = cooperativeRepository.sumBalance();

                return CooperativeStats.builder()
                                .pendingApprovals(pendingApprovals)
                                .dissolutionRequests(dissolutionRequests)
                                .activeCooperatives(activeCooperatives)
                                .totalMembers(totalMembers)
                                .totalFunds(totalFunds != null ? totalFunds : BigDecimal.ZERO)
                                .build();
        }

        // ==================== Helper Methods ====================

        private String generateInviteCode() {
                SecureRandom random = new SecureRandom();
                StringBuilder code = new StringBuilder();
                for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
                        code.append(INVITE_CODE_CHARS.charAt(random.nextInt(INVITE_CODE_CHARS.length())));
                }
                String generatedCode = code.toString();

                // Ensure uniqueness
                while (cooperativeRepository.existsByInviteCode(generatedCode)) {
                        code = new StringBuilder();
                        for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
                                code.append(INVITE_CODE_CHARS.charAt(random.nextInt(INVITE_CODE_CHARS.length())));
                        }
                        generatedCode = code.toString();
                }

                return generatedCode;
        }

        private CooperativeResponse mapToResponse(Cooperative c, Long userId) {
                CooperativeMember userMembership = memberRepository.findByCooperative_IdAndUser_Id(c.getId(), userId)
                                .orElse(null);

                CooperativeResponse.LeaderInfo leaderInfo = null;
                if (c.getLeader() != null) {
                        leaderInfo = CooperativeResponse.LeaderInfo.builder()
                                        .id(c.getLeader().getId())
                                        .name(c.getLeader().getFullName())
                                        .email(c.getLeader().getEmail())
                                        .phone(c.getLeader().getPhone())
                                        .build();
                }

                return CooperativeResponse.builder()
                                .id(c.getId())
                                .name(c.getName())
                                .code(c.getCode())
                                .inviteCode(c.getInviteCode())
                                .description(c.getDescription())
                                .address(c.getAddress())
                                .phone(c.getPhone())
                                .status(c.getStatus().name())
                                .maxMembers(c.getMaxMembers())
                                .memberCount(memberRepository.countByCooperative_Id(c.getId()))
                                .balance(c.getBalance())
                                .createdAt(c.getCreatedAt())
                                .approvedAt(c.getApprovedAt())
                                .leader(leaderInfo)
                                .userRole(userMembership != null ? userMembership.getRole().name() : null)
                                .build();
        }

        private MemberResponse mapMemberToResponse(CooperativeMember m) {
                return MemberResponse.builder()
                                .id(m.getId())
                                .userId(m.getUser().getId())
                                .userName(m.getUser().getFullName())
                                .userEmail(m.getUser().getEmail())
                                .userPhone(m.getUser().getPhone())
                                .role(m.getRole().name())
                                .contribution(m.getContribution())
                                .joinedAt(m.getJoinedAt())
                                .avatarUrl(m.getUser().getAvatarUrl())
                                .build();
        }

        private TransactionResponse mapTransactionToResponse(CooperativeTransaction tx) {
                return TransactionResponse.builder()
                                .id(tx.getId())
                                .type(tx.getType().name())
                                .amount(tx.getAmount())
                                .balanceAfter(tx.getBalanceAfter())
                                .description(tx.getDescription())
                                .memberName(tx.getMember() != null ? tx.getMember().getUser().getFullName()
                                                : "Hệ thống")
                                .createdAt(tx.getCreatedAt())
                                .build();
        }

        private AdminCooperativeResponse mapToAdminResponse(Cooperative c) {
                return AdminCooperativeResponse.builder()
                                .id(c.getId())
                                .name(c.getName())
                                .code(c.getCode())
                                .description(c.getDescription())
                                .address(c.getAddress())
                                .phone(c.getPhone())
                                .status(c.getStatus().name())
                                .maxMembers(c.getMaxMembers())
                                .memberCount(memberRepository.countByCooperative_Id(c.getId()))
                                .balance(c.getBalance())
                                .createdAt(c.getCreatedAt())
                                .approvedAt(c.getApprovedAt())
                                .leaderName(c.getLeader() != null ? c.getLeader().getFullName() : null)
                                .leaderEmail(c.getLeader() != null ? c.getLeader().getEmail() : null)
                                .leaderPhone(c.getLeader() != null ? c.getLeader().getPhone() : null)
                                .build();
        }
}
