// admin.js
const AdminPanel = {
    socket: null,
    currentUser: null,
    users: [],
    messages: [],
    isLoggedIn: false,

    init() {
        this.socket = io();
        this.setupSocketListeners();
        this.checkSavedSession();
    },

    setupSocketListeners() {
        this.socket.on('newMsg', (msg) => {
            if (this.shouldShowMessage(msg)) {
                this.messages.push(msg);
                this.renderMessages();
                this.markAsRead();
            }
            this.loadUsers();
        });

        this.socket.on('userStatus', (data) => {
            this.updateUserStatus(data.email, data.online);
        });
    },

    shouldShowMessage(msg) {
        return this.currentUser && 
            ((msg.sender === this.currentUser.email && msg.receiver === 'admin@simoffers.com') ||
             (msg.sender === 'admin@simoffers.com' && msg.receiver === this.currentUser.email));
    },

    checkSavedSession() {
        const savedSession = localStorage.getItem('adminSession');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            document.getElementById('loginEmail').value = session.email;
            document.getElementById('loginPassword').value = session.password;
            this.login(true);
        }
    },

    async login(isAutoLogin = false) {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const errorDiv = document.getElementById('loginError');
        const loginBtn = document.getElementById('loginBtn');

        if (!email || !password) {
            this.showError(errorDiv, 'সব ফিল্ড পূরণ করুন');
            return;
        }

        this.setLoadingState(loginBtn, true);
        errorDiv.style.display = 'none';

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.onLoginSuccess(email, password);
            } else {
                this.showError(errorDiv, data.error || 'লগইন ব্যর্থ হয়েছে');
                localStorage.removeItem('adminSession');
            }
        } catch (err) {
            this.showError(errorDiv, 'নেটওয়ার্ক সমস্যা');
            localStorage.removeItem('adminSession');
        } finally {
            this.setLoadingState(loginBtn, false);
        }
    },

    onLoginSuccess(email, password) {
        this.isLoggedIn = true;
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        localStorage.setItem('adminSession', JSON.stringify({ email, password }));
        this.loadUsers();
    },

    showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
    },

    setLoadingState(button, loading) {
        button.disabled = loading;
        button.innerHTML = loading ? '<span class="spinner"></span> সাইন ইন...' : 'সাইন ইন';
    },

    async loadUsers() {
        if (!this.isLoggedIn) return;
        try {
            const response = await fetch('/api/admin/users');
            this.users = await response.json();
            this.renderUserList();
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    },

    async selectUser(user) {
        this.currentUser = user;
        this.updateChatHeader(user);
        document.getElementById('chatInputArea').style.display = 'flex';
        document.querySelectorAll('.user-item').forEach(item => {
            item.classList.toggle('active', item.dataset.email === user.email);
        });
        await this.loadMessages();
        await this.markAsRead();
    },

    updateChatHeader(user) {
        document.getElementById('chatAvatar').textContent = user.name.charAt(0).toUpperCase();
        document.getElementById('chatName').textContent = user.name;
        document.getElementById('chatStatus').innerHTML = user.isOnline ? 
            '<span class="online-dot"></span> Online' : 
            '<span class="offline-dot"></span> Offline';
    },

    async loadMessages() {
        if (!this.currentUser) return;
        try {
            const response = await fetch('/api/msgs/' + this.currentUser.email);
            const allMessages = await response.json();
            this.messages = allMessages.filter(msg => 
                (msg.sender === this.currentUser.email && msg.receiver === 'admin@simoffers.com') ||
                (msg.sender === 'admin@simoffers.com' && msg.receiver === this.currentUser.email)
            );
            this.renderMessages();
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    },

    renderMessages() {
        const container = document.getElementById('chatMessages');
        if (this.messages.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>কোন মেসেজ নেই</p></div>';
            return;
        }

        let html = '';
        let lastDate = '';

        this.messages.forEach(msg => {
            const msgDate = new Date(msg.timestamp).toLocaleDateString();
            if (msgDate !== lastDate) {
                html += `<div class="date-divider"><span>${msgDate}</span></div>`;
                lastDate = msgDate;
            }
            const isSentByAdmin = msg.sender === 'admin@simoffers.com';
            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            html += `<div class="message ${isSentByAdmin ? 'sent' : 'received'}">
                ${msg.message}
                <div class="time">${time}${isSentByAdmin ? ' ✓' : ''}</div>
            </div>`;
        });

        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    },

    async sendMessage() {
        const input = document.getElementById('msgInput');
        const message = input.value.trim();
        if (!message || !this.currentUser) return;

        this.socket.emit('sendMsg', {
            sender: 'admin@simoffers.com',
            receiver: this.currentUser.email,
            message: message,
            type: 'text'
        });

        this.messages.push({
            sender: 'admin@simoffers.com',
            receiver: this.currentUser.email,
            message: message,
            type: 'text',
            timestamp: new Date()
        });

        this.renderMessages();
        input.value = '';
        input.focus();
        setTimeout(() => this.loadUsers(), 500);
    },

    async markAsRead() {
        if (!this.currentUser) return;
        this.socket.emit('markRead', { user: this.currentUser.email });
        this.loadUsers();
    },

    updateUserStatus(email, online) {
        const element = document.querySelector(`.user-item[data-email="${email}"]`);
        if (element) {
            const dot = element.querySelector('.dot');
            if (dot) dot.style.background = online ? '#2ED573' : '#A0A0B8';
        }
        if (this.currentUser && this.currentUser.email === email) {
            document.getElementById('chatStatus').innerHTML = online ? 
                '<span class="online-dot"></span> Online' : 
                '<span class="offline-dot"></span> Offline';
        }
    },

    renderUserList() {
        const container = document.getElementById('userList');
        const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';
        const filteredUsers = this.users.filter(user => 
            user.name.toLowerCase().includes(searchTerm) || 
            user.email.toLowerCase().includes(searchTerm)
        );

        if (filteredUsers.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>কোন কনভারসেশন পাওয়া যায়নি</p></div>';
            return;
        }

        container.innerHTML = filteredUsers.map(user => {
            const lastSeen = user.lastSeen ? new Date(user.lastSeen) : null;
            const timeAgo = lastSeen ? this.getTimeAgo(lastSeen) : '';
            const isActive = this.currentUser && this.currentUser.email === user.email;

            return `<div class="user-item${isActive ? ' active' : ''}" data-email="${user.email}" onclick="AdminPanel.selectUserById('${user.email}')">
                <div class="user-avatar">
                    ${user.name.charAt(0).toUpperCase()}
                    <div class="dot" style="background:${user.isOnline ? '#2ED573' : '#A0A0B8'}"></div>
                </div>
                <div class="user-info">
                    <div class="name">${user.name}</div>
                    <div class="email">${user.email}</div>
                </div>
                ${user.unreadCount > 0 ? `<div class="unread">${user.unreadCount}</div>` : ''}
                <div class="user-time">${timeAgo}</div>
            </div>`;
        }).join('');
    },

    selectUserById(email) {
        const user = this.users.find(u => u.email === email);
        if (user) this.selectUser(user);
    },

    filterUsers() {
        this.renderUserList();
    },

    getTimeAgo(date) {
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'এখন';
        if (diff < 3600) return `${Math.floor(diff / 60)}মি`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}ঘ`;
        return `${Math.floor(diff / 86400)}দিন`;
    },

    logout() {
        localStorage.removeItem('adminSession');
        location.reload();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AdminPanel.init();
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') AdminPanel.login();
    });
});

setInterval(() => {
    if (AdminPanel.isLoggedIn) AdminPanel.loadUsers();
}, 30000);
