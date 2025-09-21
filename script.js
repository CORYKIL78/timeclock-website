const PIN = '1406';
const REQUIRED_ROLE = '1315346851616002158';
const GUILD_ID = '1310656642672627752';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1417260030851551273/KGKnWF3mwTt7mNWmC3OTAPWcWJSl1FnQ3-Ub-l1-xpk46tOsAYAtIhRTlti2qxjJSOds';
const LOA_LINK = 'https://dyno.gg/form/e4c75cbc';
const HANDBOOK_LINK = 'https://docs.google.com/document/d/1SB48S4SiuT9_npDhgU1FT_CxAjdKGn40IpqUQKm2Nek/edit?usp=sharing';
const WORKER_URL = 'https://timeclock-proxy.marcusray.workers.dev';
const CLIENT_ID = '1417915896634277888'; // Replace with your numeric Discord Client ID (no 'Y')
const REDIRECT_URI = 'https://corykil78.github.io/timeclock-website'; // Exact URL, no trailing slash

const screens = {
    pin: document.getElementById('pinScreen'),
    discord: document.getElementById('discordScreen'),
    searching: document.getElementById('searchingScreen'),
    roles: document.getElementById('rolesScreen'),
    cherry: document.getElementById('cherryScreen'),
    confirm: document.getElementById('confirmScreen'),
    clocking: document.getElementById('clockingScreen'),
    main: document.getElementById('mainScreen'),
    myRoles: document.getElementById('rolesScreen'),
    tasks: document.getElementById('tasksScreen'),
    goodbye: document.getElementById('goodbyeScreen')
};

function showScreen(screenId) {
    console.log(`Showing screen: ${screenId}`);
    Object.values(screens).forEach(s => s && s.classList.remove('active'));
    if (screens[screenId]) screens[screenId].classList.add('active');
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
    }).catch(e => console.error('Webhook error:', e));
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
let currentTasks = [];

function loadTasks() {
    const savedTasks = localStorage.getItem(`tasks_${currentUser.id}`);
    currentTasks = savedTasks ? JSON.parse(savedTasks) : [];
    renderTasks();
}

function saveTasks() {
    localStorage.setItem(`tasks_${currentUser.id}`, JSON.stringify(currentTasks));
}

function renderTasks() {
    const list = document.getElementById('tasksList');
    if (!list) return;
    list.innerHTML = '';
    currentTasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <span>${task.text}</span>
        `;
        const checkbox = li.querySelector('.task-checkbox');
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                li.classList.add('completed');
                setTimeout(() => {
                    currentTasks.splice(index, 1);
                    saveTasks();
                    renderTasks();
                }, 5000);
            } else {
                li.classList.remove('completed');
                task.completed = false;
                saveTasks();
            }
        });
        if (task.completed) {
            li.classList.add('completed');
            setTimeout(() => {
                currentTasks.splice(index, 1);
                saveTasks();
                renderTasks();
            }, 5000);
        }
        list.appendChild(li);
    });
}

// PIN Submit
document.getElementById('submitPin').addEventListener('click', () => {
    if (document.getElementById('pinInput').value === PIN) {
        showScreen('discord');
    } else {
        alert('Invalid PIN');
    }
});

// Discord Login
const discordBtn = document.getElementById('discordLoginBtn');
if (discordBtn) {
    discordBtn.addEventListener('click', () => {
        console.log('Discord login button clicked');
        const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
        console.log('Redirecting to:', oauthUrl);
        console.log('Using redirect_uri:', REDIRECT_URI); // Debug URI
        window.location.href = oauthUrl;
    });
} else {
    console.error('Discord login button not found');
}

// Handle OAuth2 Redirect
async function handleOAuthRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (!code) {
        console.log('No OAuth code in URL');
        return;
    }

    showScreen('searching');
    await new Promise(r => setTimeout(r, 1000));

    let user;
    try {
        console.log(`Authenticating with code: ${code}`);
        console.log('Using redirect_uri for Worker:', REDIRECT_URI); // Debug URI
        const response = await fetch(`${WORKER_URL}/auth?code=${code}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors'
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
            alert(`Authentication failed: ${errorMsg}. Check console for details.`);
            throw new Error(errorMsg);
        }
        user = await response.json();
        console.log('User data:', user);
        window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {
        console.error('Auth error:', e, { url: `${WORKER_URL}/auth?code=${code}` });
        alert(`Failed to authenticate: ${e.message || 'Network error - check console'}`);
        showScreen('discord');
        return;
    }

    showScreen('roles');
    await new Promise(r => setTimeout(r, 1000));

    let member;
    try {
        console.log(`Fetching member: ${WORKER_URL}/member/${user.id}`);
        const response = await fetch(`${WORKER_URL}/member/${user.id}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors'
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
            alert(`Member fetch failed: ${errorMsg}. Check console for details.`);
            throw new Error(errorMsg);
        }
        member = await response.json();
        console.log('Member data:', member);
    } catch (e) {
        console.error('Member fetch error:', e, { url: `${WORKER_URL}/member/${user.id}` });
        alert(`Failed to fetch member: ${e.message || 'Network error - check console'}`);
        showScreen('discord');
        return;
    }

    if (!member.roles.includes(REQUIRED_ROLE)) {
        alert('User does not have the required role');
        showScreen('discord');
        return;
    }

    showScreen('cherry');
    await new Promise(r => setTimeout(r, 1000));

    currentUser = {
        id: user.id,
        name: user.global_name || user.username,
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : '',
        roles: member.roles
    };

    document.getElementById('profilePic').src = currentUser.avatar;
    document.getElementById('confirmName').textContent = currentUser.name;
    document.getElementById('confirmRole').textContent = 'Verified Role: Staff Member';
    showScreen('confirm');
}

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
        loadTasks();
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

// My Roles Button
document.getElementById('myRolesBtn').addEventListener('click', () => {
    const list = document.getElementById('rolesList');
    list.innerHTML = '';
    currentUser.roles.forEach(roleId => {
        const li = document.createElement('li');
        li.textContent = `Role ID: ${roleId}`;
        list.appendChild(li);
    });
    showScreen('myRoles');
});

// Back from Roles
document.getElementById('backToMainRoles').addEventListener('click', () => showScreen('main'));

// My Tasks Button
document.getElementById('myTasksBtn').addEventListener('click', () => {
    loadTasks();
    showScreen('tasks');
});

// Add Task
document.getElementById('addTaskBtn').addEventListener('click', () => {
    const input = document.getElementById('taskInput');
    const text = input.value.trim();
    if (text) {
        currentTasks.push({ text, completed: false });
        saveTasks();
        renderTasks();
        input.value = '';
    }
});

// Enter on Task Input
document.getElementById('taskInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('addTaskBtn').click();
});

// Back from Tasks
document.getElementById('backToMainTasks').addEventListener('click', () => showScreen('main'));

// Other Buttons
document.getElementById('loaBtn').addEventListener('click', () => window.open(LOA_LINK, '_blank'));
document.getElementById('handbookBtn').addEventListener('click', () => window.open(HANDBOOK_LINK, '_blank'));

// Dark/Light Toggle
document.getElementById('modeToggle').addEventListener('change', (e) => {
    document.body.classList.toggle('dark', e.target.checked);
    localStorage.setItem('darkMode', e.target.checked);
});

// Load Session or Handle OAuth
window.addEventListener('load', () => {
    console.log('Page loaded, checking state');
    const savedUser = localStorage.getItem('currentUser');
    const savedTime = localStorage.getItem('clockInTime');
    const darkMode = localStorage.getItem('darkMode') === 'true';
    document.getElementById('modeToggle').checked = darkMode;
    document.body.classList.toggle('dark', darkMode);

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('code')) {
        console.log('OAuth code detected, handling redirect');
        handleOAuthRedirect();
    } else if (savedUser && savedTime) {
        console.log('Restoring saved session');
        currentUser = JSON.parse(savedUser);
        clockInTime = parseInt(savedTime);
        const now = Date.now();
        if (now - clockInTime > 24 * 60 * 60 * 1000) {
            sendWebhook(`💤 ${currentUser.name} has been auto clocked out (inactive).`);
            downloadTXT(currentUser, clockInTime, now);
            localStorage.clear();
            showScreen('pin');
        } else {
            updateMainScreen();
            showScreen('main');
            startAutoLogoutCheck();
            loadTasks();
        }
    } else {
        console.log('No session or code, showing PIN screen');
        showScreen('pin');
    }
});

function updateMainScreen() {
    document.getElementById('welcomeName').textContent = currentUser.name;
    document.getElementById('clockInTime').textContent = new Date(clockInTime).toLocaleString();
    document.getElementById('runningPeriod').textContent = formatTime(Date.now() - clockInTime);
    document.getElementById('mainProfilePic').src = currentUser.avatar;
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
    }, 60000);
}