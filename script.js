const REQUIRED_ROLE = '1315346851616002158';
const DEPT_ROLES = {
    'Development Department': '1315323804528017498',
    'Customer Relations Department': '1315042036969242704',
    'Careers Department': '1315065603178102794'
};
const GUILD_ID = '1310656642672627752';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1417260030851551273/KGKnWF3mwTt7mNWmC3OTAPWcWJSl1FnQ3-Ub-l1-xpk46tOsAYAtIhRTlti2qxjJSOds';
const WORKER_URL = 'https://timeclock-proxy.marcusray.workers.dev';
const CLIENT_ID = '1417915896634277888';
const REDIRECT_URI = 'https://portal.cirkledevelopment.co.uk';
const SUCCESS_SOUND_URL = 'https://cdn.pixabay.com/audio/2023/01/07/audio_cae2a6c2fc.mp3';
const NOTIFICATION_SOUND_URL = 'https://cdn.pixabay.com/audio/2025/09/02/audio_4e70a465f7.mp3';
const ABSENCE_CHANNEL = '1417583684525232291';
const TIMECLOCK_CHANNEL = '1417583684525232291';
const NOTIFICATION_CHANNEL = '1417583684525232291';
const ABSENCE_WEBHOOK_URL = 'https://discord.com/api/webhooks/1421968323738079305/kU7rh9EmHZr00oFcr_zuqFNQWUinmA2fRQpPhcpWL5KhTBeIaohyxsMOIM_Z8XtzvCoN';

const screens = {
    discord: document.getElementById('discordScreen'),
    searching: document.getElementById('searchingScreen'),
    roles: document.getElementById('rolesScreen'),
    cherry: document.getElementById('cherryScreen'),
    confirm: document.getElementById('confirmScreen'),
    setupWelcome: document.getElementById('setupWelcomeScreen'),
    setupEmail: document.getElementById('setupEmailScreen'),
    setupName: document.getElementById('setupNameScreen'),
    setupDepartment: document.getElementById('setupDepartmentScreen'),
    setupVerify: document.getElementById('setupVerifyScreen'),
    setupComplete: document.getElementById('setupCompleteScreen'),
    portalWelcome: document.getElementById('portalWelcomeScreen'),
    mainMenu: document.getElementById('mainMenuScreen'),
    myProfile: document.getElementById('myProfileScreen'),
    myRoles: document.getElementById('myRolesScreen'),
    tasks: document.getElementById('tasksScreen'),
    absences: document.getElementById('absencesScreen'),
    payslips: document.getElementById('payslipsScreen'),
    disciplinaries: document.getElementById('disciplinariesScreen'),
    timeclock: document.getElementById('timeclockScreen'),
    mail: document.getElementById('mailScreen'),
    goodbye: document.getElementById('goodbyeScreen')
};

const modals = {
    alert: document.getElementById('alertModal'),
    composeMail: document.getElementById('composeMailModal'),
    resetProfile: document.getElementById('resetProfileModal'),
    absenceRequest: document.getElementById('absenceRequestModal'),
    deptChange: document.getElementById('deptChangeModal'),
    viewMail: document.getElementById('viewMailModal'),
    replyMail: document.getElementById('replyMailModal'),
    absenceDetail: document.getElementById('absenceDetailModal'),
    confirmCancelAbsence: document.getElementById('confirmCancelAbsenceModal'),
    confirmDeleteAbsence: document.getElementById('confirmDeleteAbsenceModal')
};

let currentUser = null;
let clockInTime = null;
let currentTasks = [];
let employees = JSON.parse(localStorage.getItem('employees')) || [];
let isClockedIn = false;
let clockInActions = [];
let clockInInterval = null;
let previousSessions = [];
let roleNames = {};
let successAudio = null;
let notificationAudio = null;
let currentMail = null;
let currentNotifications = [];

function showScreen(screenId) {
    console.log('Showing screen:', screenId);
    Object.values(screens).forEach(s => {
        if (s) {
            s.classList.remove('active');
            s.style.opacity = '0';
        }
    });
    const targetScreen = screens[screenId];
    if (targetScreen) {
        targetScreen.classList.add('active');
        setTimeout(() => {
            targetScreen.style.opacity = '1';
        }, 10);
        window.location.hash = screenId;
        const sidebar = document.getElementById('sidebar');
        const notificationPanel = document.getElementById('notificationPanel');
        if (sidebar && notificationPanel) {
            if (screenId !== 'portalWelcome' && ['mainMenu', 'myProfile', 'myRoles', 'tasks', 'absences', 'payslips', 'disciplinaries', 'timeclock', 'mail'].includes(screenId)) {
                sidebar.classList.remove('hidden');
                notificationPanel.classList.remove('hidden');
            } else {
                sidebar.classList.add('hidden');
                notificationPanel.classList.add('hidden');
            }
        }
    } else {
        console.error('Screen not found:', screenId);
        showScreen('discord');
        showModal('alert', 'Screen not found. Returning to login.');
    }
}

function showModal(modalId, message = '') {
    console.log('Showing modal:', modalId, message);
    const modal = modals[modalId];
    if (modal) {
        if (modalId === 'alert' && message.includes('success-tick')) {
            modal.classList.add('success');
            playSuccessSound();
            setTimeout(() => closeModal(modalId), 2000);
        } else {
            modal.classList.remove('success');
        }
        if (modalId === 'alert') {
            const alertMessage = document.getElementById('alertMessage');
            if (alertMessage) alertMessage.innerHTML = message;
        }
        modal.style.display = 'flex';
    } else {
        console.error('Modal not found:', modalId);
    }
}

function closeModal(modalId) {
    console.log('Closing modal:', modalId);
    const modal = modals[modalId];
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('success');
    }
}

function preloadAudio() {
    if (!successAudio) {
        successAudio = new Audio(SUCCESS_SOUND_URL);
        successAudio.preload = 'auto';
        successAudio.load();
        successAudio.oncanplaythrough = () => console.log('Success sound loaded');
        successAudio.onerror = (e) => console.error('Success sound load error:', e);
    }
    if (!notificationAudio) {
        notificationAudio = new Audio(NOTIFICATION_SOUND_URL);
        notificationAudio.preload = 'auto';
        notificationAudio.load();
        notificationAudio.oncanplaythrough = () => console.log('Notification sound loaded');
        notificationAudio.onerror = (e) => console.error('Notification sound load error:', e);
    }
}

function playSuccessSound() {
    if (!successAudio) preloadAudio();
    successAudio.currentTime = 0;
    successAudio.play().catch(e => console.error('Success sound playback error:', e));
}

function playNotificationSound() {
    if (!notificationAudio) preloadAudio();
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(e => console.error('Notification sound playback error:', e));
}

function showMailDeliveryAnimation() {
    // ...existing code...
    // ...existing code...
    // Only declare clockOutBtn and set up its event listener once per scope
    let clockOutBtn = document.getElementById('clockOutBtn');
    if (clockOutBtn && !clockOutBtn.dataset.listener) {
        clockOutBtn.dataset.listener = 'true';
        clockOutBtn.addEventListener('click', async () => {
            if (!isClockedIn || !clockInTime) {
                showModal('alert', 'No active clock-in session');
                return;
            }
            const clockOutTime = Date.now();
            const emp = getEmployee(currentUser.id);
            clearInterval(clockInInterval);
            const session = downloadTXT(emp, clockInTime, clockOutTime, clockInActions);
            previousSessions.push(session);
            localStorage.setItem(`previousSessions_${currentUser.id}`, JSON.stringify(previousSessions));
            await sendWebhook(`<@${currentUser.id}> (${emp.profile.name}) clocked out at ${new Date().toLocaleString()}. Duration: ${session.duration}. Actions: ${session.actions || 'None'}`);
            isClockedIn = false;
            clockInTime = null;
            localStorage.removeItem('clockInTime');
            clockInActions = [];
            clockOutBtn.disabled = true;
            clockOutBtn.classList.add('hidden');
            const clockInBtn = document.getElementById('clockInBtn');
            if (clockInBtn) {
                clockInBtn.disabled = false;
                clockInBtn.classList.remove('hidden');
            }
            const sessionInfo = document.getElementById('sessionInfo');
            if (sessionInfo) {
                sessionInfo.classList.add('hidden');
                const clock = document.getElementById('sessionClock');
                if (clock) clock.textContent = '00:00:00';
            }
            showModal('alert', '<span class="success-tick"></span> Clocked out successfully!');
            playSuccessSound();
            addNotification('timeclock', `Clocked out at ${new Date().toLocaleString()}`, 'timeclock');
            renderPreviousSessions();
            clockInActions.push(`Clocked out at ${new Date().toLocaleString()}`);
        });
    }
    a.click();
    URL.revokeObjectURL(url);
    return { id: Date.now().toString(), clockIn: inStr, clockOut: outStr, duration, actions: actions.join(', ') };
}

function saveEmployees() {
    localStorage.setItem('employees', JSON.stringify(employees));
}

function getEmployee(id) {
    return employees.find(e => e.id === id) || {
        id,
        profile: { name: '', email: '', department: '', avatar: '' },
        absences: [],
        strikes: [],
        payslips: [],
        mail: [],
        sentMail: [],
        drafts: [],
        onLOA: false,
        pendingDeptChange: null,
        lastLogin: null,
        notifications: []
    };
}

function updateEmployee(employee) {
    const index = employees.findIndex(e => e.id === employee.id);
    if (index > -1) {
        employees[index] = employee;
    } else {
        employees.push(employee);
    }
    saveEmployees();
}

function resetEmployeeData(userId) {
    console.log('Resetting employee data for user:', userId);
    employees = employees.filter(e => e.id !== userId);
    localStorage.removeItem(`tasks_${userId}`);
    localStorage.removeItem(`notifications_${userId}`);
    localStorage.removeItem(`previousSessions_${userId}`);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('clockInTime');
    saveEmployees();
}

async function addNotification(type, message, link, userId = currentUser.id) {
    const emp = getEmployee(userId);
    emp.notifications = emp.notifications || [];
    const timestamp = new Date().toLocaleString();
    emp.notifications.push({ type, message, timestamp, read: false });
    updateEmployee(emp);
    await sendEmbed({
        title: `New Notification for ${emp.profile.name || 'User'}`,
        fields: [
            { name: 'Type', value: type.charAt(0).toUpperCase() + type.slice(1), inline: true },
            { name: 'User', value: `<@${userId}> (${emp.profile.name || 'User'})`, inline: true },
            { name: 'Message', value: message, inline: false },
            { name: 'Timestamp', value: timestamp, inline: true }
        ],
        color: 0x00ff00
    });
    playNotificationSound();
    renderNotifications();
}

function loadNotifications() {
    const emp = getEmployee(currentUser.id);
    currentNotifications = emp.notifications || [];
    renderNotifications();
}

function renderNotifications() {
    const list = document.getElementById('notificationList');
    if (!list) return;
    list.innerHTML = '';
    currentNotifications.forEach((n, index) => {
        const li = document.createElement('li');
        li.className = `notification-item ${n.read ? 'read' : ''}`;
        li.innerHTML = `
            <input type="checkbox" ${n.read ? 'checked' : ''}>
            <span>${n.message}</span>
            <span>${n.timestamp}</span>
        `;
        const checkbox = li.querySelector('input');
        if (checkbox && !checkbox.dataset.listener) {
            checkbox.dataset.listener = 'true';
            checkbox.addEventListener('change', () => {
                n.read = checkbox.checked;
                updateEmployee(getEmployee(currentUser.id));
                renderNotifications();
                clockInActions.push(`Marked notification "${n.message}" as ${n.read ? 'read' : 'unread'}`);
            });
        }
        list.appendChild(li);
    });
    if (currentNotifications.length && !currentNotifications.every(n => n.read)) {
        playNotificationSound();
    }
}

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
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <span>${task.text}</span>
        `;
        const checkbox = li.querySelector('.task-checkbox');
        if (checkbox && !checkbox.dataset.listener) {
            checkbox.dataset.listener = 'true';
            checkbox.addEventListener('change', () => {
                task.completed = checkbox.checked;
                if (task.completed) {
                    setTimeout(() => {
                        currentTasks.splice(index, 1);
                        saveTasks();
                        renderTasks();
                    }, 5000);
                }
                saveTasks();
                li.classList.toggle('completed', task.completed);
                clockInActions.push(`Task "${task.text}" ${task.completed ? 'completed' : 'uncompleted'}`);
            });
        }
        list.appendChild(li);
    });
}

function renderPreviousSessions() {
    const list = document.getElementById('previousSessions');
    if (!list) return;
    list.innerHTML = '';
    previousSessions = JSON.parse(localStorage.getItem(`previousSessions_${currentUser.id}`)) || [];
    previousSessions.forEach(session => {
        const div = document.createElement('div');
        div.className = 'session-item';
        div.innerHTML = `
            <p>Clock In: ${session.clockIn}</p>
            <p>Clock Out: ${session.clockOut}</p>
            <p>Duration: ${session.duration}</p>
            <p>Actions: ${session.actions || 'None'}</p>
            <a href="#" data-session-id="${session.id}">Download</a>
        `;
        const downloadLink = div.querySelector('a');
        if (downloadLink && !downloadLink.dataset.listener) {
            downloadLink.dataset.listener = 'true';
            downloadLink.addEventListener('click', (e) => {
                e.preventDefault();
                const txt = `Clock in: ${session.clockIn}\nClock out: ${session.clockOut}\nDuration: ${session.duration}\nActions: ${session.actions || 'None'}`;
                const blob = new Blob([txt], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `timeclock_${getEmployee(currentUser.id).profile.name.replace(/[^a-z0-9]/gi, '_')}_${session.clockIn.replace(/[^a-z0-9]/gi, '_')}.txt`;
                a.click();
                URL.revokeObjectURL(url);
                clockInActions.push(`Downloaded session: ${session.clockIn}`);
            });
        }
        list.appendChild(div);
    });
}

function updateSidebarProfile() {
    const emp = getEmployee(currentUser.id);
    const sidebarProfilePic = document.getElementById('sidebarProfilePic');
    if (sidebarProfilePic) {
        sidebarProfilePic.src = emp.profile.avatar || currentUser.avatar || 'https://via.placeholder.com/100';
    }
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
}

function updateMainScreen() {
    if (!currentUser) return;
    const emp = getEmployee(currentUser.id);
    const greeting = document.getElementById('greeting');
    const lastLogin = document.getElementById('lastLogin');
    const mainProfilePic = document.getElementById('mainProfilePic');
    const totalAbsences = document.getElementById('totalAbsences');
    const totalAbsenceDays = document.getElementById('totalAbsenceDays');
    const currentDepartment = document.getElementById('currentDepartment');
    if (greeting) greeting.textContent = `Good ${getGreeting()}, ${emp.profile.name || 'User'}!`;
    if (lastLogin) lastLogin.textContent = `Last Log In: ${emp.lastLogin || 'Never'}`;
    if (mainProfilePic) mainProfilePic.src = emp.profile.avatar || currentUser.avatar || 'https://via.placeholder.com/100';
    if (totalAbsences) totalAbsences.textContent = emp.absences.length;
    if (totalAbsenceDays) {
        const totalDays = emp.absences.reduce((sum, a) => {
            const start = new Date(a.startDate);
            const end = new Date(a.endDate);
            return end >= start ? sum + Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1 : sum;
        }, 0);
        totalAbsenceDays.textContent = totalDays;
    }
    if (currentDepartment) currentDepartment.textContent = emp.profile.department || 'N/A';
    if (emp.onLOA) {
        showModal('alert', 'You are currently on a Leave of Absence');
        const clockInBtn = document.getElementById('clockInBtn');
        const clockOutBtn = document.getElementById('clockOutBtn');
        if (clockInBtn) clockInBtn.disabled = true;
        if (clockOutBtn) clockOutBtn.disabled = true;
    } else {
        const clockInBtn = document.getElementById('clockInBtn');
        const clockOutBtn = document.getElementById('clockOutBtn');
        const sessionInfo = document.getElementById('sessionInfo');
        if (clockInBtn) {
            clockInBtn.disabled = isClockedIn;
            clockInBtn.classList.toggle('hidden', isClockedIn);
        }
        if (clockOutBtn) {
            clockOutBtn.disabled = !isClockedIn;
            clockOutBtn.classList.toggle('hidden', !isClockedIn);
        }
        if (sessionInfo) sessionInfo.classList.toggle('hidden', !isClockedIn);
    }
    loadNotifications();
    renderPreviousSessions();
}

async function fetchRoleNames() {
    try {
        const response = await fetch(`${WORKER_URL}/roles/${GUILD_ID}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors'
        });
        if (!response.ok) throw new Error(`Role fetch failed: ${response.status} ${await response.text()}`);
        const roles = await response.json();
        roleNames = roles.reduce((acc, role) => {
            acc[role.id] = role.name;
            return acc;
        }, {});
        console.log('Role names fetched:', roleNames);
    } catch (e) {
        console.error('Role fetch error:', e);
        showModal('alert', 'Failed to fetch roles. Please try again.');
    }
}

async function fetchEmployees() {
    try {
        const response = await fetch(`${WORKER_URL}/members/${GUILD_ID}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors'
        });
        if (!response.ok) throw new Error(`Members fetch failed: ${response.status} ${await response.text()}`);
        const members = await response.json();
        employees = members.map(member => {
            const existing = getEmployee(member.user.id);
            return {
                ...existing,
                id: member.user.id,
                avatar: member.user.avatar ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=128` : 'https://via.placeholder.com/40',
                roles: member.roles
            };
        });
        saveEmployees();
        console.log('Employees fetched:', employees);
    } catch (e) {
        console.error('Employees fetch error:', e);
        // No backend: suppress modal alert
    }
}

async function handleOAuthRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    console.log('OAuth callback received:', { code, error, url: window.location.href });

    if (error) {
        console.error('OAuth error:', urlParams.get('error_description') || 'Unknown error');
        showModal('alert', `OAuth error: ${urlParams.get('error_description') || 'Unknown error'}`);
        window.history.replaceState({}, document.title, REDIRECT_URI);
        showScreen('discord');
        return;
    }

    if (!code) {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                if (currentUser.id) {
                    console.log('Found valid session, redirecting to portalWelcome');
                    const emp = getEmployee(currentUser.id);
                    const portalWelcomeName = document.getElementById('portalWelcomeName');
                    const portalLastLogin = document.getElementById('portalLastLogin');
                    if (portalWelcomeName) portalWelcomeName.textContent = emp.profile.name || 'User';
                    if (portalLastLogin) portalLastLogin.textContent = emp.lastLogin || 'Never';
                    showScreen('portalWelcome');
                    updateSidebarProfile();
                    await fetchEmployees();
                    // Restore clock-in state
                    const savedClockInTime = localStorage.getItem('clockInTime');
                    if (savedClockInTime) {
                        clockInTime = parseInt(savedClockInTime, 10);
                        isClockedIn = true;
                        startClock();
                        updateMainScreen();
                    }
                    return;
                }
            } catch (e) {
                console.error('Error parsing saved user:', e);
                localStorage.removeItem('currentUser');
            }
        }
        showScreen('discord');
        return;
    }

    if (localStorage.getItem('lastProcessedCode') === code) {
        console.log('Code already processed, redirecting to portalWelcome');
        window.history.replaceState({}, document.title, REDIRECT_URI);
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                if (currentUser.id) {
                    const emp = getEmployee(currentUser.id);
                    const portalWelcomeName = document.getElementById('portalWelcomeName');
                    const portalLastLogin = document.getElementById('portalLastLogin');
                    if (portalWelcomeName) portalWelcomeName.textContent = emp.profile.name || 'User';
                    if (portalLastLogin) portalLastLogin.textContent = emp.lastLogin || 'Never';
                    showScreen('portalWelcome');
                    updateSidebarProfile();
                    await fetchEmployees();
                    // Restore clock-in state
                    const savedClockInTime = localStorage.getItem('clockInTime');
                    if (savedClockInTime) {
                        clockInTime = parseInt(savedClockInTime, 10);
                        isClockedIn = true;
                        startClock();
                        updateMainScreen();
                    }
                    return;
                }
            } catch (e) {
                console.error('Error parsing saved user:', e);
                localStorage.removeItem('currentUser');
            }
        }
        showScreen('discord');
        return;
    }

    localStorage.setItem('lastProcessedCode', code);
    showScreen('searching');
    await new Promise(r => setTimeout(r, 1000));

    let user;
    try {
        const authUrl = `${WORKER_URL}/auth?code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
        console.log('Fetching user data from Worker:', authUrl);
        const response = await fetch(authUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors'
        });
        if (!response.ok) throw new Error(`Auth failed: ${response.status} ${await response.text()}`);
        user = await response.json();
        console.log('User data received:', user);
    } catch (e) {
        console.error('Auth fetch error:', e);
        showModal('alert', `Failed to authenticate: ${e.message}. Please try again.`);
        localStorage.removeItem('lastProcessedCode');
        window.history.replaceState({}, document.title, REDIRECT_URI);
        showScreen('discord');
        return;
    }

    showScreen('roles');
    await new Promise(r => setTimeout(r, 1000));

    let member;
    try {
        console.log('Fetching member data:', `${WORKER_URL}/member/${user.id}`);
        const response = await fetch(`${WORKER_URL}/member/${user.id}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors'
        });
        if (!response.ok) throw new Error(`Member fetch failed: ${response.status} ${await response.text()}`);
        member = await response.json();
        console.log('Member data received:', member);
    } catch (e) {
        console.error('Member fetch error:', e);
        showModal('alert', `Failed to fetch member data: ${e.message}. Please try again.`);
        localStorage.removeItem('lastProcessedCode');
        window.history.replaceState({}, document.title, REDIRECT_URI);
        showScreen('discord');
        return;
    }

    await fetchRoleNames();
    await fetchEmployees();

    currentUser = {
        id: user.id,
        name: user.global_name || user.username,
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : '',
        roles: member.roles,
        profile: getEmployee(user.id).profile,
        absences: getEmployee(user.id).absences || [],
        strikes: getEmployee(user.id).strikes || [],
        payslips: getEmployee(user.id).payslips || [],
        mail: getEmployee(user.id).mail || [],
        sentMail: getEmployee(user.id).sentMail || [],
        drafts: getEmployee(user.id).drafts || [],
        pendingDeptChange: getEmployee(user.id).pendingDeptChange || null,
        lastLogin: getEmployee(user.id).lastLogin || null
    };

    showScreen('cherry');
    await new Promise(r => setTimeout(r, 1000));

    if (!member.roles.includes(REQUIRED_ROLE)) {
        console.log('User lacks required role:', REQUIRED_ROLE);
        showModal('alert', 'You do not have the required permissions');
        localStorage.removeItem('lastProcessedCode');
        window.history.replaceState({}, document.title, REDIRECT_URI);
        showScreen('discord');
        return;
    }

    const emp = getEmployee(currentUser.id);
    emp.lastLogin = new Date().toLocaleString();
    emp.profile.avatar = currentUser.avatar;
    updateEmployee(emp);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    console.log('User session saved:', currentUser.id);

    if (!currentUser.profile.name || !currentUser.profile.email || !currentUser.profile.department) {
        console.log('Incomplete profile, redirecting to setupWelcome');
        showScreen('setupWelcome');
    } else {
        console.log('Profile found, redirecting to portalWelcome');
        const portalWelcomeName = document.getElementById('portalWelcomeName');
        const portalLastLogin = document.getElementById('portalLastLogin');
        if (portalWelcomeName) portalWelcomeName.textContent = emp.profile.name;
        if (portalLastLogin) portalLastLogin.textContent = emp.lastLogin;
        showScreen('portalWelcome');
    }

    window.history.replaceState({}, document.title, REDIRECT_URI);
}

function startTutorial() {
    console.log('Starting tutorial');
    showScreen('mainMenu');
    updateSidebarProfile();
    updateMainScreen();

    const steps = [
        {
            element: document.querySelector('.sidebar-toggle'),
            text: 'This is the side menu. Click to expand and access different pages.',
            action: () => document.querySelector('.sidebar-toggle').click()
        },
        {
            element: document.getElementById('sidebarNav'),
            text: 'These are all of your pages. You can submit LOAs, view disciplinaries, payslips, etc!',
            action: () => setTimeout(() => {
                const mailBtn = document.getElementById('mailBtn');
                if (mailBtn) mailBtn.click();
            }, 6000)
        },
        {
            element: document.getElementById('composeMailBtn'),
            text: 'Click this icon to compose a new mail!',
            action: () => {
                const composeMailBtn = document.getElementById('composeMailBtn');
                if (composeMailBtn) composeMailBtn.click();
            }
        },
        {
            element: document.getElementById('mailContent'),
            text: 'Tutorial complete! Check your mail for a welcome message.',
            action: () => {
                const emp = getEmployee(currentUser.id);
                emp.mail = emp.mail || [];
                emp.mail.push({
                    id: Date.now().toString(),
                    from: 'Cirkle Development',
                    subject: 'Welcome to Staff Portal',
                    content: `Dear ${emp.profile.name}, Welcome to your new Staff Portal. You are now finished with this tutorial. Please have a look around and get familiar with everything. We hope you like it! Kind Regards, Cirkle Development.`,
                    timestamp: new Date().toLocaleString(),
                    senderId: 'system'
                });
                updateEmployee(emp);
                addNotification('welcome', 'Welcome to your Staff Portal!', 'mail');
                renderMail();
            }
        }
    ];

    let currentStep = 0;

    function showStep() {
        if (currentStep >= steps.length) {
            document.querySelectorAll('.tutorial-ring, .tutorial-text').forEach(el => el.remove());
            return;
        }

        const step = steps[currentStep];
        document.querySelectorAll('.tutorial-ring, .tutorial-text').forEach(el => el.remove());

        if (step.element) {
            const rect = step.element.getBoundingClientRect();
            const ring = document.createElement('div');
            ring.className = 'tutorial-ring';
            ring.style.width = `${rect.width + 20}px`;
            ring.style.height = `${rect.height + 20}px`;
            ring.style.left = `${rect.left - 10}px`;
            ring.style.top = `${rect.top - 10}px`;
            document.body.appendChild(ring);

            const text = document.createElement('div');
            text.className = 'tutorial-text';
            text.textContent = step.text;
            document.body.appendChild(text);

            step.element.addEventListener('click', () => {
                currentStep++;
                step.action();
                showStep();
            }, { once: true });
        } else {
            currentStep++;
            showStep();
        }
    }

    showStep();
}

function setSelectValues(selectId, values) {
    const select = document.getElementById(selectId);
    if (!select) return;
    Array.from(select.options).forEach(option => {
        option.selected = values.includes(option.value);
    });
}

function renderMail() {
    const inboxContent = document.getElementById('inboxContent');
    const sentContent = document.getElementById('sentContent');
    const draftsContent = document.getElementById('draftsContent');
    if (!inboxContent || !sentContent || !draftsContent) return;
    inboxContent.innerHTML = '';
    sentContent.innerHTML = '';
    draftsContent.innerHTML = '';
    const emp = getEmployee(currentUser.id);

    emp.mail.forEach((m, index) => {
        const sender = employees.find(e => e.id === m.senderId) || { id: m.senderId, avatar: 'https://via.placeholder.com/40' };
        const li = document.createElement('li');
        li.className = 'mail-item';
        li.innerHTML = `
            <img src="${sender.avatar}" alt="Sender">
            <span class="subject">${m.subject || 'No Subject'}</span>
            <span class="timestamp">${m.timestamp}</span>
        `;
        if (!li.dataset.listener) {
            li.dataset.listener = 'true';
            li.addEventListener('click', () => {
                currentMail = { ...m, index };
                document.getElementById('viewMailContent').innerHTML = `
                    <p><strong>From:</strong> ${m.from}</p>
                    <p><strong>Subject:</strong> ${m.subject || 'No Subject'}</p>
                    <p>${m.content}</p>
                    <p><em>${m.timestamp}</em></p>
                    ${m.attachments ? m.attachments.map(file => `<p><a href="${file.url}" download="${file.name}">Download ${file.name}</a></p>`).join('') : ''}
                    ${m.thread && m.thread.length ? '<div class="mail-thread">' + m.thread.map(t => `
                        <div class="thread-item">
                            <p><strong>From:</strong> ${t.from}</p>
                            <p>${t.content}</p>
                            <p><em>${t.timestamp}</em></p>
                        </div>
                    `).join('') + '</div>' : ''}
                `;
                const replyMailBtn = document.getElementById('replyMailBtn');
                if (replyMailBtn) replyMailBtn.classList.toggle('hidden', m.senderId === 'system');
                showModal('viewMail');
            });
        }
        inboxContent.appendChild(li);
    });

    emp.sentMail.forEach(m => {
        const li = document.createElement('li');
        li.className = 'mail-item';
        li.innerHTML = `
            <img src="${currentUser.avatar || 'https://via.placeholder.com/40'}" alt="Sender">
            <span class="subject">${m.subject || 'No Subject'}</span>
            <span class="timestamp">${m.timestamp}</span>
        `;
        if (!li.dataset.listener) {
            li.dataset.listener = 'true';
            li.addEventListener('click', () => {
                document.getElementById('viewMailContent').innerHTML = `
                    <p><strong>To:</strong> ${m.to.join(', ')}</p>
                    <p><strong>Subject:</strong> ${m.subject || 'No Subject'}</p>
                    <p>${m.content}</p>
                    <p><em>${m.timestamp}</em></p>
                    ${m.attachments ? m.attachments.map(file => `<p><a href="${file.url}" download="${file.name}">Download ${file.name}</a></p>`).join('') : ''}
                `;
                const replyMailBtn = document.getElementById('replyMailBtn');
                if (replyMailBtn) replyMailBtn.classList.add('hidden');
                showModal('viewMail');
            });
        }
        sentContent.appendChild(li);
    });

    emp.drafts.forEach((d, index) => {
        const li = document.createElement('li');
        li.className = 'mail-item';
        li.innerHTML = `
            <img src="${currentUser.avatar || 'https://via.placeholder.com/40'}" alt="Sender">
            <span class="subject">${d.subject || 'No Subject'}</span>
            <span class="timestamp">${d.timestamp}</span>
            <div class="draft-actions">
                <button class="edit-draft" data-index="${index}">Edit</button>
                <button class="delete-draft" data-index="${index}">Delete</button>
                <button class="send-draft" data-index="${index}">Send</button>
            </div>
        `;
        if (!li.dataset.listener) {
            li.dataset.listener = 'true';
            li.addEventListener('click', (e) => {
                if (e.target.classList.contains('edit-draft') || e.target.classList.contains('delete-draft') || e.target.classList.contains('send-draft')) return;
                document.getElementById('viewMailContent').innerHTML = `
                    <p><strong>To:</strong> ${d.recipients.join(', ') || 'None'}</p>
                    <p><strong>Subject:</strong> ${d.subject || 'No Subject'}</p>
                    <p>${d.content}</p>
                    <p><em>${d.timestamp}</em></p>
                    ${d.attachments ? d.attachments.map(file => `<p><a href="${file.url}" download="${file.name}">Download ${file.name}</a></p>`).join('') : ''}
                `;
                const replyMailBtn = document.getElementById('replyMailBtn');
                if (replyMailBtn) replyMailBtn.classList.add('hidden');
                showModal('viewMail');
            });
        }
        draftsContent.appendChild(li);
    });

    const recipientSelect = document.getElementById('mailRecipients');
    if (recipientSelect) {
        recipientSelect.innerHTML = '<option value="" disabled>Select Recipients</option>';
        employees.filter(e => e.profile.name && e.id !== currentUser.id && e.roles.includes(REQUIRED_ROLE)).forEach(e => {
            const option = document.createElement('option');
            option.value = e.id;
            option.textContent = e.profile.name;
            recipientSelect.appendChild(option);
        });
    }

    draftsContent.querySelectorAll('.edit-draft').forEach(btn => {
        if (!btn.dataset.listener) {
            btn.dataset.listener = 'true';
            btn.addEventListener('click', () => {
                const index = btn.dataset.index;
                const draft = emp.drafts[index];
                setSelectValues('mailRecipients', draft.recipientIds);
                document.getElementById('mailSubject').value = draft.subject || '';
                document.getElementById('mailContent').value = draft.content || '';
                document.getElementById('mailAttachments').value = '';
                document.getElementById('sendMailBtn').dataset.draftIndex = index;
                showModal('composeMail');
            });
        }
    });

    draftsContent.querySelectorAll('.delete-draft').forEach(btn => {
        if (!btn.dataset.listener) {
            btn.dataset.listener = 'true';
            btn.addEventListener('click', () => {
                emp.drafts.splice(btn.dataset.index, 1);
                updateEmployee(emp);
                renderMail();
                showModal('alert', '<span class="success-tick"></span> Draft deleted successfully!');
                playSuccessSound();
                clockInActions.push(`Deleted draft: ${emp.drafts[btn.dataset.index]?.subject || 'No subject'}`);
            });
        }
    });

    draftsContent.querySelectorAll('.send-draft').forEach(btn => {
        if (!btn.dataset.listener) {
            btn.dataset.listener = 'true';
            btn.addEventListener('click', () => {
                const index = btn.dataset.index;
                const draft = emp.drafts[index];
                setSelectValues('mailRecipients', draft.recipientIds);
                document.getElementById('mailSubject').value = draft.subject || '';
                document.getElementById('mailContent').value = draft.content || '';
                document.getElementById('mailAttachments').value = '';
                document.getElementById('sendMailBtn').dataset.draftIndex = index;
                sendDraft(index);
            });
        }
    });
}

async function sendDraft(index) {
    const RecipientIds = Array.from(document.getElementById('mailRecipients').selectedOptions).map(opt => opt.value);
    const subject = document.getElementById('mailSubject').value.trim();
    const content = document.getElementById('mailContent').value.trim();
    const files = document.getElementById('mailAttachments').files;
    const mailError = document.getElementById('mailError');
    if (!RecipientIds.length || RecipientIds.includes('')) {
        if (mailError) mailError.classList.remove('hidden');
        setTimeout(() => { if (mailError) mailError.classList.add('hidden'); }, 2000);
        return;
    }
    if (!content) {
        showModal('alert', 'Please enter a message');
        return;
    }
    showModal('alert', 'Sending...');
    await new Promise(r => setTimeout(r, 1000));
    const emp = getEmployee(currentUser.id);
    const timestamp = new Date().toLocaleString();
    const attachments = await Promise.all(Array.from(files).map(async file => {
        const reader = new FileReader();
        return new Promise(resolve => {
            reader.onload = () => resolve({ name: file.name, url: reader.result });
            reader.readAsDataURL(file);
        });
    }));
    const mailData = {
        id: Date.now().toString(),
        from: emp.profile.name,
        senderId: currentUser.id,
        to: RecipientIds.map(id => getEmployee(id).profile.name),
        RecipientIds,
        subject,
        content,
        timestamp,
        attachments: attachments.length ? attachments : null,
        thread: []
    };
    emp.sentMail = emp.sentMail || [];
    emp.sentMail.push(mailData);
    RecipientIds.forEach(id => {
        const recipient = getEmployee(id);
        recipient.mail = recipient.mail || [];
        recipient.mail.push(mailData);
        updateEmployee(recipient);
        sendDM(id, `New message from ${emp.profile.name}: ${subject}\n${content}`);
        addNotification('mail', `New message from ${emp.profile.name}: ${subject}`, 'mail', id);
    });
    emp.drafts.splice(index, 1);
    updateEmployee(emp);
    showMailDeliveryAnimation();
    showModal('alert', '<span class="success-tick"></span> Successfully sent!');
    playSuccessSound();
    addNotification('mail', 'Your mail has been sent!', 'mail');
    closeModal('composeMail');
    renderMail();
}

function updateTabSlider() {
    const activeTab = document.querySelector('.mail-tabs .tab-btn.active, .absence-tabs .tab-btn.active');
    if (!activeTab) return;
    const container = activeTab.closest('.mail-tabs') || activeTab.closest('.absence-tabs');
    const slider = container.querySelector('.tab-slider');
    if (!slider) return;
    const rect = activeTab.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    slider.style.width = `${rect.width}px`;
    slider.style.transform = `translateX(${rect.left - containerRect.left}px)`;
}

function renderAbsences(tab) {
    const folders = {
        pending: document.getElementById('pendingAbsences'),
        approved: document.getElementById('approvedAbsences'),
        rejected: document.getElementById('rejectedAbsences'),
        archived: document.getElementById('archivedAbsences')
    };
    Object.values(folders).forEach(folder => {
        if (folder) folder.innerHTML = '';
    });
    const emp = getEmployee(currentUser.id);
    emp.absences.filter(a => a.status === tab).forEach(a => {
        const folder = folders[tab];
        if (!folder) return;
        const li = document.createElement('li');
        li.className = `absence-item ${a.status}`;
        li.innerHTML = `
            <span>Reason: ${a.type}</span>
            <span>Start: ${a.startDate}</span>
            <span>End: ${a.endDate}</span>
            <span>Total Days: ${Math.ceil((new Date(a.endDate) - new Date(a.startDate)) / (1000 * 60 * 60 * 24)) + 1}</span>
            ${a.status === 'rejected' ? `<span>Reason: ${a.reason || 'N/A'}</span>` : ''}
            ${a.status === 'pending' ? `<button class="cancel-absence-btn" data-id="${a.id}">Cancel Absence</button>` : ''}
        `;
        if (!li.dataset.listener) {
            li.dataset.listener = 'true';
            li.addEventListener('click', (e) => {
                if (e.target.classList.contains('cancel-absence-btn')) return;
                const absenceDetailContent = document.getElementById('absenceDetailContent');
                if (absenceDetailContent) {
                    absenceDetailContent.innerHTML = `
                        <p><strong>Type:</strong> ${a.type}</p>
                        <p><strong>Start:</strong> ${a.startDate}</p>
                        <p><strong>End:</strong> ${a.endDate}</p>
                        <p><strong>Comment:</strong> ${a.comment}</p>
                        <p><strong>Status:</strong> ${a.status.charAt(0).toUpperCase() + a.status.slice(1)}</p>
                        ${a.status === 'rejected' ? `<p><strong>Reason:</strong> ${a.reason || 'N/A'}</p>` : ''}
                    `;
                }
                const cancelAbsenceBtn = document.getElementById('cancelAbsenceBtn');
                const deleteAbsenceBtn = document.getElementById('deleteAbsenceBtn');
                if (cancelAbsenceBtn) {
                    cancelAbsenceBtn.classList.toggle('hidden', a.status !== 'pending');
                    cancelAbsenceBtn.dataset.id = a.id;
                }
                if (deleteAbsenceBtn) {
                    deleteAbsenceBtn.classList.toggle('hidden', a.status !== 'archived');
                    deleteAbsenceBtn.dataset.id = a.id;
                }
                showModal('absenceDetail');
            });
        }
        folder.appendChild(li);
    });

    folders.pending.querySelectorAll('.cancel-absence-btn').forEach(btn => {
        if (!btn.dataset.listener) {
            btn.dataset.listener = 'true';
            btn.addEventListener('click', () => {
                const confirmCancelAbsenceBtn = document.getElementById('confirmCancelAbsenceBtn');
                if (confirmCancelAbsenceBtn) confirmCancelAbsenceBtn.dataset.id = btn.dataset.id;
                showModal('confirmCancelAbsence');
            });
        }
    });
}

function updateProfileScreen() {
    if (!currentUser) return;
    const emp = getEmployee(currentUser.id);
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileDepartment = document.getElementById('profileDepartment');
    const updateNameInput = document.getElementById('updateNameInput');
    const updateEmailInput = document.getElementById('updateEmailInput');
    if (profileName) profileName.textContent = emp.profile.name || 'N/A';
    if (profileEmail) profileEmail.textContent = emp.profile.email || 'N/A';
    if (profileDepartment) {
        profileDepartment.textContent = emp.profile.department || 'N/A';
        profileDepartment.classList.toggle('pending-department', !!emp.pendingDeptChange);
    }
    if (updateNameInput) updateNameInput.value = emp.profile.name || '';
    if (updateEmailInput) updateEmailInput.value = emp.profile.email || '';
}

function updateRolesScreen() {
    const list = document.getElementById('rolesList');
    if (!list || !currentUser) return;
    list.innerHTML = '';
    currentUser.roles.forEach(roleId => {
        const li = document.createElement('li');
        li.textContent = `${roleNames[roleId] || 'Unknown Role'} (${roleId})`;
        list.appendChild(li);
    });
}

function updatePayslipsScreen() {
    const content = document.getElementById('payslipsContent');
    if (!content) return;
    content.innerHTML = '';
    const emp = getEmployee(currentUser.id);
    if (emp.payslips.length === 0) {
        content.innerHTML = '<p>No payslips available.</p>';
    } else {
        emp.payslips.forEach(p => {
            const div = document.createElement('div');
            div.innerHTML = `
                <p>Issued: ${p.timestamp}</p>
                <a href="${p.fileBase64}" download="payslip_${p.timestamp.replace(/[^a-z0-9]/gi, '_')}.pdf">Download</a>
            `;
            content.appendChild(div);
        });
    }
}

function updateDisciplinariesScreen() {
    const content = document.getElementById('disciplinariesContent');
    if (!content) return;
    content.innerHTML = '';
    const emp = getEmployee(currentUser.id);
    if (emp.strikes.length === 0) {
        content.innerHTML = '<p>No disciplinary records available.</p>';
    } else {
        emp.strikes.forEach(s => {
            const div = document.createElement('div');
            div.innerHTML = `
                <p>Level: ${s.level}</p>
                <p>Reason: ${s.reason}</p>
                <p>Details: ${s.details}</p>
                <p>Action: ${s.action}</p>
                <p>Timestamp: ${s.timestamp}</p>
            `;
            content.appendChild(div);
        });
    }
}

function calculateAbsenceDays() {
    const start = new Date(document.getElementById('absenceStartDate').value);
    const end = new Date(document.getElementById('absenceEndDate').value);
    const absenceDays = document.getElementById('absenceDays');
    if (start && end && end >= start && absenceDays) {
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        absenceDays.textContent = `Total Days: ${days}`;
    } else if (absenceDays) {
        absenceDays.textContent = `Total Days: 0`;
    }
}

function startClock() {
    if (clockInInterval) clearInterval(clockInInterval);
    const clock = document.getElementById('sessionClock');
    if (!clock) return;
    clockInInterval = setInterval(() => {
        if (clockInTime && isClockedIn) {
            clock.textContent = formatTime(Date.now() - clockInTime);
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize event listeners
    const discordLoginBtn = document.getElementById('discordLoginBtn');
    if (discordLoginBtn && !discordLoginBtn.dataset.listener) {
        discordLoginBtn.dataset.listener = 'true';
        discordLoginBtn.addEventListener('click', () => {
            const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify&prompt=none`;
            console.log('Initiating OAuth redirect:', oauthUrl);
            window.location.href = oauthUrl;
        });
    }

    const setupStartBtn = document.getElementById('setupStartBtn');
    if (setupStartBtn && !setupStartBtn.dataset.listener) {
        setupStartBtn.dataset.listener = 'true';
        setupStartBtn.addEventListener('click', () => {
            console.log('Setup start button clicked');
            showScreen('setupEmail');
        });
    }

    const setupEmailContinueBtn = document.getElementById('setupEmailContinueBtn');
    if (setupEmailContinueBtn && !setupEmailContinueBtn.dataset.listener) {
        setupEmailContinueBtn.dataset.listener = 'true';
        setupEmailContinueBtn.addEventListener('click', () => {
            const email = document.getElementById('setupEmailInput')?.value.trim();
            if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                currentUser.profile.email = email;
                showScreen('setupName');
            } else {
                showModal('alert', 'Please enter a valid email with @ and a domain (e.g., example.com)');
            }
        });
    }

    const setupNameContinueBtn = document.getElementById('setupNameContinueBtn');
    if (setupNameContinueBtn && !setupNameContinueBtn.dataset.listener) {
        setupNameContinueBtn.dataset.listener = 'true';
        setupNameContinueBtn.addEventListener('click', () => {
            const name = document.getElementById('setupNameInput')?.value.trim();
            if (name) {
                currentUser.profile.name = name;
                showScreen('setupDepartment');
            } else {
                showModal('alert', 'Please enter your first and last name');
            }
        });
    }

    const setupDepartmentContinueBtn = document.getElementById('setupDepartmentContinueBtn');
    if (setupDepartmentContinueBtn && !setupDepartmentContinueBtn.dataset.listener) {
        setupDepartmentContinueBtn.dataset.listener = 'true';
        setupDepartmentContinueBtn.addEventListener('click', () => {
            const selectedDept = document.querySelector('input[name="department"]:checked');
            if (selectedDept) {
                currentUser.profile.department = selectedDept.value;
                showScreen('setupVerify');
                setTimeout(() => {
                    const deptRole = DEPT_ROLES[currentUser.profile.department];
                    if (currentUser.roles.includes(deptRole)) {
                        updateEmployee(currentUser);
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                        console.log('Role verification successful, redirecting to confirm');
                        showScreen('confirm');
                        playSuccessSound();
                    } else {
                        console.log('Role verification failed for department:', currentUser.profile.department);
                        showModal('alert', 'Role verification failed');
                        showScreen('setupDepartment');
                    }
                }, 2000);
            } else {
                showModal('alert', 'Please select a department');
            }
        });
    }

    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn && !continueBtn.dataset.listener) {
        continueBtn.dataset.listener = 'true';
        continueBtn.addEventListener('click', () => {
            console.log('Finalise button clicked, redirecting to setupComplete');
            showScreen('setupComplete');
            const setupWelcomeName = document.getElementById('setupWelcomeName');
            if (setupWelcomeName) setupWelcomeName.textContent = currentUser.profile.name;
            setTimeout(() => startTutorial(), 3000);
        });
    }

    const portalLoginBtn = document.getElementById('portalLoginBtn');
    if (portalLoginBtn && !portalLoginBtn.dataset.listener) {
        portalLoginBtn.dataset.listener = 'true';
        portalLoginBtn.addEventListener('click', () => {
            console.log('Portal login button clicked, redirecting to mainMenu');
            showScreen('mainMenu');
            updateSidebarProfile();
            updateMainScreen();
        });
    }

    const sidebarProfilePic = document.getElementById('sidebarProfilePic');
    if (sidebarProfilePic && !sidebarProfilePic.dataset.listener) {
        sidebarProfilePic.dataset.listener = 'true';
        sidebarProfilePic.addEventListener('click', () => {
            showScreen('myProfile');
            updateProfileScreen();
        });
    }

    const mainProfilePic = document.getElementById('mainProfilePic');
    if (mainProfilePic && !mainProfilePic.dataset.listener) {
        mainProfilePic.dataset.listener = 'true';
        mainProfilePic.addEventListener('click', () => {
            showScreen('myProfile');
            updateProfileScreen();
        });
    }

    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn && !homeBtn.dataset.listener) {
        homeBtn.dataset.listener = 'true';
        homeBtn.addEventListener('click', () => {
            console.log('Home button clicked');
            showScreen('mainMenu');
            updateMainScreen();
        });
    }

    const updateProfileBtn = document.getElementById('updateProfileBtn');
    if (updateProfileBtn && !updateProfileBtn.dataset.listener) {
        updateProfileBtn.dataset.listener = 'true';
        updateProfileBtn.addEventListener('click', () => {
            const name = document.getElementById('updateNameInput')?.value.trim();
            const email = document.getElementById('updateEmailInput')?.value.trim();
            if (name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                const emp = getEmployee(currentUser.id);
                emp.profile.name = name;
                emp.profile.email = email;
                updateEmployee(emp);
                currentUser.profile = emp.profile;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showModal('alert', '<span class="success-tick"></span> Profile updated successfully!');
                playSuccessSound();
                addNotification('profile', 'Your profile has been updated!', 'myProfile');
                updateProfileScreen();
                updateMainScreen();
                updateSidebarProfile();
                clockInActions.push('Updated profile');
            } else {
                showModal('alert', 'Please enter a valid name and email');
            }
        });
    }

    const changeDeptBtn = document.getElementById('changeDeptBtn');
    if (changeDeptBtn && !changeDeptBtn.dataset.listener) {
        changeDeptBtn.dataset.listener = 'true';
        changeDeptBtn.addEventListener('click', () => showModal('deptChange'));
    }

    const changeDepartmentBtn = document.getElementById('changeDepartmentBtn');
    if (changeDepartmentBtn && !changeDepartmentBtn.dataset.listener) {
        changeDepartmentBtn.dataset.listener = 'true';
        changeDepartmentBtn.addEventListener('click', () => showModal('deptChange'));
    }

    const submitDeptChangeBtn = document.getElementById('submitDeptChangeBtn');
    if (submitDeptChangeBtn && !submitDeptChangeBtn.dataset.listener) {
        submitDeptChangeBtn.dataset.listener = 'true';
        submitDeptChangeBtn.addEventListener('click', async () => {
            const selectedDept = document.querySelector('input[name="newDepartment"]:checked');
            if (selectedDept) {
                const emp = getEmployee(currentUser.id);
                emp.pendingDeptChange = selectedDept.value;
                updateEmployee(emp);
                currentUser.pendingDeptChange = emp.pendingDeptChange;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                await sendEmbed({
                    title: 'Department Change Request',
                    description: `User: <@${currentUser.id}> (${emp.profile.name})\nRequested Department: ${selectedDept.value}`,
                    color: 0xffff00
                });
                closeModal('deptChange');
                showModal('alert', '<span class="success-tick"></span> Request to change department has been sent.');
                playSuccessSound();
                addNotification('department', 'Department change request submitted!', 'myProfile');
                updateProfileScreen();
                clockInActions.push(`Requested department change to ${selectedDept.value}`);
            } else {
                showModal('alert', 'Please select a department');
            }
        });
    }

    const resetProfileBtn = document.getElementById('resetProfileBtn');
    if (resetProfileBtn && !resetProfileBtn.dataset.listener) {
        resetProfileBtn.dataset.listener = 'true';
        resetProfileBtn.addEventListener('click', () => showModal('resetProfile'));
    }

    const confirmResetBtn = document.getElementById('confirmResetBtn');
    if (confirmResetBtn && !confirmResetBtn.dataset.listener) {
        confirmResetBtn.dataset.listener = 'true';
        confirmResetBtn.addEventListener('click', () => {
            resetEmployeeData(currentUser.id);
            closeModal('resetProfile');
            showScreen('setupWelcome');
            showModal('alert', '<span class="success-tick"></span> Profile reset successfully!');
            playSuccessSound();
            clockInActions.push('Reset profile');
        });
    }

    const myRolesBtn = document.getElementById('myRolesBtn');
    if (myRolesBtn && !myRolesBtn.dataset.listener) {
        myRolesBtn.dataset.listener = 'true';
        myRolesBtn.addEventListener('click', () => {
            showScreen('myRoles');
            updateRolesScreen();
        });
    }

    const tasksBtn = document.getElementById('tasksBtn');
    if (tasksBtn && !tasksBtn.dataset.listener) {
        tasksBtn.dataset.listener = 'true';
        tasksBtn.addEventListener('click', () => {
            showScreen('tasks');
            loadTasks();
        });
    }

    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn && !addTaskBtn.dataset.listener) {
        addTaskBtn.dataset.listener = 'true';
        addTaskBtn.addEventListener('click', () => {
            const taskText = document.getElementById('taskInput')?.value.trim();
            if (taskText) {
                currentTasks.push({ text: taskText, completed: false });
                saveTasks();
                renderTasks();
                document.getElementById('taskInput').value = '';
                showModal('alert', '<span class="success-tick"></span> Task added successfully!');
                playSuccessSound();
                addNotification('task', 'New task added!', 'tasks');
                clockInActions.push(`Added task: ${taskText}`);
            } else {
                showModal('alert', 'Please enter a task');
            }
        });
    }

    const absencesBtn = document.getElementById('absencesBtn');
    if (absencesBtn && !absencesBtn.dataset.listener) {
        absencesBtn.dataset.listener = 'true';
        absencesBtn.addEventListener('click', () => {
            showScreen('absences');
            document.querySelectorAll('.absence-tab-btn').forEach(btn => btn.classList.remove('active'));
            const pendingTab = document.querySelector('.absence-tab-btn[data-tab="pending"]');
            if (pendingTab) pendingTab.classList.add('active');
            document.getElementById('pendingFolder')?.classList.add('active');
            document.getElementById('approvedFolder')?.classList.remove('active');
            document.getElementById('rejectedFolder')?.classList.remove('active');
            document.getElementById('archivedFolder')?.classList.remove('active');
            renderAbsences('pending');
            updateTabSlider();
        });
    }

    const requestAbsenceBtn = document.getElementById('requestAbsenceBtn');
    if (requestAbsenceBtn && !requestAbsenceBtn.dataset.listener) {
        requestAbsenceBtn.dataset.listener = 'true';
        requestAbsenceBtn.addEventListener('click', () => showModal('absenceRequest'));
    }

    const absenceStartDate = document.getElementById('absenceStartDate');
    if (absenceStartDate && !absenceStartDate.dataset.listener) {
        absenceStartDate.dataset.listener = 'true';
        absenceStartDate.addEventListener('change', calculateAbsenceDays);
    }

    const absenceEndDate = document.getElementById('absenceEndDate');
    if (absenceEndDate && !absenceEndDate.dataset.listener) {
        absenceEndDate.dataset.listener = 'true';
        absenceEndDate.addEventListener('change', calculateAbsenceDays);
    }

    const submitAbsenceBtn = document.getElementById('submitAbsenceBtn');
    if (submitAbsenceBtn && !submitAbsenceBtn.dataset.listener) {
        submitAbsenceBtn.dataset.listener = 'true';
        submitAbsenceBtn.addEventListener('click', async () => {
            const type = document.getElementById('absenceType')?.value;
            const startDate = document.getElementById('absenceStartDate')?.value;
            const endDate = document.getElementById('absenceEndDate')?.value;
            const comment = document.getElementById('absenceComment')?.value.trim();
            if (!type || !startDate || !endDate || !comment) {
                showModal('alert', 'Please fill all fields');
                return;
            }
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (end < start) {
                showModal('alert', 'End date must be after start date');
                return;
            }
            const emp = getEmployee(currentUser.id);
            emp.absences = emp.absences || [];
            const absence = {
                id: Date.now().toString(),
                type,
                startDate,
                endDate,
                comment,
                status: 'pending',
                messageId: null
            };
            emp.absences.push(absence);
            updateEmployee(emp);
            const embed = {
                title: 'New Absence Request',
                fields: [
                    { name: 'User', value: `<@${currentUser.id}> (${emp.profile.name})`, inline: true },
                    { name: 'Reason', value: type, inline: true },
                    { name: 'Start Date', value: startDate, inline: true },
                    { name: 'End Date', value: endDate, inline: true },
                    { name: 'Total Days', value: `${Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1}`, inline: true },
                    { name: 'Comment', value: comment, inline: false }
                ],
                footer: { text: 'Please accept/reject on the HR portal' },
                color: 0xffff00
            };
            const embedResponse = await sendEmbed(embed);
            if (embedResponse?.id) absence.messageId = embedResponse.id;
            updateEmployee(emp);
            closeModal('absenceRequest');
            showModal('alert', '<span class="success-tick"></span> Successfully Submitted!');
            playSuccessSound();
            addNotification('absence', 'Absence request submitted!', 'absences');
            renderAbsences('pending');
            updateTabSlider();
            clockInActions.push(`Submitted absence request: ${type}`);
        });
    }

    const absencesScreen = document.getElementById('absencesScreen');
    if (absencesScreen && !absencesScreen.dataset.listener) {
        absencesScreen.dataset.listener = 'true';
        absencesScreen.addEventListener('click', (e) => {
            if (e.target.classList.contains('absence-tab-btn')) {
                document.querySelectorAll('.absence-tab-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                const folder = e.target.dataset.tab;
                document.getElementById('pendingFolder')?.classList.toggle('active', folder === 'pending');
                document.getElementById('approvedFolder')?.classList.toggle('active', folder === 'approved');
                document.getElementById('rejectedFolder')?.classList.toggle('active', folder === 'rejected');
                document.getElementById('archivedFolder')?.classList.toggle('active', folder === 'archived');
                renderAbsences(folder);
                updateTabSlider();
            }
        });
    }

    const cancelAbsenceBtn = document.getElementById('cancelAbsenceBtn');
    if (cancelAbsenceBtn && !cancelAbsenceBtn.dataset.listener) {
        cancelAbsenceBtn.dataset.listener = 'true';
        cancelAbsenceBtn.addEventListener('click', () => {
            const confirmCancelAbsenceBtn = document.getElementById('confirmCancelAbsenceBtn');
            if (confirmCancelAbsenceBtn) confirmCancelAbsenceBtn.dataset.id = cancelAbsenceBtn.dataset.id;
            showModal('confirmCancelAbsence');
        });
    }

    const confirmCancelAbsenceBtn = document.getElementById('confirmCancelAbsenceBtn');
    if (confirmCancelAbsenceBtn && !confirmCancelAbsenceBtn.dataset.listener) {
        confirmCancelAbsenceBtn.dataset.listener = 'true';
        confirmCancelAbsenceBtn.addEventListener('click', async () => {
            const absenceId = confirmCancelAbsenceBtn.dataset.id;
            const emp = getEmployee(currentUser.id);
            const absence = emp.absences.find(a => a.id === absenceId);
            if (absence) {
                absence.status = 'archived';
                updateEmployee(emp);
                if (absence.messageId) {
                    const embed = {
                        title: 'Absence Request Cancelled',
                        fields: [
                            { name: 'User', value: `<@${currentUser.id}> (${emp.profile.name})`, inline: true },
                            { name: 'Reason', value: absence.type, inline: true },
                            { name: 'Start Date', value: absence.startDate, inline: true },
                            { name: 'End Date', value: absence.endDate, inline: true },
                            { name: 'Total Days', value: `${Math.ceil((new Date(absence.endDate) - new Date(absence.startDate)) / (1000 * 60 * 60 * 24)) + 1}`, inline: true },
                            { name: 'Comment', value: absence.comment, inline: false },
                            { name: 'Status', value: 'ABSENCE CANCELLED', inline: false }
                        ],
                        color: 0xff0000
                    };
                    await updateEmbed(absence.messageId, embed);
                }
                closeModal('confirmCancelAbsence');
                closeModal('absenceDetail');
                showModal('alert', '<span class="success-tick"></span> Cancelled Absence');
                playSuccessSound();
                addNotification('absence', 'Absence request cancelled!', 'absences');
                renderAbsences('pending');
                updateTabSlider();
                clockInActions.push(`Cancelled absence: ${absence.type}`);
            }
        });
    }

    const noCancelAbsenceBtn = document.getElementById('noCancelAbsenceBtn');
    if (noCancelAbsenceBtn && !noCancelAbsenceBtn.dataset.listener) {
        noCancelAbsenceBtn.dataset.listener = 'true';
        noCancelAbsenceBtn.addEventListener('click', () => closeModal('confirmCancelAbsence'));
    }

    const deleteAbsenceBtn = document.getElementById('deleteAbsenceBtn');
    if (deleteAbsenceBtn && !deleteAbsenceBtn.dataset.listener) {
        deleteAbsenceBtn.dataset.listener = 'true';
        deleteAbsenceBtn.addEventListener('click', () => {
            const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
            if (confirmDeleteBtn) confirmDeleteBtn.dataset.id = deleteAbsenceBtn.dataset.id;
            showModal('confirmDeleteAbsence');
        });
    }

    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn && !confirmDeleteBtn.dataset.listener) {
        confirmDeleteBtn.dataset.listener = 'true';
        confirmDeleteBtn.addEventListener('click', () => {
            const absenceId = confirmDeleteBtn.dataset.id;
            const emp = getEmployee(currentUser.id);
            emp.absences = emp.absences.filter(a => a.id !== absenceId);
            updateEmployee(emp);
            closeModal('confirmDeleteAbsence');
            closeModal('absenceDetail');
            showModal('alert', '<span class="success-tick"></span> Absence deleted!');
            playSuccessSound();
            addNotification('absence', 'Absence deleted!', 'absences');
            const activeTab = document.querySelector('.absence-tab-btn.active')?.dataset.tab || 'archived';
            renderAbsences(activeTab);
            updateTabSlider();
            clockInActions.push('Deleted absence');
        });
    }

    const noDeleteBtn = document.getElementById('noDeleteBtn');
    if (noDeleteBtn && !noDeleteBtn.dataset.listener) {
        noDeleteBtn.dataset.listener = 'true';
        noDeleteBtn.addEventListener('click', () => closeModal('confirmDeleteAbsence'));
    }

    const payslipsBtn = document.getElementById('payslipsBtn');
    if (payslipsBtn && !payslipsBtn.dataset.listener) {
        payslipsBtn.dataset.listener = 'true';
        payslipsBtn.addEventListener('click', () => {
            showScreen('payslips');
            updatePayslipsScreen();
        });
    }

    const disciplinariesBtn = document.getElementById('disciplinariesBtn');
    if (disciplinariesBtn && !disciplinariesBtn.dataset.listener) {
        disciplinariesBtn.dataset.listener = 'true';
        disciplinariesBtn.addEventListener('click', () => {
            showScreen('disciplinaries');
            updateDisciplinariesScreen();
        });
    }

    const timeclockBtn = document.getElementById('timeclockBtn');
    if (timeclockBtn && !timeclockBtn.dataset.listener) {
        timeclockBtn.dataset.listener = 'true';
        timeclockBtn.addEventListener('click', () => {
            showScreen('timeclock');
            updateMainScreen();
        });
    }

    const clockInBtn = document.getElementById('clockInBtn');
    if (clockInBtn && !clockInBtn.dataset.listener) {
        clockInBtn.dataset.listener = 'true';
        clockInBtn.addEventListener('click', async () => {
            const emp = getEmployee(currentUser.id);
            if (emp.onLOA) {
                showModal('alert', 'Cannot clock in while on Leave of Absence');
                return;
            }
            clockInTime = Date.now();
            isClockedIn = true;
            localStorage.setItem('clockInTime', clockInTime.toString());
            clockInActions = [];
            startClock();
            clockInBtn.disabled = true;
            clockInBtn.classList.add('hidden');
            let clockOutBtn = document.getElementById('clockOutBtn');
            if (clockOutBtn) {
                clockOutBtn.disabled = false;
                clockOutBtn.classList.remove('hidden');
            }
            const sessionInfo = document.getElementById('sessionInfo');
            if (sessionInfo) sessionInfo.classList.remove('hidden');
            await sendWebhook(`<@${currentUser.id}> (${emp.profile.name}) clocked in at ${new Date().toLocaleString()}`);
            showModal('alert', '<span class="success-tick"></span> Clocked in successfully!');
            playSuccessSound();
            addNotification('timeclock', `Clocked in at ${new Date().toLocaleString()}`, 'timeclock');
clockInActions.push(`Clocked in at ${new Date().toLocaleString()}`);
});
}
let clockOutBtn = document.getElementById('clockOutBtn');
if (clockOutBtn && !clockOutBtn.dataset.listener) {
clockOutBtn.dataset.listener = 'true';
clockOutBtn.addEventListener('click', async () => {
if (!isClockedIn || !clockInTime) {
showModal('alert', 'No active clock-in session');
return;
}
const clockOutTime = Date.now();
const emp = getEmployee(currentUser.id);
clearInterval(clockInInterval);
const session = downloadTXT(emp, clockInTime, clockOutTime, clockInActions);
previousSessions.push(session);
localStorage.setItem(`previousSessions_${currentUser.id}`, JSON.stringify(previousSessions));
await sendWebhook(`<@${currentUser.id}> (${emp.profile.name}) clocked out at ${new Date().toLocaleString()}. Duration: ${session.duration}. Actions: ${session.actions || 'None'}`);
isClockedIn = false;
clockInTime = null;
localStorage.removeItem('clockInTime');
clockInActions = [];
clockOutBtn.disabled = true;
clockOutBtn.classList.add('hidden');
const clockInBtn = document.getElementById('clockInBtn');
if (clockInBtn) {
clockInBtn.disabled = false;
clockInBtn.classList.remove('hidden');
}
const sessionInfo = document.getElementById('sessionInfo');
if (sessionInfo) {
sessionInfo.classList.add('hidden');
const clock = document.getElementById('sessionClock');
if (clock) clock.textContent = '00:00:00';
}
showModal('alert', ' Clocked out successfully!');
playSuccessSound();
addNotification('timeclock', `Clocked in at ${new Date().toLocaleString()}`, 'timeclock');
            clockInActions.push(`Clocked in at ${new Date().toLocaleString()}`);
        });
    }


    clockOutBtn = document.getElementById('clockOutBtn');
    if (clockOutBtn && !clockOutBtn.dataset.listener) {
        clockOutBtn.dataset.listener = 'true';
        clockOutBtn.addEventListener('click', async () => {
            if (!isClockedIn || !clockInTime) {
                showModal('alert', 'No active clock-in session');
                return;
            }
            const clockOutTime = Date.now();
            const emp = getEmployee(currentUser.id);
            clearInterval(clockInInterval);
            const session = downloadTXT(emp, clockInTime, clockOutTime, clockInActions);
            previousSessions.push(session);
            localStorage.setItem(`previousSessions_${currentUser.id}`, JSON.stringify(previousSessions));
            await sendWebhook(`<@${currentUser.id}> (${emp.profile.name}) clocked out at ${new Date().toLocaleString()}. Duration: ${session.duration}. Actions: ${session.actions || 'None'}`);
            isClockedIn = false;
            clockInTime = null;
            localStorage.removeItem('clockInTime');
            clockInActions = [];
            clockOutBtn.disabled = true;
            clockOutBtn.classList.add('hidden');
            const clockInBtn = document.getElementById('clockInBtn');
            if (clockInBtn) {
                clockInBtn.disabled = false;
                clockInBtn.classList.remove('hidden');
            }
            const sessionInfo = document.getElementById('sessionInfo');
            if (sessionInfo) {
                sessionInfo.classList.add('hidden');
                const clock = document.getElementById('sessionClock');
                if (clock) clock.textContent = '00:00:00';
            }
            showModal('alert', '<span class="success-tick"></span> Clocked out successfully!');
            playSuccessSound();
            addNotification('timeclock', `Clocked out at ${new Date().toLocaleString()}`, 'timeclock');
            renderPreviousSessions();
            clockInActions.push(`Clocked out at ${new Date().toLocaleString()}`);
        });
    }

    const mailBtn = document.getElementById('mailBtn');
    if (mailBtn && !mailBtn.dataset.listener) {
        mailBtn.dataset.listener = 'true';
        mailBtn.addEventListener('click', () => {
            showScreen('mail');
            document.querySelectorAll('.mail-tab-btn').forEach(btn => btn.classList.remove('active'));
            const inboxTab = document.querySelector('.mail-tab-btn[data-tab="inbox"]');
            if (inboxTab) inboxTab.classList.add('active');
            document.getElementById('inboxContent')?.classList.add('active');
            document.getElementById('sentContent')?.classList.remove('active');
            document.getElementById('draftsContent')?.classList.remove('active');
            renderMail();
            updateTabSlider();
        });
    }

    const mailScreen = document.getElementById('mailScreen');
    if (mailScreen && !mailScreen.dataset.listener) {
        mailScreen.dataset.listener = 'true';
        mailScreen.addEventListener('click', (e) => {
            if (e.target.classList.contains('mail-tab-btn')) {
                document.querySelectorAll('.mail-tab-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                const folder = e.target.dataset.tab;
                document.getElementById('inboxContent')?.classList.toggle('active', folder === 'inbox');
                document.getElementById('sentContent')?.classList.toggle('active', folder === 'sent');
                document.getElementById('draftsContent')?.classList.toggle('active', folder === 'drafts');
                renderMail();
                updateTabSlider();
            }
        });
    }

    const composeMailBtn = document.getElementById('composeMailBtn');
    if (composeMailBtn && !composeMailBtn.dataset.listener) {
        composeMailBtn.dataset.listener = 'true';
        composeMailBtn.addEventListener('click', () => {
            document.getElementById('mailRecipients').value = '';
            document.getElementById('mailSubject').value = '';
            document.getElementById('mailContent').value = '';
            document.getElementById('mailAttachments').value = '';
            const sendMailBtn = document.getElementById('sendMailBtn');
            if (sendMailBtn) delete sendMailBtn.dataset.draftIndex;
            showModal('composeMail');
        });
    }

    const saveDraftBtn = document.getElementById('saveDraftBtn');
    if (saveDraftBtn && !saveDraftBtn.dataset.listener) {
        saveDraftBtn.dataset.listener = 'true';
        saveDraftBtn.addEventListener('click', () => {
            const recipientIds = Array.from(document.getElementById('mailRecipients').selectedOptions).map(opt => opt.value);
            const subject = document.getElementById('mailSubject').value.trim();
            const content = document.getElementById('mailContent').value.trim();
            const files = document.getElementById('mailAttachments').files;
            if (!content && !subject && !recipientIds.length) {
                showModal('alert', 'Please enter some content to save as a draft');
                return;
            }
            const emp = getEmployee(currentUser.id);
            emp.drafts = emp.drafts || [];
            (async () => {
                const attachments = await Promise.all(Array.from(files).map(async file => {
                    const reader = new FileReader();
                    return new Promise(resolve => {
                        reader.onload = () => resolve({ name: file.name, url: reader.result });
                        reader.readAsDataURL(file);
                    });
                }));
                emp.drafts.push({
                    id: Date.now().toString(),
                    recipientIds,
                    recipients: recipientIds.map(id => getEmployee(id).profile.name),
                    subject,
                    content,
                    timestamp: new Date().toLocaleString(),
                    attachments: attachments.length ? attachments : null
                });
                updateEmployee(emp);
                closeModal('composeMail');
                showModal('alert', '<span class="success-tick"></span> Draft saved successfully!');
                playSuccessSound();
                addNotification('mail', 'Draft saved!', 'mail');
                renderMail();
                clockInActions.push(`Saved draft: ${subject || 'No subject'}`);
            })();
        });
    }

    const sendMailBtn = document.getElementById('sendMailBtn');
    if (sendMailBtn && !sendMailBtn.dataset.listener) {
        sendMailBtn.dataset.listener = 'true';
        sendMailBtn.addEventListener('click', () => {
            const draftIndex = sendMailBtn.dataset.draftIndex;
            if (draftIndex !== undefined) {
                sendDraft(draftIndex);
            } else {
                const recipientIds = Array.from(document.getElementById('mailRecipients').selectedOptions).map(opt => opt.value);
                const subject = document.getElementById('mailSubject').value.trim();
                const content = document.getElementById('mailContent').value.trim();
                const files = document.getElementById('mailAttachments').files;
                const mailError = document.getElementById('mailError');
                if (!recipientIds.length || recipientIds.includes('')) {
                    if (mailError) mailError.classList.remove('hidden');
                    setTimeout(() => { if (mailError) mailError.classList.add('hidden'); }, 2000);
                    return;
                }
                if (!content) {
                    showModal('alert', 'Please enter a message');
                    return;
                }
                showModal('alert', 'Sending...');
                const emp = getEmployee(currentUser.id);
                const timestamp = new Date().toLocaleString();
                (async () => {
                    const attachments = await Promise.all(Array.from(files).map(async file => {
                        const reader = new FileReader();
                        return new Promise(resolve => {
                            reader.onload = () => resolve({ name: file.name, url: reader.result });
                            reader.readAsDataURL(file);
                        });
                    }));
                    const mailData = {
                        id: Date.now().toString(),
                        from: emp.profile.name,
                        senderId: currentUser.id,
                        to: recipientIds.map(id => getEmployee(id).profile.name),
                        recipientIds,
                        subject,
                        content,
                        timestamp,
                        attachments: attachments.length ? attachments : null,
                        thread: []
                    };
                    emp.sentMail = emp.sentMail || [];
                    emp.sentMail.push(mailData);
                    recipientIds.forEach(id => {
                        const recipient = getEmployee(id);
                        recipient.mail = recipient.mail || [];
                        recipient.mail.push(mailData);
                        updateEmployee(recipient);
                        sendDM(id, `New message from ${emp.profile.name}: ${subject}\n${content}`);
                        addNotification('mail', `New message from ${emp.profile.name}: ${subject}`, 'mail', id);
                    });
                    updateEmployee(emp);
                    showMailDeliveryAnimation();
                    showModal('alert', '<span class="success-tick"></span> Successfully sent!');
                    playSuccessSound();
                    addNotification('mail', 'Your mail has been sent!', 'mail');
                    closeModal('composeMail');
                    renderMail();
                    clockInActions.push(`Sent mail: ${subject || 'No subject'}`);
                })();
            }
        });
    }

    const replyMailBtn = document.getElementById('replyMailBtn');
    if (replyMailBtn && !replyMailBtn.dataset.listener) {
        replyMailBtn.dataset.listener = 'true';
        replyMailBtn.addEventListener('click', () => {
            if (!currentMail) return;
            document.getElementById('replyMailRecipients').value = currentMail.senderId;
            document.getElementById('replyMailSubject').value = `Re: ${currentMail.subject || 'No Subject'}`;
            document.getElementById('replyMailContent').value = `\n\n--- Original Message ---\nFrom: ${currentMail.from}\nSent: ${currentMail.timestamp}\n\n${currentMail.content}`;
            showModal('replyMail');
        });
    }

    const sendReplyMailBtn = document.getElementById('sendReplyMailBtn');
    if (sendReplyMailBtn && !sendReplyMailBtn.dataset.listener) {
        sendReplyMailBtn.dataset.listener = 'true';
        sendReplyMailBtn.addEventListener('click', () => {
            const recipientId = document.getElementById('replyMailRecipients').value;
            const subject = document.getElementById('replyMailSubject').value.trim();
            const content = document.getElementById('replyMailContent').value.trim();
            const files = document.getElementById('replyMailAttachments').files;
            if (!recipientId || !content) {
                showModal('alert', 'Please select a recipient and enter a message');
                return;
            }
            showModal('alert', 'Sending...');
            const emp = getEmployee(currentUser.id);
            const timestamp = new Date().toLocaleString();
            (async () => {
                const attachments = await Promise.all(Array.from(files).map(async file => {
                    const reader = new FileReader();
                    return new Promise(resolve => {
                        reader.onload = () => resolve({ name: file.name, url: reader.result });
                        reader.readAsDataURL(file);
                    });
                }));
                const replyData = {
                    from: emp.profile.name,
                    senderId: currentUser.id,
                    content,
                    timestamp,
                    attachments: attachments.length ? attachments : null
                };
                const recipient = getEmployee(recipientId);
                recipient.mail = recipient.mail || [];
                const originalMail = recipient.mail.find(m => m.id === currentMail.id);
                if (originalMail) {
                    originalMail.thread = originalMail.thread || [];
                    originalMail.thread.push(replyData);
                    updateEmployee(recipient);
                }
                emp.sentMail = emp.sentMail || [];
                emp.sentMail.push({
                    id: Date.now().toString(),
                    from: emp.profile.name,
                    senderId: currentUser.id,
                    to: [recipient.profile.name],
                    recipientIds: [recipientId],
                    subject,
                    content,
                    timestamp,
                    attachments: attachments.length ? attachments : null,
                    thread: []
                });
                updateEmployee(emp);
                sendDM(recipientId, `New reply from ${emp.profile.name}: ${subject}\n${content}`);
                addNotification('mail', `New reply from ${emp.profile.name}: ${subject}`, 'mail', recipientId);
                showMailDeliveryAnimation();
                showModal('alert', '<span class="success-tick"></span> Reply sent successfully!');
                playSuccessSound();
                addNotification('mail', 'Your reply has been sent!', 'mail');
                closeModal('replyMail');
                closeModal('viewMail');
                renderMail();
                clockInActions.push(`Sent reply: ${subject}`);
            })();
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn && !logoutBtn.dataset.listener) {
        logoutBtn.dataset.listener = 'true';
        logoutBtn.addEventListener('click', () => {
            if (isClockedIn) {
                showModal('alert', 'Please clock out before logging out');
                return;
            }
            showScreen('goodbye');
            setTimeout(() => {
                resetEmployeeData(currentUser.id);
                currentUser = null;
                localStorage.removeItem('currentUser');
                localStorage.removeItem('lastProcessedCode');
                showScreen('discord');
            }, 3000);
        });
    }

    // Initialize
    preloadAudio();
    handleOAuthRedirect();
});