const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'DELETE'],
    }
});

// Ensure upload directories exist
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};
ensureDir('public/images');
ensureDir('public/videos');

// Database connection pool
const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '8932',
    database: 'social_network44', // Corrected database name
});

// Test database connection
(async () => {
    try {
        const connection = await dbPool.getConnection();
        console.log('MySQL connected as id', connection.threadId);
        connection.release();
    } catch (err) {
        console.error('Database connection failed:', err.stack);
        process.exit(1);
    }
})();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.mimetype.startsWith('image')) {
            cb(null, 'public/images/');
        } else if (file.mimetype.startsWith('video')) {
            cb(null, 'public/videos/');
        } else {
            cb(new Error('Invalid file type'), null);
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, name } = req.body;
        if (!username || !password || !name) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await dbPool.query('INSERT INTO users (username, password, name) VALUES (?, ?, ?)', [username, hashedPassword, name]);
        res.json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Register error:', error.message, error.stack);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username is already taken' });
        }
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const [results] = await dbPool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (results.length === 0) {
            return res.status(400).json({ error: 'User not found' });
        }
        const user = results[0];
        if (await bcrypt.compare(password, user.password)) {
            res.json({
                user_id: user.id,
                username: user.username,
                name: user.name,
                bio: user.bio,
                profile_picture: user.profile_picture
            });
        } else {
            res.status(400).json({ error: 'Incorrect password' });
        }
    } catch (error) {
        console.error('Login error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Update Profile
app.post('/api/profile', upload.single('profile_picture'), async (req, res) => {
    try {
        const { user_id, name, bio } = req.body;
        if (!user_id || !name) {
            return res.status(400).json({ error: 'User ID and name are required' });
        }
        const profile_picture = req.file ? `/images/${req.file.filename}` : null;
        let query = 'UPDATE users SET name = ?, bio = ?';
        let params = [name, bio || null];
        if (profile_picture) {
            query += ', profile_picture = ?';
            params.push(profile_picture);
        }
        query += ' WHERE id = ?';
        params.push(user_id);
        await dbPool.query(query, params);
        res.json({ message: 'Profile updated' });
    } catch (error) {
        console.error('Update profile error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Get User Profile
app.get('/api/users/:id', async (req, res) => {
    try {
        const user_id = req.params.id;
        const [results] = await dbPool.query('SELECT id, username, name, bio, profile_picture FROM users WHERE id = ?', [user_id]);
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(results[0]);
    } catch (error) {
        console.error('Get user error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Create Post
app.post('/api/posts', upload.single('media'), async (req, res) => {
    try {
        const { user_id, content, privacy } = req.body;
        if (!user_id || (!content && !req.file)) {
            return res.status(400).json({ error: 'User ID and either content or media are required' });
        }
        const media_url = req.file ? `/${req.file.mimetype.startsWith('image') ? 'images' : 'videos'}/${req.file.filename}` : null;
        const [result] = await dbPool.query(
            'INSERT INTO posts (user_id, content, media_url, privacy) VALUES (?, ?, ?, ?)',
            [user_id, content || '', media_url, privacy || 'public']
        );
        const [postResults] = await dbPool.query(
            'SELECT p.*, u.username, u.name, u.profile_picture FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?',
            [result.insertId]
        );
        const post = postResults[0];
        io.emit('new_post', post);
        res.json({ message: 'Post created', post });
    } catch (error) {
        console.error('Create post error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Get Posts
app.get('/api/posts', async (req, res) => {
    try {
        const user_id = req.query.user_id;
        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        const [results] = await dbPool.query(
            `SELECT p.*, u.username, u.name, u.profile_picture
             FROM posts p
             JOIN users u ON p.user_id = u.id
             WHERE p.privacy = 'public' OR p.user_id = ? OR (p.privacy = 'friends'
             AND EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = ? AND f.friend_id = p.user_id AND f.status = 'accepted'))
             ORDER BY p.created_at DESC`,
            [user_id, user_id]
        );
        res.json(results);
    } catch (error) {
        console.error('Get posts error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Like Post
app.post('/api/likes', async (req, res) => {
    try {
        const { post_id, user_id } = req.body;
        if (!post_id || !user_id) {
            return res.status(400).json({ error: 'Post ID and user ID are required' });
        }
        const [existingLike] = await dbPool.query(
            'SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?',
            [post_id, user_id]
        );
        if (existingLike.length > 0) {
            return res.status(400).json({ error: 'You have already liked this post' });
        }
        await dbPool.query('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [post_id, user_id]);
        const [postResults] = await dbPool.query('SELECT user_id FROM posts WHERE id = ?', [post_id]);
        if (postResults.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        const postOwner = postResults[0].user_id;
        const [userResults] = await dbPool.query('SELECT username FROM users WHERE id = ?', [user_id]);
        if (userResults.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const username = userResults[0].username;
        if (postOwner !== user_id) {
            const [notificationCheck] = await dbPool.query(
                'SELECT 1 FROM notifications WHERE user_id = ? AND from_user_id = ? AND type = ? AND post_id = ?',
                [postOwner, user_id, 'like', post_id]
            );
            if (notificationCheck.length === 0) {
                const [notificationResult] = await dbPool.query(
                    'INSERT INTO notifications (user_id, from_user_id, type, message, post_id) VALUES (?, ?, ?, ?, ?)',
                    [postOwner, user_id, 'like', `${username} liked your post`, post_id]
                );
                io.to(postOwner.toString()).emit('new_notification', {
                    user_id: postOwner,
                    message: `${username} liked your post`,
                    post_id,
                    notification_id: notificationResult.insertId
                });
            }
        }
        io.emit('new_like', { post_id });
        res.json({ message: 'Post liked' });
    } catch (error) {
        console.error('Like post error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Add Comment
app.post('/api/comments', async (req, res) => {
    try {
        const { post_id, user_id, content } = req.body;
        if (!post_id || !user_id || !content) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        const [result] = await dbPool.query(
            'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
            [post_id, user_id, content]
        );
        const [postResults] = await dbPool.query('SELECT user_id FROM posts WHERE id = ?', [post_id]);
        if (postResults.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        const postOwner = postResults[0].user_id;
        const [userResults] = await dbPool.query('SELECT username FROM users WHERE id = ?', [user_id]);
        if (userResults.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const username = userResults[0].username;
        if (postOwner !== user_id) {
            const [notificationCheck] = await dbPool.query(
                'SELECT 1 FROM notifications WHERE user_id = ? AND from_user_id = ? AND type = ? AND post_id = ?',
                [postOwner, user_id, 'comment', post_id]
            );
            if (notificationCheck.length === 0) {
                const [notificationResult] = await dbPool.query(
                    'INSERT INTO notifications (user_id, from_user_id, post_id, type, message) VALUES (?, ?, ?, ?, ?)',
                    [postOwner, user_id, post_id, 'comment', `${username} commented on your post`]
                );
                io.to(postOwner.toString()).emit('new_notification', {
                    user_id: postOwner,
                    message: `${username} commented on your post`,
                    post_id,
                    notification_id: notificationResult.insertId
                });
            }
        }
        io.emit('new_comment', { post_id, user_id, content, comment_id: result.insertId });
        res.json({ message: 'Comment added', comment_id: result.insertId });
    } catch (error) {
        console.error('Add comment error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Get Comments
app.get('/api/comments', async (req, res) => {
    try {
        const post_id = req.query.post_id;
        if (!post_id) {
            return res.status(400).json({ error: 'Post ID is required' });
        }
        const [results] = await dbPool.query(
            'SELECT c.*, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE post_id = ? ORDER BY c.created_at ASC',
            [post_id]
        );
        res.json(results);
    } catch (error) {
        console.error('Get comments error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Share Post
app.post('/api/shares', async (req, res) => {
    try {
        const { post_id, user_id } = req.body;
        if (!post_id || !user_id) {
            return res.status(400).json({ error: 'Post ID and user ID are required' });
        }
        const [postResults] = await dbPool.query('SELECT user_id FROM posts WHERE id = ?', [post_id]);
        if (postResults.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        const postOwner = postResults[0].user_id;
        const [userResults] = await dbPool.query('SELECT username FROM users WHERE id = ?', [user_id]);
        if (userResults.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const username = userResults[0].username;
        if (postOwner !== user_id) {
            const [notificationCheck] = await dbPool.query(
                'SELECT 1 FROM notifications WHERE user_id = ? AND from_user_id = ? AND type = ? AND post_id = ?',
                [postOwner, user_id, 'share', post_id]
            );
            if (notificationCheck.length === 0) {
                const [notificationResult] = await dbPool.query(
                    'INSERT INTO notifications (user_id, from_user_id, type, message, post_id) VALUES (?, ?, ?, ?, ?)',
                    [postOwner, user_id, 'share', `${username} shared your post`, post_id]
                );
                io.to(postOwner.toString()).emit('new_notification', {
                    user_id: postOwner,
                    message: `${username} shared your post`,
                    post_id,
                    notification_id: notificationResult.insertId
                });
            }
        }
        res.json({ message: 'Post shared' });
    } catch (error) {
        console.error('Share post error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Friend Request
app.post('/api/friend_requests', async (req, res) => {
    try {
        const { user_id, friend_id } = req.body;
        if (!user_id || !friend_id || user_id === friend_id) {
            return res.status(400).json({ error: 'Invalid user or friend ID' });
        }
        const [existing] = await dbPool.query(
            'SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status IN ("pending", "accepted")',
            [user_id, friend_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Friend request already sent or accepted' });
        }
        await dbPool.query(
            'INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, "pending")',
            [user_id, friend_id]
        );
        const [friendResults] = await dbPool.query('SELECT username FROM users WHERE id = ?', [friend_id]);
        if (friendResults.length === 0) {
            return res.status(404).json({ error: 'Friend not found' });
        }
        const friendUsername = friendResults[0].username;
        const [senderResults] = await dbPool.query('SELECT username FROM users WHERE id = ?', [user_id]);
        if (senderResults.length === 0) {
            return res.status(404).json({ error: 'Sender not found' });
        }
        const senderUsername = senderResults[0].username;
        const [notificationResult] = await dbPool.query(
            'INSERT INTO notifications (user_id, from_user_id, type, message) VALUES (?, ?, ?, ?)',
            [friend_id, user_id, 'friend_request', `${senderUsername} sent you a friend request`]
        );
        await dbPool.query(
            'INSERT INTO notifications (user_id, from_user_id, type, message) VALUES (?, ?, ?, ?)',
            [user_id, user_id, 'friend_request_sent', `You sent a friend request to ${friendUsername}`]
        );
        io.to(friend_id.toString()).emit('new_friend_request', {
            user_id: friend_id,
            message: `${senderUsername} sent you a friend request`,
            from_user_id: user_id,
            notification_id: notificationResult.insertId
        });
        io.to(user_id.toString()).emit('new_notification', {
            user_id,
            message: `You sent a friend request to ${friendUsername}`,
            notification_id: notificationResult.insertId
        });
        // Auto-accept for robot users
        if (friendUsername.toLowerCase().startsWith('robot')) {
            await dbPool.query(
                'UPDATE friendships SET status = "accepted" WHERE user_id = ? AND friend_id = ?',
                [user_id, friend_id]
            );
            await dbPool.query(
                'INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, "accepted")',
                [friend_id, user_id]
            );
            const [acceptNotificationResult] = await dbPool.query(
                'INSERT INTO notifications (user_id, from_user_id, type, message) VALUES (?, ?, ?, ?)',
                [user_id, friend_id, 'friend_accepted', `${friendUsername} accepted your friend request`]
            );
            io.to(user_id.toString()).emit('new_notification', {
                user_id,
                message: `${friendUsername} accepted your friend request`,
                notification_id: acceptNotificationResult.insertId
            });
            io.to(user_id.toString()).emit('new_friend_accepted', { user_id, friend_id });
            io.to(friend_id.toString()).emit('new_friend_accepted', { user_id: friend_id, friend_id: user_id });
        }
        res.json({ message: 'Friend request sent' });
    } catch (error) {
        console.error('Friend request error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Get Friend Requests
app.get('/api/friend_requests', async (req, res) => {
    try {
        const user_id = req.query.user_id;
        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        const [results] = await dbPool.query(
            `SELECT f.id, f.user_id AS from_user_id, u.username, u.name
             FROM friendships f
             JOIN users u ON f.user_id = u.id
             WHERE f.friend_id = ? AND f.status = 'pending'`,
            [user_id]
        );
        res.json(results);
    } catch (error) {
        console.error('Get friend requests error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Accept Friend Request
app.post('/api/friend_requests/accept', async (req, res) => {
    try {
        const { user_id, friend_id } = req.body;
        if (!user_id || !friend_id) {
            return res.status(400).json({ error: 'User ID and friend ID are required' });
        }
        const [results] = await dbPool.query(
            'UPDATE friendships SET status = "accepted" WHERE user_id = ? AND friend_id = ? AND status = "pending"',
            [friend_id, user_id]
        );
        if (results.affectedRows === 0) {
            return res.status(400).json({ error: 'Friend request not found or already processed' });
        }
        await dbPool.query(
            'INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, "accepted")',
            [user_id, friend_id]
        );
        const [friendResults] = await dbPool.query('SELECT username FROM users WHERE id = ?', [user_id]);
        if (friendResults.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const username = friendResults[0].username;
        const [senderResults] = await dbPool.query('SELECT username FROM users WHERE id = ?', [friend_id]);
        if (senderResults.length === 0) {
            return res.status(404).json({ error: 'Sender not found' });
        }
        const senderUsername = senderResults[0].username;
        const [notificationResult1] = await dbPool.query(
            'INSERT INTO notifications (user_id, from_user_id, type, message) VALUES (?, ?, ?, ?)',
            [friend_id, user_id, 'friend_accepted', `${username} accepted your friend request`]
        );
        const [notificationResult2] = await dbPool.query(
            'INSERT INTO notifications (user_id, from_user_id, type, message) VALUES (?, ?, ?, ?)',
            [user_id, user_id, 'friend_accepted', `You accepted ${senderUsername}'s friend request`]
        );
        io.to(friend_id.toString()).emit('new_notification', {
            user_id: friend_id,
            message: `${username} accepted your friend request`,
            notification_id: notificationResult1.insertId
        });
        io.to(user_id.toString()).emit('new_notification', {
            user_id,
            message: `You accepted ${senderUsername}'s friend request`,
            notification_id: notificationResult2.insertId
        });
        io.to(friend_id.toString()).emit('new_friend_accepted', { user_id: friend_id, friend_id: user_id });
        io.to(user_id.toString()).emit('new_friend_accepted', { user_id, friend_id });
        res.json({ message: 'Friend request accepted' });
    } catch (error) {
        console.error('Accept friend request error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Reject Friend Request
app.delete('/api/friend_requests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [results] = await dbPool.query('DELETE FROM friendships WHERE id = ?', [id]);
        if (results.affectedRows === 0) {
            return res.status(400).json({ error: 'Request not found' });
        }
        res.json({ message: 'Friend request rejected' });
    } catch (error) {
        console.error('Reject friend request error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Get Notifications
app.get('/api/notifications', async (req, res) => {
    try {
        const user_id = req.query.user_id;
        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        const [results] = await dbPool.query(
            'SELECT n.*, u.username FROM notifications n JOIN users u ON n.from_user_id = u.id WHERE n.user_id = ? ORDER BY n.created_at DESC',
            [user_id]
        );
        res.json(results);
    } catch (error) {
        console.error('Get notifications error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Create Group
app.post('/api/groups', async (req, res) => {
    try {
        const { name, description, user_id } = req.body;
        if (!name || !description || !user_id) {
            return res.status(400).json({ error: 'Name, description, and user_id are required' });
        }
        const [result] = await dbPool.query(
            'INSERT INTO user_groups_data (name, description, owner_id) VALUES (?, ?, ?)',
            [name, description, user_id]
        );
        await dbPool.query(
            'INSERT INTO group_memberships (user_id, group_id, role) VALUES (?, ?, "admin")',
            [user_id, result.insertId]
        );
        const [notificationResult] = await dbPool.query(
            'INSERT INTO notifications (user_id, from_user_id, type, message) VALUES (?, ?, ?, ?)',
            [user_id, user_id, 'group_created', `You created the group ${name}`]
        );
        io.to(user_id.toString()).emit('new_notification', {
            user_id,
            message: `You created the group ${name}`,
            group_id: result.insertId,
            notification_id: notificationResult.insertId
        });
        res.json({ message: 'Group created', group_id: result.insertId });
    } catch (error) {
        console.error('Create group error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Join Group
app.post('/api/user_groups', async (req, res) => {
    try {
        const { user_id, group_id } = req.body;
        if (!user_id || !group_id) {
            return res.status(400).json({ error: 'User ID and group ID are required' });
        }
        await dbPool.query('INSERT INTO group_memberships (user_id, group_id, role) VALUES (?, ?, "member")', [user_id, group_id]);
        const [notificationResult] = await dbPool.query(
            'INSERT INTO notifications (user_id, from_user_id, type, message) VALUES (?, ?, ?, ?)',
            [user_id, user_id, 'group_joined', `You joined a group`]
        );
        io.to(user_id.toString()).emit('new_notification', {
            user_id,
            message: 'You joined a group',
            group_id,
            notification_id: notificationResult.insertId
        });
        res.json({ message: 'Joined group' });
    } catch (error) {
        console.error('Join group error:', error.message, error.stack);
        res.status(400).json({ error: error.code === 'ER_DUP_ENTRY' ? 'Already joined this group' : 'Server error: ' + error.message });
    }
});

// Invite to Group
app.post('/api/groups/invite', async (req, res) => {
    try {
        const { user_id, friend_id, group_id } = req.body;
        if (!user_id || !friend_id || !group_id) {
            return res.status(400).json({ error: 'User ID, friend ID, and group ID are required' });
        }
        const [adminCheck] = await dbPool.query(
            'SELECT role FROM group_memberships WHERE user_id = ? AND group_id = ?',
            [user_id, group_id]
        );
        if (adminCheck.length === 0 || adminCheck[0].role !== 'admin') {
            return res.status(403).json({ error: 'Only group admins can invite members' });
        }
        const [memberCheck] = await dbPool.query(
            'SELECT 1 FROM group_memberships WHERE user_id = ? AND group_id = ?',
            [friend_id, group_id]
        );
        if (memberCheck.length > 0) {
            return res.status(400).json({ error: 'User already in group' });
        }
        await dbPool.query('INSERT INTO group_memberships (user_id, group_id, role) VALUES (?, ?, "member")', [friend_id, group_id]);
        const [friendResults] = await dbPool.query('SELECT username FROM users WHERE id = ?', [user_id]);
        if (friendResults.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const username = friendResults[0].username;
        const [notificationResult] = await dbPool.query(
            'INSERT INTO notifications (user_id, from_user_id, type, message) VALUES (?, ?, ?, ?)',
            [friend_id, user_id, 'group_invite', `${username} invited you to a group`]
        );
        io.to(friend_id.toString()).emit('new_notification', {
            user_id: friend_id,
            message: `${username} invited you to a group`,
            group_id,
            notification_id: notificationResult.insertId
        });
        res.json({ message: 'Friend invited to group' });
    } catch (error) {
        console.error('Group invite error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Get Group Members
app.get('/api/groups/:id/members', async (req, res) => {
    try {
        const group_id = req.params.id;
        const [results] = await dbPool.query(
            `SELECT u.id, u.username, u.name, u.profile_picture, ug.role
             FROM group_memberships ug
             JOIN users u ON ug.user_id = u.id
             WHERE ug.group_id = ?`,
            [group_id]
        );
        res.json(results);
    } catch (error) {
        console.error('Get group members error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Get Groups
app.get('/api/groups', async (req, res) => {
    try {
        const user_id = req.query.user_id;
        const [results] = await dbPool.query(
            `SELECT g.*, u.username AS owner_username
             FROM user_groups_data g
             JOIN users u ON g.owner_id = u.id
             WHERE g.id IN (SELECT group_id FROM group_memberships WHERE user_id = ?)
             ORDER BY g.created_at DESC`,
            [user_id]
        );
        res.json(results);
    } catch (error) {
        console.error('Get groups error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Get User's Friends
app.get('/api/friends', async (req, res) => {
    try {
        const user_id = req.query.user_id;
        if (!user_id) {
            console.error('Get friends error: Missing user_id');
            return res.status(400).json({ error: 'User ID is required' });
        }
        const [results] = await dbPool.query(
            `SELECT u.id, u.username, u.name, u.profile_picture
             FROM friendships f
             JOIN users u ON f.friend_id = u.id
             WHERE f.user_id = ? AND f.status = 'accepted'
             UNION
             SELECT u.id, u.username, u.name, u.profile_picture
             FROM friendships f
             JOIN users u ON f.user_id = u.id
             WHERE f.friend_id = ? AND f.status = 'accepted'
             ORDER BY name ASC`,
            [user_id, user_id]
        );
        console.log(`Fetched friends for user ${user_id}:`, results);
        res.json(results);
    } catch (error) {
        console.error('Get friends error:', error.message, error.stack);
        res.status(500).json({ error: `Server error: ${error.message}` });
    }
});

// Get User Suggestions
app.get('/api/suggestions', async (req, res) => {
    try {
        const user_id = req.query.user_id;
        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        const [results] = await dbPool.query(
            `SELECT id, username, name, profile_picture
             FROM users
             WHERE id != ? AND id NOT IN (
                 SELECT friend_id FROM friendships WHERE user_id = ? AND status IN ('accepted', 'pending')
                 UNION
                 SELECT user_id FROM friendships WHERE friend_id = ? AND status IN ('accepted', 'pending')
             ) LIMIT 15`,
            [user_id, user_id, user_id]
        );
        res.json(results);
    } catch (error) {
        console.error('Get suggestions error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Messaging
app.post('/api/messages', async (req, res) => {
    try {
        const { sender_id, receiver_id, content } = req.body;
        if (!sender_id || !receiver_id || !content) {
            return res.status(400).json({ error: 'Sender ID, receiver ID, and content are required' });
        }
        const [result] = await dbPool.query(
            'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
            [sender_id, receiver_id, content]
        );
        const [messageResults] = await dbPool.query(
            'SELECT id, sender_id, receiver_id, content, created_at FROM messages WHERE id = ?',
            [result.insertId]
        );
        const message = messageResults[0];
        const [senderResults] = await dbPool.query('SELECT username FROM users WHERE id = ?', [sender_id]);
        if (senderResults.length === 0) {
            return res.status(404).json({ error: 'Sender not found' });
        }
        const senderUsername = senderResults[0].username;
        io.to(receiver_id.toString()).emit('new_message', { ...message, senderUsername });
        res.json({ message: 'Message sent' });
    } catch (error) {
        console.error('Send message error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Get messages between two users
app.get('/api/messages', async (req, res) => {
    try {
        const { user_id, friend_id } = req.query;
        if (!user_id || !friend_id) {
            return res.status(400).json({ error: 'User ID and friend ID are required' });
        }
        const [results] = await dbPool.query(
            'SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY created_at ASC',
            [user_id, friend_id, friend_id, user_id]
        );
        res.json(results);
    } catch (error) {
        console.error('Get messages error:', error.message, error.stack);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});


// Socket.io for real-time notifications
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });

    socket.on('join_user_room', (user_id) => {
        socket.join(user_id.toString());
        console.log(`User ${user_id} joined their room`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});