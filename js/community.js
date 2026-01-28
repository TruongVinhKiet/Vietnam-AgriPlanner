/**
 * Community Page JavaScript
 * Handles posts, guides, friends, and chat functionality
 */


var API_BASE_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL :
                   (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:8080/api');
const BACKEND_URL = API_BASE_URL.replace('/api', '');

function getFullMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('blob:')) return url;
    if (url.startsWith('/uploads')) return `${BACKEND_URL}${url}`;
    return url;
}

// State
let currentUser = null;
let currentTab = 'feed';
let posts = [];
let guides = [];
let categories = [];
let friends = [];
let chatRooms = [];
let activeChatWindows = [];

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    initializeTabs();
    initializeChatPanel();
    initializePostModal();
    initializeFriendRequestPanel();
    // Attach reaction picker handlers early
    attachReactionPickerHandlers();
    loadFeed();
    loadFriendSuggestions();
    loadOnlineFriends();
    loadChatRooms();
    loadFriendRequestCount();
});

async function loadCurrentUser() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            currentUser = await response.json();
            updateUserDisplay();
        } else if (response.status === 401 || response.status === 403) {
            // Token invalid, redirect to login
            window.location.href = 'login.html';
            return;
        } else {
            console.error('Error loading user profile:', response.status);
            // Don't redirect on other errors, still allow page to load
        }
    } catch (error) {
        console.error('Error loading user:', error);
        // Network error - don't redirect, still allow page to load
    }
}

function updateUserDisplay() {
    if (!currentUser) return;

    // Sidebar
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    const sidebarName = document.getElementById('sidebar-name');
    const sidebarEmail = document.getElementById('sidebar-email');

    if (sidebarAvatar) {
        if (currentUser.avatarUrl) {
            sidebarAvatar.textContent = '';
            sidebarAvatar.style.backgroundImage = `url('${currentUser.avatarUrl}')`;
            sidebarAvatar.style.backgroundSize = 'cover';
            sidebarAvatar.style.backgroundPosition = 'center';
        } else {
            sidebarAvatar.textContent = getInitials(currentUser.fullName);
            sidebarAvatar.style.backgroundImage = '';
        }
    }
    if (sidebarName) sidebarName.textContent = currentUser.fullName || 'User';
    if (sidebarEmail) sidebarEmail.textContent = currentUser.email || '';

    // Create post avatar
    const createPostAvatar = document.getElementById('create-post-avatar');
    if (createPostAvatar) {
        if (currentUser.avatarUrl) {
            createPostAvatar.textContent = '';
            createPostAvatar.style.backgroundImage = `url('${currentUser.avatarUrl}')`;
            createPostAvatar.style.backgroundSize = 'cover';
            createPostAvatar.style.backgroundPosition = 'center';
        } else {
            createPostAvatar.textContent = getInitials(currentUser.fullName);
            createPostAvatar.style.backgroundImage = '';
        }
    }

    // Modal avatar
    const modalPostAvatar = document.getElementById('modal-post-avatar');
    const modalPostName = document.getElementById('modal-post-name');
    if (modalPostAvatar) {
        if (currentUser.avatarUrl) {
            modalPostAvatar.textContent = '';
            modalPostAvatar.style.backgroundImage = `url('${currentUser.avatarUrl}')`;
            modalPostAvatar.style.backgroundSize = 'cover';
            modalPostAvatar.style.backgroundPosition = 'center';
        } else {
            modalPostAvatar.textContent = getInitials(currentUser.fullName);
            modalPostAvatar.style.backgroundImage = '';
        }
    }
    if (modalPostName) modalPostName.textContent = currentUser.fullName || 'User';
}

function getInitials(name) {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

// ==================== TABS ====================

function initializeTabs() {
    const tabs = document.querySelectorAll('.community-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });

    // Feed buttons - bind to modal trigger
    const postWithImageBtn = document.getElementById('post-with-image');
    if (postWithImageBtn) {
        postWithImageBtn.addEventListener('click', () => {
            const modal = document.getElementById('create-post-modal');
            modal?.classList.add('active');
            // Trigger file input after modal opens
            setTimeout(() => document.getElementById('post-images-input')?.click(), 100);
        });
    }

    const postWithVideoBtn = document.getElementById('post-with-video');
    if (postWithVideoBtn) {
        postWithVideoBtn.addEventListener('click', () => {
            const modal = document.getElementById('create-post-modal');
            modal?.classList.add('active');
            // Trigger file input after modal opens
            setTimeout(() => document.getElementById('post-videos-input')?.click(), 100);
        });
    }
}

function switchTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.community-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`)?.classList.add('active');

    // Load content based on tab
    switch (tabName) {
        case 'feed':
            loadFeed();
            break;
        case 'guides':
            loadGuides();
            break;
        case 'friends':
            loadFriends();
            break;
    }
}

// ==================== POSTS FEED ====================

async function loadFeed() {
    const feedContainer = document.getElementById('posts-feed');
    if (!feedContainer) return;

    feedContainer.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Đang tải bài viết...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE_URL}/posts?page=0&size=20`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            const data = await response.json();
            posts = data.content || [];
            renderPosts(feedContainer);
        } else {
            feedContainer.innerHTML = '<p class="text-center text-muted">Không thể tải bài viết</p>';
        }
    } catch (error) {
        console.error('Error loading feed:', error);
        feedContainer.innerHTML = '<p class="text-center text-muted">Lỗi kết nối</p>';
    }
}

function renderPosts(container) {
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">article</span>
                <p>Chưa có bài viết nào</p>
                <p class="text-muted">Hãy là người đầu tiên chia sẻ!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = posts.map(post => renderPostCard(post)).join('');
    attachPostEventListeners();
}

function renderPostCard(post) {
    const author = post.author || {};
    const timeAgo = formatTimeAgo(post.createdAt);
    const images = parseImages(post.images);
    const userReaction = getUserReaction(post);
    const reactionInfo = userReaction ? getReactionInfo(userReaction) : null;
    const reactionCounts = post.reactionCounts || {};
    const totalReactions = Object.keys(reactionCounts).length > 0
        ? Object.values(reactionCounts).reduce((sum, c) => sum + (c || 0), 0)
        : (post.likeCount || 0);
    const topReactions = Object.keys(reactionCounts).length > 0
        ? Object.entries(reactionCounts)
            .filter(([, count]) => (count || 0) > 0)
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))
            .slice(0, 3)
            .map(([type]) => type)
        : [];
    const reactionIconsHtml = topReactions.length > 0
        ? topReactions.map(type => `<span>${getReactionEmoji(type)}</span>`).join('')
        : '';

    return `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-card__header">
                <div class="post-card__avatar" ${author.avatarUrl ? `style="background-image: url('${author.avatarUrl}'); background-size: cover; background-position: center;"` : ''}>
                    ${author.avatarUrl ? '' : getInitials(author.fullName)}
                </div>
                <div class="post-card__info">
                    <span class="post-card__name">${author.fullName || 'Người dùng'}</span>
                    <span class="post-card__meta">
                        ${timeAgo}
                        <span class="material-symbols-outlined" style="font-size: 4px;">circle</span>
                        <span class="material-symbols-outlined" style="font-size: 14px;">public</span>
                    </span>
                </div>
                <div class="post-card__menu-wrapper" style="position: relative;">
                    <button class="post-card__menu" onclick="togglePostMenu(event, ${post.id})">
                        <span class="material-symbols-outlined">more_horiz</span>
                    </button>
                    <div class="post-menu-dropdown" id="post-menu-${post.id}" style="display: none; position: absolute; right: 0; top: 100%; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); min-width: 160px; z-index: 100;">
                        ${author.id === currentUser?.id ? `
                            <button onclick="deletePost(${post.id})" style="width: 100%; padding: 10px 16px; text-align: left; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #dc3545;">
                                <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
                                Xóa bài viết
                            </button>
                        ` : `
                            <button onclick="reportPost(${post.id})" style="width: 100%; padding: 10px 16px; text-align: left; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                <span class="material-symbols-outlined" style="font-size: 18px;">flag</span>
                                Báo cáo bài viết
                            </button>
                        `}
                    </div>
                </div>
            </div>
            <div class="post-card__content">${escapeHtml(post.content)}</div>
            ${images.length > 0 ? renderPostImages(images) : ''}
            ${post.videos ? renderPostVideos(post.videos) : ''}
            <div class="post-card__stats">
                <div class="post-card__reactions">
                    ${totalReactions > 0 ? `
                        <div class="post-card__reaction-icons">
                            ${reactionIconsHtml || `<span>👍</span>${totalReactions > 1 ? '<span>❤️</span>' : ''}`}
                        </div>
                        <span>${totalReactions}</span>
                    ` : ''}
                </div>
                <div>
                    ${post.commentCount > 0 ? `<span>${post.commentCount} bình luận</span>` : ''}
                </div>
            </div>
            <div class="post-card__actions">
                <button class="post-card__action like-btn ${userReaction ? 'liked' : ''}" data-post-id="${post.id}" ${userReaction ? `data-current-reaction="${userReaction}" style="color: ${reactionInfo?.color};"` : ''}>
                    ${userReaction ? `
                        <span class="text-xl mr-2">${reactionInfo?.emoji}</span>
                        <span>${reactionInfo?.text}</span>
                    ` : `
                        <span class="material-symbols-outlined">thumb_up_off_alt</span>
                        <span>Thích</span>
                    `}
                </button>
                <button class="post-card__action comment-btn" data-post-id="${post.id}">
                    <span class="material-symbols-outlined">chat_bubble_outline</span>
                    <span>Bình luận</span>
                </button>
                <button class="post-card__action share-btn" data-post-id="${post.id}">
                    <span class="material-symbols-outlined">share</span>
                    <span>Chia sẻ</span>
                </button>
            </div>
        </div>
    `;
}

function renderPostImages(images) {
    const count = images.length;
    let gridClass = 'single';
    if (count === 2) gridClass = 'double';
    if (count >= 3) gridClass = 'triple';

    return `
        <div class="post-card__images ${gridClass}">
            ${images.slice(0, 3).map(url => `<img src="${url}" alt="Post image">`).join('')}
        </div>
    `;
}

// NOTE: video rendering is implemented further below (single source of truth)

function parseImages(imagesStr) {
    if (!imagesStr) return [];
    try {
        return JSON.parse(imagesStr);
    } catch {
        return [];
    }
}

function getUserReaction(post) {
    if (!currentUser) return null;

    if (post?.userReaction) return post.userReaction;

    if (!post.reactions) return null;

    // Debug logging
    // console.log(`Checking reaction for post ${post.id}`, { 
    //     currentUser: currentUser.id, 
    //     reactions: post.reactions.length 
    // });

    const reaction = post.reactions.find(r => {
        // Handle nested user object or direct id if serialized differently
        const reactionUserId = r.user?.id || r.userId;
        return reactionUserId == currentUser.id;
    });

    return reaction?.reactionType;
}

function getReactionEmoji(type) {
    const map = {
        'LIKE': '👍',
        'LOVE': '❤️',
        'HAHA': '😆',
        'WOW': '😮',
        'SAD': '😢',
        'ANGRY': '😠'
    };
    return map[type] || '👍';
}

function getReactionInfo(type) {
    const map = {
        'LIKE': { text: 'Thích', color: '#2563EB', emoji: '👍' }, // blue-600
        'LOVE': { text: 'Yêu thích', color: '#DC2626', emoji: '❤️' }, // red-600
        'HAHA': { text: 'Haha', color: '#F59E0B', emoji: '😆' }, // yellow-500
        'WOW': { text: 'Wow', color: '#D97706', emoji: '😮' }, // amber-600
        'SAD': { text: 'Buồn', color: '#F59E0B', emoji: '😢' }, // yellow-500
        'ANGRY': { text: 'Phẫn nộ', color: '#E11D48', emoji: '😠' } // rose-600
    };
    return map[type] || map['LIKE'];
}

function attachPostEventListeners() {
    // Like buttons - only attach click handler, hover is handled globally
    document.querySelectorAll('.like-btn').forEach(btn => {
        // Remove old listeners to avoid duplicates
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', handleLikeClick);
    });

    // Comment buttons
    document.querySelectorAll('.comment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const postId = btn.dataset.postId;
            toggleComments(postId);
        });
    });
}

// ...

function updatePostReactionUI(postId, userReaction, likeCount, reactionType = 'LIKE') {
    const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (!postCard) return;

    // Update Like Button
    const likeBtn = postCard.querySelector('.like-btn');
    if (likeBtn) {
        if (userReaction) {
            const info = getReactionInfo(reactionType);
            likeBtn.classList.add('liked');

            // Set styles directly to override default blue
            likeBtn.style.color = info.color;

            // Update Icon (Emoji) and Text
            // We replace the material symbol with the emoji for the icon part if it's not LIKE
            // But usually, Facebook keeps the icon as main button and text colored. 
            // The user said "giao diện vẫn hiện nút like" (still shows like button).
            // So we should replace the content to be [Emoji] [Text]

            likeBtn.innerHTML = `
                <span class="text-xl mr-2">${info.emoji}</span>
                <span>${info.text}</span>
            `;

            // Store reaction type for reference
            likeBtn.dataset.currentReaction = reactionType;

        } else {
            likeBtn.classList.remove('liked');
            likeBtn.style.color = ''; // Reset color
            likeBtn.innerHTML = `
                <span class="material-symbols-outlined">thumb_up_off_alt</span>
                <span>Thích</span>
            `;
            delete likeBtn.dataset.currentReaction;
        }
    }

    // Update Stats
    const statsContainer = postCard.querySelector('.post-card__reactions');
    if (statsContainer) {
        if (likeCount > 0) {
            let iconsDiv = statsContainer.querySelector('.post-card__reaction-icons');
            let countSpan = statsContainer.querySelector('span:last-child'); // count is usually last

            // If structure doesn't exist, create it
            if (!iconsDiv || !countSpan) {
                statsContainer.innerHTML = `
                    <div class="post-card__reaction-icons">
                        <span>${userReaction ? getReactionEmoji(reactionType) : '👍'}</span>
                    </div>
                    <span>${likeCount}</span>
                `;
            } else {
                // Update count
                countSpan.textContent = likeCount;

                // Update icon ONLY if adding/changing reaction
                if (userReaction) {
                    // Update the first icon to represent the user's new reaction
                    // This mirrors the comment logic of "show latest user reaction"
                    const firstIcon = iconsDiv.querySelector('span');
                    if (firstIcon) {
                        firstIcon.textContent = getReactionEmoji(reactionType);
                    } else {
                        // Should not happen if div exists, but just in case
                        iconsDiv.innerHTML = `<span>${getReactionEmoji(reactionType)}</span>`;
                    }
                }
                // If removing (userReaction is false/null), we DO NOT touch the icons.
                // This prevents the "reset" to default icons that the user complained about.
            }
        } else {
            statsContainer.innerHTML = '';
        }
    }
}

async function handleLikeClick(e) {
    e.preventDefault();
    const btn = e.currentTarget;
    const postId = btn.dataset.postId;
    const isLiked = btn.classList.contains('liked');

    // Optimistic UI Update
    const currentCountText = btn.closest('.post-card').querySelector('.post-card__reactions span:last-child')?.textContent || '0';
    let newCount = parseInt(currentCountText);

    updatePostReactionUI(postId, !isLiked, isLiked ? newCount - 1 : newCount + 1, 'LIKE');

    try {
        if (isLiked) {
            await fetch(`${API_BASE_URL}/posts/${postId}/react?userId=${currentUser.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
        } else {
            await fetch(`${API_BASE_URL}/posts/${postId}/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    userId: currentUser.id,
                    reactionType: 'LIKE'
                })
            });
        }
        // No loadFeed() here, rely on optimistic update or specific fetch if needed
    } catch (error) {
        console.error('Error toggling reaction:', error);
        loadFeed(); // Revert on error
    }
}

// ...

function showReactionPicker(e, overridePostId = null, overrideCommentId = null) {
    if (e && e.stopPropagation) {
        e.stopPropagation();
    }

    // Handle both direct calls and event-based calls
    let targetEl = null;
    if (overridePostId || overrideCommentId) {
        // Called with override params, find target
        if (overrideCommentId) {
            targetEl = document.querySelector(`.comment[data-comment-id="${overrideCommentId}"]`)?.querySelector('.comment__action--react, .comment__reaction-badge');
        } else if (overridePostId) {
            targetEl = document.querySelector(`.like-btn[data-post-id="${overridePostId}"]`);
        }
    } else if (e) {
        // For event delegation, use target
        if (e.target) {
            // Ensure e.target is an Element node (not text node)
            const target = e.target.nodeType === Node.ELEMENT_NODE ? e.target : e.target.parentElement;
            if (target && target.closest) {
                targetEl = target.closest('.like-btn, .comment__action--react, .comment__reaction-badge');
            }
        }
        // If not found, try currentTarget
        if (!targetEl && e.currentTarget && e.currentTarget.nodeType === 1) {
            targetEl = e.currentTarget;
        }
    }

    const picker = document.getElementById('reaction-picker');
    if (!picker || !targetEl) {
        if (!picker) console.error('Reaction picker not found in DOM');
        if (!targetEl) console.warn('Target element not found for reaction picker');
        return;
    }

    const rect = targetEl.getBoundingClientRect();

    // Ensure picker handlers are attached
    attachReactionPickerHandlers();

    picker.style.display = 'flex';
    picker.style.alignItems = 'center';
    picker.style.padding = '8px 12px';
    picker.style.position = 'absolute';
    picker.style.zIndex = '10000';

    // Reset state
    delete picker.dataset.postId;
    delete picker.dataset.commentId;

    const postId = overridePostId || targetEl.dataset.postId;
    // For comments, we store ID in data-comment-id on the comment DIV usually, but the trigger might not have it directly?
    // In renderCommentItem: <span ... onclick="showReactionPicker(event, null, ${c.id})">
    const commentId = overrideCommentId || targetEl.closest('.comment')?.dataset.commentId;

    if (postId) picker.dataset.postId = postId;
    if (commentId) picker.dataset.commentId = commentId;

    // Position above the button
    // adjust top to be closer (overlap slightly) to prevent mouseout gaps
    picker.style.top = `${window.scrollY + rect.top - 48}px`;
    picker.style.bottom = 'auto'; // Reset bottom
    picker.style.left = `${rect.left}px`;

    // Check Liked Status
    const isLiked = targetEl.classList.contains('liked');
    const existingRemoveBtn = picker.querySelector('.reaction-remove-btn');

    if (isLiked) {
        if (!existingRemoveBtn) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'reaction-btn reaction-remove-btn';
            removeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; color: #666;">close</span>';
            removeBtn.title = 'Hủy cảm xúc';
            removeBtn.style.marginLeft = '12px';
            removeBtn.style.width = '32px';
            removeBtn.style.height = '32px';
            removeBtn.style.borderRadius = '50%';
            removeBtn.style.display = 'flex';
            removeBtn.style.alignItems = 'center';
            removeBtn.style.justifyContent = 'center';
            removeBtn.style.backgroundColor = '#f3f4f6';
            removeBtn.style.border = 'none';
            removeBtn.style.cursor = 'pointer';

            removeBtn.onclick = async (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                picker.style.display = 'none';

                // Determine what to remove
                if (picker.dataset.commentId) {
                    updateCommentReactionUI(picker.dataset.commentId, null, -1);
                    await removeCommentReaction(picker.dataset.commentId);
                } else if (picker.dataset.postId) {
                    const pid = picker.dataset.postId;
                    const likeBtn = document.querySelector(`.like-btn[data-post-id="${pid}"]`);
                    const currentCountText = likeBtn?.closest('.post-card')?.querySelector('.post-card__reactions span:last-child')?.textContent || '0';
                    let startCount = parseInt(currentCountText) || 0;

                    updatePostReactionUI(pid, false, Math.max(0, startCount - 1), 'LIKE');

                    try {
                        await fetch(`${API_BASE_URL}/posts/${pid}/react?userId=${currentUser.id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
                        });
                    } catch (error) {
                        console.error('Error removing reaction:', error);
                        loadFeed();
                    }
                }
            };
            picker.appendChild(removeBtn);
        } else {
            existingRemoveBtn.style.display = 'flex';
        }
    } else {
        if (existingRemoveBtn) existingRemoveBtn.style.display = 'none';
    }
}

function hideReactionPicker() {
    setTimeout(() => {
        const picker = document.getElementById('reaction-picker');
        if (picker && !picker.matches(':hover') && !document.elementFromPoint(picker.getBoundingClientRect().left + 10, picker.getBoundingClientRect().top + 10)?.closest('.reaction-picker')) {
            picker.style.display = 'none';
        }
    }, 500);
}

// Global Event Listeners for Post and Comment Hover
let hoverTimeout = null;

// Use mouseover instead of mouseenter for better event delegation
document.addEventListener('mouseover', (e) => {
    // Check for Post Like Button OR Comment Like Button OR Comment Badge
    // Ensure e.target is an Element node (not text node)
    const target = e.target.nodeType === Node.ELEMENT_NODE ? e.target : e.target.parentElement;
    if (!target || !target.closest) return;

    const btn = target.closest('.like-btn, .comment__action--react, .comment__reaction-badge');
    if (btn && !target.closest('.reaction-picker')) {
        // Clear any pending hide
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        // Always show picker on hover - let showReactionPicker handle visibility check
        showReactionPicker(e);
    }
}, true); // Use capture phase

document.addEventListener('mouseout', (e) => {
    // Ensure e.target is an Element node (not text node)
    const target = e.target.nodeType === Node.ELEMENT_NODE ? e.target : e.target.parentElement;
    if (!target || !target.closest) return;

    const btn = target.closest('.like-btn, .comment__action--react, .comment__reaction-badge');
    const picker = document.getElementById('reaction-picker');

    if (btn) {
        // Check if mouse is moving to picker
        const relatedTarget = e.relatedTarget;
        if (picker && relatedTarget && relatedTarget.nodeType === Node.ELEMENT_NODE && picker.contains(relatedTarget)) {
            // Mouse moving to picker, don't hide
            return;
        }
        // Check if mouse is moving to another button
        if (relatedTarget && relatedTarget.nodeType === Node.ELEMENT_NODE) {
            const relatedBtn = relatedTarget.closest('.like-btn, .comment__action--react, .comment__reaction-badge');
            if (relatedBtn && relatedBtn !== btn) {
                // Moving to another button, keep picker
                return;
            }
        }
        hideReactionPicker();
    }
}, true); // Use capture phase

// Keep picker visible when hovering over it
document.addEventListener('mouseover', (e) => {
    const picker = document.getElementById('reaction-picker');
    if (picker && picker.contains(e.target)) {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
    }
}, true);

document.addEventListener('mouseout', (e) => {
    const picker = document.getElementById('reaction-picker');
    // Ensure e.target is an Element node
    const target = e.target.nodeType === Node.ELEMENT_NODE ? e.target : e.target.parentElement;
    if (picker && target && picker.contains(target)) {
        const relatedTarget = e.relatedTarget;
        // Check if leaving picker to go to button
        if (!relatedTarget ||
            (relatedTarget.nodeType !== Node.ELEMENT_NODE) ||
            !relatedTarget.closest ||
            !relatedTarget.closest('.like-btn, .comment__action--react, .comment__reaction-badge, .reaction-picker')) {
            hideReactionPicker();
        }
    }
}, true);

// Handle click on comment like button (direct click without picker)
document.addEventListener('click', async (e) => {
    // Ensure e.target is an Element node
    const target = e.target.nodeType === Node.ELEMENT_NODE ? e.target : e.target.parentElement;
    if (!target || !target.closest) return;

    // Check if clicking on comment like button
    const commentLikeBtn = target.closest('.comment__action--react');
    if (commentLikeBtn && !target.closest('.reaction-picker')) {
        e.preventDefault();
        e.stopPropagation();

        const commentEl = commentLikeBtn.closest('.comment');
        if (!commentEl) return;

        const commentId = commentEl.dataset.commentId;
        if (!commentId) return;

        const isLiked = commentLikeBtn.classList.contains('liked');

        // Optimistic UI update
        if (isLiked) {
            // Remove reaction
            updateCommentReactionUI(commentId, null, -1);
            try {
                await removeCommentReaction(commentId);
            } catch (error) {
                console.error('Error removing comment reaction:', error);
                // Reload comments on error
                const postId = commentEl.closest('.post-card')?.dataset.postId;
                if (postId) loadComments(postId);
            }
        } else {
            // Add LIKE reaction
            updateCommentReactionUI(commentId, 'LIKE', 1);
            try {
                await addCommentReaction(commentId, 'LIKE');
            } catch (error) {
                console.error('Error adding comment reaction:', error);
                // Reload comments on error
                const postId = commentEl.closest('.post-card')?.dataset.postId;
                if (postId) loadComments(postId);
            }
        }
    }
}, true);

// ...

function initializePostModal() {
    const openBtn = document.getElementById('open-post-modal');
    const modal = document.getElementById('create-post-modal');
    const imagesInput = document.getElementById('post-images-input');

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            modal?.classList.add('active');
        });
    }

    if (imagesInput) {
        imagesInput.addEventListener('change', handleImagesSelect);
    }

    const videosInput = document.getElementById('post-videos-input');
    if (videosInput) {
        videosInput.addEventListener('change', handleVideosSelect);
    }

    // Add drag and drop support
    const preview = document.getElementById('post-images-preview');
    if (preview) {
        preview.addEventListener('dragover', (e) => {
            e.preventDefault();
            preview.style.borderColor = '#4CAF50';
            preview.style.backgroundColor = '#f0f9f0';
        });

        preview.addEventListener('dragleave', (e) => {
            e.preventDefault();
            preview.style.borderColor = '#ddd';
            preview.style.backgroundColor = 'transparent';
        });

        preview.addEventListener('drop', (e) => {
            e.preventDefault();
            preview.style.borderColor = '#ddd';
            preview.style.backgroundColor = 'transparent';

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                // Create a synthetic event object to reuse handleImagesSelect logic
                const syntheticEvent = {
                    target: {
                        files: e.dataTransfer.files
                    }
                };
                handleImagesSelect(syntheticEvent);
            }
        });
    }
    // Reaction picker - use event delegation since buttons are in HTML
    attachReactionPickerHandlers();
}

// Flag to track if handlers are already attached
let reactionPickerHandlersAttached = false;

function attachReactionPickerHandlers() {
    // Only attach once
    if (reactionPickerHandlersAttached) return;

    const picker = document.getElementById('reaction-picker');
    if (!picker) return;

    // Use event delegation on the picker itself
    picker.addEventListener('click', async (e) => {
        // Ensure e.target is an Element node
        const target = e.target.nodeType === Node.ELEMENT_NODE ? e.target : e.target.parentElement;
        if (!target || !target.closest) return;

        const btn = target.closest('.reaction-btn');
        if (!btn || btn.classList.contains('reaction-remove-btn')) return;

        e.preventDefault();
        e.stopPropagation();

        const reactionType = btn.dataset.reaction;
        if (!reactionType) return;

        // Check if this is for a comment or a post
        const commentId = picker.dataset.commentId;
        const postId = picker.dataset.postId;

        picker.style.display = 'none';

        if (commentId) {
            // Handle Comment Reaction
            updateCommentReactionUI(commentId, reactionType, 1);
            try {
                await addCommentReaction(commentId, reactionType);
            } catch (error) {
                console.error('Error adding comment reaction:', error);
            }
            // Clear state
            delete picker.dataset.commentId;
        } else if (postId) {
            // Handle Post Reaction (Existing Logic)
            const likeBtn = document.querySelector(`.like-btn[data-post-id="${postId}"]`);
            const currentCountText = likeBtn?.closest('.post-card')
                ?.querySelector('.post-card__reactions span:last-child')?.textContent || '0';
            const startCount = parseInt(currentCountText) || 0;
            const hadReaction = likeBtn?.classList.contains('liked') === true;
            const newCount = hadReaction ? startCount : startCount + 1;

            updatePostReactionUI(postId, true, newCount, reactionType);

            try {
                await addReaction(postId, reactionType);
            } catch (error) {
                console.error('Error adding reaction:', error);
                loadFeed();
            }
        }
    });

    reactionPickerHandlersAttached = true;
}

function closeCreatePostModal() {
    const modal = document.getElementById('create-post-modal');
    modal?.classList.remove('active');
    document.getElementById('post-content').value = '';
    document.getElementById('post-images-preview').innerHTML = '';
    document.getElementById('post-videos-preview').innerHTML = '';
    selectedImages = [];
    selectedVideos = [];
}

let selectedImages = [];
let selectedVideos = [];

function handleImagesSelect(e) {
    const files = Array.from(e.target.files);
    const preview = document.getElementById('post-images-preview');

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            selectedImages.push(event.target.result);
            const img = document.createElement('img');
            img.src = event.target.result;
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
}

function handleVideosSelect(e) {
    const files = Array.from(e.target.files);
    const preview = document.getElementById('post-videos-preview');

    files.forEach(file => {
        if (!file.type.startsWith('video/')) return;

        selectedVideos.push(file); // Store File object for upload

        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'post-form__video-preview';
        videoWrapper.style.position = 'relative';

        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.style.width = '100%';
        video.style.borderRadius = '8px';
        video.controls = false;

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '4px';
        removeBtn.style.right = '4px';
        removeBtn.style.background = 'rgba(0,0,0,0.5)';
        removeBtn.style.color = 'white';
        removeBtn.style.border = 'none';
        removeBtn.style.borderRadius = '50%';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.width = '24px';
        removeBtn.style.height = '24px';
        removeBtn.style.display = 'flex';
        removeBtn.style.alignItems = 'center';
        removeBtn.style.justifyContent = 'center';

        removeBtn.onclick = () => {
            selectedVideos = selectedVideos.filter(v => v !== file);
            videoWrapper.remove();
        };

        videoWrapper.appendChild(video);
        videoWrapper.appendChild(removeBtn);
        preview.appendChild(videoWrapper);
    });
}

async function submitPost() {
    const content = document.getElementById('post-content').value.trim();
    if (!content) {
        alert('Vui lòng nhập nội dung bài viết');
        return;
    }

    try {
        let uploadedVideoUrls = [];

        // Upload videos if any
        if (selectedVideos.length > 0) {
            showToast('Đang tải video lên...', 'info');
            for (const file of selectedVideos) {
                const formData = new FormData();
                formData.append('file', file);

                const uploadResponse = await fetch(`${API_BASE_URL}/posts/upload-video`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: formData
                });

                if (uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    uploadedVideoUrls.push(uploadData.url);
                } else {
                    console.error('Failed to upload video');
                }
            }
        }

        const response = await fetch(`${API_BASE_URL}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                userId: currentUser.id,
                content: content,
                images: selectedImages.length > 0 ? JSON.stringify(selectedImages) : null,
                videos: uploadedVideoUrls.length > 0 ? JSON.stringify(uploadedVideoUrls) : null
            })
        });

        if (response.ok) {
            const data = await response.json();
            closeCreatePostModal();

            if (data.isApproved) {
                loadFeed();
                showToast('Đăng bài thành công!', 'success');
            } else {
                showToast('Bài viết đang chờ duyệt.', 'info');
            }
        } else {
            showToast('Không thể đăng bài', 'error');
        }
    } catch (error) {
        console.error('Error creating post:', error);
        showToast('Lỗi kết nối', 'error');
    }
}

async function addReaction(postId, reactionType) {
    try {
        await fetch(`${API_BASE_URL}/posts/${postId}/react`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                userId: currentUser.id,
                reactionType: reactionType
            })
        });
    } catch (error) {
        console.error('Error adding reaction:', error);
    }
}

// ==================== COMMENT REACTIONS ====================

async function addCommentReaction(commentId, reactionType) {
    try {
        await fetch(`${API_BASE_URL}/posts/comments/${commentId}/react`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                userId: currentUser.id,
                reactionType: reactionType
            })
        });
    } catch (error) {
        console.error('Error adding comment reaction:', error);
    }
}

// Video Renderer (single source of truth for feed)
function renderPostVideos(videosStr) {
    if (!videosStr) return '';
    try {
        const videos = JSON.parse(videosStr);
        if (!Array.isArray(videos) || videos.length === 0) return '';

        return videos.map(url => `
            <div class="post-card__video">
                <video
                    src="${normalizeMediaUrl(url)}"
                    controls
                    preload="metadata"
                    playsinline
                ></video>
            </div>
        `).join('');
    } catch (e) {
        console.error('Error parsing videos:', e);
        return '';
    }
}

function normalizeMediaUrl(url) {
    if (!url) return '';
    try {
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        const origin = new URL(API_BASE_URL).origin;
        return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
    } catch {
        return url;
    }
}

// Add global fullscreen listener for agriculture theme
document.addEventListener('fullscreenchange', (e) => {
    if (document.fullscreenElement && document.fullscreenElement.tagName === 'VIDEO') {
        // Native video fullscreen prevents custom overlays usually.
        // To strictly follow "frame around video", we would need a custom player wrapper.
        // However, standard <video> fullscreen takes over the screen.
        // We will try to style it if possible or stick to best effort.
        // A common trick is fullscreening the wrapper div instead.
    }
});

async function removeCommentReaction(commentId) {
    try {
        await fetch(`${API_BASE_URL}/posts/comments/${commentId}/react?userId=${currentUser.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
    } catch (error) {
        console.error('Error removing comment reaction:', error);
    }
}

function updateCommentReactionUI(commentId, reactionType, countDiff) {
    const commentEl = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
    if (!commentEl) return;

    // Update Action Text
    const actionBtn = commentEl.querySelector('.comment__action--react');
    if (actionBtn) {
        if (reactionType) {
            actionBtn.classList.add('liked');
            // For LIKE reaction, show "Thích" only (no emoji), for others show emoji + text
            if (reactionType === 'LIKE') {
                actionBtn.textContent = 'Thích';
                actionBtn.innerHTML = 'Thích';
                actionBtn.style.color = '#2563EB'; // Ensure blue color for Like
            } else {
                const info = getReactionInfo(reactionType);
                actionBtn.innerHTML = `<span>${info.emoji}</span> ${info.text}`;
                actionBtn.style.color = info.color;
            }
            actionBtn.dataset.userReaction = reactionType;
        } else {
            actionBtn.classList.remove('liked');
            actionBtn.textContent = 'Thích';
            actionBtn.innerHTML = 'Thích';
            actionBtn.style.color = ''; // Reset color
            delete actionBtn.dataset.userReaction;
        }
    }

    // Update Badge
    // This is complex because we don't have the full count map locally. 
    // We can just trust the reload or implement a simple counter increment/decrement for the *total*.
    // For specific reaction types, re-fetching is safer, but here is a simple total update:
    const badge = commentEl.querySelector('.comment__reaction-badge');

    // Logic: If badge exists, update number. If not, create? 
    // Creating from scratch is hard without knowing which icon to show.
    // Simplest approach: Just update the "active" state on the button and let the user reload to see exact counts if they care deeply, 
    // OR try to update the count if badge exists.
    if (badge) {
        const countSpan = badge.querySelector('.count');
        if (countSpan) {
            let count = parseInt(countSpan.textContent) || 0;
            count += countDiff;
            if (count <= 0) {
                badge.remove();
            } else {
                countSpan.textContent = count;
                // Update icon if we are adding a reaction (simplistic assumption: show latest user reaction)
                if (countDiff > 0 && reactionType) {
                    const iconSpan = badge.querySelector('span:not(.count)');
                    if (iconSpan) iconSpan.textContent = getEmojiForType(reactionType);
                }
            }
        }
    } else if (reactionType && countDiff > 0) {
        // Create badge if it didn't exist
        const body = commentEl.querySelector('.comment__body');
        if (body) {
            const emoji = getEmojiForType(reactionType); // Helper needed
            const newBadge = document.createElement('div');
            newBadge.className = 'comment__reaction-badge';
            newBadge.setAttribute('data-comment-id', commentId); // Add data attribute for hover
            newBadge.innerHTML = `<span>${emoji}</span> <span class="count">1</span>`;
            body.appendChild(newBadge);
        }
    }
}

function getEmojiForType(type) {
    const map = {
        'LIKE': '👍', 'LOVE': '❤️', 'HAHA': '😆',
        'WOW': '😮', 'SAD': '😢', 'ANGRY': '😡'
    };
    return map[type] || '👍';
}

// Close all post menus when clicking outside
document.addEventListener('click', (e) => {
    // Ensure e.target is an Element node
    const target = e.target.nodeType === Node.ELEMENT_NODE ? e.target : e.target.parentElement;
    if (!target || !target.closest) return;

    if (!target.closest('.post-card__menu-wrapper')) {
        document.querySelectorAll('.post-menu-dropdown').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});

function togglePostMenu(event, postId) {
    event.stopPropagation();
    const menu = document.getElementById(`post-menu-${postId}`);

    // Close all other menus first
    document.querySelectorAll('.post-menu-dropdown').forEach(m => {
        if (m !== menu) m.style.display = 'none';
    });

    // Toggle this menu
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

async function deletePost(postId) {
    if (!confirm('Bạn có chắc muốn xóa bài viết này?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        if (response.ok) {
            showToast('Đã xóa bài viết', 'success');
            // Remove the post card from DOM
            const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
            if (postCard) postCard.remove();
        } else {
            showToast('Không thể xóa bài viết', 'error');
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        showToast('Lỗi kết nối', 'error');
    }
}

function reportPost(postId) {
    showToast('Đã gửi báo cáo bài viết', 'info');
    // Close the menu
    document.getElementById(`post-menu-${postId}`).style.display = 'none';
}

// ==================== GUIDES ====================

async function loadGuides() {
    const categoriesContainer = document.getElementById('guide-categories');
    const featuredContainer = document.getElementById('featured-guides');
    const allContainer = document.getElementById('all-guides');

    try {
        // Load categories
        const catResponse = await fetch(`${API_BASE_URL}/guides/categories`);
        if (catResponse.ok) {
            categories = await catResponse.json();
            renderGuideCategories(categoriesContainer);
        }

        // Load featured guides
        const featuredResponse = await fetch(`${API_BASE_URL}/guides/featured`);
        if (featuredResponse.ok) {
            const featured = await featuredResponse.json();
            renderFeaturedGuides(featuredContainer, featured);
        }

        // Load all guides
        const guidesResponse = await fetch(`${API_BASE_URL}/guides?page=0&size=10`);
        if (guidesResponse.ok) {
            const data = await guidesResponse.json();
            guides = data.content || [];
            renderAllGuides(allContainer, guides);
        }
    } catch (error) {
        console.error('Error loading guides:', error);
    }
}

function renderGuideCategories(container) {
    if (!container) return;
    container.innerHTML = categories.map(cat => `
        <button class="guide-category-chip" data-category="${cat.slug}">
            <span class="material-symbols-outlined">${cat.icon || 'category'}</span>
            ${cat.name}
        </button>
    `).join('');

    container.querySelectorAll('.guide-category-chip').forEach(chip => {
        chip.addEventListener('click', () => loadGuidesByCategory(chip.dataset.category));
    });
}

function renderFeaturedGuides(container, featured) {
    if (!container) return;
    if (featured.length === 0) {
        container.innerHTML = '<p class="text-muted">Chưa có bài viết nổi bật</p>';
        return;
    }

    container.innerHTML = featured.map(guide => `
        <div class="guide-card" onclick="viewGuide('${guide.slug}')">
            <img class="guide-card__image" src="${guide.coverImage || ''}" alt="${guide.title}">
            <div class="guide-card__content">
                <div class="guide-card__category">${guide.category?.name || 'Tổng hợp'}</div>
                <h4 class="guide-card__title">${guide.title}</h4>
                <div class="guide-card__meta">
                    <span>${formatTimeAgo(guide.createdAt)}</span>
                    <span>${guide.viewCount || 0} lượt xem</span>
                </div>
            </div>
        </div>
    `).join('');
}

function renderAllGuides(container, guides) {
    if (!container) return;
    if (guides.length === 0) {
        container.innerHTML = '<p class="text-muted">Chưa có hướng dẫn nào</p>';
        return;
    }

    container.innerHTML = guides.map(guide => `
        <div class="guide-list-item" onclick="viewGuide('${guide.slug}')">
            <img class="guide-list-item__image" src="${guide.coverImage || ''}" alt="${guide.title}">
            <div class="guide-list-item__content">
                <h4 class="guide-list-item__title">${guide.title}</h4>
                <p class="guide-list-item__excerpt">${guide.excerpt || ''}</p>
            </div>
        </div>
    `).join('');
}

function viewGuide(slug) {
    // Open guide detail page or modal
    window.location.href = `guide.html?slug=${slug}`;
}

async function loadGuidesByCategory(slug) {
    const allContainer = document.getElementById('all-guides');
    const featuredContainer = document.getElementById('featured-guides');

    // Update active state on category buttons
    document.querySelectorAll('.guide-category-chip').forEach(chip => {
        if (chip.dataset.category === slug) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });

    try {
        const response = await fetch(`${API_BASE_URL}/guides/category/${slug}?page=0&size=20`);
        if (response.ok) {
            const data = await response.json();
            const guides = data.content || [];

            // Show filtered guides in featured section
            if (featuredContainer) {
                if (guides.length === 0) {
                    featuredContainer.innerHTML = '<p class="text-muted">Không có bài viết trong danh mục này</p>';
                } else {
                    renderFeaturedGuides(featuredContainer, guides.slice(0, 4));
                }
            }

            // Show rest in all guides section
            if (allContainer) {
                renderAllGuides(allContainer, guides.slice(4));
            }
        }
    } catch (error) {
        console.error('Error loading guides by category:', error);
    }
}

// ==================== FRIENDS ====================

async function loadFriends() {
    await loadFriendRequests();
    await loadFriendsList();
}

async function loadFriendRequests() {
    const container = document.getElementById('friend-requests-list');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE_URL}/friends/requests?userId=${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            const requests = await response.json();
            if (requests.length === 0) {
                container.innerHTML = '<p class="text-muted">Không có lời mời kết bạn</p>';
            } else {
                container.innerHTML = requests.map(req => renderFriendRequest(req)).join('');
                attachFriendRequestListeners();
            }
        }
    } catch (error) {
        console.error('Error loading friend requests:', error);
    }
}

function renderFriendRequest(request) {
    const requester = request.requester || {};
    return `
        <div class="friend-item" data-request-id="${request.id}">
            <div class="friend-item__avatar">${getInitials(requester.fullName)}</div>
            <div class="friend-item__info">
                <span class="friend-item__name">${requester.fullName}</span>
                <span class="friend-item__mutual">Muốn kết bạn với bạn</span>
            </div>
            <div class="friend-item__actions">
                <button class="btn btn--primary accept-request-btn" data-id="${request.id}">Chấp nhận</button>
                <button class="btn btn--secondary reject-request-btn" data-id="${request.id}">Từ chối</button>
            </div>
        </div>
    `;
}

function attachFriendRequestListeners() {
    document.querySelectorAll('.accept-request-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            await acceptFriendRequest(btn.dataset.id);
        });
    });

    document.querySelectorAll('.reject-request-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            await rejectFriendRequest(btn.dataset.id);
        });
    });
}

async function acceptFriendRequest(requestId) {
    try {
        const response = await fetch(`${API_BASE_URL}/friends/accept/${requestId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (response.ok) {
            showToast('Đã chấp nhận lời mời kết bạn', 'success');
            loadFriends();
            loadFriendRequestCount();
        }
    } catch (error) {
        console.error('Error accepting request:', error);
    }
}

async function rejectFriendRequest(requestId) {
    try {
        const response = await fetch(`${API_BASE_URL}/friends/reject/${requestId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (response.ok) {
            showToast('Đã từ chối lời mời', 'info');
            loadFriends();
            loadFriendRequestCount();
        }
    } catch (error) {
        console.error('Error rejecting request:', error);
    }
}

async function loadFriendsList() {
    const container = document.getElementById('friends-list');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE_URL}/friends?userId=${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            friends = await response.json();
            if (friends.length === 0) {
                container.innerHTML = '<p class="text-muted">Chưa có bạn bè</p>';
            } else {
                container.innerHTML = friends.map(friend => renderFriend(friend)).join('');
            }
        }
    } catch (error) {
        console.error('Error loading friends:', error);
    }
}

function renderFriend(friend) {
    return `
        <div class="friend-item" onclick="startChat(${friend.id})">
            <div class="friend-item__avatar" ${friend.avatarUrl ? `style="background-image: url('${friend.avatarUrl}'); background-size: cover; background-position: center;"` : ''}>
                ${friend.avatarUrl ? '' : getInitials(friend.fullName)}
            </div>
            <div class="friend-item__info">
                <span class="friend-item__name">${friend.fullName}</span>
            </div>
            <div class="friend-item__actions">
                <button class="btn btn--secondary btn--icon" onclick="startChat(${friend.id}); event.stopPropagation();">
                    <span class="material-symbols-outlined">chat</span>
                </button>
            </div>
        </div>
    `;
}

async function loadFriendSuggestions() {
    const container = document.getElementById('friend-suggestions');
    if (!container || !currentUser) return;

    try {
        // Fetch suggestions, sent requests (I sent), and received requests (Sent to me)
        const [suggestionsRes, sentRequestsRes, receivedRequestsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/friends/suggestions?userId=${currentUser.id}&limit=5`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            }),
            fetch(`${API_BASE_URL}/friends/requests/sent?userId=${currentUser.id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            }),
            fetch(`${API_BASE_URL}/friends/requests?userId=${currentUser.id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            })
        ]);

        if (suggestionsRes.ok) {
            const suggestions = await suggestionsRes.json();
            const sentRequests = sentRequestsRes.ok ? await sentRequestsRes.json() : [];
            const receivedRequests = receivedRequestsRes.ok ? await receivedRequestsRes.json() : [];

            // Create sets for O(1) lookup
            const pendingSentIds = new Set(sentRequests.map(r => r.addressee?.id));
            const pendingReceivedIds = new Set(receivedRequests.map(r => r.requester?.id));

            container.innerHTML = suggestions.map(user => {
                const isSent = pendingSentIds.has(user.id);
                const isReceived = pendingReceivedIds.has(user.id);

                const pendingRequest = sentRequests.find(r => r.addressee?.id === user.id);
                // For received, we might want to open panel or accept directly, but for now just show status

                let actionButton = '';
                let statusText = '';

                if (isSent) {
                    statusText = '<span class="suggestion-item__status">Đã gửi lời mời</span>';
                    actionButton = `
                        <button class="suggestion-item__cancel" onclick="cancelFriendRequest(${pendingRequest?.id})" title="Hủy lời mời">
                            <span class="material-symbols-outlined">person_remove</span>
                        </button>
                    `;
                } else if (isReceived) {
                    statusText = '<span class="suggestion-item__status text-primary">Chờ xác nhận</span>';
                    // Show a button that opens the request panel or just indicates attention
                    actionButton = `
                        <button class="suggestion-item__notification" onclick="if(window.toggleFriendRequestPanel) window.toggleFriendRequestPanel(); event.stopPropagation();" title="Xem lời mời">
                            <span class="material-symbols-outlined">notifications_active</span>
                        </button>
                    `;
                } else {
                    actionButton = `
                        <button class="suggestion-item__add" onclick="sendFriendRequest(${user.id})" title="Gửi lời mời kết bạn">
                            <span class="material-symbols-outlined">person_add</span>
                        </button>
                    `;
                }

                return `
                <div class="suggestion-item">
                    <div class="suggestion-item__avatar" ${user.avatarUrl ? `style="background-image: url('${user.avatarUrl}'); background-size: cover; background-position: center;"` : ''}>
                        ${user.avatarUrl ? '' : getInitials(user.fullName)}
                    </div>
                    <div class="suggestion-item__info">
                        <span class="suggestion-item__name">${user.fullName}</span>
                        ${statusText}
                    </div>
                    ${actionButton}
                </div>
            `}).join('');
        }
    } catch (error) {
        console.error('Error loading suggestions:', error);
    }
}

// Load friends for sidebar (with chat button)
async function loadOnlineFriends() {
    const container = document.getElementById('online-friends');
    if (!container || !currentUser) return;

    try {
        const response = await fetch(`${API_BASE_URL}/friends?userId=${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            const friendsData = await response.json();

            if (friendsData.length === 0) {
                container.innerHTML = '<p style="padding: 12px; text-align: center; color: #666; font-size: 14px;">Chưa có bạn bè</p>';
                return;
            }

            container.innerHTML = friendsData.slice(0, 5).map(friend => `
                <div class="online-friend-item" style="display: flex; align-items: center; padding: 8px 12px; cursor: pointer; border-radius: 8px; transition: background 0.2s;"
                    onclick="startChat(${friend.id})" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='transparent'">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #4CAF50, #45a049); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; margin-right: 10px; ${friend.avatarUrl ? `background-image: url('${friend.avatarUrl}'); background-size: cover;` : ''}">
                        ${friend.avatarUrl ? '' : getInitials(friend.fullName)}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${friend.fullName}</div>
                    </div>
                    <button onclick="startChat(${friend.id}); event.stopPropagation();" 
                        style="background: none; border: none; cursor: pointer; padding: 6px; border-radius: 50%; transition: background 0.2s;"
                        onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='none'">
                        <span class="material-symbols-outlined" style="font-size: 20px; color: #4CAF50;">chat</span>
                    </button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading online friends:', error);
    }
}

async function sendFriendRequest(addresseeId) {
    if (!currentUser || !currentUser.id) {
        showToast('Vui lòng đăng nhập để gửi lời mời kết bạn', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/friends/request/${addresseeId}?requesterId=${currentUser.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            showToast('Đã gửi lời mời kết bạn', 'success');
            loadFriendSuggestions();
        } else {
            const error = await response.json();
            showToast(error.error || 'Không thể gửi lời mời', 'error');
        }
    } catch (error) {
        console.error('Error sending friend request:', error);
        showToast('Đã xảy ra lỗi khi gửi lời mời', 'error');
    }
}

async function cancelFriendRequest(requestId) {
    if (!requestId) {
        showToast('Không tìm thấy yêu cầu kết bạn', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/friends/${requestId}?userId=${currentUser.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            showToast('Đã hủy lời mời kết bạn', 'success');
            loadFriendSuggestions();
        } else {
            showToast('Không thể hủy lời mời', 'error');
        }
    } catch (error) {
        console.error('Error canceling friend request:', error);
        showToast('Đã xảy ra lỗi', 'error');
    }
}

async function deletePost(postId) {
    showConfirmModal('Xóa bài viết?', 'Bạn có chắc muốn xóa bài viết này không? Hành động này không thể hoàn tác.', async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });

            if (response.ok) {
                showToast('Đã xóa bài viết', 'success');
                loadFeed();
            } else {
                showToast('Không thể xóa bài viết', 'error');
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            showToast('Đã xảy ra lỗi', 'error');
        }
    });
}

async function loadFriendRequestCount() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_BASE_URL}/friends/requests/count?userId=${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            const count = await response.json();
            const badge = document.getElementById('friend-request-count');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'flex' : 'none';
            }
        }
    } catch (error) {
        console.error('Error loading request count:', error);
    }
}

// ============ FRIEND REQUESTS ============

function initializeFriendRequestPanel() {
    const btn = document.getElementById('friend-requests-btn');
    if (!btn) return;

    // Create dropdown panel if it doesn't exist
    let panel = document.getElementById('friend-request-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'friend-request-panel';
        panel.className = 'friend-request-panel';
        panel.innerHTML = `
            <div class="friend-request-header">
                <h3>Lời mời kết bạn</h3>
            </div>
            <div class="friend-request-list" id="friend-request-list">
                <div class="loading-spinner p-4"><div class="spinner border-2 border-primary border-t-transparent rounded-full w-6 h-6 animate-spin mx-auto"></div></div>
            </div>
        `;
        document.body.appendChild(panel);
    }

    // Global toggle function
    window.toggleFriendRequestPanel = function () {
        // Calculate position dynamically every time
        const rect = btn.getBoundingClientRect();
        panel.style.top = `${rect.bottom + 10}px`;
        const leftPos = rect.right - 320;
        panel.style.left = `${Math.max(10, leftPos)}px`;

        if (panel.classList.contains('active')) {
            panel.classList.remove('active');
        } else {
            document.querySelectorAll('.active-panel').forEach(p => p.classList.remove('active')); // Close other panels
            panel.classList.add('active');
            loadFriendRequests();
        }
    };

    // Toggle panel on button click
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.toggleFriendRequestPanel();
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (panel && !panel.contains(e.target) && !btn.contains(e.target)) {
            panel.classList.remove('active');
        }
    });
}

async function loadFriendRequests() {
    const container = document.getElementById('friend-request-list');
    if (!container || !currentUser) return;

    try {
        const response = await fetch(`${API_BASE_URL}/friends/requests?userId=${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            const requests = await response.json();

            if (requests.length === 0) {
                container.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">Không có lời mời nào</div>';
                // Hide badge
                const badge = document.getElementById('friend-request-count');
                if (badge) badge.style.display = 'none';
                return;
            }

            container.innerHTML = requests.map(req => `
                <div class="friend-request-item">
                    <div class="friend-request-avatar" ${req.requester.avatarUrl ? `style="background-image: url('${req.requester.avatarUrl}'); background-size: cover; background-position: center;"` : ''}>
                        ${req.requester.avatarUrl ? '' : getInitials(req.requester.fullName)}
                    </div>
                    <div class="friend-request-info">
                        <div class="friend-request-name">${req.requester.fullName}</div>
                        <div class="friend-request-time">${formatTimeAgo(req.createdAt)}</div>
                    </div>
                    <div class="friend-request-actions">
                        <button onclick="acceptFriendRequest(${req.id})" class="friend-request-btn accept" title="Đồng ý">
                            <span class="material-symbols-outlined">check</span>
                        </button>
                        <button onclick="rejectFriendRequest(${req.id})" class="friend-request-btn reject" title="Từ chối">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
            `).join('');

            // Update badge count
            const badge = document.getElementById('friend-request-count');
            if (badge) {
                badge.textContent = requests.length;
                badge.style.display = requests.length > 0 ? 'flex' : 'none';
            }
        }
    } catch (error) {
        console.error('Error loading friend requests:', error);
        container.innerHTML = '<div class="p-4 text-center text-red-500 text-sm">Có lỗi xảy ra</div>';
    }
}

async function acceptFriendRequest(requestId) {
    try {
        const response = await fetch(`${API_BASE_URL}/friends/accept/${requestId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            excludedRequestIds.add(requestId); // Mark as handled
            showToast('Đã chấp nhận kết bạn', 'success');
            loadFriendRequests(); // Reload list
            loadFriends(); // Reload friends list
            loadFriendSuggestions(); // Reload suggestions
        } else {
            showToast('Không thể chấp nhận yêu cầu', 'error');
        }
    } catch (error) {
        console.error('Error accepting friend request:', error);
        showToast('Đã xảy ra lỗi', 'error');
    }
}

async function rejectFriendRequest(requestId) {
    try {
        const response = await fetch(`${API_BASE_URL}/friends/reject/${requestId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            // Immediate DOM update with animation
            const items = document.querySelectorAll('.friend-request-item');
            items.forEach(item => {
                if (item.innerHTML.includes(`rejectFriendRequest(${requestId})`)) {
                    item.style.transition = 'all 0.3s ease';
                    item.style.height = '0';
                    item.style.padding = '0';
                    item.style.opacity = '0';
                    setTimeout(() => item.remove(), 300);
                }
            });

            showToast('Đã từ chối lời mời', 'info');

            // Update badge
            const badge = document.getElementById('friend-request-count');
            if (badge) {
                const current = parseInt(badge.textContent) || 0;
                if (current > 0) {
                    badge.textContent = current - 1;
                    if (current <= 1) badge.style.display = 'none';
                }
            }

            // Reload data from server to ensure consistency
            setTimeout(() => {
                loadFriendRequests();
                loadFriendSuggestions();
            }, 400);
        } else {
            showToast('Không thể từ chối yêu cầu', 'error');
        }
    } catch (error) {
        console.error('Error rejecting friend request:', error);
        showToast('Đã xảy ra lỗi', 'error');
    }
}

// ==================== CHAT ====================

function initializeChatPanel() {
    const toggleBtn = document.getElementById('chat-toggle-btn');
    const panel = document.getElementById('chat-panel');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            panel?.classList.toggle('open');
        });
    }

    // Initialize new chat button
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', openCreateGroupModal);
    }
}

// ==================== GROUP CHAT ====================

let selectedFriendIds = new Set();

async function openCreateGroupModal() {
    const modal = document.getElementById('create-group-modal');
    const friendsList = document.getElementById('group-friends-list');

    if (!modal || !friendsList) return;

    // Reset state
    selectedFriendIds.clear();
    document.getElementById('group-name-input').value = '';
    updateSelectedCount();

    // Show loading
    friendsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Đang tải...</div>';
    modal.classList.add('active');

    // Load friends
    try {
        const response = await fetch(`${API_BASE_URL}/friends?userId=${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            const friendsData = await response.json();

            if (friendsData.length === 0) {
                friendsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Chưa có bạn bè</div>';
                return;
            }

            friendsList.innerHTML = friendsData.map(friend => `
                <div class="group-friend-item" onclick="toggleFriendSelection(${friend.id}, this)" 
                    style="display: flex; align-items: center; padding: 12px; cursor: pointer; transition: background 0.2s;"
                    onmouseover="this.style.background='#f5f5f5'" onmouseout="if(!this.classList.contains('selected'))this.style.background='white'">
                    <div class="group-friend-checkbox" style="width: 20px; height: 20px; border: 2px solid #ddd; border-radius: 4px; margin-right: 12px; display: flex; align-items: center; justify-content: center;">
                    </div>
                    <div class="group-friend-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #4CAF50, #45a049); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 12px; ${friend.avatarUrl ? `background-image: url('${friend.avatarUrl}'); background-size: cover;` : ''}">
                        ${friend.avatarUrl ? '' : getInitials(friend.fullName)}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 500;">${friend.fullName}</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading friends:', error);
        friendsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Có lỗi xảy ra</div>';
    }
}

function closeCreateGroupModal() {
    const modal = document.getElementById('create-group-modal');
    modal?.classList.remove('active');
    selectedFriendIds.clear();
}

function toggleFriendSelection(friendId, element) {
    if (selectedFriendIds.has(friendId)) {
        selectedFriendIds.delete(friendId);
        element.classList.remove('selected');
        element.style.background = 'white';
        element.querySelector('.group-friend-checkbox').innerHTML = '';
        element.querySelector('.group-friend-checkbox').style.borderColor = '#ddd';
        element.querySelector('.group-friend-checkbox').style.background = 'white';
    } else {
        selectedFriendIds.add(friendId);
        element.classList.add('selected');
        element.style.background = '#e8f5e9';
        element.querySelector('.group-friend-checkbox').innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px; color: white;">check</span>';
        element.querySelector('.group-friend-checkbox').style.borderColor = '#4CAF50';
        element.querySelector('.group-friend-checkbox').style.background = '#4CAF50';
    }
    updateSelectedCount();
}

function updateSelectedCount() {
    const countEl = document.getElementById('selected-count');
    const btn = document.getElementById('create-group-btn');
    const count = selectedFriendIds.size;

    if (countEl) countEl.textContent = `Đã chọn: ${count}`;

    if (btn) {
        if (count >= 2) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        } else {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        }
    }
}

async function createGroupChat() {
    const name = document.getElementById('group-name-input').value.trim();

    if (selectedFriendIds.size < 2) {
        showToast('Vui lòng chọn ít nhất 2 bạn bè', 'error');
        return;
    }

    const groupName = name || `Nhóm của ${currentUser.fullName}`;

    try {
        const response = await fetch(`${API_BASE_URL}/chat/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                ownerId: currentUser.id,
                name: groupName,
                type: 'GROUP',
                memberIds: Array.from(selectedFriendIds)
            })
        });

        if (response.ok) {
            const room = await response.json();
            showToast('Đã tạo nhóm thành công!', 'success');
            closeCreateGroupModal();
            loadChatRooms();
            openChatWindow(room.id);
        } else {
            showToast('Không thể tạo nhóm', 'error');
        }
    } catch (error) {
        console.error('Error creating group:', error);
        showToast('Đã xảy ra lỗi', 'error');
    }
}

function toggleChatPanel() {
    const panel = document.getElementById('chat-panel');
    panel?.classList.toggle('open');
}

async function loadChatRooms() {
    if (!currentUser) return;

    const container = document.getElementById('chat-rooms-list');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE_URL}/chat/rooms?userId=${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            chatRooms = await response.json();
            renderChatRooms(container);
        }
    } catch (error) {
        console.error('Error loading chat rooms:', error);
    }
}

function renderChatRooms(container) {
    if (chatRooms.length === 0) {
        container.innerHTML = '<p class="text-center text-muted" style="padding: 20px;">Chưa có cuộc trò chuyện</p>';
        return;
    }

    container.innerHTML = chatRooms.map(room => {
        const isGroup = room.type === 'GROUP' || room.type === 'COOPERATIVE';
        const memberCount = room.members?.length || 0;

        let name, avatarContent, avatarStyle;

        if (isGroup) {
            name = room.name || 'Nhóm chat';
            avatarContent = '<span class="material-symbols-outlined" style="font-size: 20px;">groups</span>';
            avatarStyle = 'background: linear-gradient(135deg, #2196F3, #1976D2); color: white;';
        } else {
            const otherMember = room.members?.find(m => m.user?.id !== currentUser.id);
            name = otherMember?.user?.fullName || 'Người dùng';
            const avatarUrl = otherMember?.user?.avatarUrl;
            if (avatarUrl) {
                avatarContent = '';
                avatarStyle = `background-image: url('${avatarUrl}'); background-size: cover;`;
            } else {
                avatarContent = getInitials(name);
                avatarStyle = 'background: linear-gradient(135deg, #4CAF50, #45a049); color: white;';
            }
        }

        return `
            <div class="chat-room-item ${isGroup ? 'chat-room-item--group' : ''}" onclick="openChatWindow(${room.id})">
                <div class="chat-room-item__avatar" style="${avatarStyle}">${avatarContent}</div>
                <div class="chat-room-item__info">
                    <span class="chat-room-item__name">${name}</span>
                    <span class="chat-room-item__last-message">${isGroup ? `${memberCount} thành viên` : 'Nhấn để xem tin nhắn'}</span>
                </div>
            </div>
        `;
    }).join('');
}

async function startChat(friendId) {
    try {
        const response = await fetch(`${API_BASE_URL}/chat/rooms/private`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                userId1: currentUser.id,
                userId2: friendId
            })
        });

        if (response.ok) {
            const room = await response.json();
            openChatWindow(room.id);
            loadChatRooms();
        }
    } catch (error) {
        console.error('Error starting chat:', error);
    }
}

async function openChatWindow(roomId) {
    // Check if already open
    if (activeChatWindows.includes(roomId)) return;

    const template = document.getElementById('chat-window-template');
    if (!template) return;

    // Get room info
    const room = chatRooms.find(r => r.id === roomId);
    if (!room) return;

    const chatWindow = template.cloneNode(true);
    chatWindow.id = `chat-window-${roomId}`;
    chatWindow.style.display = 'flex';
    chatWindow.style.right = `${100 + (activeChatWindows.length + 1) * 340}px`;
    chatWindow.dataset.roomId = roomId;

    // Set name and avatar based on room type
    const isGroup = room.type === 'GROUP' || room.type === 'COOPERATIVE';
    let name, avatarContent, avatarStyle, statusText;

    if (isGroup) {
        name = room.name || 'Nhóm chat';
        avatarContent = '<span class="material-symbols-outlined" style="font-size: 18px;">groups</span>';
        avatarStyle = 'background: linear-gradient(135deg, #2196F3, #1976D2); display: flex; align-items: center; justify-content: center;';
        statusText = `${room.members?.length || 0} thành viên`;
    } else {
        const otherMember = room.members?.find(m => m.user?.id !== currentUser.id);
        name = otherMember?.user?.fullName || 'Người dùng';
        const avatarUrl = otherMember?.user?.avatarUrl;
        if (avatarUrl) {
            avatarContent = '';
            avatarStyle = `background-image: url('${avatarUrl}'); background-size: cover;`;
        } else {
            avatarContent = getInitials(name);
            avatarStyle = '';
        }
        if (otherMember?.user?.isOnline !== false) { // Default to online if prop missing, given context
            statusText = '<span class="status-dot online"></span> Đang hoạt động';
        } else {
            statusText = '<span class="status-dot offline"></span> Offline';
        }
    }

    chatWindow.querySelector('.chat-window__name').textContent = name;
    chatWindow.querySelector('.chat-window__avatar').innerHTML = avatarContent;
    chatWindow.querySelector('.chat-window__avatar').style.cssText += avatarStyle;
    chatWindow.querySelector('.chat-window__status').innerHTML = statusText;

    // Add event listeners
    chatWindow.querySelector('.chat-window__close').addEventListener('click', () => {
        closeChatWindow(roomId);
    });

    chatWindow.querySelector('.chat-window__send').addEventListener('click', () => {
        sendMessage(roomId);
    });

    chatWindow.querySelector('.chat-window__text').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage(roomId);
    });

    document.body.appendChild(chatWindow);
    activeChatWindows.push(roomId);

    // Load messages
    await loadMessages(roomId);
}

function closeChatWindow(roomId) {
    const chatWindow = document.getElementById(`chat-window-${roomId}`);
    if (chatWindow) {
        chatWindow.remove();
    }
    activeChatWindows = activeChatWindows.filter(id => id !== roomId);

    // Reposition remaining windows
    activeChatWindows.forEach((id, index) => {
        const window = document.getElementById(`chat-window-${id}`);
        if (window) {
            window.style.right = `${100 + (index + 1) * 340}px`;
        }
    });
}

async function loadMessages(roomId) {
    const chatWindow = document.getElementById(`chat-window-${roomId}`);
    if (!chatWindow) return;

    const messagesContainer = chatWindow.querySelector('.chat-window__messages');

    try {
        const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/messages?page=0&size=50`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            const data = await response.json();
            const messages = (data.content || []).reverse();
            renderMessages(messagesContainer, messages);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function renderMessages(container, messages) {
    container.innerHTML = messages.map((msg, index, arr) => {
        const isSent = msg.sender?.id === currentUser.id;
        const content = parseMessageContent(msg.content, msg.sender?.id, msg.id, isSent, msg.metadata);
        const timeAgo = formatChatTime(msg.createdAt);

        // Parse metadata nếu là string
        let metadata = msg.metadata;
        if (typeof metadata === 'string') {
            try { metadata = JSON.parse(metadata); } catch (e) { metadata = {}; }
        }

        // Hiển thị reaction với emoji thực tế từ metadata
        const reactionEmoji = metadata?.lastReaction || '👍';
        const reactionHtml = msg.likeCount > 0 ?
            `<span style="background: #fff; border-radius: 12px; padding: 2px 6px; font-size: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.15); position: absolute; bottom: -10px; ${isSent ? 'left: 4px;' : 'right: 4px;'}">${reactionEmoji}${msg.likeCount > 1 ? ' ' + msg.likeCount : ''}</span>` : '';

        // Chỉ hiện avatar ở tin nhắn cuối của 1 người (Messenger style)
        const nextMsg = arr[index + 1];
        const isLastInGroup = !nextMsg || nextMsg.sender?.id !== msg.sender?.id;

        // Reaction bar - đặt phía trên tin nhắn
        const reactionBar = `
            <div class="reaction-bar" style="display: none; position: absolute; ${isSent ? 'right: 0;' : 'left: 0;'} top: -35px; background: white; border-radius: 20px; padding: 4px 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); z-index: 100; white-space: nowrap;">
                <span onclick="addMessageReaction(${msg.id}, '👍')" style="cursor: pointer; padding: 4px; font-size: 18px; transition: transform 0.15s; display: inline-block;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">👍</span>
                <span onclick="addMessageReaction(${msg.id}, '❤️')" style="cursor: pointer; padding: 4px; font-size: 18px; transition: transform 0.15s; display: inline-block;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">❤️</span>
                <span onclick="addMessageReaction(${msg.id}, '😂')" style="cursor: pointer; padding: 4px; font-size: 18px; transition: transform 0.15s; display: inline-block;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">😂</span>
                <span onclick="addMessageReaction(${msg.id}, '😮')" style="cursor: pointer; padding: 4px; font-size: 18px; transition: transform 0.15s; display: inline-block;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">😮</span>
                <span onclick="addMessageReaction(${msg.id}, '😢')" style="cursor: pointer; padding: 4px; font-size: 18px; transition: transform 0.15s; display: inline-block;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">😢</span>
                ${msg.likeCount > 0 ? `<span onclick="removeReaction(${msg.id})" style="cursor: pointer; padding: 4px 8px; font-size: 14px; color: #999; margin-left: 4px; border-left: 1px solid #eee;" title="Xóa reaction">✕</span>` : ''}
            </div>
        `;

        // Messenger style: bubble đơn giản, không nền ngoài
        return `
            <div style="display: flex; flex-direction: column; margin-bottom: ${isLastInGroup ? '8px' : '2px'}; padding: 0 12px;">
                <div class="chat-message chat-message--${isSent ? 'sent' : 'received'}" data-message-id="${msg.id}" 
                    style="display: flex; align-items: flex-end; justify-content: ${isSent ? 'flex-end' : 'flex-start'}; width: 100%; ${msg.likeCount > 0 ? 'margin-bottom: 12px;' : ''}"
                    onmouseenter="var rb = this.querySelector('.reaction-bar'); if(rb) rb.style.display='flex';" 
                    onmouseleave="var rb = this.querySelector('.reaction-bar'); if(rb) rb.style.display='none';">
                    ${!isSent ? `
                        <div style="width: 28px; height: 28px; margin-right: 8px; flex-shrink: 0; align-self: flex-end;">
                            ${isLastInGroup ? `
                                <div onclick="viewAvatar(${msg.sender?.id})" 
                                    style="cursor: pointer; width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #4CAF50, #45a049); color: white; font-size: 11px; font-weight: 500; display: flex; align-items: center; justify-content: center; ${msg.sender?.avatarUrl ? `background-image: url('${msg.sender.avatarUrl}'); background-size: cover;` : ''}">
                                    ${msg.sender?.avatarUrl ? '' : getInitials(msg.sender?.fullName || 'U')}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    <div style="position: relative; max-width: 70%;">
                        ${reactionBar}
                        <div class="chat-message__content" style="padding: 8px 12px; border-radius: 18px; background: ${isSent ? 'linear-gradient(135deg, #4CAF50, #43a047)' : '#f0f2f5'}; color: ${isSent ? 'white' : '#050505'}; overflow-wrap: break-word; word-break: break-word; position: relative; font-size: 15px; line-height: 1.4; max-width: 100%;">
                            ${content}
                            ${reactionHtml}
                        </div>
                    </div>
                </div>
                ${isLastInGroup ? `<div style="font-size: 11px; color: #65676b; margin-top: 2px; ${isSent ? 'text-align: right;' : 'margin-left: 36px;'}">${timeAgo}</div>` : ''}
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

// Format chat timestamp 
function formatChatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút`;
    if (diff < 86400) return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

// Parse message content for @taikhoan, @chuyentien, links, emojis
function parseMessageContent(content, senderId, messageId, isSentByMe, metadata) {
    if (!content) return '';

    let parsed = escapeHtml(content);

    // Check if this transfer was already completed
    const transferCompleted = metadata?.transferCompleted === true || metadata?.transferStatus === 'completed';

    // Parse @taikhoan - show SENDER's balance (not mine)
    // Only show balance button if message is from someone else (I can see their balance)
    if (!isSentByMe) {
        parsed = parsed.replace(/@taikhoan/gi, `<span onclick="showSenderBalance(${senderId})" style="color: #1565c0; cursor: pointer; text-decoration: underline;">💰 Xem số dư</span>`);
    } else {
        parsed = parsed.replace(/@taikhoan/gi, `<span onclick="showMyBalance()" style="color: #2e7d32; cursor: pointer; text-decoration: underline;">💰 Số dư</span>`);
    }

    // Parse @chuyentien {amount} - only others can request transfer to me
    // If I sent this message, it means I'm requesting others to transfer to me - show as info
    // If others sent, it's a transfer request I can accept
    parsed = parsed.replace(/@chuyentien\s+(\d+)/gi, (match, amount) => {
        const formattedAmount = parseInt(amount).toLocaleString('vi-VN');

        // If transfer already completed, show success status
        if (transferCompleted) {
            return `<span style="color: #4caf50; font-weight: 500;">✅ Đã chuyển ${formattedAmount}đ</span>`;
        }

        if (isSentByMe) {
            return `<span style="color: #e65100;">💸 Yêu cầu ${formattedAmount}đ</span>`;
        } else {
            return `<span onclick="openTransferModal(${senderId}, ${amount}, ${messageId})" style="color: #ff9800; cursor: pointer; text-decoration: underline; font-weight: 500;">💸 Chuyển ${formattedAmount}đ</span>`;
        }
    });

    // Parse URLs
    parsed = parsed.replace(/(https?:\/\/[^\s]+)/gi, '<a href="$1" target="_blank" style="color: #2196F3; text-decoration: underline;">$1</a>');

    return parsed;
}

async function sendMessage(roomId) {
    const chatWindow = document.getElementById(`chat-window-${roomId}`);
    if (!chatWindow) return;

    const input = chatWindow.querySelector('.chat-window__text');
    const content = input.value.trim();
    if (!content) return;

    try {
        const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                senderId: currentUser.id,
                content: content
            })
        });

        if (response.ok) {
            input.value = '';
            loadMessages(roomId);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// ==================== MONEY TRANSFER IN CHAT ====================

let pendingTransfer = null; // Store pending transfer info

async function showMyBalance() {
    try {
        const response = await fetch(`${API_BASE_URL}/money/balance/${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (response.ok) {
            const data = await response.json();
            const formatted = parseFloat(data.balance || 0).toLocaleString('vi-VN');
            showToast(`💰 Số dư của bạn: ${formatted} VNĐ`, 'success');
        }
    } catch (error) {
        console.error('Error getting balance:', error);
        showToast('Không thể lấy số dư', 'error');
    }
}

function openTransferModal(receiverId, amount, messageId) {
    // Get receiver info from chat room members
    const room = chatRooms.find(r => r.members?.some(m => m.user?.id === receiverId));
    const receiver = room?.members?.find(m => m.user?.id === receiverId)?.user;

    pendingTransfer = {
        receiverId,
        amount,
        messageId,
        receiverName: receiver?.fullName || 'Người nhận',
        roomId: room?.id
    };

    // Create modal
    const existingModal = document.getElementById('transfer-modal');
    if (existingModal) existingModal.remove();

    const formattedAmount = parseInt(amount).toLocaleString('vi-VN');

    const modal = document.createElement('div');
    modal.id = 'transfer-modal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal__overlay" onclick="closeTransferModal()"></div>
        <div class="modal__content" style="max-width: 400px; animation: slideUp 0.3s ease;">
            <div class="modal__header">
                <h3 class="modal__title">💸 Xác nhận chuyển tiền</h3>
                <button class="modal__close" onclick="closeTransferModal()">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="modal__body" style="padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 24px; font-weight: 700; color: #4CAF50;">${formattedAmount} VNĐ</div>
                    <div style="color: #666; margin-top: 8px;">Chuyển cho: <strong>${pendingTransfer.receiverName}</strong></div>
                </div>
                
                <div id="balance-preview" style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
                    Đang tải số dư...
                </div>
                
                <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Mật khẩu xác nhận</label>
                    <input type="password" id="transfer-password" placeholder="Nhập mật khẩu của bạn" 
                        style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
                </div>
                
                <div style="display: flex; gap: 12px;">
                    <button onclick="confirmTransfer(false)" class="btn btn--primary" style="flex: 1; padding: 12px;">
                        Chuyển ngay
                    </button>
                    <button onclick="confirmTransfer(true)" class="btn btn--secondary" style="flex: 1; padding: 12px;">
                        Yêu cầu Admin xác minh
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    loadBalancePreview(amount);
}

async function loadBalancePreview(amount) {
    try {
        const response = await fetch(`${API_BASE_URL}/money/balance/${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (response.ok) {
            const data = await response.json();
            const balance = parseFloat(data.balance || 0);
            const remaining = balance - amount;
            const preview = document.getElementById('balance-preview');
            if (preview) {
                const balanceFormatted = balance.toLocaleString('vi-VN');
                const remainingFormatted = remaining.toLocaleString('vi-VN');
                preview.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Số dư hiện tại:</span>
                        <strong>${balanceFormatted} VNĐ</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; color: ${remaining >= 0 ? '#4CAF50' : '#ef4444'};">
                        <span>Sau khi chuyển:</span>
                        <strong>${remainingFormatted} VNĐ</strong>
                    </div>
                    ${remaining < 0 ? '<div style="color: #ef4444; margin-top: 8px; font-size: 12px;">⚠️ Số dư không đủ để thực hiện giao dịch</div>' : ''}
                `;
            }
        }
    } catch (error) {
        console.error('Error loading balance:', error);
    }
}

function closeTransferModal() {
    const modal = document.getElementById('transfer-modal');
    if (modal) modal.remove();
    pendingTransfer = null;
}

async function confirmTransfer(requiresAdmin) {
    if (!pendingTransfer) return;

    const password = document.getElementById('transfer-password')?.value;
    if (!password) {
        showToast('Vui lòng nhập mật khẩu', 'error');
        return;
    }

    const endpoint = requiresAdmin ? '/money/request-verification' : '/money/transfer';
    const roomId = pendingTransfer.roomId;
    const messageId = pendingTransfer.messageId;

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                senderId: currentUser.id,
                receiverId: pendingTransfer.receiverId,
                amount: pendingTransfer.amount,
                password: password,
                chatMessageId: messageId,
                chatRoomId: roomId
            })
        });

        // Handle non-JSON response
        let data;
        try {
            data = await response.json();
        } catch (e) {
            if (response.ok) {
                data = { success: true, message: 'Chuyển tiền thành công!' };
            } else {
                data = { success: false, error: 'Có lỗi xảy ra' };
            }
        }

        if (response.ok || data.success) {
            const formattedAmount = parseInt(pendingTransfer.amount).toLocaleString('vi-VN');
            showToast(data.message || `✅ Đã chuyển ${formattedAmount} VNĐ thành công!`, 'success');
            closeTransferModal();

            // Update message metadata to mark transfer as completed
            if (messageId) {
                try {
                    await fetch(`${API_BASE_URL}/chat/messages/${messageId}/metadata`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                        },
                        body: JSON.stringify({ transferCompleted: true, transferStatus: 'completed' })
                    });
                } catch (e) {
                    console.log('Could not update message metadata');
                }
            }

            if (roomId) {
                loadMessages(roomId);
            }
        } else {
            showToast(data.error || 'Có lỗi xảy ra khi chuyển tiền', 'error');
        }
    } catch (error) {
        console.error('Error transferring:', error);
        showToast('Đã xảy ra lỗi kết nối', 'error');
    }
}

async function toggleLike(messageId) {
    await addMessageReaction(messageId, '👍');
}

async function addMessageReaction(messageId, emoji) {
    try {
        await fetch(`${API_BASE_URL}/chat/messages/${messageId}/like`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ emoji: emoji })
        });
        // Reload messages in current active window
        activeChatWindows.forEach(roomId => loadMessages(roomId));
    } catch (error) {
        console.error('Error adding reaction:', error);
    }
}

async function removeReaction(messageId) {
    try {
        await fetch(`${API_BASE_URL}/chat/messages/${messageId}/unlike`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        // Reload messages 
        activeChatWindows.forEach(roomId => loadMessages(roomId));
    } catch (error) {
        console.error('Error removing reaction:', error);
    }
}

// Show sender's balance (not current user's)
async function showSenderBalance(senderId) {
    try {
        const response = await fetch(`${API_BASE_URL}/money/balance/${senderId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (response.ok) {
            const data = await response.json();
            const formatted = parseFloat(data.balance || 0).toLocaleString('vi-VN');
            const senderName = friends.find(f => f.id === senderId)?.fullName ||
                chatRooms.flatMap(r => r.members || []).find(m => m.user?.id === senderId)?.user?.fullName ||
                'Người gửi';
            showToast(`💰 Số dư của ${senderName}: ${formatted} VNĐ`, 'info');
        }
    } catch (error) {
        console.error('Error getting sender balance:', error);
        showToast('Không thể lấy số dư', 'error');
    }
}

function viewAvatar(userId) {
    const user = friends.find(f => f.id === userId) ||
        chatRooms.flatMap(r => r.members || []).find(m => m.user?.id === userId)?.user;

    if (!user) return;

    const existingModal = document.getElementById('avatar-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'avatar-modal';
    modal.className = 'modal active';
    modal.onclick = () => modal.remove();
    modal.innerHTML = `
        <div class="modal__overlay"></div>
        <div style="position: relative; z-index: 1; text-align: center; animation: scaleIn 0.3s ease;">
            <div style="width: 200px; height: 200px; border-radius: 50%; margin: 0 auto; background: linear-gradient(135deg, #4CAF50, #45a049); color: white; font-size: 60px; display: flex; align-items: center; justify-content: center; ${user.avatarUrl ? `background-image: url('${user.avatarUrl}'); background-size: cover;` : ''}">
                ${user.avatarUrl ? '' : getInitials(user.fullName || 'U')}
            </div>
            <h3 style="color: white; margin-top: 16px;">${user.fullName || 'Người dùng'}</h3>
        </div>
    `;
    document.body.appendChild(modal);
}

// ==================== UTILITIES ====================

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
    return date.toLocaleDateString('vi-VN');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast-notification';

    const colors = {
        success: { bg: '#10b981', icon: 'check_circle' },
        error: { bg: '#ef4444', icon: 'error' },
        warning: { bg: '#f59e0b', icon: 'warning' },
        info: { bg: '#3b82f6', icon: 'info' }
    };

    const color = colors[type] || colors.info;

    toast.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:20px">${color.icon}</span>
        <span>${message}</span>
    `;

    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: ${color.bg};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: toastSlideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function toggleComments(postId) {
    // Toggle comments section for a post
    const postCard = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postCard) return;

    let commentsSection = postCard.querySelector('.post-card__comments');
    if (commentsSection) {
        // Instead of removing, just hide it to preserve state
        commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
        // If hiding, remove it after animation
        if (commentsSection.style.display === 'none') {
            setTimeout(() => {
                if (commentsSection.style.display === 'none') {
                    commentsSection.remove();
                }
            }, 300);
        }
    } else {
        loadComments(postId);
    }
}

// Global state for comment media
const commentMediaMap = new Map(); // postId -> { file: File, type: 'image'|'video', previewUrl: string }

function triggerCommentImageSelect(postId) {
    document.getElementById(`comment-image-input-${postId}`).click();
}

function triggerCommentVideoSelect(postId) {
    document.getElementById(`comment-video-input-${postId}`).click();
}

function handleCommentMediaSelect(postId, type, input) {
    const file = input.files[0];
    if (!file) return;

    // Validate size (e.g., 20MB for video, 5MB for image)
    const maxSize = type === 'video' ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast(`File quá lớn! Tối đa ${type === 'video' ? '20MB' : '5MB'}`, 'error');
        input.value = '';
        return;
    }

    const previewUrl = URL.createObjectURL(file);
    commentMediaMap.set(postId, { file, type, previewUrl });

    // Render Preview (Compact)
    const previewContainer = document.getElementById(`comment-media-preview-${postId}`);
    previewContainer.classList.remove('hidden');
    previewContainer.innerHTML = `
        <div class="relative inline-block mt-1">
            ${type === 'video'
            ? `<video src="${previewUrl}" class="rounded-lg border border-gray-200" style="height: 60px; width: auto; max-width: 100px; object-fit: cover;"></video>`
            : `<img src="${previewUrl}" class="rounded-lg border border-gray-200" style="height: 60px; width: auto; max-width: 100px; object-fit: cover;">`
        }
            <button onclick="removeCommentMedia(${postId})" class="absolute -top-1 -right-1 bg-gray-200 rounded-full p-0.5 hover:bg-gray-300 flex items-center justify-center" style="width: 16px; height: 16px;">
                <span class="material-symbols-outlined text-gray-600" style="font-size: 10px;">close</span>
            </button>
        </div>
    `;
}

function removeCommentMedia(postId) {
    commentMediaMap.delete(postId);
    const previewContainer = document.getElementById(`comment-media-preview-${postId}`);
    previewContainer.innerHTML = '';
    previewContainer.classList.add('hidden');

    // Reset inputs
    const imgInput = document.getElementById(`comment-image-input-${postId}`);
    const vidInput = document.getElementById(`comment-video-input-${postId}`);
    if (imgInput) imgInput.value = '';
    if (vidInput) vidInput.value = '';
}

async function loadComments(postId) {
    const postCard = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postCard) return;

    try {
        const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments?page=0&size=10`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            const data = await response.json();
            const comments = data.content || [];

            const commentsHtml = `
                <div class="post-card__comments">
                    ${renderCommentTree(comments, postId)}
                    <div class="p-3 border-t border-gray-100">
                        <!-- Media Preview -->
                        <div id="comment-media-preview-${postId}" class="hidden mb-2"></div>
                        
                        <div class="comment-input" style="align-items: center;">
                            <div class="comment-input__avatar" ${currentUser?.avatarUrl ? `style="background-image: url('${currentUser.avatarUrl}'); background-size: cover; background-position: center;"` : ''}>
                                 ${currentUser?.avatarUrl ? '' : getInitials(currentUser?.fullName)}
                            </div>
                            
                            <!-- Input Wrapper imitating the original input look but holding icons -->
                            <div style="flex: 1; background: var(--color-bg-light); border-radius: 999px; padding: 8px 16px; display: flex; align-items: center; gap: 8px;">
                                <input type="text" placeholder="Viết bình luận..." id="comment-input-${postId}"
                                    style="background: transparent; border: none; flex: 1; outline: none; padding: 0; font-size: inherit;"
                                    onkeypress="if(event.key==='Enter') { event.preventDefault(); const input = this; submitComment(${postId}, input.value); }">
                                
                                <div style="display: flex; gap: 4px;">
                                    <button onclick="triggerCommentImageSelect(${postId})" style="border: none; background: transparent; cursor: pointer; color: #65676b; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%;">
                                        <span class="material-symbols-outlined" style="font-size: 20px;">photo_camera</span>
                                    </button>
                                    <button onclick="triggerCommentVideoSelect(${postId})" style="border: none; background: transparent; cursor: pointer; color: #65676b; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%;">
                                        <span class="material-symbols-outlined" style="font-size: 20px;">videocam</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Hidden Inputs -->
                        <input type="file" id="comment-image-input-${postId}" accept="image/*" style="display: none;" onchange="handleCommentMediaSelect(${postId}, 'image', this)">
                        <input type="file" id="comment-video-input-${postId}" accept="video/*" style="display: none;" onchange="handleCommentMediaSelect(${postId}, 'video', this)">
                    </div>
                </div>
            `;
            postCard.insertAdjacentHTML('beforeend', commentsHtml);
        }
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

function renderCommentTree(comments, postId) {
    if (!comments || comments.length === 0) return '';
    return comments.map(c => renderCommentItem(c, postId)).join('');
}

function renderCommentItem(c, postId, isReply = false) {
    // Reaction Logic
    const reactionCounts = c.reactionCounts || {};
    const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);
    const userReaction = c.userReaction; // e.g., 'LIKE', 'LOVE'

    // Top reaction icon (simplistic: just take first or LIKE)
    // Ideally find the most frequent.
    let topReactionIcon = '👍';
    if (totalReactions > 0) {
        // Find type with max count
        const topType = Object.keys(reactionCounts).reduce((a, b) => reactionCounts[a] > reactionCounts[b] ? a : b);
        topReactionIcon = getEmojiForType(topType);
    }

    const badgeHtml = totalReactions > 0 ? `
        <div class="comment__reaction-badge" data-comment-id="${c.id}">
            <span>${topReactionIcon}</span>
            <span class="count">${totalReactions}</span>
        </div>
    ` : '';

    const actionClass = userReaction ? 'liked' : '';
    const actionText = userReaction ? getEmojiForType(userReaction) : 'Thích';

    // Replies
    const repliesHtml = (c.replies && c.replies.length > 0)
        ? `<div class="replies-container">${c.replies.map(r => renderCommentItem(r, postId, true)).join('')}</div>`
        : '';

    return `
        <div class="comment ${isReply ? 'comment-reply' : ''}" data-comment-id="${c.id}">
            <div class="comment__avatar" ${c.author?.avatarUrl ? `style="background-image: url('${c.author.avatarUrl}'); background-size: cover; background-position: center;"` : ''}>
                ${c.author?.avatarUrl ? '' : getInitials(c.author?.fullName)}
            </div>
            <div class="comment__content-wrapper">
                <div class="comment__body">
                    <span class="comment__name">${c.author?.fullName || 'User'}</span>
                    <span class="comment__text">${escapeHtml(c.content)}</span>
                    ${badgeHtml}
                </div>
                <!-- Media Attachment (Facebook Style) -->
                ${c.imageUrl ? `<div class="mt-2"><img src="${getFullMediaUrl(c.imageUrl)}" class="rounded-xl border border-gray-100 object-cover" style="width: 300px; height: 200px; display: block;"></div>` : ''}
                ${c.videoUrl ? `<div class="mt-2"><video src="${getFullMediaUrl(c.videoUrl)}" class="rounded-xl border border-gray-100 object-cover" controls style="width: 300px; height: 200px; display: block;"></video></div>` : ''}
                <div class="comment__actions">
                    <span class="comment__action comment__action--react ${actionClass}" 
                        data-comment-id="${c.id}"
                        data-user-reaction="${userReaction || ''}">
                        ${actionText}
                    </span>
                    <span class="comment__action" onclick="toggleReplyInput(${c.id})">Trả lời</span>
                    <span>${formatTimeAgo(c.createdAt)}</span>
                    ${c.author?.id === currentUser?.id ? `<span class="comment__action" style="color: #dc3545; cursor: pointer; margin-left: 8px;" onclick="deleteComment(${c.id}, ${postId})">Xóa</span>` : ''}
                </div>
                <!-- Nested Replies -->
                ${repliesHtml}
            </div>
        </div>
    `;
}

function showReactionPicker_duplicate(event, postId, commentId) {
    return; // Disabled duplicate
    event.stopPropagation();
    event.preventDefault(); // Prevent default link behavior if any

    const picker = document.getElementById('reaction-picker');
    const rect = event.target.getBoundingClientRect();

    // Reset state
    delete picker.dataset.postId;
    delete picker.dataset.commentId;

    if (postId) {
        picker.dataset.postId = postId;
    } else if (commentId) {
        picker.dataset.commentId = commentId;
    }

    // Position above the cursor/button
    picker.style.top = `${window.scrollY + rect.top - 50}px`;
    picker.style.left = `${rect.left}px`;
    picker.style.display = 'flex';
}

async function submitComment(postId, content, parentId = null, parentCommentEl = null) {
    // Allow empty content if there is media
    const media = commentMediaMap.get(postId);
    if ((!content || !content.trim()) && !media) return;

    try {
        let imageUrl = null;
        let videoUrl = null;

        // Upload media if exists
        if (media) {
            const formData = new FormData();
            formData.append('file', media.file);

            // Use existing endpoint for now - assuming it saves to uploads/videos or uploads/images
            // Note: PostController /upload-video endpoint handles generic files or we might need to check.
            // PostController.java has /upload-video which returns {url: ...}
            // Let's use that for videos. For images, we don't have a direct "upload-image" endpoint exposed in PostController separately 
            // but we can check if there's a generic one. 
            // Wait, PostController has createPost which takes base64 images? 
            // No, createPost takes JSON string of images. The user uploads images via... wait, let me check handleImagesSelect.
            // It reads as DataURL (base64). So for images, we might send base64 directly? Or upload?
            // "PostController.java" lines 61: String images = ... (it's a JSON array of URLs or Base64?)
            // If the user wants separate upload for comments, we need an endpoint.
            // Let's use the /upload-video endpoint for both for now (it likely just saves the file), OR implement a new one.
            // For safety, let's look at `upload-video`.

            // Actually, for simplicity and consistency with the "upload-video" task, let's assume we can upload both there or base64 the image.
            // Comment.imageUrl is TEXT. Base64 can be huge.
            // Let's use the same /posts/upload-video for now, it saves to uploads/videos/ by default but we can rename it later or it's fine.
            // Or better, let's treat it as a generic upload.

            const uploadRes = await fetch(`${API_BASE_URL}/posts/upload-video`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
                body: formData
            });

            if (uploadRes.ok) {
                const data = await uploadRes.json();
                if (media.type === 'image') imageUrl = data.url;
                else videoUrl = data.url;
            } else {
                showToast('Lỗi upload file media', 'error');
                return;
            }
        }

        const body = {
            userId: currentUser.id,
            content: content ? content.trim() : '',
            imageUrl: imageUrl,
            videoUrl: videoUrl
        };
        // Ensure parentId is treated as number and added if valid
        if (parentId) {
            body.parentId = parseInt(parentId);
        }

        const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            const newComment = await response.json();

            // If it's a reply and we have the parent element, add it directly with animation
            if (parentId && parentCommentEl) {
                const replyHtml = renderCommentItem(newComment, postId, true);
                const contentWrapper = parentCommentEl.querySelector('.comment__content-wrapper');
                const repliesContainer = contentWrapper.querySelector('.replies-container') ||
                    (contentWrapper.querySelectorAll('.comment-reply').length > 0 ? null : null);

                // Create or find replies container
                let repliesDiv = contentWrapper.querySelector('.replies-container');
                if (!repliesDiv) {
                    // Check if there are already replies
                    const existingReplies = contentWrapper.querySelectorAll('.comment-reply');
                    if (existingReplies.length > 0) {
                        // Wrap existing replies in container
                        repliesDiv = document.createElement('div');
                        repliesDiv.className = 'replies-container';
                        existingReplies.forEach(reply => repliesDiv.appendChild(reply));
                        contentWrapper.appendChild(repliesDiv);
                    } else {
                        repliesDiv = document.createElement('div');
                        repliesDiv.className = 'replies-container';
                        contentWrapper.appendChild(repliesDiv);
                    }
                }

                // Create temporary element for animation
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = replyHtml;
                const newReplyEl = tempDiv.firstElementChild;

                // Add to DOM
                repliesDiv.appendChild(newReplyEl);

                // Animate
                gsap.from(newReplyEl, { height: 0, opacity: 0, duration: 0.3 });
            } else {
                // Top-level comment animation
                const commentsSection = document.querySelector(`[data-post-id="${postId}"] .post-card__comments`);
                const inputContainer = commentsSection.lastElementChild;

                // Create temporary element
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = renderCommentItem(newComment, postId);
                const newCommentEl = tempDiv.firstElementChild;

                // Insert before input
                inputContainer.parentNode.insertBefore(newCommentEl, inputContainer);

                // Animate (Messenger style: slide down + fade in)
                gsap.from(newCommentEl, {
                    height: 0,
                    opacity: 0,
                    y: -10,
                    duration: 0.4,
                    ease: "power2.out",
                    onComplete: () => {
                        newCommentEl.style.height = 'auto';
                        newCommentEl.style.transform = 'none';
                    }
                });
            }

            // Clear inputs
            const inputEl = document.getElementById(`comment-input-${postId}`);
            if (inputEl) inputEl.value = '';
            removeCommentMedia(postId);

        }
    } catch (error) {
        console.error('Error submitting comment:', error);
        showToast('Lỗi khi đăng bình luận', 'error');
    }
}

async function deleteComment(commentId, postId) {
    showConfirmModal('Xóa bình luận?', 'Bạn có chắc muốn xóa bình luận này không? Hành động này không thể hoàn tác.', async () => {
        try {
            // Note: Endpoint is /api/posts/comments/{id} because it is inside PostController mapped to /api/posts
            const response = await fetch(`${API_BASE_URL}/posts/comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });

            if (response.ok) {
                // Reload comments
                const postCard = document.querySelector(`[data-post-id="${postId}"]`);
                postCard?.querySelector('.post-card__comments')?.remove();
                loadComments(postId);
                showToast('Đã xóa bình luận', 'success');
            } else {
                showToast('Không thể xóa bình luận', 'error');
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
            showToast('Đã xảy ra lỗi', 'error');
        }
    });
}

function showConfirmModal(title, message, onConfirm) {
    // Remove existing modal if any
    const existing = document.getElementById('custom-confirm-modal');
    if (existing) existing.remove();

    // Use inline styles to guarantee positioning and z-index regardless of Tailwind config
    const html = `
        <div id="custom-confirm-modal" style="position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background-color: rgba(17, 24, 39, 0.6); backdrop-filter: blur(4px);" class="fade-in">
            <div style="background-color: white; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); max-width: 24rem; width: 100%; overflow: hidden;" class="scale-in">
                <div style="padding: 1.5rem; text-align: center;">
                    <div style="width: 4rem; height: 4rem; background-color: #FEF2F2; color: #EF4444; border-radius: 9999px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto;">
                        <span class="material-symbols-outlined" style="font-size: 1.875rem;">warning</span>
                    </div>
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: #1F2937; margin-bottom: 0.5rem;">${title}</h3>
                    <p style="color: #4B5563; margin-bottom: 1.5rem;">${message}</p>
                    <div style="display: flex; gap: 0.75rem; justify-content: center;">
                        <button id="confirm-cancel-btn" style="padding: 0.625rem 1.25rem; border-radius: 0.75rem; border: 1px solid #E5E7EB; color: #374151; font-weight: 500; background: white; cursor: pointer; transition: background 0.2s;">
                            Hủy
                        </button>
                        <button id="confirm-ok-btn" style="padding: 0.625rem 1.25rem; border-radius: 0.75rem; background-color: #DC2626; color: white; font-weight: 500; border: none; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2); transition: background 0.2s;">
                            Đồng ý
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    // Add animation styles dynamically if not present
    if (!document.getElementById('modal-styles')) {
        const style = document.createElement('style');
        style.id = 'modal-styles';
        style.textContent = `
            .fade-in { animation: fadeIn 0.2s ease-out forwards; }
            .scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            #confirm-cancel-btn:hover { background-color: #F9FAFB !important; }
            #confirm-ok-btn:hover { background-color: #B91C1C !important; }
        `;
        document.head.appendChild(style);
    }


    const modal = document.getElementById('custom-confirm-modal');

    document.getElementById('confirm-cancel-btn').onclick = () => modal.remove();
    document.getElementById('confirm-ok-btn').onclick = () => {
        onConfirm();
        modal.remove();
    };
}

function toggleReplyInput(commentId) {
    const commentEl = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
    if (!commentEl) return;

    let replyInputContainer = commentEl.querySelector('.reply-input-container');

    if (replyInputContainer) {
        replyInputContainer.style.display = replyInputContainer.style.display === 'none' ? 'flex' : 'none';
        if (replyInputContainer.style.display === 'flex') {
            const input = replyInputContainer.querySelector('input');
            if (input) input.focus();
        }
    } else {
        const contentWrapper = commentEl.querySelector('.comment__content-wrapper');
        const inputHtml = `
            <div class="comment-input reply-input-container" style="margin-top: 8px;">
                <div class="comment-input__avatar" ${currentUser?.avatarUrl ? `style="background-image: url('${currentUser.avatarUrl}'); background-size: cover; background-position: center;"` : ''}>
                     ${currentUser?.avatarUrl ? '' : getInitials(currentUser?.fullName)}
                </div>
                <input type="text" placeholder="Viết câu trả lời...">
            </div>
        `;
        contentWrapper.insertAdjacentHTML('beforeend', inputHtml);

        replyInputContainer = commentEl.querySelector('.reply-input-container');
        const input = replyInputContainer.querySelector('input');

        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();

                if (this.dataset.submitting === 'true') return;

                const postId = commentEl.closest('.post-card').dataset.postId;
                const content = this.value.trim();

                if (content) {
                    this.dataset.submitting = 'true';
                    const originalValue = this.value;
                    this.value = 'Đang gửi...';
                    this.disabled = true;

                    submitComment(postId, content, commentId, commentEl)
                        .then(() => {
                            this.value = '';
                        })
                        .catch(() => {
                            this.value = originalValue;
                        })
                        .finally(() => {
                            this.dataset.submitting = 'false';
                            this.disabled = false;
                            this.focus();
                        });
                }
            }
        });

        if (input) input.focus();
    }
}
