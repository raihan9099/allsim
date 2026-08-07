// theme.js
const THEME = {
    colors: {
        primary: '#6C5CE7',
        secondary: '#FF6B6B',
        accent: '#FFA502',
        success: '#2ED573',
        info: '#1E90FF',
        dark: '#0F0F23',
        darker: '#1A1A3E',
        border: '#2A2A4A',
        text: '#E8E8F0',
        muted: '#A0A0B8'
    },
    gradients: {
        primary: 'linear-gradient(135deg, #6C5CE7, #FF6B6B)',
        secondary: 'linear-gradient(135deg, #1E90FF, #2ED573)',
        accent: 'linear-gradient(135deg, #FFA502, #FF6B6B)'
    },
    shadows: {
        sm: '0 2px 8px rgba(0,0,0,0.2)',
        md: '0 4px 16px rgba(0,0,0,0.3)',
        lg: '0 8px 32px rgba(0,0,0,0.4)'
    },
    radius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        full: '9999px'
    },
    fonts: {
        primary: "'Hind Siliguri', sans-serif",
        display: "'Righteous', cursive"
    }
};

const SIM_OPERATORS = {
    banglalink: {
        name: 'Banglalink',
        color: '#FFA502',
        icon: '🔶',
        image: '/assets/Banglalink.jpg'
    },
    grameenphone: {
        name: 'Grameenphone',
        color: '#1E90FF',
        icon: '💙',
        image: '/assets/grameenphone.jpg'
    },
    robi: {
        name: 'Robi',
        color: '#6C5CE7',
        icon: '💜',
        image: '/assets/robi.jpg'
    },
    airtel: {
        name: 'Airtel',
        color: '#FF6B6B',
        icon: '❤️',
        image: '/assets/airtel.jpg'
    }
};

const OFFER_CATEGORIES = [
    'Internet',
    'Voice',
    'Combo',
    'Social',
    'Gaming',
    'Night',
    'Entertainment',
    'Business',
    'Premium'
];

module.exports = { THEME, SIM_OPERATORS, OFFER_CATEGORIES };
