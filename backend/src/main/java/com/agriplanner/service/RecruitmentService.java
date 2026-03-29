package com.agriplanner.service;

import com.agriplanner.model.Farm;
import com.agriplanner.model.RecruitmentPost;
import com.agriplanner.model.User;
import com.agriplanner.model.UserRole;
import com.agriplanner.repository.RecruitmentPostRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecruitmentService {

    private final RecruitmentPostRepository recruitmentPostRepository;
    private final UserRepository userRepository;

    @Transactional
    public void syncRecruitmentPostForFarm(Farm farm) {
        if (farm == null || farm.getId() == null) return;

        int quota = farm.getRecruitmentQuota() != null ? farm.getRecruitmentQuota() : 0;
        
        // Count active/approved workers
        long currentWorkers = userRepository.findByRoleAndFarmIdAndApprovalStatus(
                UserRole.WORKER, farm.getId(), User.ApprovalStatus.APPROVED).stream()
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                .count();

        int needed = quota - (int) currentWorkers;
        if (needed < 0) needed = 0;

        List<RecruitmentPost> existingPosts = recruitmentPostRepository.findByFarm_Id(farm.getId());
        RecruitmentPost post = existingPosts.isEmpty() ? new RecruitmentPost() : existingPosts.get(0);

        if (needed > 0) {
            if (post.getId() == null) {
                post.setFarm(farm);
                post.setTitle("Tuyển nhân công - " + farm.getName());
                post.setDescription("Nông trại chúng tôi đang mở đợt tuyển dụng nhân công. Hệ thống tự động ghi nhận nhu cầu tuyển " + quota + " người. Hãy nhanh tay nộp hồ sơ để ứng tuyển và gia nhập cùng chúng tôi!");
            }
            post.setQuantityNeeded(needed);
            post.setStatus("OPEN");
            recruitmentPostRepository.save(post);
            log.info("Synced RecruitmentPost for Farm {} - OPEN (quota={}, current={}, needed={})", farm.getId(), quota, currentWorkers, needed);
        } else {
            if (post.getId() != null && "OPEN".equals(post.getStatus())) {
                post.setStatus("CLOSED");
                post.setQuantityNeeded(0);
                recruitmentPostRepository.save(post);
                log.info("Synced RecruitmentPost for Farm {} - CLOSED (quota={}, current={})", farm.getId(), quota, currentWorkers);
            }
        }
    }
}
