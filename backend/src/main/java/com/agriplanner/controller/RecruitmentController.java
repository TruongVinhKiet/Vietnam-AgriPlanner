package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import java.util.Objects;

@RestController
@RequestMapping("/api/recruitment")
@CrossOrigin(origins = "*")
public class RecruitmentController {

    @Autowired
    private RecruitmentPostRepository postRepository;

    @Autowired
    private JobApplicationRepository applicationRepository;

    @Autowired
    private FarmRepository farmRepository;

    @Autowired
    private UserRepository userRepository;

    // --- Posts ---

    @PostMapping("/posts")
    public ResponseEntity<?> createPost(@RequestBody RecruitmentPost post) {
        try {
            // To be safe, creating simplified logic or checking if Farm ID is present.
            if (post.getFarm() != null && post.getFarm().getId() != null) {
                Long farmId = post.getFarm().getId();
                Farm f = farmRepository.findById(Objects.requireNonNull(farmId)).orElse(null);
                post.setFarm(f);
            }
            return ResponseEntity.ok(postRepository.save(post));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @GetMapping("/posts/farm/{farmId}")
    public List<RecruitmentPost> getPostsByFarm(@PathVariable Long farmId) {
        return postRepository.findByFarm_Id(farmId);
    }

    @GetMapping("/posts/open")
    public List<RecruitmentPost> getOpenPosts() {
        return postRepository.findByStatus("OPEN");
    }

    // --- Applications ---

    @PostMapping("/posts/{postId}/apply")
    public ResponseEntity<?> applyForJob(@PathVariable Long postId, @RequestParam Long workerId,
            @RequestBody(required = false) String message) {
        try {
            if (postId == null || workerId == null)
                throw new IllegalArgumentException("IDs required");

            RecruitmentPost post = postRepository.findById(postId)
                    .orElseThrow(() -> new RuntimeException("Post not found"));
            User worker = userRepository.findById(workerId)
                    .orElseThrow(() -> new RuntimeException("Worker not found"));

            JobApplication app = new JobApplication();
            app.setPost(post);
            app.setWorker(worker);
            app.setMessage(message);

            return ResponseEntity.ok(applicationRepository.save(app));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @GetMapping("/applications/post/{postId}")
    public List<JobApplication> getApplicationsByPost(@PathVariable Long postId) {
        return applicationRepository.findByPost_Id(postId);
    }

    @PutMapping("/applications/{id}/status")
    public ResponseEntity<?> updateApplicationStatus(@PathVariable Long id, @RequestParam String status) {
        try {
            if (id == null)
                throw new IllegalArgumentException("Application ID required");

            JobApplication app = applicationRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Application not found"));
            app.setStatus(status);
            return ResponseEntity.ok(applicationRepository.save(app));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }
}
