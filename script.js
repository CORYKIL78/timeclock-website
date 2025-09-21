const PIN = '1406';
const HR_PIN = '1224';
const REQUIRED_ROLE = '1315346851616002158';
const DEPT_ROLES = {
    'Development Department': '1315323804528017498',
    'Customer Relations Department': '1315042036969242704',
    'Careers Department': '1315065603178102794'
};
const HR_ROLES = ['1315042028912115784', '1315042029872615504', '1315323532028284938'];
const GUILD_ID = '1310656642672627752';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1417260030851551273/KGKnWF3mwTt7mNWmC3OTAPWcWJSl1FnQ3-Ub-l1-xpk46tOsAYAtIhRTlti2qxjJSOds';
const LOA_LINK = 'https://dyno.gg/form/e4c75cbc';
const HANDBOOK_LINK = 'https://docs.google.com/document/d/1SB48S4SiuT9_npDhgU1FT_CxAjdKGn40IpqUQKm2Nek/edit?usp=sharing';
const WORKER_URL = 'https://timeclock-proxy.marcusray.workers.dev';
const CLIENT_ID = '1417915896634277888';
const REDIRECT_URI = 'https://corykil78.github.io/timeclock-website';
const SUCCESS_SOUND_URL = 'https://www.soundjay.com/buttons/beep-07a.mp3';
const ABSENCE_CHANNEL = '1417583684525232291';
const LOA_ROLE = '1346567328749322293';

const screens = {
    pin: document.getElementById('pinScreen'),
    discord: document.getElementById('discordScreen'),
    searching: document.getElementById('searchingScreen'),
    roles: document.getElementById('rolesScreen'),
    cherry: document.getElementById('cherryScreen'),
    confirm: document.getElementById('confirmScreen'),
    clocking: document.getElementById('clockingScreen'),
    mainMenu: document.getElementById('mainMenuScreen'),
    myRoles: document.getElementById('myRolesScreen'),
    tasks: document.getElementById('tasksScreen'),
    myProfile: document.getElementById('myProfileScreen'),
    submitAbsence: document.getElementById('submitAbsenceScreen'),
    absences: document.getElementById('absencesScreen'),
    disciplinaries: document.getElementById('disciplinariesScreen'),
    payslips: document.getElementById('payslipsScreen'),
    setupWelcome: document.getElementById('setupWelcomeScreen'),
    setupEmail: document.getElementById('setupEmailScreen'),
    setupName: document.getElementById('setupNameScreen'),
    setupDepartment: document.getElementById('setupDepartmentScreen'),
    setupVerify: document.getElementById('setupVerifyScreen'),
    setupComplete: document.getElementById('setupCompleteScreen'),
    portalWelcome: document.getElementById('portalWelcomeScreen'),
    hrHome: document.getElementById('hrHomeScreen'),
    hrAddPayslip: document.getElementById('hrAddPayslipScreen'),
    hrManageAbsences: document.getElementById('hrManageAbsencesScreen'),
    hrEmployeeList: document.getElementById('hrEmployeeListScreen'),
    goodbye: document.getElementById('goodbyeScreen')
};

const modals = {
    hrEmployeeProfile: document.getElementById('hrEmployeeProfileModal'),
    addStrike: document.getElementById('addStrikeModal'),
    rejectAbsence: document.getElementById('rejectAbsenceModal')
};

let currentUser = null;
let clockInTime = null;
let currentTasks = [];
let employees = JSON.parse(localStorage.getItem('employees')) || [];
let notifications = [];
let isHR = false;

function showScreen(screenId) {
    console.log(`Showing screen: ${screenId}`);
    Object.values(screens).forEach(s => s && s.classList.remove('active'));
    if (screens[screenId]) {
        screens[screenId].classList.add('active');
        window.location.hash = screenId;
    }
}

function showModal(modalId) {
    modals[modalId].style.display = 'flex';
}

function closeModal(modalId) {
    modals[modalId].style.display = 'none';
}

function formatTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function sendWebhook(content) {
    try {
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
    } catch (e) {
        console.error('Webhook error:', e);
    }
}

function downloadTXT(user, clockInTime, clockOutTime) {
    const duration = formatTime(clockOutTime - clockInTime);
    const inStr = new Date(clockInTime).toLocaleString();
    const outStr = new Date(clockOutTime).toLocaleString();
    const txt = `Log in: ${inStr}\nLog out: ${outStr}\nPeriod: ${duration}\nActions: Logged in at ${inStr}, logged out at ${outStr}`;
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log_${user.profile.name.replace(/[^a-z0-9]/gi, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function saveEmployees() {
    localStorage.setItem('employees', JSON.stringify(employees));
}

function getEmployee(id) {
    return employees.find(e => e.id === id) || { id, profile: {}, absences: [], strikes: [], payslips: [], onLOA: false };
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

function addNotification(type, message, link) {
    notifications.push({ id: Date.now().toString(), type, message, link, read: false, timestamp: new Date().toLocaleString() });
    localStorage.setItem(`notifications_${currentUser.id}`, JSON.stringify(notifications));
    renderNotifications();
}

function renderNotifications() {
    notifications = JSON.parse(localStorage.getItem(`notifications_${currentUser.id}`)) || [];
    const list = document.getElementById('notificationList');
    list.innerHTML = '';
    notifications.forEach((notif, index) => {
        if (!notif.read) {
            const li = document.createElement('li');
            li.textContent = notif.message;
            if (index === 0) li.classList.add('latest');
            li.addEventListener('click', () => {
                notifications[index].read = true;
                localStorage.setItem(`notifications_${currentUser.id}`, JSON.stringify(notifications));
                if (notif.link) {
                    window.location.hash = notif.link;
                }
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

// PIN Submit
document.getElementById('submitPin').addEventListener('click', () => {
    const pinValue = document.getElementById('pinInput').value;
    if (pinValue === PIN) {
        isHR = false;
        showScreen('discord');
    } else if (pinValue === HR_PIN) {
        isHR = true;
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
        console.log('Using redirect_uri:', REDIRECT_URI);
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
        console.log('Using redirect_uri for Worker:', REDIRECT_URI);
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

    currentUser = {
        id: user.id,
        name: user.global_name || user.username,
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : '',
        roles: member.roles,
        profile: getEmployee(user.id).profile,
        absences: getEmployee(user.id).absences,
        strikes: getEmployee(user.id).strikes,
        payslips: getEmployee(user.id).payslips
    };

    if (isHR) {
        if (!HR_ROLES.some(role => member.roles.includes(role))) {
            alert('You do not have HR access');
            showScreen('discord');
            return;
        }
        showScreen('hrHome');
        document.getElementById('hrWelcomeName').textContent = currentUser.name;
        renderHRNotifications();
        return;
    } else {
        if (!member.roles.includes(REQUIRED_ROLE)) {
            alert('User does not have the required role');
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
}

// First-Time Setup
document.getElementById('setupStartBtn').addEventListener('click', () => showScreen('setupEmail'));

document.getElementById('setupEmailContinueBtn').addEventListener('click', () => {
    const email = document.getElementById('setupEmailInput').value.trim();
    if (email) {
        currentUser.profile.email = email;
        showScreen('setupName');
    } else {
        alert('Please enter your email');
    }
});

document.getElementById('setupNameContinueBtn').addEventListener('click', () => {
    const name = document.getElementById('setupNameInput').value.trim();
    if (name) {
        currentUser.profile.name = name;
        showScreen('setupDepartment');
    } else {
        alert('Please enter your name');
    }
});

document.getElementById('setupDepartmentContinueBtn').addEventListener('click', () => {
    const selectedDept = document.querySelector('input[name="department"]:checked');
    if (selectedDept) {
        currentUser.profile.department = selectedDept.value;
        showScreen('setupVerify');
        setTimeout(async () => {
            const deptRole = DEPT_ROLES[currentUser.profile.department];
            if (currentUser.roles.includes(deptRole)) {
                updateEmployee(currentUser);
                showScreen('setupComplete');
            } else {
                alert('Role verification failed for selected department');
                showScreen('setupDepartment');
            }
        }, 2000);
    } else {
        alert('Please select a department');
    }
});

document.getElementById('setupCompleteBtn').addEventListener('click', () => {
    showScreen('portalWelcome');
    document.getElementById('portalWelcomeName').textContent = currentUser.profile.name;
    setTimeout(() => {
        showScreen('mainMenu');
        updateSidebarProfile();
    }, 3000);
});

// Log In (formerly Clock In)
document.getElementById('logInBtn').addEventListener('click', () => {
    clockInTime = Date.now();
    localStorage.setItem('clockInTime', clockInTime);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    sendWebhook(`☀️ ${currentUser.profile.name} has logged in!`);
    showScreen('clocking');
    setTimeout(() => {
        updateMainScreen();
        showScreen('mainMenu');
        startAutoLogoutCheck();
        loadTasks();
        renderNotifications();
        updateSidebarProfile();
    }, 2000);
});

document.getElementById('mainLogInBtn').addEventListener('click', () => {
    clockInTime = Date.now();
    localStorage.setItem('clockInTime', clockInTime);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    sendWebhook(`☀️ ${currentUser.profile.name} has logged in!`);
    showScreen('clocking');
    setTimeout(() => {
        updateMainScreen();
        showScreen('mainMenu');
        startAutoLogoutCheck();
        loadTasks();
        renderNotifications();
        updateSidebarProfile();
    }, 2000);
});

// Log Out
document.getElementById('clockOutBtn').addEventListener('click', () => {
    const clockOutTime = Date.now();
    sendWebhook(`💤 ${currentUser.profile.name} has logged out!`);
    downloadTXT(currentUser, clockInTime, clockOutTime);
    localStorage.clear();
    employees = [];
    saveEmployees();
    document.getElementById('goodbyeName').textContent = currentUser.profile.name;
    showScreen('goodbye');
    clearInterval(autoLogoutInterval);
});

// Sidebar Toggle
document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('extended');
});

// Update Sidebar Profile
function updateSidebarProfile() {
    document.getElementById('sidebarProfilePic').src = currentUser.avatar;
}

// My Profile
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
    alert('Profile saved');
    showScreen('mainMenu');
});

// My Roles
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

// My Tasks
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
    }
});

document.getElementById('taskInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('addTaskBtn').click();
});

// Submit Absence
document.getElementById('submitAbsenceBtn').addEventListener('click', () => {
    showScreen('submitAbsence');
});

document.getElementById('submitAbsenceBtn').addEventListener('click', async () => {
    const type = document.getElementById('absenceType').value;
    const comment = document.getElementById('absenceComment').value;
    const start = document.getElementById('absenceStart').value;
    const end = document.getElementById('absenceEnd').value;
    if (type && start && end) {
        const absence = { id: Date.now().toString(), type, comment, startDate: start, endDate: end, status: 'pending' };
        currentUser.absences.push(absence);
        updateEmployee(currentUser);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        const audio = new Audio(SUCCESS_SOUND_URL);
        await audio.play();
        alert('Success. Thank you for sending in your absence. It will be reviewed and either Approved or Rejected. Keep an eye out for it!');
        const embed = JSON.stringify({
            title: 'New Absence Submitted',
            description: `User: ${currentUser.profile.name} (${currentUser.name})\nType: ${type}\nComment: ${comment}\nStart: ${start}\nEnd: ${end}\nPlease utilise this absence using the HR portal.`,
            color: 0x0099ff
        });
        await fetch(`${WORKER_URL}/postEmbed?channel_id=${ABSENCE_CHANNEL}&embed_json=${encodeURIComponent(embed)}`);
        addNotification('absence', 'Your absence has been submitted', 'absences');
        showScreen('mainMenu');
    } else {
        alert('Please fill all fields');
    }
});

// Calculate Absence Days
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

// Absences Page
document.getElementById('absencesScreen').addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        renderAbsences(e.target.dataset.tab);
    }
});

function renderAbsences(tab) {
    const content = document.getElementById('absencesContent');
    content.innerHTML = '';
    const filtered = currentUser.absences.filter(a => a.status === tab || (tab === 'rejected' && a.status === 'rejected-acknowledged'));
    filtered.forEach(a => {
        const div = document.createElement('div');
        div.className = `absence-item ${a.status === 'rejected' ? 'rejected' : ''}`;
        div.innerHTML = `<p>Type: ${a.type}</p><p>Comment: ${a.comment}</p><p>Start: ${a.startDate}</p><p>End: ${a.endDate}</p>`;
        if (a.status === 'rejected') {
            div.innerHTML += `<p>Reason: ${a.reason}</p><button onclick="acknowledgeRejection('${a.id}')">Acknowledge</button>`;
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

// Disciplinaries Page
function renderStrikes() {
    const list = document.getElementById('strikesList');
    list.innerHTML = '';
    currentUser.strikes.forEach((s, i) => {
        const li = document.createElement('li');
        li.textContent = `${s.level}: ${s.details} (${s.timestamp})`;
        if (i === 0) li.classList.add('latest');
        list.appendChild(li);
    });
}

// Payslips Page
function renderPayslips() {
    const list = document.getElementById('payslipsList');
    list.innerHTML = '';
    currentUser.payslips.forEach((p, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="${p.fileBase64}" target="_blank">Payslip from ${p.timestamp}</a>`;
        if (i === 0) li.classList.add('latest');
        list.appendChild(li);
    });
}

// HR Home Buttons
document.getElementById('hrAddPayslipBtn').addEventListener('click', () => {
    showScreen('hrAddPayslip');
    renderHRPayslipList();
});

document.getElementById('hrManageAbsencesBtn').addEventListener('click', () => {
    showScreen('hrManageAbsences');
    renderHRPendingAbsences();
});

document.getElementById('hrViewEmployeesBtn').addEventListener('click', () => {
    showScreen('hrEmployeeList');
    renderHREmployeeGrid();
});

// HR Add Payslip
function renderHRPayslipList() {
    const list = document.getElementById('hrEmployeeListForPayslip');
    list.innerHTML = '';
    employees.forEach(emp => {
        const li = document.createElement('li');
        li.textContent = emp.profile.name || emp.name;
        li.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,application/pdf';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = async () => {
                    emp.payslips.push({ timestamp: new Date().toLocaleString(), fileBase64: reader.result });
                    saveEmployees();
                    alert('Success! Please remember to pay the user now.');
                    await fetch(`${WORKER_URL}/sendDM?user_id=${emp.id}&message=Hi ${emp.profile.name}! Your payslip has been uploaded. Please log on to your staff portal to view it!`);
                    const empNotifications = JSON.parse(localStorage.getItem(`notifications_${emp.id}`)) || [];
                    empNotifications.push({ id: Date.now().toString(), type: 'payslip', message: 'View your payslip!', link: 'payslips', read: false, timestamp: new Date().toLocaleString() });
                    localStorage.setItem(`notifications_${emp.id}`, JSON.stringify(empNotifications));
                };
                reader.readAsDataURL(file);
            };
            input.click();
        });
        list.appendChild(li);
    });
}

// HR Manage Absences
function renderHRPendingAbsences() {
    const list = document.getElementById('hrPendingAbsencesList');
    list.innerHTML = '';
    employees.forEach(emp => {
        emp.absences.filter(a => a.status === 'pending').forEach(a => {
            const li = document.createElement('li');
            li.innerHTML = `${emp.profile.name}: ${a.type} from ${a.startDate} to ${a.endDate}`;
            const approveBtn = document.createElement('button');
            approveBtn.textContent = 'Approve';
            approveBtn.addEventListener('click', async () => {
                a.status = 'approved';
                emp.onLOA = true;
                saveEmployees();
                alert('Successfully approved absence');
                await fetch(`${WORKER_URL}/addRole?user_id=${emp.id}&role_id=${LOA_ROLE}`);
                await fetch(`${WORKER_URL}/sendDM?user_id=${emp.id}&message=Your absence has been approved!`);
                const empNotifications = JSON.parse(localStorage.getItem(`notifications_${emp.id}`)) || [];
                empNotifications.push({ id: Date.now().toString(), type: 'absence', message: 'Your absence has been approved!', link: 'absences', read: false, timestamp: new Date().toLocaleString() });
                localStorage.setItem(`notifications_${emp.id}`, JSON.stringify(empNotifications));
                renderHRPendingAbsences();
            });
            const rejectBtn = document.createElement('button');
            rejectBtn.textContent = 'Reject';
            rejectBtn.addEventListener('click', () => {
                showModal('rejectAbsence');
                document.getElementById('submitRejectBtn').onclick = async () => {
                    a.status = 'rejected';
                    a.reason = document.getElementById('rejectReason').value;
                    saveEmployees();
                    alert('Successfully rejected absence');
                    await fetch(`${WORKER_URL}/sendDM?user_id=${emp.id}&message=Your absence has been rejected! Reason: ${a.reason}`);
                    const empNotifications = JSON.parse(localStorage.getItem(`notifications_${emp.id}`)) || [];
                    empNotifications.push({ id: Date.now().toString(), type: 'absence', message: 'Your absence has been rejected!', link: 'absences', read: false, timestamp: new Date().toLocaleString() });
                    localStorage.setItem(`notifications_${emp.id}`, JSON.stringify(empNotifications));
                    closeModal('rejectAbsence');
                    renderHRPendingAbsences();
                };
            });
            li.appendChild(approveBtn);
            li.appendChild(rejectBtn);
            list.appendChild(li);
        });
    });
}

// HR Employee List
function renderHREmployeeGrid() {
    const grid = document.getElementById('hrEmployeeGrid');
    grid.innerHTML = '';
    employees.forEach(emp => {
        const card = document.createElement('div');
        card.className = 'employee-card';
        card.innerHTML = `
            <img src="${emp.avatar}" alt="Profile">
            <h3>${emp.profile.name || 'Unnamed'}</h3>
            <p>${emp.name}</p>
        `;
        card.addEventListener('click', () => {
            showModal('hrEmployeeProfile');
            document.getElementById('hrEmployeeAvatar').src = emp.avatar;
            document.getElementById('hrEmployeeDiscordName').textContent = emp.name;
            document.getElementById('hrEmployeeName').value = emp.profile.name || '';
            document.getElementById('hrEmployeeDepartment').value = emp.profile.department || '';
            document.getElementById('hrEmployeeStrikesCount').textContent = emp.strikes.length;
            document.getElementById('hrSaveEmployeeBtn').onclick = () => {
                emp.profile.name = document.getElementById('hrEmployeeName').value;
                emp.profile.department = document.getElementById('hrEmployeeDepartment').value;
                saveEmployees();
                closeModal('hrEmployeeProfile');
                renderHREmployeeGrid();
            };
            document.getElementById('hrAddStrikeBtn').onclick = () => {
                showModal('addStrike');
                document.getElementById('submitStrikeBtn').onclick = async () => {
                    const level = document.getElementById('strikeLevel').value;
                    const details = document.getElementById('strikeDetails').value;
                    emp.strikes.push({ level, details, timestamp: new Date().toLocaleString() });
                    saveEmployees();
                    await fetch(`${WORKER_URL}/sendDM?user_id=${emp.id}&message=You have been striked: ${level} - ${details}`);
                    const empNotifications = JSON.parse(localStorage.getItem(`notifications_${emp.id}`)) || [];
                    empNotifications.push({ id: Date.now().toString(), type: 'strike', message: 'You have been striked', link: 'disciplinaries', read: false, timestamp: new Date().toLocaleString() });
                    localStorage.setItem(`notifications_${emp.id}`, JSON.stringify(empNotifications));
                    closeModal('addStrike');
                    renderHREmployeeGrid();
                };
            };
        });
        grid.appendChild(card);
    });
}

// HR Notifications
function renderHRNotifications() {
    const list = document.getElementById('notificationList');
    list.innerHTML = '';
    employees.forEach(emp => {
        emp.absences.filter(a => a.status === 'pending').forEach(a => {
            const li = document.createElement('li');
            li.textContent = `New absence submitted by ${emp.profile.name}`;
            li.addEventListener('click', () => {
                showScreen('hrManageAbsences');
                renderHRPendingAbsences();
            });
            list.appendChild(li);
        });
    });
}

// Back Buttons
document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (isHR) {
            showScreen('hrHome');
        } else {
            showScreen('mainMenu');
        }
    });
});

// Modal Close Buttons
document.querySelectorAll('.close').forEach(close => {
    close.addEventListener('click', () => close.parentNode.parentNode.style.display = 'none');
});

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
        notifications = JSON.parse(localStorage.getItem(`notifications_${currentUser.id}`)) || [];
        clockInTime = parseInt(savedTime);
        const now = Date.now();
        if (now - clockInTime > 24 * 60 * 60 * 1000) {
            sendWebhook(`💤 ${currentUser.profile.name} has been auto logged out (inactive).`);
            downloadTXT(currentUser, clockInTime, now);
            localStorage.clear();
            employees = [];
            saveEmployees();
            showScreen('pin');
        } else {
            updateMainScreen();
            showScreen('mainMenu');
            startAutoLogoutCheck();
            loadTasks();
            renderNotifications();
            updateSidebarProfile();
        }
    } else {
        console.log('No session or code, showing PIN screen');
        showScreen('pin');
    }
});

function updateMainScreen() {
    // Add homepage content if needed
}

let autoLogoutInterval;
function startAutoLogoutCheck() {
    autoLogoutInterval = setInterval(() => {
        if (Date.now() - clockInTime > 24 * 60 * 60 * 1000) {
            const clockOutTime = Date.now();
            sendWebhook(`💤 ${currentUser.profile.name} has been auto logged out (24h limit).`);
            downloadTXT(currentUser, clockInTime, clockOutTime);
            localStorage.clear();
            employees = [];
            saveEmployees();
            document.getElementById('goodbyeName').textContent = currentUser.profile.name;
            showScreen('goodbye');
            clearInterval(autoLogoutInterval);
        }
    }, 60000);
}

// Hash Routing
window.addEventListener('hashchange', () => {
    const screenId = window.location.hash.slice(1);
    if (screens[screenId]) {
        showScreen(screenId);
        if (screenId === 'myRoles') {
            document.getElementById('myRolesBtn').click();
        } else if (screenId === 'tasks') {
            document.getElementById('myTasksBtn').click();
        } else if (screenId === 'submitAbsence') {
            document.getElementById('submitAbsenceBtn').click();
        } else if (screenId === 'payslips') {
            renderPayslips();
        } else if (screenId === 'disciplinaries') {
            renderStrikes();
        } else if (screenId === 'absences') {
            renderAbsences('pending');
            document.querySelector('.tab-btn[data-tab="pending"]').classList.add('active');
        }
    }
});