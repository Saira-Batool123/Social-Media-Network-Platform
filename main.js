const socket = io();
let currentUser = null;
let currentSection = 'feed';
let currentChatFriend = null;
let currentGroup = null;

function hideAll() {
    const sections = ['login-form', 'register-form', 'profile-form', 'post-form', 'feed', 'friend-requests-section', 'suggestions-section', 'friends-section', 'groups-section', 'notifications-section', 'messages-section'];
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
}

function showSection(section) {
    hideAll();
    currentSection = section;
    const element = document.getElementById(section);
    if (element) {
        element.style.display = 'block';
        if (currentUser) {
            if (section === 'feed') loadPosts();
            else if (section === 'friend-requests-section') loadFriendRequests();
            else if (section === 'suggestions-section') loadSuggestions();
            else if (section === 'friends-section') loadFriends();
            else if (section === 'groups-section') loadGroups();
            else if (section === 'notifications-section') loadNotifications();
            else if (section === 'messages-section') loadMessages();
        } else {
            console.error(`showSection: No current user for ${section}`);
            alert('Please log in to view this section.');
            showLogin();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    showLogin();
});

function showLogin() {
    hideAll();
    document.getElementById('login-form').style.display = 'block';
}

function showRegister() {
    hideAll();
    document.getElementById('register-form').style.display = 'block';
}

function showProfile() {
    hideAll();
    document.getElementById('profile-form').style.display = 'block';
    loadProfile();
}

function showPostForm() {
    hideAll();
    document.getElementById('post-form').style.display = 'block';
}

function showFriendRequests() {
    showSection('friend-requests-section');
}

function showSuggestions() {
    showSection('suggestions-section');
}

function showFriends() {
    showSection('friends-section');
}

function showGroups() {
    showSection('groups-section');
}

function showNotifications() {
    showSection('notifications-section');
}

function showMessages(friend_id = null, friend_name = null) {
    hideAll();
    currentSection = 'messages-section';
    document.getElementById('messages-section').style.display = 'block';
    if (friend_id && friend_name) {
        currentChatFriend = { id: friend_id, name: friend_name };
        document.getElementById('message-header').textContent = `Chat with ${friend_name}`;
        loadMessages();
    } else {
        document.getElementById('message-header').textContent = 'Select a Friend to Message';
        document.getElementById('chat-box').innerHTML = '';
        document.getElementById('message-input-container').style.display = 'none';
        loadFriendsForMessages();
    }
}

async function loadFriendsForMessages() {
    if (!currentUser) {
        console.error('loadFriendsForMessages: No current user');
        alert('Please log in to view friends.');
        return;
    }
    try {
        const res = await fetch(`/api/friends?user_id=${currentUser.user_id}`);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}, Message: ${await res.text()}`);
        }
        const friends = await res.json();
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = '';
        if (friends.length === 0) {
            chatBox.innerHTML = '<p>You have no friends to message yet. Try adding some friends!</p>';
        }
        friends.forEach(friend => {
            const friendDiv = document.createElement('div');
            friendDiv.className = 'friend-item';
            friendDiv.innerHTML = `
                <span><img src="${friend.profile_picture || '/images/default-dp.jpg'}" class="circular-dp" style="width: 40px; height: 40px;"> ${friend.name} (@${friend.username})</span>
                <button onclick="showMessages(${friend.id}, '${friend.name}')">Message</button>
            `;
            chatBox.appendChild(friendDiv);
        });
    } catch (error) {
        console.error('Load friends for messages error:', error.message, error.stack);
        alert('Failed to load friends for messaging. Check console for details.');
    }
}

async function register() {
    try {
        const username = document.getElementById('reg-username').value;
        const password = document.getElementById('reg-password').value;
        const name = document.getElementById('reg-name').value;
        if (!username || !password || !name) {
            alert('All fields are required');
            return;
        }
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, name })
        });
        const data = await res.json();
        alert(data.message || data.error);
        if (res.ok) showLogin();
    } catch (error) {
        console.error('Registration error:', error.message, error.stack);
        alert('Failed to register. Check console for details.');
    }
}

async function login() {
    try {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        if (!username || !password) {
            alert('Username and password are required');
            return;
        }
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data;
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('user-section').style.display = 'flex';
            document.getElementById('username').textContent = `${data.name} (@${data.username})`;
            socket.emit('user_connected', currentUser.user_id.toString());
            showSection('feed');
            loadNotifications();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Login error:', error.message, error.stack);
        alert('Failed to login. Check console for details.');
    }
}

function logout() {
    currentUser = null;
    currentChatFriend = null;
    currentGroup = null;
    document.getElementById('auth-section').style.display = 'flex';
    document.getElementById('user-section').style.display = 'none';
    hideAll();
    document.getElementById('feed').innerHTML = '';
    socket.disconnect();
    socket.connect();
}

async function loadProfile() {
    if (!currentUser) {
        console.error('loadProfile: No current user');
        return;
    }
    try {
        const res = await fetch(`/api/users/${currentUser.user_id}`);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}, Message: ${await res.text()}`);
        }
        const userData = await res.json();
        currentUser = { ...currentUser, ...userData };
        document.getElementById('profile-name').value = currentUser.name || '';
        document.getElementById('profile-bio').value = currentUser.bio || '';
        const preview = document.getElementById('profile-picture-preview');
        preview.src = currentUser.profile_picture || '/images/default-dp.jpg';
    } catch (error) {
        console.error('Load profile error:', error.message, error.stack);
        alert('Failed to load profile. Check console for details.');
    }
}

async function updateProfile() {
    if (!currentUser) {
        console.error('updateProfile: No current user');
        return;
    }
    try {
        const name = document.getElementById('profile-name').value;
        const bio = document.getElementById('profile-bio').value;
        const profile_picture_file = document.getElementById('profile-picture').files[0];
        const formData = new FormData();
        formData.append('user_id', currentUser.user_id);
        formData.append('name', name);
        formData.append('bio', bio);
        if (profile_picture_file) formData.append('profile_picture', profile_picture_file);

        const res = await fetch('/api/profile', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        alert(data.message || data.error);
        if (res.ok) {
            const userRes = await fetch(`/api/users/${currentUser.user_id}`);
            const userData = await userRes.json();
            currentUser = { ...currentUser, ...userData };
            document.getElementById('username').textContent = `${currentUser.name} (@${currentUser.username})`;
            loadProfile();
        }
    } catch (error) {
        console.error('Update profile error:', error.message, error.stack);
        alert('Failed to update profile. Check console for details.');
    }
}

async function createPost() {
    if (!currentUser) {
        console.error('createPost: No current user');
        return;
    }
    try {
        const content = document.getElementById('post-content').value;
        const media = document.getElementById('post-media').files[0];
        const privacy = document.getElementById('post-privacy').value;
        if (!content && !media) {
            alert('Post content or media is required');
            return;
        }
        const formData = new FormData();
        formData.append('user_id', currentUser.user_id);
        formData.append('content', content);
        formData.append('privacy', privacy);
        if (media) formData.append('media', media);

        const res = await fetch('/api/posts', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        alert(data.message || data.error);
        if (res.ok) {
            document.getElementById('post-content').value = '';
            document.getElementById('post-media').value = '';
            showSection('feed');
        }
    } catch (error) {
        console.error('Create post error:', error.message, error.stack);
        alert('Failed to create post. Check console for details.');
    }
}

async function loadPosts() {
    if (!currentUser) {
        console.error('loadPosts: No current user');
        return;
    }
    try {
        const res = await fetch(`/api/posts?user_id=${currentUser.user_id}`);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}, Message: ${await res.text()}`);
        }
        const posts = await res.json();
        const feed = document.getElementById('feed');
        feed.innerHTML = '<h2>News Feed</h2>';
        if (posts.length === 0) {
            feed.innerHTML += '<p>No posts to display.</p>';
        }
        posts.forEach(post => {
            const postDiv = document.createElement('div');
            postDiv.className = 'post';
            postDiv.id = `post-${post.id}`;
            postDiv.innerHTML = `
                <div class="post-header">
                    <img src="${post.profile_picture || '/images/default-dp.jpg'}" class="circular-dp" alt="Profile Picture">
                    <div>
                        <h3>${post.name}</h3>
                        <p>@${post.username}</p>
                    </div>
                </div>
                <p>${post.content}</p>
                ${post.media_url ? (post.media_url.includes('video') ?
                    `<video src="${post.media_url}" controls></video>` :
                    `<img src="${post.media_url}" alt="Post media">`) : ''}
                <div class="post-actions">
                    <button onclick="likePost(${post.id})">Like</button>
                    <button onclick="showCommentForm(${post.id})">Comment</button>
                    <button onclick="sharePost(${post.id})">Share</button>
                </div>
                <div class="comment-section" id="comment-section-${post.id}" style="display: none;">
                    <textarea id="comment-content-${post.id}" placeholder="Write a comment..."></textarea>
                    <button onclick="addComment(${post.id})">Submit</button>
                </div>
                <div class="comments-list" id="comments-${post.id}"></div>
            `;
            feed.appendChild(postDiv);
            loadComments(post.id);
        });
    } catch (error) {
        console.error('Load posts error:', error.message, error.stack);
        alert('Failed to load posts. Check console for details.');
    }
}

async function likePost(post_id) {
    if (!currentUser) {
        console.error('likePost: No current user');
        alert('Please log in to like posts.');
        return;
    }
    try {
        const res = await fetch('/api/likes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id, user_id: currentUser.user_id })
        });
        const data = await res.json();
        alert(data.message || data.error);
        if (res.ok && currentSection === 'feed') {
            loadPosts();
            loadNotifications();
        }
    } catch (error) {
        console.error('Like post error:', error.message, error.stack);
        alert('Failed to like post. Check console for details.');
    }
}

function showCommentForm(post_id) {
    const commentSection = document.getElementById(`comment-section-${post_id}`);
    if (!commentSection) {
        console.error(`showCommentForm: Comment section for post ${post_id} not found`);
        return;
    }
    commentSection.style.display = commentSection.style.display === 'block' ? 'none' : 'block';
}

async function addComment(post_id) {
    if (!currentUser) {
        console.error('addComment: No current user');
        alert('Please log in to comment.');
        return;
    }
    try {
        const content = document.getElementById(`comment-content-${post_id}`).value;
        if (!content.trim()) {
            alert('Comment cannot be empty');
            return;
        }
        const res = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id, user_id: currentUser.user_id, content })
        });
        const data = await res.json();
        alert(data.message || data.error);
        if (res.ok) {
            document.getElementById(`comment-content-${post_id}`).value = '';
            loadComments(post_id);
            loadNotifications();
        }
    } catch (error) {
        console.error('Add comment error:', error.message, error.stack);
        alert('Failed to add comment. Check console for details.');
    }
}

async function loadComments(post_id) {
    try {
        const res = await fetch(`/api/comments?post_id=${post_id}`);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}, Message: ${await res.text()}`);
        }
        const comments = await res.json();
        const commentsDiv = document.getElementById(`comments-${post_id}`);
        if (!commentsDiv) {
            console.error(`loadComments: Comments div for post ${post_id} not found`);
            return;
        }
        commentsDiv.innerHTML = '';
        if (comments.length === 0) {
            commentsDiv.innerHTML = '<p>No comments yet.</p>';
        }
        comments.forEach(comment => {
            const commentDiv = document.createElement('div');
            commentDiv.innerHTML = `<small><b>${comment.username}</b>: ${comment.content}</small>`;
            commentsDiv.appendChild(commentDiv);
        });
    } catch (error) {
        console.error('Load comments error:', error.message, error.stack);
        alert('Failed to load comments. Check console for details.');
    }
}

async function sharePost(post_id) {
    if (!currentUser) {
        console.error('sharePost: No current user');
        alert('Please log in to share posts.');
        return;
    }
    try {
        const res = await fetch('/api/shares', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id, user_id: currentUser.user_id })
        });
        const data = await res.json();
        alert(data.message || data.error);
        if (res.ok) {
            const postUrl = `${window.location.origin}/post/${post_id}`;
            navigator.clipboard.writeText(postUrl).then(() => {
                alert('Post link copied to clipboard! Share it anywhere!');
                loadNotifications();
            }).catch(() => {
                alert('Failed to copy link. Please try again.');
            });
        }
    } catch (error) {
        console.error('Share post error:', error.message, error.stack);
        alert('Failed to share post. Check console for details.');
    }
}

async function loadNotifications() {
    if (!currentUser) {
        console.error('loadNotifications: No current user');
        alert('Please log in to view notifications.');
        return;
    }
    try {
        const res = await fetch(`/api/notifications?user_id=${currentUser.user_id}`);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}, Message: ${await res.text()}`);
        }
        const notifications = await res.json();
        const notificationList = document.getElementById('notification-list');
        if (!notificationList) {
            console.error('loadNotifications: Notification list element not found');
            return;
        }
        notificationList.innerHTML = '';
        if (notifications.length === 0) {
            notificationList.innerHTML = '<p>No new notifications.</p>';
        }
        notifications.forEach(notification => {
            const notifDiv = document.createElement('div');
            notifDiv.className = 'notification-item';
            let message = `<span>${notification.message} (from @${notification.username})</span>`;
            if (notification.post_id) {
                message += ` <a href="#" onclick="showSection('feed'); loadPosts();">View Post</a>`;
            }
            if (notification.group_id && (notification.type === 'group_invite' || notification.type === 'group_joined')) {
                message += ` <button onclick="joinGroup(${notification.group_id})">Join Group</button>`;
            }
            if (notification.friend_request_id && notification.type === 'friend_request') {
                message += ` <button onclick="acceptFriendRequest(${notification.friend_request_id}, ${notification.from_user_id})">Accept</button>`;
                message += ` <button onclick="rejectFriendRequest(${notification.friend_request_id})">Reject</button>`;
            }
            notifDiv.innerHTML = message;
            notificationList.appendChild(notifDiv);
        });
    } catch (error) {
        console.error('Load notifications error:', error.message, error.stack);
        alert('Failed to load notifications. Check console for details.');
    }
}

async function loadFriendRequests() {
    if (!currentUser) {
        console.error('loadFriendRequests: No current user');
        alert('Please log in to view friend requests.');
        return;
    }
    try {
        const res = await fetch(`/api/friend_requests?user_id=${currentUser.user_id}`);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}, Message: ${await res.text()}`);
        }
        const requests = await res.json();
        const requestList = document.getElementById('friend-request-list');
        if (!requestList) {
            console.error('loadFriendRequests: Friend request list element not found');
            return;
        }
        requestList.innerHTML = '';
        if (requests.length === 0) {
            requestList.innerHTML = '<p>No new friend requests.</p>';
        }
        requests.forEach(request => {
            const requestDiv = document.createElement('div');
            requestDiv.className = 'friend-request-item';
            requestDiv.innerHTML = `
                <span>${request.name} (@${request.username}) sent you a friend request</span>
                <div>
                    <button onclick="acceptFriendRequest(${request.id}, ${request.from_user_id})">Accept</button>
                    <button onclick="rejectFriendRequest(${request.id})">Reject</button>
                </div>
            `;
            requestList.appendChild(requestDiv);
        });
    } catch (error) {
        console.error('Load friend requests error:', error.message, error.stack);
        alert('Failed to load friend requests. Check console for details.');
    }
}

async function acceptFriendRequest(request_id, friend_id) {
    if (!currentUser) {
        console.error('acceptFriendRequest: No current user');
        alert('Please log in to accept friend requests.');
        return;
    }
    try {
        const res = await fetch('/api/friend_requests/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.user_id, friend_id })
        });
        const data = await res.json();
        alert(data.message || data.error);
        if (res.ok) {
            loadFriendRequests();
            loadFriends();
            loadNotifications();
        }
    } catch (error) {
        console.error('Accept friend request error:', error.message, error.stack);
        alert('Failed to accept friend request. Check console for details.');
    }
}

async function rejectFriendRequest(request_id) {
    if (!currentUser) {
        console.error('rejectFriendRequest: No current user');
        alert('Please log in to reject friend requests.');
        return;
    }
    try {
        const res = await fetch(`/api/friend_requests/${request_id}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        alert(data.message || data.error);
        if (res.ok) {
            loadFriendRequests();
            loadNotifications();
        }
    } catch (error) {
        console.error('Reject friend request error:', error.message, error.stack);
        alert('Failed to reject friend request. Check console for details.');
    }
}

async function loadSuggestions() {
    if (!currentUser) {
        console.error('loadSuggestions: No current user');
        alert('Please log in to view suggestions.');
        return;
    }
    try {
        const res = await fetch(`/api/suggestions?user_id=${currentUser.user_id}`);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}, Message: ${await res.text()}`);
        }
        const suggestions = await res.json();
        const suggestionList = document.getElementById('suggestion-list');
        if (!suggestionList) {
            console.error('loadSuggestions: Suggestion list element not found');
            return;
        }
        suggestionList.innerHTML = '';
        if (suggestions.length === 0) {
            suggestionList.innerHTML = '<p>No new suggestions at this time.</p>';
        }
        suggestions.forEach(user => {
            const suggestionDiv = document.createElement('div');
            suggestionDiv.className = 'suggestion-item';
            suggestionDiv.innerHTML = `
                <span>${user.name} (@${user.username})</span>
                <button onclick="sendFriendRequest(${user.id})">Add Friend</button>
            `;
            suggestionList.appendChild(suggestionDiv);
        });
    } catch (error) {
        console.error('Load suggestions error:', error.message, error.stack);
        alert('Failed to load suggestions. Check console for details.');
    }
}

async function sendFriendRequest(friend_id) {
    if (!currentUser) {
        console.error('sendFriendRequest: No current user');
        alert('Please log in to send friend requests.');
        return;
    }
    try {
        const res = await fetch('/api/friend_requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.user_id, friend_id })
        });
        const data = await res.json();
        alert(data.message || data.error);
        if (res.ok) {
            loadSuggestions();
            loadFriendRequests();
            loadFriends();
            loadNotifications();
        }
    } catch (error) {
        console.error('Send friend request error:', error.message, error.stack);
        alert('Failed to send friend request. Check console for details.');
    }
}

async function loadFriends() {
    if (!currentUser) {
        console.error('loadFriends: No current user');
        alert('Please log in to view friends.');
        return;
    }
    try {
        const res = await fetch(`/api/friends?user_id=${currentUser.user_id}`);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}, Message: ${await res.text()}`);
        }
        const friends = await res.json();
        console.log('Fetched friends:', friends); // Debug log
        const friendsList = document.getElementById('friends-list');
        if (!friendsList) {
            console.error('loadFriends: Friends list element not found');
            alert('Friends section is missing in HTML. Check index.html.');
            return;
        }
        friendsList.innerHTML = '';
        if (friends.length === 0) {
            const resPending = await fetch(`/api/friend_requests?user_id=${currentUser.user_id}`);
            if (!resPending.ok) {
                throw new Error(`HTTP error! Status: ${resPending.status}, Message: ${await resPending.text()}`);
            }
            const pendingRequests = await resPending.json();
            if (pendingRequests.length > 0) {
                friendsList.innerHTML = '<p>You have sent friend requests, but no friends have been accepted yet.</p>';
            } else {
                friendsList.innerHTML = '<p>You have no friends yet. Try adding some friends!</p>';
            }
        } else {
            friends.forEach(friend => {
                const friendDiv = document.createElement('div');
                friendDiv.className = 'friend-item';
                friendDiv.innerHTML = `
                    <span><img src="${friend.profile_picture || '/images/default-dp.jpg'}" class="circular-dp" style="width: 40px; height: 40px;"> ${friend.name} (@${friend.username})</span>
                    <div>
                        <button onclick="showMessages(${friend.id}, '${friend.name}')">Message</button>
                        ${currentGroup ? `<button onclick="inviteToGroup(${friend.id}, ${currentGroup.id})">Invite to Group</button>` : ''}
                    </div>
                `;
                friendsList.appendChild(friendDiv);
            });
        }
    } catch (error) {
        console.error('Load friends error:', error.message, error.stack);
        alert('Failed to load friends. Check console for details.');
    }
}

async function inviteToGroup(friend_id, group_id) {
    if (!currentUser) {
        console.error('inviteToGroup: No current user');
        alert('Please log in to invite friends.');
        return;
    }
    try {
        const res = await fetch('/api/groups/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.user_id, friend_id, group_id })
        });
        const data = await res.json();
        alert(data.message || data.error);
        if (res.ok) {
            loadGroups();
            loadNotifications();
        }
    } catch (error) {
        console.error('Invite to group error:', error.message, error.stack);
        alert('Failed to invite friend. Check console for details.');
    }
}

async function createGroup() {
    if (!currentUser) {
        console.error('createGroup: No current user');
        alert('Please log in to create a group.');
        return;
    }
    try {
        const groupName = prompt('Enter the name of the new group:');
        const groupDesc = prompt('Enter a description for the group:');
        if (!groupName || !groupDesc) {
            alert('Group name and description are required.');
            return;
        }
        const res = await fetch('/api/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: groupName, description: groupDesc, user_id: currentUser.user_id })
        });
        const data = await res.json();
        alert(data.message || data.error);
        if (res.ok) {
            loadGroups();
            loadNotifications();
        }
    } catch (error) {
        console.error('Create group error:', error.message, error.stack);
        alert('Failed to create group. Check console for details.');
    }
}

async function loadGroups() {
    if (!currentUser) {
        console.error('loadGroups: No current user');
        alert('Please log in to view groups.');
        return;
    }
    try {
        const res = await fetch(`/api/groups?user_id=${currentUser.user_id}`);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}, Message: ${await res.text()}`);
        }
        const groups = await res.json();
        const groupList = document.getElementById('group-list');
        if (!groupList) {
            console.error('loadGroups: Group list element not found');
            return;
        }
        groupList.innerHTML = '';
        if (groups.length === 0) {
            groupList.innerHTML = '<p>No groups found. Create one!</p>';
        }
        for (const group of groups) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'group-item';
            groupDiv.innerHTML = `
                <span><b>${group.name}</b> (Owner: ${group.owner_username}): ${group.description}</span>
                <div>
                    <button onclick="joinGroup(${group.id})">Join Group</button>
                    <button onclick="showGroupMembers(${group.id}, '${group.name}')">View Members</button>
                    <button onclick="showInviteFriends(${group.id})">Invite Friends</button>
                </div>
            `;
            groupList.appendChild(groupDiv);
        }
    } catch (error) {
        console.error('Load groups error:', error.message, error.stack);
        alert('Failed to load groups. Check console for details.');
    }
}

async function joinGroup(group_id) {
    if (!currentUser) {
        console.error('joinGroup: No current user');
        alert('Please log in to join groups.');
        return;
    }
    try {
        const res = await fetch('/api/user_groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.user_id, group_id })
        });
        const data = await res.json();
        alert(data.message || data.error);
        if (res.ok) {
            loadGroups();
            loadNotifications();
        }
    } catch (error) {
        console.error('Join group error:', error.message, error.stack);
        alert('Failed to join group. Check console for details.');
    }
}

async function showGroupMembers(group_id, group_name) {
    if (!currentUser) {
        console.error('showGroupMembers: No current user');
        alert('Please log in to view group members.');
        return;
    }
    try {
        const res = await fetch(`/api/groups/${group_id}/members`);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}, Message: ${await res.text()}`);
        }
        const members = await res.json();
        const groupList = document.getElementById('group-list');
        if (!groupList) {
            console.error('showGroupMembers: Group list element not found');
            return;
        }
        groupList.innerHTML = `<h2>Members of ${group_name}</h2>`;
        if (members.length === 0) {
            groupList.innerHTML += '<p>No members in this group.</p>';
        }
        members.forEach(member => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'group-member-item';
            memberDiv.innerHTML = `
                <span>${member.name} (@${member.username}) - ${member.role}</span>
            `;
            groupList.appendChild(memberDiv);
        });
        const backButton = document.createElement('button');
        backButton.textContent = 'Back to Groups';
        backButton.onclick = () => loadGroups();
        groupList.appendChild(backButton);
    } catch (error) {
        console.error('Show group members error:', error.message, error.stack);
        alert('Failed to load group members. Check console for details.');
    }
}

function showInviteFriends(group_id) {
    currentGroup = { id: group_id };
    showFriends();
}

async function loadMessages() {
    if (!currentUser || !currentChatFriend) {
        console.error('loadMessages: No current user or chat friend');
        return;
    }
    try {
        const res = await fetch(`/api/messages?user_id=${currentUser.user_id}&friend_id=${currentChatFriend.id}`);
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}, Message: ${await res.text()}`);
        }
        const messages = await res.json();
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = '';
        messages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + (message.sender_id === currentUser.user_id ? 'sent' : 'received');
            messageDiv.textContent = message.content;
            chatBox.appendChild(messageDiv);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
        document.getElementById('message-input-container').style.display = 'flex';
    } catch (error) {
        console.error('Load messages error:', error.message, error.stack);
        alert('Failed to load messages. Check console for details.');
    }
}

async function sendMessage() {
    if (!currentUser || !currentChatFriend) {
        console.error('sendMessage: No current user or chat friend');
        return;
    }
    try {
        const content = document.getElementById('message-content').value;
        if (!content.trim()) {
            alert('Message cannot be empty');
            return;
        }
        const res = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender_id: currentUser.user_id, receiver_id: currentChatFriend.id, content })
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('message-content').value = '';
            loadMessages();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Send message error:', error.message, error.stack);
        alert('Failed to send message. Check console for details.');
    }
}

socket.on('new_post', () => {
    if (currentSection === 'feed') {
        loadPosts();
    }
});

socket.on('new_comment', (comment) => {
    if (currentSection === 'feed') {
        loadComments(comment.post_id);
    }
});

socket.on('new_like', (data) => {
    if (currentSection === 'feed') {
        loadPosts();
    }
});

socket.on('new_notification', (notification) => {
    if (currentUser && notification.user_id.toString() === currentUser.user_id.toString()) {
        alert(notification.message || 'You have a new notification!');
        if (currentSection === 'notifications-section') {
            loadNotifications();
        }
    }
});

socket.on('new_friend_request', (request) => {
    if (currentUser && request.user_id.toString() === currentUser.user_id.toString()) {
        alert(request.message || 'You have a new friend request!');
        if (currentSection === 'friend-requests-section') {
            loadFriendRequests();
        }
        loadNotifications();
    }
});

socket.on('new_friend_accepted', (data) => {
    if (data.user_id.toString() === currentUser?.user_id.toString()) {
        alert('A friend request was accepted!');
        if (currentSection === 'friends-section') {
            loadFriends();
        }
        if (currentSection === 'friend-requests-section') {
            loadFriendRequests();
        }
        loadNotifications();
    }
});

socket.on('new_message', (message) => {
    if (currentChatFriend &&
        ((message.sender_id.toString() === currentChatFriend.id.toString() && message.receiver_id.toString() === currentUser?.user_id.toString()) ||
         (message.sender_id.toString() === currentUser?.user_id.toString() && message.receiver_id.toString() === currentChatFriend.id.toString()))) {
        loadMessages();
    }
    loadNotifications();
});

document.getElementById('profile-picture').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('profile-picture-preview').src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});