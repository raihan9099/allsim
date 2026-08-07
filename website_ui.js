// website_ui.js
const WebsiteUI = {
    init() {
        this.createParticles();
        this.initScrollEffects();
        this.initMobileMenu();
        this.initSimTabs();
    },

    createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const size = Math.random() * 4 + 2;
            particle.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                left: ${Math.random() * 100}%;
                animation-duration: ${Math.random() * 10 + 10}s;
                animation-delay: ${Math.random() * 10}s;
                background: hsl(${Math.random() * 360}, 70%, 60%);
            `;
            container.appendChild(particle);
        }
    },

    initScrollEffects() {
        const backToTop = document.getElementById('backToTop');
        window.addEventListener('scroll', () => {
            if (backToTop) {
                backToTop.style.display = window.scrollY > 500 ? 'flex' : 'none';
            }
        });

        const sections = document.querySelectorAll('.sim-section');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.1 });

        sections.forEach(section => {
            section.style.opacity = '0';
            section.style.transform = 'translateY(30px)';
            section.style.transition = 'all 0.6s ease';
            observer.observe(section);
        });
    },

    initMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const chatArea = document.querySelector('.chat-area');
        
        if (sidebar && chatArea && window.innerWidth <= 768) {
            chatArea.addEventListener('click', () => {
                sidebar.classList.remove('mobile-show');
            });
        }
    },

    initSimTabs() {
        const tabs = document.querySelectorAll('.sim-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                tabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
            });
        });
    },

    scrollToSim(id) {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    formatPrice(price) {
        return price.replace('৳', '৳ ');
    },

    getTimeAgo(date) {
        const now = new Date();
        const diff = Math.floor((now - new Date(date)) / 1000);
        if (diff < 60) return 'এইমাত্র';
        if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} ঘন্টা আগে`;
        if (diff < 2592000) return `${Math.floor(diff / 86400)} দিন আগে`;
        return new Date(date).toLocaleDateString('bn-BD');
    },

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 16px 24px;
            border-radius: 12px;
            color: white;
            font-weight: 600;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#2ED573' : '#FF6B6B'};
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => WebsiteUI.init());
}

module.exports = WebsiteUI;
