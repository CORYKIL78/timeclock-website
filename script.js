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
    Object.values(screens).forEach(s => s && s.classList.remove('active'));
    if (screens[screenId]) {
        screens[screenId].classList.add('active');
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
    }
}

function showModal(modalId, message = '') {
    document.getElementById('alertMessage').innerHTML = message;
    modals[modalId].style.display = 'flex';
}

function closeModal(modalId) {
    modals[modalId].style.display = 'none';
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
        console.log('Webhook sent successfully');
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
    if (!list) return;
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

document.getElementById('discordLoginBtn').addEventListener('click', () => {
    const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify&prompt=none`;
    window.location.href = oauthUrl;
});

async function handleOAuthRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    if (error) {
        console.error('OAuth error:', urlParams.get('error_description'));
        showModal('alert', `OAuth error: ${urlParams.get('error_description') || 'Unknown error'}`);
        window.history.replaceState({}, document.title, REDIRECT_URI);
        showScreen('discord');
        return;
    }
    if (!code) {
        showScreen('discord');
        return;
    }

    // Prevent reprocessing if already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser && JSON.parse(savedUser).id) {
        currentUser = JSON.parse(savedUser);
        showScreen('mainMenu');
        updateSidebarProfile();
        renderNotifications();
        updateMainScreen();
        return;
    }

    showScreen('searching');
    await new Promise(r => setTimeout(r, 1000));

    let user;
    try {
        const response = await fetch(`${WORKER_URL}/auth?code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors'
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Auth failed: ${response.status} ${errorText}`);
        }
        user = await response.json();
        window.history.replaceState({}, document.title, REDIRECT_URI);
    } catch (e) {
        console.error('Auth fetch error:', e);
        showModal('alert', `Failed to authenticate: ${e.message}. Please check console for details.`);
        showScreen('discord');
        return;
    }

    showScreen('roles');
    await new Promise(r => setTimeout(r, 1000));

    let member;
    try {
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
    } catch (e) {
        console.error('Member fetch error:', e);
        showModal('alert', `Failed to fetch member: ${e.message}. Please check console for details.`);
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
        showModal('alert', 'You do not have manager permissions');
        showScreen('discord');
        return;
    }

    const profile = getEmployee(currentUser.id).profile;
    if (!profile.name) {
        showScreen('setupWelcome');
    } else {
        document.getElementById('confirmName').textContent = profile.name;
        document.getElementById('confirmRole').textContent = 'Verified Role: Manager';
        showScreen('confirm');
    }
}

document.getElementById('setupStartBtn').addEventListener('click', () => showScreen('setupEmail'));

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
            const deptRole = DEPT_ROLES[currentUser.profile.department};
            if (currentUser.roles.includes(deptRole)) {
                updateEmployee(currentUser);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showScreen('setupComplete');
                playSuccessSound();
            } else {
                showModal('alert', 'Role verification failed');
                showScreen('setupDepartment');
            }
        }, 2000);
    } else {
        showModal('alert', 'Please select a department');
    }
});

document.getElementById('setupCompleteBtn').addEventListener('click', () => {
    showScreen('portalWelcome');
    document.getElementById('portalWelcomeName').textContent = currentUser.profile.name;
    setTimeout(() => {
        showScreen('mainMenu');
        updateSidebarProfile();
        renderNotifications();
    }, 3000);
});

document.getElementById('continueBtn').addEventListener('click', () => {
    showScreen('portalWelcome');
    document.getElementById('portalWelcomeName').textContent = currentUser.profile.name;
    setTimeout(() => {
        showScreen('mainMenu');
        updateSidebarProfile();
        renderNotifications();
    }, 3000);
});

document.getElementById('homeBtn').addEventListener('click', () => showScreen('mainMenu'));

document.getElementById('absencesBtn').addEventListener('click', () => {
    showScreen('absences');
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
    employees.forEach(emp => {
        emp.absences.filter(a => a.status === tab).forEach(a => {
            const div = document.createElement('div');
            div.className = `absence-item ${a.status}`;
            div.innerHTML = `
                <p>User: ${emp.profile.name}</p>
                <p>Type: ${a.type}</p>
                <p>Comment: ${a.comment}</p>
                <p>Start: ${a.startDate}</p>
                <p>End: ${a.endDate}</p>
                ${a.status === 'pending' ? `
                    <button onclick="approveAbsence('${emp.id}', '${a.id}')">Accept</button>
                    <button onclick="showRejectAbsence('${emp.id}', '${a.id}')">Reject</button>
                ` : ''}
            `;
            content.appendChild(div);
        });
    });
}

window.approveAbsence = async (userId, absenceId) => {
    const emp = getEmployee(userId);
    const absence = emp.absences.find(a => a.id === absenceId);
    if (absence) {
        absence.status = 'approved';
        emp.onLOA = true;
        updateEmployee(emp);
        await sendDM(userId, `Your absence has been approved! Check your staff portal.`);
        await sendEmbed(NOTIFICATION_CHANNEL, {
            title: 'Absence Approved',
            description: `User: <@${userId}> (${emp.profile.name})\nType: ${absence.type}\nStart: ${absence.startDate}\nEnd: ${absence.endDate}`,
            color: 0x00ff00
        });
        addNotification(userId, 'absence', 'Your absence has been approved', 'absences');
        showModal('alert', 'Absence approved');
        playSuccessSound();
        renderAbsences('pending');
    }
};

window.showRejectAbsence = (userId, absenceId) => {
    showModal('alert', `
        <h2>Reject Absence</h2>
        <input type="text" id="rejectReason" placeholder="Reason">
        <button id="submitRejectBtn">Reject</button>
    `);
    document.getElementById('submitRejectBtn').addEventListener('click', async () => {
        const reason = document.getElementById('rejectReason').value.trim();
        if (!reason) {
            showModal('alert', 'Please enter a reason');
            return;
        }
        const emp = getEmployee(userId);
        const absence = emp.absences.find(a => a.id === absenceId);
        if (absence) {
            absence.status = 'rejected';
            absence.reason = reason;
            updateEmployee(emp);
            await sendDM(userId, `Your absence has been rejected. Reason: ${reason}. Check your staff portal.`);
            await sendEmbed(NOTIFICATION_CHANNEL, {
                title: 'Absence Rejected',
                description: `User: <@${userId}> (${emp.profile.name})\nType: ${absence.type}\nReason: ${reason}`,
                color: 0xff0000
            });
            addNotification(userId, 'absence', `Your absence has been rejected: ${reason}`, 'absences');
            closeModal('alert');
            showModal('alert', 'Absence rejected');
            playSuccessSound();
            renderAbsences('pending');
        }
    });
};

document.getElementById('payslipsBtn').addEventListener('click', () => {
    showScreen('payslips');
    document.getElementById('payslipForm').classList.add('hidden');
});

document.getElementById('issuePayslipBtn').addEventListener('click', () => {
    document.getElementById('payslipForm').classList.toggle('hidden');
    document.getElementById('payslipUser').value = '';
    renderUserSearch('payslipUser', 'userSearchResults');
});

document.getElementById('payslipUser').addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length >= 3) {
        renderUserSearch('payslipUser', 'userSearchResults');
    } else {
        document.getElementById('userSearchResults').innerHTML = '';
    }
});

document.getElementById('submitPayslipBtn').addEventListener('click', () => {
    const userName = document.getElementById('payslipUser').value.trim();
    const file = document.getElementById('payslipFile').files[0];
    if (!userName || !file) {
        showModal('alert', 'Please select a user and file');
        return;
    }
    const emp = employees.find(e => e.profile.name === userName);
    if (!emp) {
        showModal('alert', 'User not found');
        return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
        emp.payslips = emp.payslips || [];
        emp.payslips.push({ timestamp: new Date().toLocaleString(), fileBase64: reader.result });
        updateEmployee(emp);
        await sendDM(emp.id, `Your payslip has been issued. Check your staff portal.`);
        await sendEmbed(NOTIFICATION_CHANNEL, {
            title: 'Payslip Issued',
            description: `User: <@${emp.id}> (${emp.profile.name})\nTimestamp: ${new Date().toLocaleString()}`,
            color: 0x007bff
        });
        addNotification(emp.id, 'payslip', 'New payslip available', 'payslips');
        showModal('alert', 'Payslip issued');
        playSuccessSound();
        document.getElementById('payslipForm').classList.add('hidden');
    };
    reader.readAsDataURL(file);
});

document.getElementById('disciplinariesBtn').addEventListener('click', () => {
    showScreen('disciplinaries');
    document.getElementById('disciplinaryForm').classList.add('hidden');
});

document.getElementById('issueDisciplinaryBtn').addEventListener('click', () => {
    document.getElementById('disciplinaryForm').classList.toggle('hidden');
    document.getElementById('disciplinaryUser').value = '';
    renderUserSearch('disciplinaryUser', 'userSearchResultsDisciplinary');
});

document.getElementById('disciplinaryUser').addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length >= 3) {
        renderUserSearch('disciplinaryUser', 'userSearchResultsDisciplinary');
    } else {
        document.getElementById('userSearchResultsDisciplinary').innerHTML = '';
    }
});

document.getElementById('submitDisciplinaryBtn').addEventListener('click', async () => {
    const userName = document.getElementById('disciplinaryUser').value.trim();
    const level = document.getElementById('strikeLevel').value;
    const reason = document.getElementById('disciplinaryReason').value.trim();
    const details = document.getElementById('disciplinaryDetails').value.trim();
    const action = document.getElementById('disciplinaryAction').value.trim();
    if (!userName || !reason || !details) {
        showModal('alert', 'Please fill all required fields');
        return;
    }
    const emp = employees.find(e => e.profile.name === userName);
    if (!emp) {
        showModal('alert', 'User not found');
        return;
    }
    emp.strikes = emp.strikes || [];
    emp.strikes.push({ level, reason, details, action: action || 'None', timestamp: new Date().toLocaleString() });
    updateEmployee(emp);
    await sendDM(emp.id, `You have been issued a ${level}: ${reason}. Check your staff portal.`);
    await sendEmbed(NOTIFICATION_CHANNEL, {
        title: 'Disciplinary Issued',
        description: `User: <@${emp.id}> (${emp.profile.name})\nLevel: ${level}\nReason: ${reason}\nDetails: ${details}\nAction: ${action || 'None'}`,
        color: 0xff0000
    });
    addNotification(emp.id, 'strike', `You have been issued a ${level}`, 'disciplinaries');
    showModal('alert', 'Disciplinary issued');
    playSuccessSound();
    document.getElementById('disciplinaryForm').classList.add('hidden');
});

function renderUserSearch(inputId, resultsId) {
    const query = document.getElementById(inputId).value.trim();
    const results = document.getElementById(resultsId);
    results.innerHTML = '';
    const filtered = employees.filter(e => e.profile.name && e.profile.name.toLowerCase().startsWith(query.toLowerCase()));
    filtered.forEach(emp => {
        const div = document.createElement('div');
        div.className = 'user-search-item';
        div.innerHTML = `
            <img src="${emp.avatar}" alt="${emp.profile.name}" style="width: 40px; height: 40px; border-radius: 50%;">
            <span>${emp.profile.name}</span>
        `;
        div.addEventListener('click', () => {
            document.getElementById(inputId).value = emp.profile.name;
            results.innerHTML = '';
        });
        results.appendChild(div);
    });
}

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    document.getElementById('goodbyeName').textContent = currentUser.profile.name;
    showScreen('goodbye');
});

document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('extended');
});

function updateSidebarProfile() {
    document.getElementById('sidebarProfilePic').src = currentUser.avatar;
}

document.getElementById('modeToggle').addEventListener('change', (e) => {
    document.body.classList.toggle('dark', e.target.checked);
    localStorage.setItem('darkMode', e.target.checked);
});

document.querySelectorAll('.close').forEach(close => {
    close.addEventListener('click', () => closeModal(close.parentNode.parentNode.id));
});

window.addEventListener('load', () => {
    const savedUser = localStorage.getItem('currentUser');
    const darkMode = localStorage.getItem('darkMode') === 'true';
    document.getElementById('modeToggle').checked = darkMode;
    document.body.classList.toggle('dark', darkMode);

    if (new URLSearchParams(window.location.search).get('code')) {
        handleOAuthRedirect();
    } else if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showScreen('mainMenu');
        updateSidebarProfile();
        renderNotifications();
    } else {
        showScreen('discord');
    }
});

window.addEventListener('hashchange', () => {
    const screenId = window.location.hash.slice(1);
    if (screens[screenId]) {
        showScreen(screenId);
        if (screenId === 'absences') document.getElementById('absencesBtn').click();
        else if (screenId === 'payslips') document.getElementById('payslipsBtn').click();
        else if (screenId === 'disciplinaries') document.getElementById('disciplinariesBtn').click();
    }
});