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
        if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);
    } catch (e) {
        console.error('Webhook error:', e);
    }
}

async function sendEmbed(channelId, embed) {
    try {
        const response = await fetch(`${WORKER_URL}/postEmbed?channel_id=${channelId}&embed_json=${encodeURIComponent(JSON.stringify(embed))}`);
        if (!response.ok) throw new Error(`Embed failed: ${response.status}`);
    } catch (e) {
        console.error('Embed error:', e);
    }
}

async function sendDM(userId, message) {
    try {
        const response = await fetch(`${WORKER_URL}/sendDM?user_id=${userId}&message=${encodeURIComponent(message)}`);
        if (!response.ok) throw new Error(`DM failed: ${response.status}`);
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
        showModal('alert', 'User does not have the required role');
        showScreen('discord');
        return;
    }

    const profile = getEmployee(currentUser.id).profile;
    if (!profile.name) {
        showScreen('setupWelcome');
    } else {
        document.getElementById('profilePic').src = currentUser.avatar;
        document.getElementById('confirmName').textContent = profile.name;
        document.getElementById('confirmRole').textContent = 'Verified Role: Staff Member';
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
            const deptRole = DEPT_ROLES[currentUser.profile.department];
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
        updateMainScreen();
    }, 3000);
});

document.getElementById('continueBtn').addEventListener('click', () => {
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
    showScreen('mainMenu');
    updateMainScreen();
});

document.getElementById('myProfileBtn').addEventListener('click', () => {
    showScreen('myProfile');
    document.getElementById('profileAvatar').src = currentUser.avatar;
    document.getElementById('profileDiscordName').textContent = currentUser.name;
    document.getElementById('profileName').value = currentUser.profile.name || '';
    document.getElementById('profileEmail').value = currentUser.profile.email || '';
    document.getElementById('profileDepartment').value = currentUser.profile.department || '';
});

document.getElementById('saveProfileBtn').addEventListener('click', () => {
    currentUser.profile.name = document.getElementById('profileName').value.trim();
    currentUser.profile.email = document.getElementById('profileEmail').value.trim();
    currentUser.profile.department = document.getElementById('profileDepartment').value;
    updateEmployee(currentUser);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    showModal('alert', 'Profile saved');
    playSuccessSound();
    showScreen('mainMenu');
});

document.getElementById('resetProfileBtn').addEventListener('click', () => {
    showModal('resetProfile');
});

document.getElementById('confirmResetBtn').addEventListener('click', () => {
    resetEmployeeData(currentUser.id);
    currentUser = null;
    clockInTime = null;
    isClockedIn = false;
    closeModal('resetProfile');
    showScreen('setupWelcome');
});

document.getElementById('cancelResetBtn').addEventListener('click', () => {
    closeModal('resetProfile');
});

document.getElementById('myRolesBtn').addEventListener('click', () => {
    showScreen('myRoles');
    const list = document.getElementById('rolesList');
    list.innerHTML = '';
    currentUser.roles.forEach(roleId => {
        const li = document.createElement('li');
        li.textContent = `Role ID: ${roleId}`;
        list.appendChild(li);
    });
});

document.getElementById('myTasksBtn').addEventListener('click', () => {
    showScreen('tasks');
    loadTasks();
});

document.getElementById('addTaskBtn').addEventListener('click', () => {
    const input = document.getElementById('taskInput');
    const text = input.value.trim();
    if (text) {
        currentTasks.push({ text, completed: false });
        saveTasks();
        renderTasks();
        input.value = '';
        playSuccessSound();
    } else {
        showModal('alert', 'Please enter a task');
    }
});

document.getElementById('taskInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('addTaskBtn').click();
});

document.getElementById('absencesBtn').addEventListener('click', () => {
    showScreen('absences');
    renderAbsences('pending');
});

document.getElementById('submitAbsenceBtn').addEventListener('click', () => {
    const form = document.getElementById('submitAbsenceForm');
    form.classList.toggle('hidden');
});

document.getElementById('submitAbsenceFormBtn').addEventListener('click', async () => {
    const type = document.getElementById('absenceType').value;
    const comment = document.getElementById('absenceComment').value;
    const start = document.getElementById('absenceStart').value;
    const end = document.getElementById('absenceEnd').value;
    if (type && start && end) {
        const absence = { id: Date.now().toString(), type, comment, startDate: start, endDate: end, status: 'pending' };
        currentUser.absences.push(absence);
        updateEmployee(currentUser);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        const embed = {
            title: 'New Absence Submitted',
            description: `User: <@${currentUser.id}> (${currentUser.profile.name})\nType: ${type}\nComment: ${comment}\nStart: ${start}\nEnd: ${end}\nPlease approve or reject on the management dashboard.`,
            color: 0x0099ff
        };
        await sendEmbed(ABSENCE_CHANNEL, embed);
        addNotification('absence', 'Your absence has been submitted', 'absences');
        showModal('alert', 'Absence submitted successfully');
        playSuccessSound();
        document.getElementById('submitAbsenceForm').classList.add('hidden');
        renderAbsences('pending');
    } else {
        showModal('alert', 'Please fill all fields');
    }
});

const startDateInput = document.getElementById('absenceStart');
const endDateInput = document.getElementById('absenceEnd');
const daysP = document.getElementById('absenceDays');
function calculateDays() {
    const start = new Date(startDateInput.value);
    const end = new Date(endDateInput.value);
    if (start && end) {
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        daysP.textContent = `Duration: ${days} day${days !== 1 ? 's' : ''}`;
    } else {
        daysP.textContent = '';
    }
}
startDateInput.addEventListener('change', calculateDays);
endDateInput.addEventListener('change', calculateDays);

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
    const filtered = currentUser.absences.filter(a => a.status === tab || (tab === 'rejected' && a.status === 'rejected-acknowledged'));
    filtered.forEach(a => {
        const div = document.createElement('div');
        div.className = `absence-item ${a.status}`;
        div.innerHTML = `<p>Type: ${a.type}</p><p>Comment: ${a.comment}</p><p>Start: ${a.startDate}</p><p>End: ${a.endDate}</p>`;
        if (a.status === 'rejected') {
            div.innerHTML += `<p>Reason: ${a.reason || 'No reason provided'}</p><button onclick="acknowledgeRejection('${a.id}')">Acknowledge</button>`;
        }
        content.appendChild(div);
    });
}

function acknowledgeRejection(absenceId) {
    const absence = currentUser.absences.find(a => a.id === absenceId);
    if (absence) {
        absence.status = 'rejected-acknowledged';
        updateEmployee(currentUser);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        renderAbsences('rejected');
    }
}

document.getElementById('payslipsBtn').addEventListener('click', () => {
    showScreen('payslips');
    renderPayslips();
});

function renderPayslips() {
    const list = document.getElementById('payslipsList');
    if (!list) return;
    list.innerHTML = '';
    currentUser.payslips.forEach((p, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="${p.fileBase64}" target="_blank">Payslip from ${p.timestamp}</a>`;
        if (i === 0) li.classList.add('latest');
        list.appendChild(li);
    });
}

document.getElementById('disciplinariesBtn').addEventListener('click', () => {
    showScreen('disciplinaries');
    renderStrikes();
});

function renderStrikes() {
    const list = document.getElementById('strikesList');
    if (!list) return;
    list.innerHTML = '';
    currentUser.strikes.forEach((s, i) => {
        const li = document.createElement('li');
        li.textContent = `${s.level}: ${s.reason} (${s.timestamp}) - ${s.details}${s.action ? `, Action: ${s.action}` : ''}`;
        if (i === 0) li.classList.add('latest');
        list.appendChild(li);
    });
}

document.getElementById('timeclockBtn').addEventListener('click', () => {
    showScreen('timeclock');
    updateTimeclockScreen();
});

function updateTimeclockScreen() {
    const clockInBtn = document.getElementById('timeclockClockInBtn');
    const clockOutBtn = document.getElementById('timeclockClockOutBtn');
    const sessionStatus = document.getElementById('sessionStatus');
    const sessionTime = document.getElementById('sessionTime');
    const sessionDate = document.getElementById('sessionDate');
    const sessionActions = document.getElementById('sessionActions');

    if (isClockedIn) {
        clockInBtn.classList.add('hidden');
        clockOutBtn.classList.remove('hidden');
        sessionStatus.textContent = 'Session started';
        sessionDate.textContent = `Date: ${new Date(clockInTime).toLocaleDateString()}`;
        sessionActions.innerHTML = clockInActions.map(a => `<p>${a}</p>`).join('');
        sessionTime.textContent = `Time: ${formatTime(Date.now() - clockInTime)}`;
        if (!clockInInterval) {
            clockInInterval = setInterval(() => {
                if (isClockedIn) {
                    sessionTime.textContent = `Time: ${formatTime(Date.now() - clockInTime)}`;
                }
            }, 1000);
        }
    } else {
        clockInBtn.classList.remove('hidden');
        clockOutBtn.classList.add('hidden');
        sessionStatus.textContent = 'Not clocked in';
        sessionTime.textContent = '';
        sessionDate.textContent = '';
        sessionActions.innerHTML = '';
        clearInterval(clockInInterval);
        clockInInterval = null;
    }
}

document.getElementById('timeclockClockInBtn').addEventListener('click', async () => {
    if (!isClockedIn) {
        clockInTime = Date.now();
        clockInActions = [];
        localStorage.setItem('clockInTime', clockInTime);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        isClockedIn = true;
        await sendWebhook(`☀️ ${currentUser.profile.name} has clocked in!`);
        showScreen('clocking');
        setTimeout(() => {
            showScreen('timeclock');
            updateTimeclockScreen();
            startAutoLogoutCheck();
            playSuccessSound();
        }, 2000);
    } else {
        showModal('alert', 'You are already clocked in!');
    }
});

document.getElementById('timeclockClockOutBtn').addEventListener('click', () => {
    if (isClockedIn) {
        showModal('alert', `
            <h2>Clock Out</h2>
            <p>What did you do today?</p>
            <textarea id="clockOutActions" placeholder="Enter your actions"></textarea>
            <button id="submitClockOutBtn">Clock Out</button>
        `);
        document.getElementById('submitClockOutBtn').addEventListener('click', async () => {
            const actions = document.getElementById('clockOutActions').value.trim();
            const clockOutTime = Date.now();
            clockInActions.push(actions);
            const embed = {
                title: 'Timeclock Log',
                description: `User: <@${currentUser.id}> (${currentUser.profile.name})\nClock In: ${new Date(clockInTime).toLocaleString()}\nClock Out: ${new Date(clockOutTime).toLocaleString()}\nDuration: ${formatTime(clockOutTime - clockInTime)}\nActions: ${actions || 'None'}`,
                color: 0x00ff00
            };
            await sendEmbed(TIMECLOCK_CHANNEL, embed);
            await sendWebhook(`💤 ${currentUser.profile.name} has clocked out!`);
            downloadTXT(currentUser, clockInTime, clockOutTime, actions);
            currentUser.profile.lastClockIn = new Date(clockInTime).toLocaleString();
            updateEmployee(currentUser);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.removeItem('clockInTime');
            isClockedIn = false;
            clockInTime = null;
            clockInActions = [];
            clearInterval(clockInInterval);
            clockInInterval = null;
            closeModal('alert');
            document.getElementById('goodbyeName').textContent = currentUser.profile.name;
            showScreen('goodbye');
            playSuccessSound();
            clearInterval(autoLogoutInterval);
        });
    }
});

document.getElementById('mailBtn').addEventListener('click', () => {
    showScreen('mail');
    renderMail('inbox');
});

document.getElementById('mailScreen').addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        renderMail(e.target.dataset.tab);
    }
});

document.getElementById('composeMailBtn').addEventListener('click', () => {
    showModal('composeMail');
    document.getElementById('mailTo').value = '';
    document.getElementById('mailSubject').value = '';
    document.getElementById('mailBody').value = '';
    document.getElementById('mailAttachment').value = '';
    renderUserSearch('');
});

document.getElementById('mailTo').addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length >= 3) {
        renderUserSearch(query);
    } else {
        document.getElementById('userSearchResults').innerHTML = '';
    }
});

function renderUserSearch(query) {
    const results = document.getElementById('userSearchResults');
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
            document.getElementById('mailTo').value = emp.profile.name;
            results.innerHTML = '';
        });
        results.appendChild(div);
    });
}

document.getElementById('sendMailBtn').addEventListener('click', async () => {
    const to = document.getElementById('mailTo').value.trim();
    const subject = document.getElementById('mailSubject').value.trim();
    const body = document.getElementById('mailBody').value.trim();
    const file = document.getElementById('mailAttachment').files[0];
    if (!to || !subject || !body) {
        showModal('alert', 'Please fill all fields');
        return;
    }
    const recipient = employees.find(e => e.profile.name === to);
    if (!recipient) {
        showModal('alert', 'Recipient not found');
        return;
    }
    let attachment = null;
    if (file) {
        const reader = new FileReader();
        reader.onload = async () => {
            attachment = reader.result;
            sendMail(recipient, subject, body, attachment);
        };
        reader.readAsDataURL(file);
    } else {
        sendMail(recipient, subject, body, null);
    }
});

async function sendMail(recipient, subject, body, attachment) {
    const mail = {
        id: Date.now().toString(),
        from: currentUser.profile.name,
        to: recipient.profile.name,
        subject,
        body,
        attachment,
        timestamp: new Date().toLocaleString(),
        read: false
    };
    currentUser.mail.push({ ...mail, folder: 'sent' });
    recipient.mail = recipient.mail || [];
    recipient.mail.push({ ...mail, folder: 'inbox' });
    updateEmployee(currentUser);
    updateEmployee(recipient);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    await sendDM(recipient.id, `📩 You received mail! Please log into your staff portal to view.`);
    addNotification('mail', `New mail from ${currentUser.profile.name}: ${subject}`, 'mail');
    showModal('alert', 'Mail sent!');
    playSuccessSound();
    closeModal('composeMail');
    renderMail('sent');
}

function renderMail(tab) {
    const content = document.getElementById('mailContent');
    if (!content) return;
    content.innerHTML = '';
    const filtered = currentUser.mail.filter(m => m.folder === tab);
    filtered.forEach(m => {
        const div = document.createElement('div');
        div.className = 'mail-item';
        div.innerHTML = `
            <p><strong>${tab === 'inbox' ? 'From' : 'To'}: ${tab === 'inbox' ? m.from : m.to}</strong></p>
            <p>Subject: ${m.subject}</p>
            <p>${m.timestamp}</p>
        `;
        div.addEventListener('click', () => {
            showModal('alert', `
                <h2>${m.subject}</h2>
                <p>From: ${m.from}</p>
                <p>${m.body}</p>
                ${m.attachment ? `<p><a href="${m.attachment}" target="_blank">View Attachment</a></p>` : ''}
                <button id="replyMailBtn">Reply</button>
            `);
            if (tab === 'inbox' && !m.read) {
                m.read = true;
                updateEmployee(currentUser);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                renderNotifications();
            }
            document.getElementById('replyMailBtn').addEventListener('click', () => {
                closeModal('alert');
                showModal('composeMail');
                document.getElementById('mailTo').value = m.from;
                document.getElementById('mailSubject').value = `Re: ${m.subject}`;
                document.getElementById('mailBody').value = `\n\n--- Original Message ---\n${m.body}`;
                renderUserSearch(m.from);
            });
        });
        content.appendChild(div);
    });
}

document.getElementById('handbookBtn').addEventListener('click', () => window.open('https://docs.google.com/document/d/1SB48S4SiuT9_npDhgU1FT_CxAjdKGn40IpqUQKm2Nek/edit?usp=sharing', '_blank'));

document.getElementById('clockOutBtn').addEventListener('click', () => {
    if (isClockedIn) {
        document.getElementById('timeclockClockOutBtn').click();
    } else {
        localStorage.clear();
        employees = [];
        saveEmployees();
        document.getElementById('goodbyeName').textContent = currentUser.profile.name;
        showScreen('goodbye');
    }
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

document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen('mainMenu'));
});

function updateMainScreen() {
    document.getElementById('welcomeName').textContent = currentUser.profile.name;
    const clockInStatus = document.getElementById('clockInStatus');
    const runningPeriodContainer = document.getElementById('runningPeriodContainer');
    if (isClockedIn) {
        clockInStatus.classList.remove('hidden');
        runningPeriodContainer.classList.remove('hidden');
        document.getElementById('clockInTime').textContent = new Date(clockInTime).toLocaleString();
        document.getElementById('runningPeriod').textContent = formatTime(Date.now() - clockInTime);
        setInterval(() => {
            if (currentUser && isClockedIn) {
                document.getElementById('runningPeriod').textContent = formatTime(Date.now() - clockInTime);
            }
        }, 1000);
    } else {
        clockInStatus.classList.add('hidden');
        runningPeriodContainer.classList.add('hidden');
    }
}

let autoLogoutInterval;
function startAutoLogoutCheck() {
    autoLogoutInterval = setInterval(() => {
        if (isClockedIn && Date.now() - clockInTime > 24 * 60 * 60 * 1000) {
            const clockOutTime = Date.now();
            sendWebhook(`💤 ${currentUser.profile.name} has been auto clocked out (24h limit).`);
            downloadTXT(currentUser, clockInTime, clockOutTime, clockInActions.join(', '));
            currentUser.profile.lastClockIn = new Date(clockInTime).toLocaleString();
            updateEmployee(currentUser);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.removeItem('clockInTime');
            isClockedIn = false;
            clockInTime = null;
            clockInActions = [];
            clearInterval(clockInInterval);
            clockInInterval = null;
            document.getElementById('goodbyeName').textContent = currentUser.profile.name;
            showScreen('goodbye');
            clearInterval(autoLogoutInterval);
        }
    }, 60000);
}

window.addEventListener('load', () => {
    const savedUser = localStorage.getItem('currentUser');
    const savedTime = localStorage.getItem('clockInTime');
    const darkMode = localStorage.getItem('darkMode') === 'true';
    document.getElementById('modeToggle').checked = darkMode;
    document.body.classList.toggle('dark', darkMode);

    if (new URLSearchParams(window.location.search).get('code')) {
        handleOAuthRedirect();
    } else if (savedUser) {
        currentUser = JSON.parse(savedUser);
        notifications = JSON.parse(localStorage.getItem(`notifications_${currentUser.id}`)) || [];
        if (savedTime) {
            clockInTime = parseInt(savedTime);
            isClockedIn = true;
            const now = Date.now();
            if (now - clockInTime > 24 * 60 * 60 * 1000) {
                sendWebhook(`💤 ${currentUser.profile.name} has been auto clocked out (inactive).`);
                downloadTXT(currentUser, clockInTime, now, clockInActions.join(', '));
                currentUser.profile.lastClockIn = new Date(clockInTime).toLocaleString();
                updateEmployee(currentUser);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                localStorage.removeItem('clockInTime');
                showScreen('discord');
            } else {
                updateMainScreen();
                showScreen('mainMenu');
                startAutoLogoutCheck();
                loadTasks();
                renderNotifications();
                updateSidebarProfile();
            }
        } else {
            showScreen('mainMenu');
            updateMainScreen();
            loadTasks();
            renderNotifications();
            updateSidebarProfile();
        }
    } else {
        showScreen('discord');
    }
});

window.addEventListener('hashchange', () => {
    const screenId = window.location.hash.slice(1);
    if (screens[screenId]) {
        showScreen(screenId);
        if (screenId === 'myRoles') document.getElementById('myRolesBtn').click();
        else if (screenId === 'tasks') document.getElementById('myTasksBtn').click();
        else if (screenId === 'absences') {
            document.getElementById('absencesBtn').click();
            document.getElementById('submitAbsenceForm').classList.add('hidden');
        }
        else if (screenId === 'payslips') document.getElementById('payslipsBtn').click();
        else if (screenId === 'disciplinaries') document.getElementById('disciplinariesBtn').click();
        else if (screenId === 'timeclock') document.getElementById('timeclockBtn').click();
        else if (screenId === 'mail') document.getElementById('mailBtn').click();
    }
});