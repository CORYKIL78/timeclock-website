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
const SUCCESS_SOUND_URL = 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_9d4a8d3f8d.mp3';
const ABSENCE_CHANNEL = '1417583684525232291';
const TIMECLOCK_CHANNEL = '1417583684525232291';
const NOTIFICATION_CHANNEL = '1417583684525232291';

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
    resetProfile: document.getElementById('resetProfileModal'),
    alert: document.getElementById('alertModal'),
    composeMail: document.getElementById('composeMailModal')
};

let currentUser = null;
let clockInTime = null;
let currentTasks = [];
let employees = JSON.parse(localStorage.getItem('employees')) || [];
let notifications = [];
let isClockedIn = false;
let clockInActions = [];
let clockInInterval = null;

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
    const txt = `Clock in: ${inStr}\nClock out: ${outStr}\nPeriod: ${duration}\nActions: ${actions || 'None'}`;
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeclock_${user.profile.name.replace(/[^a-z0-9]/gi, '_')}_${inStr.replace(/[^a-z0-9]/gi, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
        onLOA: false 
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
        if (!notif.read) {
            const li = document.createElement('li');
            li.textContent = notif.message;
            if (index === 0) li.classList.add('latest');
            li.addEventListener('click', () => {
                notifications[index].read = true;
                localStorage.setItem(`notifications_${currentUser.id}`, JSON.stringify(notifications));
                if (notif.link) showScreen(notif.link);
                renderNotifications();
            });
            list.appendChild(li);
        }
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
    }
}

document.getElementById('discordLoginBtn').addEventListener('click', () => {
    const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify&prompt=none`;
    console.log('Initiating OAuth redirect:', oauthUrl);
    window.location.href = oauthUrl;
});

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
                    console.log('Found valid session, redirecting to mainMenu');
                    showScreen('mainMenu');
                    updateSidebarProfile();
                    renderNotifications();
                    updateMainScreen();
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

    // Prevent reprocessing the same code
    if (localStorage.getItem('lastProcessedCode') === code) {
        console.log('Code already processed, redirecting to mainMenu');
        window.history.replaceState({}, document.title, REDIRECT_URI);
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                if (currentUser.id) {
                    showScreen('mainMenu');
                    updateSidebarProfile();
                    renderNotifications();
                    updateMainScreen();
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
            throw new Error(`Member fetch failed: ${response.status} ${errorText}`);
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

    currentUser = {
        id: user.id,
        name: user.global_name || user.username,
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : '',
        roles: member.roles,
        profile: getEmployee(user.id).profile,
        absences: getEmployee(user.id).absences || [],
        strikes: getEmployee(user.id).strikes || [],
        payslips: getEmployee(user.id).payslips || [],
        mail: getEmployee(user.id).mail || []
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

    // Save user session
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    console.log('User session saved:', currentUser.id);

    const profile = getEmployee(currentUser.id).profile;
    if (!profile.name) {
        console.log('No profile name, redirecting to setupWelcome');
        showScreen('setupWelcome');
    } else {
        console.log('Profile found, redirecting to confirm screen');
        document.getElementById('confirmName').textContent = profile.name;
        document.getElementById('confirmRole').textContent = 'Verified Role: Staff';
        showScreen('confirm');
    }

    window.history.replaceState({}, document.title, REDIRECT_URI);
}

document.getElementById('setupStartBtn').addEventListener('click', () => {
    console.log('Setup start button clicked');
    showScreen('setupEmail');
});

document.getElementById('setupEmailContinueBtn').addEventListener('click', () => {
    const email = document.getElementById('setupEmailInput').value.trim();
    if (email) {
        currentUser.profile.email = email;
        showScreen('setupName');
    } else {
        showModal('alert', 'Please enter your email');
    }
});

document.getElementById('setupNameContinueBtn').addEventListener('click', () => {
    const name = document.getElementById('setupNameInput').value.trim();
    if (name) {
        currentUser.profile.name = name;
        showScreen('setupDepartment');
    } else {
        showModal('alert', 'Please enter your name');
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
                console.log('Role verification successful, redirecting to setupComplete');
                showScreen('setupComplete');
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

document.getElementById('setupCompleteBtn').addEventListener('click', () => {
    console.log('Setup complete, redirecting to portalWelcome');
    showScreen('portalWelcome');
    document.getElementById('portalWelcomeName').textContent = currentUser.profile.name;
    setTimeout(() => {
        showScreen('mainMenu');
        updateSidebarProfile();
        renderNotifications();
        updateMainScreen();
    }, 3000);
});

document.getElementById('continueBtn').addEventListener('click', () => {
    console.log('Continue button clicked, redirecting to portalWelcome');
    showScreen('portalWelcome');
    document.getElementById('portalWelcomeName').textContent = currentUser.profile.name;
    setTimeout(() => {
        showScreen('mainMenu');
        updateSidebarProfile();
        renderNotifications();
        updateMainScreen();
    }, 3000);
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
    currentUser.roles.forEach(role => {
        const li = document.createElement('li');
        li.textContent = role;
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
    document.getElementById('absenceForm').classList.toggle('hidden');
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
    document.getElementById('absenceForm').classList.add('hidden');
    showModal('alert', 'Absence request submitted');
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
    const emp = getEmployee(currentUser.id);
    await sendWebhook(`<@${currentUser.id}> (${emp.profile.name}) clocked in at ${new Date().toLocaleString()}`);
    clockInInterval = setInterval(() => {
        const elapsed = Date.now() - clockInTime;
        document.getElementById('clockDisplay').textContent = formatTime(elapsed);
    }, 1000);
});

document.getElementById('clockOutBtn').addEventListener('click', async () => {
    const clockOutTime = Date.now();
    clearInterval(clockInInterval);
    isClockedIn = false;
    document.getElementById('clockInBtn').disabled = false;
    document.getElementById('clockOutBtn').disabled = true;
    document.getElementById('clockDisplay').textContent = '';
    const emp = getEmployee(currentUser.id);
    await sendWebhook(`<@${currentUser.id}> (${emp.profile.name}) clocked out at ${new Date().toLocaleString()}`);
    downloadTXT(currentUser, clockInTime, clockOutTime, clockInActions.join(', '));
    localStorage.removeItem('clockInTime');
    clockInTime = null;
});

document.getElementById('mailBtn').addEventListener('click', () => {
    showScreen('mail');
    const content = document.getElementById('mailContent');
    content.innerHTML = '';
    const emp = getEmployee(currentUser.id);
    emp.mail.forEach(m => {
        const div = document.createElement('div');
        div.innerHTML = `
            <p>From: ${m.from}</p>
            <p>Message: ${m.content}</p>
            <p>Timestamp: ${m.timestamp}</p>
        `;
        content.appendChild(div);
    });
});

document.getElementById('composeMailBtn').addEventListener('click', () => {
    showModal('composeMail');
});

document.getElementById('sendMailBtn').addEventListener('click', () => {
    const recipient = document.getElementById('mailRecipient').value.trim();
    const content = document.getElementById('mailContent').value.trim();
    if (!recipient || !content) {
        showModal('alert', 'Please fill all fields');
        return;
    }
    const emp = employees.find(e => e.profile.name === recipient);
    if (!emp) {
        showModal('alert', 'Recipient not found');
        return;
    }
    emp.mail = emp.mail || [];
    emp.mail.push({
        from: currentUser.profile.name,
        content,
        timestamp: new Date().toLocaleString()
    });
    updateEmployee(emp);
    closeModal('composeMail');
    showModal('alert', 'Mail sent');
    playSuccessSound();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    console.log('Logging out, clearing currentUser');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('clockInTime');
    localStorage.removeItem('lastProcessedCode');
    document.getElementById('goodbyeName').textContent = currentUser.profile.name;
    showScreen('goodbye');
    setTimeout(() => showScreen('discord'), 3000);
});

document.querySelector('.sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('extended');
});

function updateSidebarProfile() {
    console.log('Updating sidebar profile');
    document.getElementById('sidebarProfilePic').src = currentUser.avatar || 'https://via.placeholder.com/100';
}

document.getElementById('modeToggle').addEventListener('change', (e) => {
    document.body.classList.toggle('dark', e.target.checked);
    localStorage.setItem('darkMode', e.target.checked);
});

document.querySelectorAll('.close').forEach(close => {
    close.addEventListener('click', () => closeModal(close.parentNode.parentNode.id));
});

window.addEventListener('load', () => {
    console.log('Window loaded, checking OAuth state');
    const savedUser = localStorage.getItem('currentUser');
    const darkMode = localStorage.getItem('darkMode') === 'true';
    document.getElementById('modeToggle').checked = darkMode;
    document.body.classList.toggle('dark', darkMode);

    if (new URLSearchParams(window.location.search).get('code')) {
        console.log('Detected OAuth code, processing redirect');
        handleOAuthRedirect();
    } else if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            if (currentUser.id) {
                console.log('Found saved user, loading mainMenu');
                showScreen('mainMenu');
                updateSidebarProfile();
                renderNotifications();
                updateMainScreen();
            } else {
                console.log('Invalid saved user, showing discord screen');
                localStorage.removeItem('currentUser');
                showScreen('discord');
            }
        } catch (e) {
            console.error('Error parsing saved user:', e);
            localStorage.removeItem('currentUser');
            showScreen('discord');
        }
    } else {
        console.log('No user session, showing discord screen');
        showScreen('discord');
    }
});

window.addEventListener('hashchange', () => {
    const screenId = window.location.hash.slice(1);
    if (screens[screenId]) {
        console.log('Hash changed, showing screen:', screenId);
        showScreen(screenId);
        if (screenId === 'mainMenu') updateMainScreen();
        else if (screenId === 'tasks') document.getElementById('tasksBtn').click();
        else if (screenId === 'absences') document.getElementById('absencesBtn').click();
        else if (screenId === 'payslips') document.getElementById('payslipsBtn').click();
        else if (screenId === 'disciplinaries') document.getElementById('disciplinariesBtn').click();
        else if (screenId === 'timeclock') document.getElementById('timeclockBtn').click();
        else if (screenId === 'mail') document.getElementById('mailBtn').click();
    }
});