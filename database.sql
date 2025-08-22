CREATE DATABASE social_network44;
USE social_network44;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    bio TEXT,
    profile_picture VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posts table
CREATE TABLE posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    content TEXT,
    media_url VARCHAR(255),
    privacy ENUM('public', 'friends', 'private') DEFAULT 'public',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Comments table
CREATE TABLE comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT,
    user_id INT,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Likes table
CREATE TABLE likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY unique_like (post_id, user_id)
);

-- Friendships table
CREATE TABLE friendships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    friend_id INT,
    status ENUM('pending', 'accepted') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY unique_friendship (user_id, friend_id)
);

-- Notifications table
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    from_user_id INT,
    type ENUM('like', 'comment', 'friend_request', 'friend_accepted', 'group_invite', 'message', 'group_created', 'group_joined'),
    post_id INT NULL,
    group_id INT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL ON UPDATE CASCADE

);

-- Groups table






-- Messages table
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT,
    receiver_id INT,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Dummy user data for 15 robot friends
INSERT INTO users (username, password, name, bio, profile_picture) VALUES
('robot1', 'password123', 'Bot-A', 'Hello, I am a chat bot.', '/images/bot-avatar.png'),
('robot2', 'password123', 'Bot-B', 'I am here to test the friend system.', '/images/bot-avatar.png'),
('robot3', 'password123', 'Bot-C', 'Ask me anything.', '/images/bot-avatar.png'),
('robot4', 'password123', 'Bot-D', 'Enjoy the app!', '/images/bot-avatar.png'),
('robot5', 'password123', 'Bot-E', 'I am a friendly bot.', '/images/bot-avatar.png'),
('robot6', 'password123', 'Bot-F', 'Ready to chat.', '/images/bot-avatar.png'),
('robot7', 'password123', 'Bot-G', 'How can I help you?', '/images/bot-avatar.png'),
('robot8', 'password123', 'Bot-H', 'Feel free to add me.', '/images/bot-avatar.png'),
('robot9', 'password123', 'Bot-I', 'Testing 1, 2, 3.', '/images/bot-avatar.png'),
('robot10', 'password123', 'Bot-J', 'I am here to listen.', '/images/bot-avatar.png'),
('robot11', 'password123', 'Bot-K', 'Awaiting your request.', '/images/bot-avatar.png'),
('robot12', 'password123', 'Bot-L', 'Happy to be your friend.', '/images/bot-avatar.png'),
('robot13', 'password123', 'Bot-M', 'Greetings!', '/images/bot-avatar.png'),
('robot14', 'password123', 'Bot-N', 'Ready for a chat.', '/images/bot-avatar.png'),
('robot15', 'password123', 'Bot-O', 'Just a simple bot.', '/images/bot-avatar.png');