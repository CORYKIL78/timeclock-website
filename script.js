const PIN = '1406';
const BOT_TOKEN = 'MTQxNzkxNTg5NjYzNDI3Nzg4OA.GMu4rv.T_Tru0HtZoaVbL57qxFDWb8rjR3Pj4OpaoaIvU';
const REQUIRED_ROLE = '1315346851616002158';
const GUILD_ID = '1310656642672627752';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1417260030851551273/KGKnWF3mwTt7mNWmC3OTAPWcWJSl1FnQ3-Ub-l1-xpk46tOsAYAtIhRTlti2qxjJSOds';
const LOA_LINK = 'https://dyno.gg/form/e4c75cbc';
const HANDBOOK_LINK = 'https://docs.google.com/document/d/1SB48S4SiuT9_npDhgU1FT_CxAjdKGn40IpqUQKm2Nek/edit?usp=sharing';

const screens = {
    pin: document.getElementById('pinScreen'),
    discord: document.getElementById('discordScreen'),
    searching: document.getElementById('searchingScreen'),
    roles: document.getElementById('rolesScreen'),
    cherry: document.getElementById('cherryScreen'),
    confirm: document.getElementById('confirmScreen'),
    clocking: document.getElementById('clockingScreen'),
    main: document.getElementById('mainScreen'),
    goodbye: document.getElementById('goodbyeScreen')
};

function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenId].classList.add('active');
}

function formatTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function sendWebhook(content) {
    fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    }).catch(console.error);
}

function downloadTXT(user, clockInTime, clockOutTime) {
    const duration = formatTime(clockOutTime - clockInTime);
    const inStr = new Date(clockInTime).toLocaleString();
    const outStr = new Date(clockOutTime).toLocaleString();
    const txt = `Clock in: ${inStr}\nClock out: ${outStr}\nRoaming period: ${duration}\nActions: Clocked in at ${inStr}, clocked out at ${outStr}`;
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeclock_${user.name.replace(/[^a-z0-9]/gi, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

let currentUser = null;
let clockInTime = null;

// PIN Submit
document.getElementById('submitPin').addEventListener('click', () => {
    if (document.getElementById('pinInput').value === PIN) {
        showScreen('discord');
    } else {
        alert('Invalid PIN');
    }
});

// Discord ID Submit
document.getElementById('submitDiscord').addEventListener('click', async () => {
    const id = document.getElementById('discordInput').value;
    if (!id) return alert('Enter ID');

    showScreen('searching');
    await new Promise(r => setTimeout(r, 1000));

    const headers = { Authorization: `Bot ${BOT_TOKEN}` };
    let user;
    try {
        user = await (await fetch(`https://discord.com/api/v10/users/${id}`, { headers })).json();
    } catch (e) {
        alert('User not found');
        showScreen('discord');
        return;
    }

    showScreen('roles');
    await new Promise(r => setTimeout(r, 1000));

    let member;
    try {
        member = await (await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${id}`, { headers })).json();
    } catch (e) {
        alert('Not in server');
        showScreen('discord');
        return;
    }

    if (!member.roles.includes(REQUIRED_ROLE)) {
        alert('Missing required role');
        showScreen('discord');
        return;
    }

    showScreen('cherry');
    await new Promise(r => setTimeout(r, 1000));

    currentUser = {
        id,
        name: user.global_name || user.username,
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${id}/${user.avatar}.png?size=128` : null
    };

    document.getElementById('profilePic').src = currentUser.avatar || '';
    document.getElementById('confirmName').textContent = currentUser.name;
    document.getElementById('confirmRole').textContent = 'Verified Role: Staff Member'; // Customize label as needed
    showScreen('confirm');
});

// Clock In
document.getElementById('clockInBtn').addEventListener('click', () => {
    clockInTime = Date.now();
    localStorage.setItem('clockInTime', clockInTime);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    sendWebhook(`☀️ ${currentUser.name} has clocked in!`);

    showScreen('clocking');
    setTimeout(() => {
        updateMainScreen();
        showScreen('main');
        startAutoLogoutCheck();
    }, 2000);
});

// Clock Out
document.getElementById('clockOutBtn').addEventListener('click', () => {
    const clockOutTime = Date.now();
    sendWebhook(`💤 ${currentUser.name} has clocked out!`);
    downloadTXT(currentUser, clockInTime, clockOutTime);
    localStorage.clear();
    document.getElementById('goodbyeName').textContent = currentUser.name;
    showScreen('goodbye');
    clearInterval(autoLogoutInterval);
});

// Other Buttons
document.getElementById('loaBtn').addEventListener('click', () => window.open(LOA_LINK, '_blank'));
document.getElementById('handbookBtn').addEventListener('click', () => window.open(HANDBOOK_LINK, '_blank'));

// Dark/Light Toggle
document.getElementById('modeToggle').addEventListener('change', (e) => {
    document.body.classList.toggle('dark', e.target.checked);
    localStorage.setItem('darkMode', e.target.checked);
});

// Load Session on Start
window.addEventListener('load', () => {
    const savedUser = localStorage.getItem('currentUser');
    const savedTime = localStorage.getItem('clockInTime');
    const darkMode = localStorage.getItem('darkMode') === 'true';
    document.getElementById('modeToggle').checked = darkMode;
    document.body.classList.toggle('dark', darkMode);

    if (savedUser && savedTime) {
        currentUser = JSON.parse(savedUser);
        clockInTime = parseInt(savedTime);
        const now = Date.now();
        if (now - clockInTime > 24 * 60 * 60 * 1000) {
            // Auto clock out if >24h
            sendWebhook(`💤 ${currentUser.name} has been auto clocked out (inactive).`);
            downloadTXT(currentUser, clockInTime, now);
            localStorage.clear();
            showScreen('pin');
        } else {
            updateMainScreen();
            showScreen('main');
            startAutoLogoutCheck();
        }
    } else {
        showScreen('pin');
    }
});

function updateMainScreen() {
    document.getElementById('welcomeName').textContent = currentUser.name;
    document.getElementById('clockInTime').textContent = new Date(clockInTime).toLocaleString();
    const running = formatTime(Date.now() - clockInTime);
    document.getElementById('runningPeriod').textContent = running;
    setInterval(() => {
        if (currentUser) {
            document.getElementById('runningPeriod').textContent = formatTime(Date.now() - clockInTime);
        }
    }, 1000);
}

let autoLogoutInterval;
function startAutoLogoutCheck() {
    autoLogoutInterval = setInterval(() => {
        if (Date.now() - clockInTime > 24 * 60 * 60 * 1000) {
            const clockOutTime = Date.now();
            sendWebhook(`💤 ${currentUser.name} has been auto clocked out (24h limit).`);
            downloadTXT(currentUser, clockInTime, clockOutTime);
            localStorage.clear();
            document.getElementById('goodbyeName').textContent = currentUser.name;
            showScreen('goodbye');
            clearInterval(autoLogoutInterval);
        }
    }, 60000); // Check every minute
}