require('dotenv').config();
process.on('uncaughtException', (e) => { console.error('Uncaught:', e.message); });
process.on('unhandledRejection', (e) => { console.error('Rejection:', e); });

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;
const db = new Database('simoffers.db');

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    isAdmin INTEGER DEFAULT 0,
    lastSeen TEXT,
    isOnline INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL,
    receiver TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    fileUrl TEXT,
    seen INTEGER DEFAULT 0,
    timestamp TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sim TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price TEXT,
    validity TEXT,
    data TEXT,
    minutes TEXT,
    sms TEXT,
    category TEXT,
    image TEXT,
    featured INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

['uploads'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const simImages = {
  banglalink: '/Banglalink.jpg',
  airtel: '/airtel.jpg',
  grameenphone: '/grameenphone.jpg',
  robi: '/robi.jpg'
};

(async () => {
  const adminEmail = 'admin@simoffers.com';
  const admin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
  
  if (!admin) {
    const hashedPassword = await bcrypt.hash('Admin@2024!', 10);
    db.prepare('INSERT INTO users (name, email, password, isAdmin) VALUES (?, ?, ?, 1)').run('SIM Offers Admin', adminEmail, hashedPassword);
    console.log('Admin user created');
  }

  const offerCount = db.prepare('SELECT COUNT(*) as count FROM offers').get();
  if (offerCount.count === 0) {
    const insertOffer = db.prepare('INSERT INTO offers (sim, title, description, price, validity, data, minutes, sms, category, image, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    
    const offers = [
      ['banglalink', 'Unlimited Internet', 'Get unlimited internet for 7 days', '99', '7 Days', 'Unlimited', '100 Min', '50 SMS', 'Internet', simImages.banglalink, 1],
      ['banglalink', 'Gaming Pack', 'Special gaming data pack', '49', '3 Days', '2 GB', '50 Min', '20 SMS', 'Gaming', simImages.banglalink, 1],
      ['banglalink', 'Call Master', 'Unlimited calls pack', '129', '14 Days', '1 GB', 'Unlimited', '50 SMS', 'Voice', simImages.banglalink, 0],
      ['grameenphone', 'Super Saver', 'Best value pack for all', '199', '30 Days', '10 GB', '300 Min', '100 SMS', 'Combo', simImages.grameenphone, 1],
      ['grameenphone', 'Social Pack', 'Unlimited social media', '79', '7 Days', '5 GB', '75 Min', '30 SMS', 'Social', simImages.grameenphone, 1],
      ['grameenphone', 'Video Plus', 'Unlimited video streaming', '89', '7 Days', '6 GB', '60 Min', '25 SMS', 'Entertainment', simImages.grameenphone, 1],
      ['robi', 'Diamond Offer', 'Premium package for you', '299', '30 Days', '15 GB', '500 Min', '200 SMS', 'Premium', simImages.robi, 1],
      ['robi', 'Night Owl', 'Special night data pack', '39', '1 Day', '3 GB', '20 Min', '10 SMS', 'Night', simImages.robi, 0],
      ['robi', 'Business Pack', 'For business professionals', '399', '30 Days', '20 GB', '800 Min', '300 SMS', 'Business', simImages.robi, 0],
      ['airtel', 'Turbo Boost', 'High-speed data pack', '149', '15 Days', '8 GB', '200 Min', '80 SMS', 'Internet', simImages.airtel, 1],
      ['airtel', 'Music Stream', 'Unlimited music streaming', '59', '5 Days', '3 GB', '40 Min', '15 SMS', 'Entertainment', simImages.airtel, 0],
      ['airtel', 'Star Offer', 'Popular value pack', '249', '28 Days', '12 GB', '400 Min', '150 SMS', 'Combo', simImages.airtel, 1]
    ];

    const insertMany = db.transaction((offers) => {
      for (const offer of offers) {
        insertOffer.run(...offer);
      }
    });
    insertMany(offers);
    console.log('Sample offers created');
  }
})();

app.get('/', (req, res) => {
  const offers = db.prepare('SELECT * FROM offers WHERE active = 1 ORDER BY featured DESC, createdAt DESC').all();
  const featuredOffers = offers.filter(o => o.featured).slice(0, 4);
  const banglalinkOffers = offers.filter(o => o.sim === 'banglalink').slice(0, 4);
  const gpOffers = offers.filter(o => o.sim === 'grameenphone').slice(0, 4);
  const robiOffers = offers.filter(o => o.sim === 'robi').slice(0, 4);
  const airtelOffers = offers.filter(o => o.sim === 'airtel').slice(0, 4);

  function renderOfferCard(offer, featured = false) {
    return `
    <div class="offer-card ${featured ? 'featured' : ''}">
      <div class="offer-sim">
        <img src="${offer.image}" alt="${offer.sim}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2236%22 height=%2236%22><rect fill=%22%236C5CE7%22 width=%2236%22 height=%2236%22 rx=%2218%22/><text fill=%22white%22 x=%2218%22 y=%2224%22 text-anchor=%22middle%22 font-size=%2216%22>${offer.sim.charAt(0).toUpperCase()}</text></svg>'">
        <span>${offer.sim}</span>
      </div>
      <div class="offer-title">${offer.title}</div>
      <div class="offer-desc">${offer.description}</div>
      <div class="offer-features">
        <div class="offer-feature"><span class="icon">📱</span> ${offer.data}</div>
        <div class="offer-feature"><span class="icon">📞</span> ${offer.minutes}</div>
        <div class="offer-feature"><span class="icon">💬</span> ${offer.sms}</div>
        <div class="offer-feature"><span class="icon">📅</span> ${offer.validity}</div>
      </div>
      <div class="offer-bottom">
        <div class="offer-price">৳${offer.price}</div>
        <div class="offer-validity">${offer.validity}</div>
      </div>
      <button class="offer-btn" onclick="alert('Offer: ${offer.title}\\nPrice: ৳${offer.price}\\nValidity: ${offer.validity}')">Get This Offer</button>
    </div>`;
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#6C5CE7">
<title>SIM Offers BD - All Operator Best Deals 2024</title>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Righteous&display=swap" rel="stylesheet">
<style>
:root {
  --purple: #6C5CE7;
  --purple-dark: #5A4BD1;
  --pink: #FF6B6B;
  --orange: #FFA502;
  --green: #2ED573;
  --blue: #1E90FF;
  --bg: #0F0F23;
  --card-bg: #1A1A3E;
  --text: #E8E8F0;
  --text-muted: #A0A0B8;
  --border: #2A2A4A;
  --gradient-1: linear-gradient(135deg, #6C5CE7, #FF6B6B);
  --gradient-2: linear-gradient(135deg, #1E90FF, #2ED573);
  --gradient-3: linear-gradient(135deg, #FFA502, #FF6B6B);
  --shadow: 0 8px 32px rgba(0,0,0,0.3);
  --radius: 16px;
  --radius-sm: 10px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Hind Siliguri', sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  overflow-x: hidden;
}
.particles {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 0;
}
.particle {
  position: absolute;
  border-radius: 50%;
  animation: float 15s infinite linear;
  opacity: 0.3;
}
@keyframes float {
  0% { transform: translateY(100vh) rotate(0deg); }
  100% { transform: translateY(-100vh) rotate(720deg); }
}
.nav {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: rgba(15,15,35,0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
  padding: 0 20px;
}
.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 70px;
}
.logo {
  font-family: 'Righteous', cursive;
  font-size: 1.8em;
  background: var(--gradient-1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-decoration: none;
}
.nav-links {
  display: flex;
  gap: 20px;
  align-items: center;
}
.nav-links a {
  color: var(--text-muted);
  text-decoration: none;
  font-weight: 500;
  transition: 0.3s;
  font-size: 0.95em;
}
.nav-links a:hover { color: var(--purple); }
.chat-btn {
  background: var(--gradient-1);
  color: white !important;
  padding: 10px 24px;
  border-radius: 25px;
  font-weight: 600 !important;
}
.hero {
  position: relative;
  z-index: 1;
  padding: 80px 20px 60px;
  text-align: center;
  max-width: 900px;
  margin: 0 auto;
}
.hero-badge {
  display: inline-block;
  background: rgba(108,92,231,0.2);
  color: var(--purple);
  padding: 8px 20px;
  border-radius: 25px;
  font-weight: 600;
  font-size: 0.9em;
  margin-bottom: 20px;
  border: 1px solid rgba(108,92,231,0.3);
}
.hero h1 {
  font-size: 3em;
  font-weight: 700;
  margin-bottom: 16px;
  background: var(--gradient-1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.2;
}
.hero p {
  font-size: 1.15em;
  color: var(--text-muted);
  margin-bottom: 30px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}
.sim-tabs {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 30px;
}
.sim-tab {
  padding: 12px 28px;
  border-radius: 30px;
  border: 2px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95em;
  transition: 0.3s;
  font-family: 'Hind Siliguri', sans-serif;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sim-tab:hover, .sim-tab.active {
  border-color: var(--purple);
  color: white;
  background: rgba(108,92,231,0.1);
}
.sim-tab img {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}
.section {
  position: relative;
  z-index: 1;
  padding: 40px 20px;
}
.container {
  max-width: 1200px;
  margin: 0 auto;
}
.section-title {
  font-size: 2em;
  font-weight: 700;
  text-align: center;
  margin-bottom: 12px;
}
.section-subtitle {
  text-align: center;
  color: var(--text-muted);
  margin-bottom: 40px;
  font-size: 1em;
}
.offers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
.offer-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  transition: 0.3s;
  position: relative;
  overflow: hidden;
}
.offer-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow);
  border-color: var(--purple);
}
.offer-card.featured {
  border-color: var(--purple);
}
.offer-card.featured::before {
  content: 'HOT';
  position: absolute;
  top: 16px;
  right: -30px;
  background: var(--gradient-3);
  color: white;
  padding: 4px 40px;
  font-size: 0.75em;
  font-weight: 700;
  transform: rotate(45deg);
}
.offer-sim {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.offer-sim img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}
.offer-sim span {
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  font-size: 0.85em;
  letter-spacing: 1px;
}
.offer-title {
  font-size: 1.15em;
  font-weight: 700;
  margin-bottom: 8px;
}
.offer-desc {
  color: var(--text-muted);
  font-size: 0.9em;
  margin-bottom: 16px;
}
.offer-features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}
.offer-feature {
  background: rgba(108,92,231,0.1);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.82em;
  display: flex;
  align-items: center;
  gap: 6px;
}
.offer-feature .icon { font-size: 1.1em; }
.offer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.offer-price {
  font-size: 1.5em;
  font-weight: 700;
  background: var(--gradient-1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.offer-validity {
  font-size: 0.82em;
  color: var(--text-muted);
  background: rgba(108,92,231,0.1);
  padding: 4px 12px;
  border-radius: 15px;
}
.offer-btn {
  width: 100%;
  padding: 12px;
  background: var(--gradient-1);
  color: white;
  border: none;
  border-radius: 25px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.95em;
  margin-top: 16px;
  transition: 0.3s;
  font-family: 'Hind Siliguri', sans-serif;
}
.offer-btn:hover { transform: scale(1.02); }
.sim-section {
  margin-top: 40px;
}
.sim-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid var(--border);
}
.sim-header img {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--purple);
}
.sim-header h3 {
  font-size: 1.8em;
  font-weight: 700;
}
.sim-header p {
  color: var(--text-muted);
}
.footer {
  position: relative;
  z-index: 1;
  background: var(--card-bg);
  padding: 50px 20px 30px;
  text-align: center;
  border-top: 1px solid var(--border);
}
.footer-grid {
  max-width: 1000px;
  margin: 0 auto 30px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 30px;
  text-align: left;
}
.footer h4 {
  color: var(--purple);
  margin-bottom: 12px;
}
.footer p, .footer a {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9em;
  line-height: 2;
}
.footer a:hover { color: white; }
.footer-bottom {
  padding-top: 20px;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.85em;
}
.chat-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999;
}
.chat-bubble {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  cursor: pointer;
  background: var(--gradient-1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5em;
  box-shadow: 0 8px 25px rgba(108,92,231,0.4);
  transition: 0.3s;
  animation: bounce 3s infinite;
}
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.chat-bubble:hover { transform: scale(1.1); }
.chat-box {
  display: none;
  position: fixed;
  bottom: 100px;
  right: 24px;
  width: 370px;
  height: 500px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  flex-direction: column;
  overflow: hidden;
  z-index: 999;
  box-shadow: var(--shadow);
}
.chat-box.open { display: flex; }
.chat-head {
  background: var(--gradient-1);
  color: white;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}
.chat-head button {
  background: none;
  border: none;
  color: white;
  font-size: 1.3em;
  cursor: pointer;
}
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg);
}
.chat-login {
  padding: 30px;
  text-align: center;
}
.chat-login input {
  width: 100%;
  padding: 12px 16px;
  margin-bottom: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card-bg);
  color: white;
  font-size: 0.9em;
  font-family: 'Hind Siliguri', sans-serif;
  outline: none;
}
.chat-login input:focus { border-color: var(--purple); }
.chat-login button {
  width: 100%;
  padding: 12px;
  background: var(--gradient-1);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  font-family: 'Hind Siliguri', sans-serif;
}
.chat-input-row {
  padding: 14px;
  background: var(--card-bg);
  border-top: 1px solid var(--border);
  display: none;
}
.chat-input-row div {
  display: flex;
  gap: 8px;
}
.chat-input-row input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--bg);
  color: white;
  font-family: 'Hind Siliguri', sans-serif;
  outline: none;
}
.chat-input-row button {
  background: var(--gradient-1);
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.1em;
}
.msg {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 15px;
  margin-bottom: 8px;
  font-size: 0.9em;
  word-wrap: break-word;
}
.msg.user {
  background: var(--gradient-1);
  color: white;
  margin-left: auto;
  border-bottom-right-radius: 4px;
}
.msg.admin {
  background: var(--card-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-bottom-left-radius: 4px;
}
.msg .time {
  font-size: 0.7em;
  opacity: 0.7;
  margin-top: 4px;
  text-align: right;
}
.back-to-top {
  position: fixed;
  bottom: 24px;
  left: 24px;
  z-index: 998;
  width: 45px;
  height: 45px;
  border-radius: 50%;
  background: var(--card-bg);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  display: none;
  font-size: 1.2em;
  transition: 0.3s;
}
.back-to-top:hover { background: var(--purple); }
@media(max-width: 768px) {
  .hero h1 { font-size: 2em; }
  .offers-grid { grid-template-columns: 1fr; }
  .chat-box { width: 100%; height: 100%; bottom: 0; right: 0; border-radius: 0; }
  .nav-links { gap: 10px; }
  .nav-links a { font-size: 0.85em; }
}
</style>
</head>
<body>
<div class="particles" id="particles"></div>
<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="logo">SIM Offers</a>
    <div class="nav-links">
      <a href="#banglalink">Banglalink</a>
      <a href="#grameenphone">Grameenphone</a>
      <a href="#robi">Robi</a>
      <a href="#airtel">Airtel</a>
      <a href="/messenger" class="chat-btn">Support</a>
    </div>
  </div>
</nav>
<section class="hero">
  <div class="hero-badge">Best Deals of 2024</div>
  <h1>All SIM Operators Best Offers in One Place</h1>
  <p>Find the best internet, voice & combo packages from Banglalink, Grameenphone, Robi & Airtel. Compare and save more!</p>
  <div class="sim-tabs">
    <button class="sim-tab active" onclick="scrollToSim('featured')">Featured</button>
    <button class="sim-tab" onclick="scrollToSim('banglalink')"><img src="${simImages.banglalink}" onerror="this.style.display='none'"> Banglalink</button>
    <button class="sim-tab" onclick="scrollToSim('grameenphone')"><img src="${simImages.grameenphone}" onerror="this.style.display='none'"> GP</button>
    <button class="sim-tab" onclick="scrollToSim('robi')"><img src="${simImages.robi}" onerror="this.style.display='none'"> Robi</button>
    <button class="sim-tab" onclick="scrollToSim('airtel')"><img src="${simImages.airtel}" onerror="this.style.display='none'"> Airtel</button>
  </div>
</section>
<section class="section" id="featured">
  <div class="container">
    <h2 class="section-title">Featured Offers</h2>
    <p class="section-subtitle">Most popular packages chosen by our users</p>
    <div class="offers-grid">
      ${featuredOffers.map(o => renderOfferCard(o, true)).join('')}
    </div>
  </div>
</section>
<section class="section sim-section" id="banglalink">
  <div class="container">
    <div class="sim-header">
      <img src="${simImages.banglalink}" alt="Banglalink" onerror="this.style.display='none'">
      <div>
        <h3>Banglalink Offers</h3>
        <p>Best Banglalink internet & combo packages</p>
      </div>
    </div>
    <div class="offers-grid">
      ${banglalinkOffers.map(o => renderOfferCard(o)).join('')}
    </div>
  </div>
</section>
<section class="section sim-section" id="grameenphone">
  <div class="container">
    <div class="sim-header">
      <img src="${simImages.grameenphone}" alt="Grameenphone" onerror="this.style.display='none'">
      <div>
        <h3>Grameenphone Offers</h3>
        <p>Latest GP internet, voice & bundle packs</p>
      </div>
    </div>
    <div class="offers-grid">
      ${gpOffers.map(o => renderOfferCard(o)).join('')}
    </div>
  </div>
</section>
<section class="section sim-section" id="robi">
  <div class="container">
    <div class="sim-header">
      <img src="${simImages.robi}" alt="Robi" onerror="this.style.display='none'">
      <div>
        <h3>Robi Offers</h3>
        <p>Robi & Airtel combined best deals</p>
      </div>
    </div>
    <div class="offers-grid">
      ${robiOffers.map(o => renderOfferCard(o)).join('')}
    </div>
  </div>
</section>
<section class="section sim-section" id="airtel">
  <div class="container">
    <div class="sim-header">
      <img src="${simImages.airtel}" alt="Airtel" onerror="this.style.display='none'">
      <div>
        <h3>Airtel Offers</h3>
        <p>Exclusive Airtel packages for you</p>
      </div>
    </div>
    <div class="offers-grid">
      ${airtelOffers.map(o => renderOfferCard(o)).join('')}
    </div>
  </div>
</section>
<footer class="footer">
  <div class="footer-grid">
    <div>
      <h4>About Us</h4>
      <p>SIM Offers BD is your one-stop destination for all telecom operator offers in Bangladesh. We compare and show the best deals from all operators.</p>
    </div>
    <div>
      <h4>Quick Links</h4>
      <p><a href="#banglalink">Banglalink Offers</a></p>
      <p><a href="#grameenphone">GP Offers</a></p>
      <p><a href="#robi">Robi Offers</a></p>
      <p><a href="#airtel">Airtel Offers</a></p>
    </div>
    <div>
      <h4>Contact</h4>
      <p>Use the chat button for support</p>
      <p>Email: support@simoffersbd.com</p>
    </div>
  </div>
  <div class="footer-bottom">
    <p>2024 SIM Offers BD. All rights reserved. | Not affiliated with any operator.</p>
  </div>
</footer>
<div class="chat-widget">
  <div class="chat-bubble" onclick="openChat()">💬</div>
</div>
<div class="chat-box" id="chatBox">
  <div class="chat-head">Live Support <button onclick="closeChat()">✕</button></div>
  <div class="chat-body" id="chatBody">
    <div class="chat-login" id="chatLogin">
      <h4 style="margin-bottom:16px;color:var(--text)">Get Help</h4>
      <input type="text" id="chatName" placeholder="Your Name">
      <input type="text" id="chatEmail" placeholder="Email or Phone">
      <button onclick="startChat()">Start Chatting</button>
    </div>
  </div>
  <div class="chat-input-row" id="chatInput">
    <div>
      <input type="text" id="chatMsg" placeholder="Type message..." onkeypress="if(event.key==='Enter')sendMsg()">
      <button onclick="sendMsg()">➤</button>
    </div>
  </div>
</div>
<button class="back-to-top" id="backToTop" onclick="window.scrollTo({top:0,behavior:'smooth'})">⬆</button>
<script src="/socket.io/socket.io.js"></script>
<script>
(function(){
  const pContainer = document.getElementById('particles');
  for(let i=0;i<30;i++){
    const p = document.createElement('div');
    p.className='particle';
    const size=Math.random()*4+2;
    p.style.width=size+'px';
    p.style.height=size+'px';
    p.style.left=Math.random()*100+'%';
    p.style.animationDuration=(Math.random()*10+10)+'s';
    p.style.animationDelay=Math.random()*10+'s';
    p.style.background='hsl('+Math.random()*360+',70%,60%)';
    pContainer.appendChild(p);
  }
})();
function scrollToSim(id){
  const el=document.getElementById(id);
  if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
}
window.addEventListener('scroll',()=>{
  document.getElementById('backToTop').style.display=window.scrollY>500?'flex':'none';
});
const socket=io();let cu=null;
function openChat(){document.getElementById('chatBox').classList.add('open')}
function closeChat(){document.getElementById('chatBox').classList.remove('open')}
function startChat(){
  const n=document.getElementById('chatName').value.trim();
  const e=document.getElementById('chatEmail').value.trim();
  if(!n||!e)return;
  cu={name:n,email:e};
  socket.emit('register',{name:n,email:e});
  document.getElementById('chatLogin').style.display='none';
  document.getElementById('chatInput').style.display='block';
  loadMsgs();
}
async function loadMsgs(){
  if(!cu)return;
  const r=await fetch('/api/msgs/'+cu.email);
  const ms=await r.json();
  const b=document.getElementById('chatBody');
  b.innerHTML=ms.map(m=>'<div class="msg '+(m.sender===cu.email?'user':'admin')+'">'+m.message+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>').join('');
  b.scrollTop=b.scrollHeight;
}
function sendMsg(){
  const i=document.getElementById('chatMsg');
  const m=i.value.trim();
  if(!m||!cu)return;
  socket.emit('sendMsg',{sender:cu.email,receiver:'admin',message:m,type:'text'});
  i.value='';
}
socket.on('newMsg',(m)=>{
  if(cu&&(m.sender===cu.email||m.receiver===cu.email)){
    const b=document.getElementById('chatBody');
    b.insertAdjacentHTML('beforeend','<div class="msg '+(m.sender===cu.email?'user':'admin')+'">'+m.message+'<div class="time">'+new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</div></div>');
    b.scrollTop=b.scrollHeight;
  }
});
</script>
</body>
</html>`);
});

app.get('/api/offers', (req, res) => {
  try {
    const { sim, category } = req.query;
    let query = 'SELECT * FROM offers WHERE active = 1';
    const params = [];
    if (sim) { query += ' AND sim = ?'; params.push(sim); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    query += ' ORDER BY featured DESC, createdAt DESC';
    const offers = db.prepare(query).all(...params);
    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

app.get('/api/msgs/:email', (req, res) => {
  try {
    const msgs = db.prepare(`
      SELECT * FROM messages 
      WHERE (sender = ? AND receiver = 'admin@simoffers.com') 
         OR (sender = 'admin@simoffers.com' AND receiver = ?)
      ORDER BY timestamp ASC
    `).all(req.params.email, req.params.email);
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND isAdmin = 1').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ token: 'ok', message: 'Login successful' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/users', (req, res) => {
  try {
    const users = db.prepare('SELECT * FROM users WHERE isAdmin = 0 ORDER BY lastSeen DESC').all();
    for (let u of users) {
      u.unreadCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE sender = ? AND receiver = 'admin@simoffers.com' AND seen = 0").get(u.email).count;
    }
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/messenger', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Messenger | SIM Offers BD</title>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Hind Siliguri',sans-serif;background:#0F0F23;height:100vh;overflow:hidden;color:#E8E8F0}
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px)}
.login-card{background:#1A1A3E;padding:40px;border-radius:20px;width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);animation:slideUp 0.3s ease;border:1px solid #2A2A4A}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.login-card .logo{width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#6C5CE7,#FF6B6B);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#fff;font-size:1.5em;font-weight:700}
.login-card h2{margin-bottom:6px;font-size:1.5em;color:#E8E8F0}
.login-card .subtitle{color:#A0A0B8;font-size:0.9em;margin-bottom:24px}
.input-group{margin-bottom:14px;text-align:left}
.input-group label{display:block;font-size:0.85em;font-weight:600;color:#A0A0B8;margin-bottom:4px}
.input-group input{width:100%;padding:12px 16px;border:1.5px solid #2A2A4A;border-radius:12px;font-size:0.95em;outline:none;transition:0.2s;font-family:'Hind Siliguri',sans-serif;background:#0F0F23;color:#E8E8F0}
.input-group input:focus{border-color:#6C5CE7;box-shadow:0 0 0 3px rgba(108,92,231,0.2)}
.login-card button{width:100%;padding:12px;background:linear-gradient(135deg,#6C5CE7,#FF6B6B);color:#fff;border:none;border-radius:12px;font-weight:600;cursor:pointer;font-size:1em;font-family:'Hind Siliguri',sans-serif}
.login-card button:disabled{opacity:0.7}
.login-error{color:#FF6B6B;font-size:0.85em;margin-top:10px;display:none}
.spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-radius:50%;border-top-color:#fff;animation:spin 0.6s linear infinite;margin-right:6px;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
.app{display:none;height:100vh}
.app-layout{display:flex;height:100vh;max-width:1400px;margin:0 auto;background:#1A1A3E;box-shadow:0 0 40px rgba(0,0,0,0.3)}
.sidebar{width:360px;border-right:1px solid #2A2A4A;display:flex;flex-direction:column;background:#1A1A3E}
.sidebar-header{padding:16px 20px;border-bottom:1px solid #2A2A4A;display:flex;justify-content:space-between;align-items:center}
.sidebar-header h2{font-size:1.2em;color:#E8E8F0}
.logout-btn{background:rgba(255,107,107,0.2);color:#FF6B6B;border:none;padding:7px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85em;font-family:'Hind Siliguri',sans-serif}
.logout-btn:hover{background:rgba(255,107,107,0.3)}
.search-bar{padding:12px 16px;border-bottom:1px solid #2A2A4A}
.search-bar input{width:100%;padding:10px 16px;border:1.5px solid #2A2A4A;border-radius:24px;font-size:0.9em;outline:none;background:#0F0F23;color:#E8E8F0;font-family:'Hind Siliguri',sans-serif}
.search-bar input:focus{border-color:#6C5CE7}
.user-list{flex:1;overflow-y:auto}
.user-list::-webkit-scrollbar{width:4px}
.user-list::-webkit-scrollbar-thumb{background:#2A2A4A;border-radius:2px}
.user-item{padding:14px 20px;display:flex;align-items:center;gap:12px;cursor:pointer;border-bottom:1px solid #2A2A4A;transition:0.15s}
.user-item:hover{background:#0F0F23}
.user-item.active{background:rgba(108,92,231,0.1);border-left:3px solid #6C5CE7}
.user-avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#6C5CE7,#FF6B6B);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1em;flex-shrink:0;position:relative}
.user-avatar .dot{position:absolute;bottom:2px;right:2px;width:10px;height:10px;border-radius:50%;background:#2ED573;border:2px solid #1A1A3E}
.user-info{flex:1;min-width:0}
.user-info .name{font-weight:600;font-size:0.9em;color:#E8E8F0}
.user-info .email{font-size:0.78em;color:#A0A0B8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.unread{background:#FF6B6B;color:#fff;font-size:0.7em;padding:3px 8px;border-radius:10px;font-weight:700;flex-shrink:0}
.empty-state{text-align:center;padding:40px 20px;color:#A0A0B8}
.empty-state .empty-icon{font-size:2em;margin-bottom:8px}
.chat-area{flex:1;display:flex;flex-direction:column;background:#0F0F23}
.chat-header{padding:16px 24px;background:#1A1A3E;border-bottom:1px solid #2A2A4A;display:flex;align-items:center;gap:12px}
.chat-avatar{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#6C5CE7,#FF6B6B);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.95em}
.chat-name{font-weight:600;font-size:1em;color:#E8E8F0}
.chat-status{font-size:0.8em;display:flex;align-items:center;gap:4px}
.online-dot{width:7px;height:7px;border-radius:50%;background:#2ED573;display:inline-block}
.offline-dot{width:7px;height:7px;border-radius:50%;background:#A0A0B8;display:inline-block}
.chat-messages{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:2px}
.chat-messages::-webkit-scrollbar{width:4px}
.chat-messages::-webkit-scrollbar-thumb{background:#2A2A4A;border-radius:2px}
.message{max-width:65%;padding:10px 16px;border-radius:18px;font-size:0.9em;line-height:1.5;word-wrap:break-word;animation:fadeIn 0.2s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.message.sent{background:linear-gradient(135deg,#6C5CE7,#FF6B6B);color:#fff;align-self:flex-end;border-bottom-right-radius:4px;margin-left:auto}
.message.received{background:#1A1A3E;color:#E8E8F0;border:1px solid #2A2A4A;align-self:flex-start;border-bottom-left-radius:4px}
.message .time{font-size:0.65em;opacity:0.7;margin-top:4px;text-align:right}
.date-divider{text-align:center;margin:16px 0;font-size:0.75em}
.date-divider span{background:#2A2A4A;color:#A0A0B8;padding:4px 12px;border-radius:10px}
.chat-input{padding:14px 24px;background:#1A1A3E;border-top:1px solid #2A2A4A;display:none;gap:10px;align-items:center}
.chat-input input{flex:1;padding:10px 18px;border:1.5px solid #2A2A4A;border-radius:24px;font-size:0.9em;outline:none;font-family:'Hind Siliguri',sans-serif;background:#0F0F23;color:#E8E8F0}
.chat-input input:focus{border-color:#6C5CE7}
.chat-input button{background:linear-gradient(135deg,#6C5CE7,#FF6B6B);color:#fff;border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.1em}
@media(max-width:768px){
  .sidebar{width:100%;display:none}
  .sidebar.mobile-show{display:flex}
  .chat-area{width:100%}
  .login-card{width:90%;padding:30px}
}
</style>
</head>
<body>
<div class="login-overlay" id="loginOverlay">
  <div class="login-card">
    <div class="logo">SO</div>
    <h2>Admin Messenger</h2>
    <p class="subtitle">SIM Offers BD Support Panel</p>
    <div class="input-group"><label>Email</label><input type="email" id="loginEmail" placeholder="admin@simoffers.com"></div>
    <div class="input-group"><label>Password</label><input type="password" id="loginPassword" placeholder="Enter password"></div>
    <button id="loginBtn" onclick="ChatAdmin.login()">Sign In</button>
    <div class="login-error" id="loginError"></div>
  </div>
</div>
<div class="app" id="app">
  <div class="app-layout">
    <div class="sidebar" id="sidebar">
      <div class="sidebar-header"><h2>Conversations</h2><button class="logout-btn" onclick="ChatAdmin.logout()">Logout</button></div>
      <div class="search-bar"><input type="text" id="searchInput" placeholder="Search users..." oninput="ChatAdmin.filterUsers()"></div>
      <div class="user-list" id="userList"><div class="empty-state"><div class="empty-icon">📭</div><p>No conversations</p></div></div>
    </div>
    <div class="chat-area">
      <div class="chat-header">
        <div class="chat-avatar" id="chatAvatar">?</div>
        <div><div class="chat-name" id="chatName">Select a user</div><div class="chat-status" id="chatStatus"></div></div>
      </div>
      <div class="chat-messages" id="chatMessages"><div class="empty-state"><div class="empty-icon">💬</div><p>Select a conversation</p></div></div>
      <div class="chat-input" id="chatInputArea">
        <input type="text" id="msgInput" placeholder="Type your message..." onkeypress="if(event.key==='Enter')ChatAdmin.sendMessage()">
        <button onclick="ChatAdmin.sendMessage()">➤</button>
      </div>
    </div>
  </div>
</div>
<script src="/socket.io/socket.io.js"></script>
<script>
const ChatAdmin={socket:null,currentUser:null,users:[],messages:[],isLoggedIn:false,init(){this.socket=io();this.socket.on('newMsg',(msg)=>{if(this.currentUser&&((msg.sender===this.currentUser.email&&msg.receiver==='admin@simoffers.com')||(msg.sender==='admin@simoffers.com'&&msg.receiver===this.currentUser.email))){this.messages.push(msg);this.renderMessages();this.markAsRead()}this.loadUsers()});this.socket.on('userStatus',(data)=>{this.updateUserStatus(data.email,data.online)});const s=localStorage.getItem('adminSession');if(s){const session=JSON.parse(s);document.getElementById('loginEmail').value=session.email;document.getElementById('loginPassword').value=session.password;this.login(!0)}},async login(a){const e=document.getElementById('loginEmail').value.trim(),p=document.getElementById('loginPassword').value.trim(),d=document.getElementById('loginError'),b=document.getElementById('loginBtn');if(!e||!p){d.textContent='Please fill all fields';d.style.display='block';return}b.disabled=!0;b.innerHTML='<span class="spinner"></span> Signing in...';d.style.display='none';try{const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})}),data=await r.json();r.ok?(this.isLoggedIn=!0,document.getElementById('loginOverlay').style.display='none',document.getElementById('app').style.display='block',localStorage.setItem('adminSession',JSON.stringify({email:e,password:p})),await this.loadUsers()):(d.textContent=data.error||'Login failed',d.style.display='block',localStorage.removeItem('adminSession'))}catch(er){d.textContent='Network error';d.style.display='block'}finally{b.disabled=!1;b.innerHTML='Sign In'}},async loadUsers(){if(!this.isLoggedIn)return;try{const r=await fetch('/api/admin/users');this.users=await r.json();this.renderUserList()}catch(e){}},async selectUser(u){this.currentUser=u;document.getElementById('chatAvatar').textContent=u.name.charAt(0).toUpperCase();document.getElementById('chatName').textContent=u.name;document.getElementById('chatStatus').innerHTML=u.isOnline?'<span class="online-dot"></span> Online':'<span class="offline-dot"></span> Offline';document.getElementById('chatInputArea').style.display='flex';document.querySelectorAll('.user-item').forEach(i=>{i.classList.remove('active');if(i.dataset.email===u.email)i.classList.add('active')});await this.loadMessages();await this.markAsRead()},async loadMessages(){if(!this.currentUser)return;try{const r=await fetch('/api/msgs/'+this.currentUser.email),ms=await r.json();this.messages=ms.filter(m=>(m.sender===this.currentUser.email&&m.receiver==='admin@simoffers.com')||(m.sender==='admin@simoffers.com'&&m.receiver===this.currentUser.email));this.renderMessages()}catch(e){}},renderMessages(){const c=document.getElementById('chatMessages');if(this.messages.length===0){c.innerHTML='<div class="empty-state"><div class="empty-icon">💬</div><p>No messages yet</p></div>';return}let h='',ld='';this.messages.forEach(m=>{const d=new Date(m.timestamp).toLocaleDateString();if(d!==ld){h+='<div class="date-divider"><span>'+d+'</span></div>';ld=d}const sa=m.sender==='admin@simoffers.com',t=new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});h+='<div class="message '+(sa?'sent':'received')+'">'+m.message+'<div class="time">'+t+(sa?' ✓':'')+'</div></div>'});c.innerHTML=h;c.scrollTop=c.scrollHeight},async sendMessage(){const i=document.getElementById('msgInput'),m=i.value.trim();if(!m||!this.currentUser)return;this.socket.emit('sendMsg',{sender:'admin@simoffers.com',receiver:this.currentUser.email,message:m,type:'text'});this.messages.push({sender:'admin@simoffers.com',receiver:this.currentUser.email,message:m,type:'text',timestamp:new Date()});this.renderMessages();i.value='';i.focus();setTimeout(()=>this.loadUsers(),500)},async markAsRead(){if(!this.currentUser)return;this.socket.emit('markRead',{user:this.currentUser.email});this.loadUsers()},updateUserStatus(e,o){const el=document.querySelector('.user-item[data-email="'+e+'"]');if(el){const d=el.querySelector('.dot');if(d)d.style.background=o?'#2ED573':'#A0A0B8'}if(this.currentUser&&this.currentUser.email===e)document.getElementById('chatStatus').innerHTML=o?'<span class="online-dot"></span> Online':'<span class="offline-dot"></span> Offline'},renderUserList(){const c=document.getElementById('userList'),s=document.getElementById('searchInput')?.value?.toLowerCase()||'',f=this.users.filter(u=>u.name.toLowerCase().includes(s)||u.email.toLowerCase().includes(s));if(f.length===0){c.innerHTML='<div class="empty-state"><div class="empty-icon">📭</div><p>No conversations found</p></div>';return}c.innerHTML=f.map(u=>{const ls=u.lastSeen?new Date(u.lastSeen):null,ta=ls?this.getTimeAgo(ls):'',act=this.currentUser&&this.currentUser.email===u.email;return'<div class="user-item'+(act?' active':'')+'" data-email="'+u.email+'" onclick="ChatAdmin.selectUserById(\''+u.email+'\')"><div class="user-avatar">'+u.name.charAt(0).toUpperCase()+'<div class="dot" style="background:'+(u.isOnline?'#2ED573':'#A0A0B8')+'"></div></div><div class="user-info"><div class="name">'+u.name+'</div><div class="email">'+u.email+'</div></div>'+(u.unreadCount>0?'<div class="unread">'+u.unreadCount+'</div>':'')+'<div class="user-time">'+ta+'</div></div>'}).join('')},selectUserById(e){const u=this.users.find(u=>u.email===e);if(u)this.selectUser(u)},filterUsers(){this.renderUserList()},getTimeAgo(d){const n=new Date(),diff=Math.floor((n-d)/1000);if(diff<60)return'now';if(diff<3600)return Math.floor(diff/60)+'m';if(diff<86400)return Math.floor(diff/3600)+'h';return Math.floor(diff/86400)+'d'},logout(){localStorage.removeItem('adminSession');location.reload()}};
document.addEventListener('DOMContentLoaded',()=>{ChatAdmin.init();document.getElementById('loginPassword').addEventListener('keypress',(e)=>{if(e.key==='Enter')ChatAdmin.login()})});
setInterval(()=>{if(ChatAdmin.isLoggedIn)ChatAdmin.loadUsers()},30000);
</script>
</body>
</html>`);
});

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  socket.on('register', async (data) => {
    try {
      socket.userData = data;
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email);
      if (!user) {
        const hash = await bcrypt.hash('default123', 10);
        db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(data.name, data.email, hash);
      }
      db.prepare("UPDATE users SET isOnline = 1, lastSeen = datetime('now') WHERE email = ?").run(data.email);
      io.emit('userStatus', { email: data.email, online: true });
    } catch (err) {
      console.error('Register error:', err.message);
    }
  });
  socket.on('sendMsg', (data) => {
    try {
      const result = db.prepare("INSERT INTO messages (sender, receiver, message, type) VALUES (?, ?, ?, ?)").run(data.sender, data.receiver, data.message, data.type || 'text');
      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      io.emit('newMsg', msg);
    } catch (err) {
      console.error('Send message error:', err.message);
    }
  });
  socket.on('markRead', (data) => {
    try {
      db.prepare("UPDATE messages SET seen = 1 WHERE sender = ? AND receiver = 'admin@simoffers.com' AND seen = 0").run(data.user);
    } catch (err) {
      console.error('Mark read error:', err.message);
    }
  });
  socket.on('disconnect', () => {
    if (socket.userData) {
      try {
        db.prepare("UPDATE users SET isOnline = 0, lastSeen = datetime('now') WHERE email = ?").run(socket.userData.email);
        io.emit('userStatus', { email: socket.userData.email, online: false });
      } catch (err) {
        console.error('Disconnect error:', err.message);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
  console.log('Admin panel: http://localhost:' + PORT + '/messenger');
  console.log('Admin Email: admin@simoffers.com');
  console.log('Admin Password: Admin@2024!');
});
