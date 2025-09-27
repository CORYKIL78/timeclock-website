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
const REDIRECT_URI = 'https://corykil78.github.io/timeclock-website';
const SUCCESS_SOUND_URL = 'https://cdn.pixabay.com/audio/2023/01/07/audio_cae2a6c2fc.mp3';
const ABSENCE_CHANNEL = '1417583684525232291';
const TIMECLOCK_CHANNEL = '1322975014110236716';
const NOTIFICATION_CHANNEL = '1322975014110236716';

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
    deptChange: document.getElementById('deptChangeModal')
};

let currentUser = null;
let clockInTime = null;
let currentTasks = [];
let employees = JSON.parse(localStorage.getItem('employees')) || [];
let notifications = [];
let isClockedIn = false;
let clockInActions = [];
let clockInInterval = null;
let previousSessions = JSON.parse(localStorage.getItem('previousSessions')) || [];
let roleNames = {};

function showScreen(screenId) {
    console.log('Showing screen:', screenId);
    Object.values(screens).forEach(s => {
        if (s) {
            s.classList.remove('active');
            s.style.opacity = '0';
        }
    });
    if (screens[screenId]) {
        screens[screenId].classList.add('active');
        setTimeout(() => {
            screens[screenId].style.opacity = '1';
        }, 10);
        window.location.hash = screenId;
        const sidebar = document.getElementById('sidebar');
        const notificationPanel = document.getElementById('notificationPanel');
        if (['mainMenu', 'myProfile', 'myRoles', 'tasks', 'absences', 'payslips', 'disciplinaries', 'timeclock', 'mail'].includes(screenId)) {
            sidebar.classList.remove('hidden');
            notificationPanel.classList.remove('hidden');
        } else {
            sidebar.classList.add('hidden');
            notificationPanel.classList.add('hidden');
        }
    } else {
        console.error('Screen not found:', screenId);
        showScreen('discord');
    }
}

function showModal(modalId, message = '') {
    console.log('Showing modal:', modalId, message);
    document.getElementById('alertMessage').innerHTML = message;
    if (modals[modalId]) {
        modals[modalId].style.display = 'flex';
    } else {
        console.error('Modal not found:', modalId);
    }
}

function closeModal(modalId) {
    console.log('Closing modal:', modalId);
    if (modals[modalId]) {
        modals[modalId].style.display = 'none';
    }
}

function playSuccessSound() {
    const audio = new Audio(SUCCESS_SOUND_URL);
    audio.play().catch(e => console.error('Sound error:', e));
}

function formatTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function sendWebhook(content) {
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        if (!response.ok) throw new Error(`Webhook failed: ${response.status} ${await response.text()}`);
        console.log('Webhook sent successfully:', content);
    } catch (e) {
        console.error('Webhook error:', e);
    }
}

async function sendEmbed(channelId, embed) {
    try {
        const response = await fetch(`${WORKER_URL}/postEmbed?channel_id=${channelId}&embed_json=${encodeURIComponent(JSON.stringify(embed))}`);
        if (!response.ok) throw new Error(`Embed failed: ${response.status} ${await response.text()}`);
        console.log('Embed sent successfully to channel:', channelId);
    } catch (e) {
        console.error('Embed error:', e);
    }
}

async function sendDM(userId, message) {
    try {
        const response = await fetch(`${WORKER_URL}/sendDM?user_id=${userId}&message=${encodeURIComponent(message)}`);
        if (!response.ok) throw new Error(`DM failed: ${response.status} ${await response.text()}`);
        console.log('DM sent successfully to user:', userId);
    } catch (e) {
        console.error('DM error:', e);
    }
}

function downloadTXT(user, clockInTime, clockOutTime, actions) {
    const duration = formatTime(clockOutTime - clockInTime);
    const inStr = new Date(clockInTime).toLocaleString();
    const outStr = new Date(clockOutTime).toLocaleString();
    const txt = `Clock in: ${inStr}\nClock out: ${outStr}\nDuration: ${duration}\nActions: ${actions.join(', ') || 'None'}`;
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeclock_${user.profile.name.replace(/[^a-z0-9]/gi, '_')}_${inStr.replace(/[^a-z0-9]/gi, '_')}.txt`;
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
        profile: {}, 
        absences: [], 
        strikes: [], 
        payslips: [], 
        mail: [], 
        onLOA: false,
        pendingDeptChange: null,
        lastLogin: null
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

function addNotification(type, message, link) {
    notifications.push({ id: Date.now().toString(), type, message, link, read: false, timestamp: new Date().toLocaleString() });
    localStorage.setItem(`notifications_${currentUser.id}`, JSON.stringify(notifications));
    renderNotifications();
}

function renderNotifications() {
    notifications = JSON.parse(localStorage.getItem(`notifications_${currentUser.id}`)) || [];
    const list = document.getElementById('notificationList');
    if (!list) {
        console.error('Notification list element not found');
        return;
    }
    list.innerHTML = '';
    notifications.forEach((notif, index) => {
        const li = document.createElement('li');
        li.textContent = notif.message;
        if (index === 0) li.classList.add('latest');
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'delete-notification';
        deleteBtn.innerHTML = '🗑';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifications.splice(index, 1);
            localStorage.setItem(`notifications_${currentUser.id}`, JSON.stringify(notifications));
            renderNotifications();
        });
        li.appendChild(deleteBtn);
        li.addEventListener('click', () => {
            notifications[index].read = true;
            localStorage.setItem(`notifications_${currentUser.id}`, JSON.stringify(notifications));
            if (notif.link) showScreen(notif.link);
            renderNotifications();
        });
        list.appendChild(li);
    });
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
        div.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            const txt = `Clock in: ${session.clockIn}\nClock out: ${session.clockOut}\nDuration: ${session.duration}\nActions: ${session.actions || 'None'}`;
            const blob = new Blob([txt], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `timeclock_${currentUser.profile.name.replace(/[^a-z0-9]/gi, '_')}_${session.clockIn.replace(/[^a-z0-9]/gi, '_')}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        });
        list.appendChild(div);
    });
}

function updateSidebarProfile() {
    const emp = getEmployee(currentUser.id);
    document.getElementById('sidebarProfilePic').src = currentUser.avatar || 'https://via.placeholder.com/100';
}

function updateMainScreen() {
    console.log('Updating main screen for user:', currentUser.id);
    const emp = getEmployee(currentUser.id);
    document.getElementById('mainWelcomeName').textContent = emp.profile.name || 'User';
    document.getElementById('mainProfilePic').src = currentUser.avatar || 'https://via.placeholder.com/100';
    if (emp.onLOA) {
        showModal('alert', 'You are currently on a Leave of Absence');
        document.getElementById('clockInBtn').disabled = true;
        document.getElementById('clockOutBtn').disabled = true;
    } else {
        document.getElementById('clockInBtn').disabled = isClockedIn;
        document.getElementById('clockOutBtn').disabled = !isClockedIn;
        document.getElementById('clockOutBtn').classList.toggle('hidden', !isClockedIn);
        document.getElementById('sessionInfo').classList.toggle('hidden', !isClockedIn);
    }
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
        console.log('No OAuth code provided, checking for saved session');
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                if (currentUser.id) {
                    console.log('Found valid session, redirecting to portalWelcome');
                    const emp = getEmployee(currentUser.id);
                    document.getElementById('portalWelcomeName').textContent = emp.profile.name;
                    document.getElementById('portalLastLogin').textContent = emp.lastLogin || 'Never';
                    showScreen('portalWelcome');
                    updateSidebarProfile();
                    renderNotifications();
                    return;
                } else {
                    console.log('Invalid saved user data, clearing');
                    localStorage.removeItem('currentUser');
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
                    document.getElementById('portalWelcomeName').textContent = emp.profile.name;
                    document.getElementById('portalLastLogin').textContent = emp.lastLogin || 'Never';
                    showScreen('portalWelcome');
                    updateSidebarProfile();
                    renderNotifications();
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
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Auth failed: ${response.status} ${errorText}`);
        }
        user = await response.json();
        console.log('User data received:', user);
    } catch (e) {
        console.error('Auth fetch error:', e.message);
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
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Member fetch failed: ${response.status} ${await response.text()}`);
        }
        member = await response.json();
        console.log('Member data received:', member);
    } catch (e) {
        console.error('Member fetch error:', e.message);
        showModal('alert', `Failed to fetch member data: ${e.message}. Please try again.`);
        localStorage.removeItem('lastProcessedCode');
        window.history.replaceState({}, document.title, REDIRECT_URI);
        showScreen('discord');
        return;
    }

    await fetchRoleNames();

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
    updateEmployee(emp);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    console.log('User session saved:', currentUser.id);

    if (!currentUser.profile.name) {
        console.log('No profile name, redirecting to setupWelcome');
        showScreen('setupWelcome');
    } else {
        console.log('Profile found, redirecting to portalWelcome');
        document.getElementById('portalWelcomeName').textContent = emp.profile.name;
        document.getElementById('portalLastLogin').textContent = emp.lastLogin;
        showScreen('portalWelcome');
    }

    window.history.replaceState({}, document.title, REDIRECT_URI);
}

function startTutorial() {
    console.log('Starting tutorial');
    showScreen('mainMenu');
    updateSidebarProfile();
    renderNotifications();
    updateMainScreen();

    const steps = [
        {
            element: document.querySelector('.sidebar-toggle'),
            text: 'This is the side menu. You can access different pages.',
            action: () => document.querySelector('.sidebar-toggle').click()
        },
        {
            element: document.getElementById('sidebarNav'),
            text: 'These are all of your pages. You can submit LOAs, view disciplinaries, payslips, etc!',
            action: () => setTimeout(() => {
                document.getElementById('mailBtn').click();
            }, 6000)
        },
        {
            element: document.getElementById('composeMailBtn'),
            text: 'Compose mail here!',
            action: () => document.getElementById('composeMailBtn').click()
        },
        {
            element: document.getElementById('mailContent'),
            text: 'Tutorial complete! Check your mail for a welcome message.',
            action: () => {
                const emp = getEmployee(currentUser.id);
                emp.mail = emp.mail || [];
                emp.mail.push({
                    from: 'Cirkle Development',
                    content: `Dear ${emp.profile.name}, Welcome to your new Staff Portal. You are now finished this tutorial. Please have a look around and get familiar with everything. We hope you like it! Kind Regards, Cirkle Development.`,
                    timestamp: new Date().toLocaleString()
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

function renderMail() {
    const content = document.getElementById('mailContent');
    if (!content) return;
    content.innerHTML = '';
    const emp = getEmployee(currentUser.id);
    emp.mail.forEach((m, index) => {
        const div = document.createElement('div');
        div.className = 'mail-item';
        div.innerHTML = `
            <p><strong>From:</strong> ${m.from}</p>
            <p>${m.content}</p>
            <p><em>${m.timestamp}</em></p>
        `;
        content.appendChild(div);
    });

    const recipientSelect = document.getElementById('mailRecipient');
    recipientSelect.innerHTML = '<option value="">Select Recipient</option>';
    employees.filter(e => e.profile.name && e.id !== currentUser.id).forEach(e => {
        const option = document.createElement('option');
        option.value = e.id;
        option.textContent = e.profile.name;
        recipientSelect.appendChild(option);
    });
}

document.getElementById('discordLoginBtn').addEventListener('click', () => {
    const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify&prompt=none`;
    console.log('Initiating OAuth redirect:', oauthUrl);
    window.location.href = oauthUrl;
});

document.getElementById('setupStartBtn').addEventListener('click', () => {
    console.log('Setup start button clicked');
    showScreen('setupEmail');
});

document.getElementById('setupEmailContinueBtn').addEventListener('click', () => {
    const email = document.getElementById('setupEmailInput').value.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        currentUser.profile.email = email;
        showScreen('setupName');
    } else {
        showModal('alert', 'Please enter a valid email with @ and a domain (e.g., example.com)');
    }
});

document.getElementById('setupNameContinueBtn').addEventListener('click', () => {
    const name = document.getElementById('setupNameInput').value.trim();
    if (name) {
        currentUser.profile.name = name;
        showScreen('setupDepartment');
    } else {
        showModal('alert', 'Please enter your first and last name');
    }
});

document.getElementById('setupDepartmentContinueBtn').addEventListener('click', () => {
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
        }, 20000);
    } else {
        showModal('alert', 'Please select a department');
    }
});

document.getElementById('continueBtn').addEventListener('click', () => {
    console.log('Finalise button clicked, redirecting to setupComplete');
    showScreen('setupComplete');
    document.getElementById('setupWelcomeName').textContent = currentUser.profile.name;
    setTimeout(() => startTutorial(), 3000);
});

document.getElementById('portalLoginBtn').addEventListener('click', () => {
    console.log('Portal login button clicked, redirecting to mainMenu');
    showScreen('mainMenu');
    updateSidebarProfile();
    renderNotifications();
    updateMainScreen();
});

document.getElementById('mainProfilePic').addEventListener('click', () => {
    showScreen('myProfile');
    const emp = getEmployee(currentUser.id);
    document.getElementById('profileName').textContent = emp.profile.name || 'N/A';
    document.getElementById('profileEmail').textContent = emp.profile.email || 'N/A';
    document.getElementById('profileDepartment').textContent = emp.profile.department || 'N/A';
    document.getElementById('profileDepartment').classList.toggle('pending-department', !!emp.pendingDeptChange);
    document.getElementById('updateNameInput').value = emp.profile.name || '';
    document.getElementById('updateEmailInput').value = emp.profile.email || '';
});

document.getElementById('homeBtn').addEventListener('click', () => {
    console.log('Home button clicked');
    showScreen('mainMenu');
    updateMainScreen();
});

document.getElementById('myProfileBtn').addEventListener('click', () => {
    showScreen('myProfile');
    const emp = getEmployee(currentUser.id);
    document.getElementById('profileName').textContent = emp.profile.name || 'N/A';
    document.getElementById('profileEmail').textContent = emp.profile.email || 'N/A';
    document.getElementById('profileDepartment').textContent = emp.profile.department || 'N/A';
    document.getElementById('profileDepartment').classList.toggle('pending-department', !!emp.pendingDeptChange);
    document.getElementById('updateNameInput').value = emp.profile.name || '';
    document.getElementById('updateEmailInput').value = emp.profile.email || '';
});

document.getElementById('updateProfileBtn').addEventListener('click', () => {
    const name = document.getElementById('updateNameInput').value.trim();
    const email = document.getElementById('updateEmailInput').value.trim();
    if (name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const emp = getEmployee(currentUser.id);
        emp.profile.name = name;
        emp.profile.email = email;
        updateEmployee(emp);
        currentUser.profile = emp.profile;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showModal('alert', '<span class="success-tick"></span> Profile updated successfully!');
        playSuccessSound();
        document.getElementById('profileName').textContent = name;
        document.getElementById('profileEmail').textContent = email;
    } else {
        showModal('alert', 'Please enter a valid name and email');
    }
});

document.getElementById('changeDeptBtn').addEventListener('click', () => {
    showModal('deptChange');
});

document.getElementById('submitDeptChangeBtn').addEventListener('click', () => {
    const selectedDept = document.querySelector('input[name="newDepartment"]:checked');
    if (selectedDept) {
        const emp = getEmployee(currentUser.id);
        emp.pendingDeptChange = selectedDept.value;
        updateEmployee(emp);
        currentUser.pendingDeptChange = emp.pendingDeptChange;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        sendEmbed(ABSENCE_CHANNEL, {
            title: 'Department Change Request',
            description: `User: <@${currentUser.id}> (${emp.profile.name})\nRequested Department: ${selectedDept.value}`,
            color: 0xffff00
        });
        closeModal('deptChange');
        showModal('alert', '<span class="success-tick"></span> Request to change department has been sent.');
        playSuccessSound();
        document.getElementById('profileDepartment').textContent = emp.profile.department;
        document.getElementById('profileDepartment').classList.add('pending-department');
    } else {
        showModal('alert', 'Please select a department');
    }
});

document.getElementById('resetProfileBtn').addEventListener('click', () => {
    showModal('resetProfile');
});

document.getElementById('confirmResetBtn').addEventListener('click', () => {
    resetEmployeeData(currentUser.id);
    closeModal('resetProfile');
    showScreen('setupWelcome');
});

document.getElementById('myRolesBtn').addEventListener('click', () => {
    showScreen('myRoles');
    const list = document.getElementById('rolesList');
    list.innerHTML = '';
    currentUser.roles.forEach(roleId => {
        const li = document.createElement('li');
        li.textContent = `${roleNames[roleId] || 'Unknown Role'} (${roleId})`;
        list.appendChild(li);
    });
});

document.getElementById('tasksBtn').addEventListener('click', () => {
    showScreen('tasks');
    loadTasks();
});

document.getElementById('addTaskBtn').addEventListener('click', () => {
    const taskText = document.getElementById('taskInput').value.trim();
    if (taskText) {
        currentTasks.push({ text: taskText, completed: false });
        saveTasks();
        renderTasks();
        document.getElementById('taskInput').value = '';
    }
});

document.getElementById('absencesBtn').addEventListener('click', () => {
    showScreen('absences');
    renderAbsences('pending');
});

document.getElementById('requestAbsenceBtn').addEventListener('click', () => {
    showModal('absenceRequest');
});

document.getElementById('submitAbsenceBtn').addEventListener('click', async () => {
    const type = document.getElementById('absenceType').value;
    const startDate = document.getElementById('absenceStartDate').value;
    const endDate = document.getElementById('absenceEndDate').value;
    const comment = document.getElementById('absenceComment').value.trim();
    if (!startDate || !endDate || !comment) {
        showModal('alert', 'Please fill all fields');
        return;
    }
    const emp = getEmployee(currentUser.id);
    emp.absences = emp.absences || [];
    emp.absences.push({ id: Date.now().toString(), type, startDate, endDate, comment, status: 'pending' });
    updateEmployee(emp);
    await sendEmbed(ABSENCE_CHANNEL, {
        title: 'New Absence Request',
        description: `User: <@${currentUser.id}> (${emp.profile.name})\nType: ${type}\nStart: ${startDate}\nEnd: ${endDate}\nComment: ${comment}`,
        color: 0xffff00
    });
    closeModal('absenceRequest');
    showModal('alert', '<span class="success-tick"></span> Successfully Submitted!');
    playSuccessSound();
    renderAbsences('pending');
});

document.getElementById('absencesScreen').addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        renderAbsences(e.target.dataset.tab);
    }
});

function renderAbsences(tab) {
    const content = document.getElementById('absencesContent');
    if (!content) return;
    content.innerHTML = '';
    const emp = getEmployee(currentUser.id);
    emp.absences.filter(a => a.status === tab).forEach(a => {
        const div = document.createElement('div');
        div.className = `absence-item ${a.status}`;
        div.innerHTML = `
            <p>Type: ${a.type}</p>
            <p>Comment: ${a.comment}</p>
            <p>Start: ${a.startDate}</p>
            <p>End: ${a.endDate}</p>
            ${a.status === 'rejected' ? `<p>Reason: ${a.reason || 'N/A'}</p>` : ''}
        `;
        content.appendChild(div);
    });
}

document.getElementById('payslipsBtn').addEventListener('click', () => {
    showScreen('payslips');
    const content = document.getElementById('payslipsContent');
    content.innerHTML = '';
    const emp = getEmployee(currentUser.id);
    emp.payslips.forEach(p => {
        const div = document.createElement('div');
        div.innerHTML = `
            <p>Issued: ${p.timestamp}</p>
            <a href="${p.fileBase64}" download="payslip_${p.timestamp.replace(/[^a-z0-9]/gi, '_')}.pdf">Download</a>
        `;
        content.appendChild(div);
    });
});

document.getElementById('disciplinariesBtn').addEventListener('click', () => {
    showScreen('disciplinaries');
    const content = document.getElementById('disciplinariesContent');
    content.innerHTML = '';
    const emp = getEmployee(currentUser.id);
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
});

document.getElementById('timeclockBtn').addEventListener('click', () => {
    showScreen('timeclock');
    updateMainScreen();
});

document.getElementById('clockInBtn').addEventListener('click', async () => {
    clockInTime = Date.now();
    localStorage.setItem('clockInTime', clockInTime);
    isClockedIn = true;
    clockInActions = [];
    document.getElementById('clockInBtn').disabled = true;
    document.getElementById('clockOutBtn').disabled = false;
    document.getElementById('clockOutBtn').classList.remove('hidden');
    document.getElementById('sessionInfo').classList.remove('hidden');
    const emp = getEmployee(currentUser.id);
    await sendWebhook(`<@${currentUser.id}> (${emp.profile.name}) clocked in at ${new Date().toLocaleString()}`);
    showModal('alert', '<span class="success-tick"></span> You have clocked in!');
    playSuccessSound();
    clockInInterval = setInterval(() => {
        const elapsed = Date.now() - clockInTime;
        document.getElementById('sessionInfo').innerHTML = `
            <p>Session started: ${new Date(clockInTime).toLocaleString()}</p>
            <p>Elapsed: ${formatTime(elapsed)}</p>
            <p>Actions: ${clockInActions.join(', ') || 'None'}</p>
        `;
    }, 1000);
});

document.getElementById('clockOutBtn').addEventListener('click', async () => {
    const clockOutTime = Date.now();
    clearInterval(clockInInterval);
    isClockedIn = false;
    document.getElementById('clockInBtn').disabled = false;
    document.getElementById('clockOutBtn').disabled = true;
    document.getElementById('clockOutBtn').classList.add('hidden');
    document.getElementById('sessionInfo').classList.add('hidden');
    document.getElementById('sessionInfo').innerHTML = '';
    const emp = getEmployee(currentUser.id);
    await sendWebhook(`<@${currentUser.id}> (${emp.profile.name}) clocked out at ${new Date().toLocaleString()}`);
    const session = downloadTXT(currentUser, clockInTime, clockOutTime, clockInActions);
    previousSessions = JSON.parse(localStorage.getItem(`previousSessions_${currentUser.id}`)) || [];
    previousSessions.unshift(session);
    localStorage.setItem(`previousSessions_${currentUser.id}`, JSON.stringify(previousSessions));
    localStorage.removeItem('clockInTime');
    clockInTime = null;
    clockInActions = [];
    showModal('alert', '<span class="success-tick"></span> You have clocked out. Please remember to clock back in again tomorrow!');
    playSuccessSound();
    renderPreviousSessions();
});

document.getElementById('mailBtn').addEventListener('click', () => {
    showScreen('mail');
    renderMail();
});

document.getElementById('composeMailBtn').addEventListener('click', () => {
    showModal('composeMail');
});

document.getElementById('sendMailBtn').addEventListener('click', () => {
    const recipientId = document.getElementById('mailRecipient').value;
    const content = document.getElementById('mailContent').value.trim();
    if (!recipientId || !content) {
        showModal('alert', 'Please select a recipient and enter a message');
        return;
    }
    const emp = getEmployee(currentUser.id);
    const recipient = getEmployee(recipientId);
    recipient.mail = recipient.mail || [];
    recipient.mail.push({
        from: emp.profile.name,
        content,
        timestamp: new Date().toLocaleString()
    });
    updateEmployee(recipient);
    sendDM(recipientId, `New message from ${emp.profile.name}: ${content}`);
    closeModal('composeMail');
    showModal('alert', '<span class="success-tick"></span> Message sent successfully!');
    playSuccessSound();
    document.getElementById('mailContent').value = '';
});

document.getElementById('notificationBtn').addEventListener('click', () => {
    const panel = document.getElementById('notificationPanel');
    panel.classList.toggle('hidden');
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    console.log('Logging out user:', currentUser.id);
    const emp = getEmployee(currentUser.id);
    document.getElementById('goodbyeName').textContent = emp.profile.name || 'User';
    localStorage.removeItem('currentUser');
    localStorage.removeItem('lastProcessedCode');
    localStorage.removeItem('clockInTime');
    if (isClockedIn) {
        clearInterval(clockInInterval);
        isClockedIn = false;
        const session = downloadTXT(currentUser, clockInTime, Date.now(), clockInActions);
        previousSessions = JSON.parse(localStorage.getItem(`previousSessions_${currentUser.id}`)) || [];
        previousSessions.unshift(session);
        localStorage.setItem(`previousSessions_${currentUser.id}`, JSON.stringify(previousSessions));
        sendWebhook(`<@${currentUser.id}> (${emp.profile.name}) clocked out at ${new Date().toLocaleString()} due to logout`);
    }
    showScreen('goodbye');
    setTimeout(() => showScreen('discord'), 2000);
});

document.getElementById('sidebar').addEventListener('click', (e) => {
    if (e.target.classList.contains('sidebar-toggle')) {
        document.getElementById('sidebar').classList.toggle('extended');
    }
});

document.getElementById('modeToggle').addEventListener('change', (e) => {
    document.body.classList.toggle('dark', e.target.checked);
    localStorage.setItem('darkMode', e.target.checked);
});

document.querySelectorAll('.modal .close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
        const modal = closeBtn.closest('.modal');
        const modalId = Object.keys(modals).find(id => modals[id] === modal);
        closeModal(modalId);
    });
});

// Initialize
(function init() {
    console.log('Initializing Staff Portal');
    const savedUser = localStorage.getItem('currentUser');
    const savedClockIn = localStorage.getItem('clockInTime');
    if (savedClockIn) {
        clockInTime = parseInt(savedClockIn);
        isClockedIn = true;
        clockInInterval = setInterval(() => {
            const elapsed = Date.now() - clockInTime;
            document.getElementById('sessionInfo').innerHTML = `
                <p>Session started: ${new Date(clockInTime).toLocaleString()}</p>
                <p>Elapsed: ${formatTime(elapsed)}</p>
                <p>Actions: ${clockInActions.join(', ') || 'None'}</p>
            `;
        }, 1000);
    }
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            if (currentUser.id) {
                const emp = getEmployee(currentUser.id);
                document.getElementById('portalWelcomeName').textContent = emp.profile.name;
                document.getElementById('portalLastLogin').textContent = emp.lastLogin || 'Never';
                showScreen('portalWelcome');
                updateSidebarProfile();
                renderNotifications();
                return;
            }
        } catch (e) {
            console.error('Error parsing saved user:', e);
            localStorage.removeItem('currentUser');
        }
    }
    handleOAuthRedirect();
})();