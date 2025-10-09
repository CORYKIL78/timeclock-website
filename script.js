// --- Profile Edit Buttons, Barcode, and Reset Countdown ---
document.addEventListener('DOMContentLoaded', () => {
    // Fetch and sync user profile from backend (Google Sheets) on load
    async function syncProfileFromSheets() {
        if (!window.currentUser) return;
        const profile = await fetchUserProfile(window.currentUser.id);
        if (profile) {
            // Update UI fields with latest data from Sheets
            if (profile.name && profileName) profileName.textContent = profile.name;
            if (profile.email && profileEmail) profileEmail.textContent = profile.email;
            if (profile.department && profileDepartment) profileDepartment.textContent = profile.department;
            if (profile.staffId && window.currentUser) {
                if (!window.currentUser.profile) window.currentUser.profile = {};
                window.currentUser.profile.staffId = profile.staffId;
            }
            // Also update local currentUser fields for consistency
            if (window.currentUser.profile) {
                window.currentUser.profile.name = profile.name;
                window.currentUser.profile.email = profile.email;
                window.currentUser.profile.department = profile.department;
            }
        }
    }
    // Initial sync on load
    syncProfileFromSheets();

    // Poll for live updates from Sheets every 15 seconds
    setInterval(syncProfileFromSheets, 15000);
    // Card flip and QR code logic
    const profileCard = document.getElementById('profileCard');
    const showIdBtn = document.getElementById('showIdBtn');
    const backToProfileBtn = document.getElementById('backToProfileBtn');
    const qrcodeEl = document.getElementById('qrcode');
    const staffIdDisplay = document.getElementById('staffIdDisplay');
    // Edit buttons
    const editNameBtn = document.getElementById('editNameBtn');
    const editEmailBtn = document.getElementById('editEmailBtn');
    const editDeptBtn = document.getElementById('editDeptBtn');
    const editFieldsContainer = document.getElementById('editFieldsContainer');
    // Profile fields
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileDepartment = document.getElementById('profileDepartment');
    // Profile pic
    const profilePic = document.getElementById('profilePic');
    if (profilePic && window.currentUser && window.currentUser.avatar) {
        profilePic.src = window.currentUser.avatar;
    }
    // Reset profile
    const resetProfileBtn = document.getElementById('resetProfileBtn');
    let resetCountdown = null;
    let resetTimer = null;
    // Card flip logic with live QR code and staff ID
    let lastProfileData = null;
    async function updateQrAndStaffId(forceFlip) {
        let profile = await fetchUserProfile(window.currentUser.id);
        if (!profile) profile = {};
        const name = profile.name || '';
        const email = profile.email || '';
        const department = profile.department || '';
        const discordUsername = window.currentUser?.name || '';
        const discordId = window.currentUser?.id || '';
        const staffId = profile.staffId || '';
        // Compose QR code data string as multi-line labeled text (all fields)
        const qrData =
            `Staff ID: ${staffId}\n` +
            `Discord Username: ${discordUsername}\n` +
            `Discord ID: ${discordId}\n` +
            `Name: ${name}\n` +
            `Email: ${email}\n` +
            `Department: ${department}`;
        staffIdDisplay.textContent = `Staff ID: ${staffId}`;
        // Only update QR if data changed or forced
        const newProfileData = JSON.stringify({staffId, discordUsername, discordId, name, email, department});
        if (forceFlip || newProfileData !== lastProfileData) {
            qrcodeEl.innerHTML = '';
            new QRCode(qrcodeEl, {
                text: qrData,
                width: 180,
                height: 180,
                colorDark: '#222',
                colorLight: '#fff',
                correctLevel: QRCode.CorrectLevel.H
            });
            lastProfileData = newProfileData;
        }
    }
    if (showIdBtn && profileCard && backToProfileBtn && qrcodeEl && staffIdDisplay) {
        showIdBtn.addEventListener('click', async () => {
            await updateQrAndStaffId(true);
            profileCard.classList.add('flipped');
        });
        backToProfileBtn.addEventListener('click', () => {
            profileCard.classList.remove('flipped');
        });
        // Live update QR and staff ID while card is flipped
        setInterval(() => {
            if (profileCard.classList.contains('flipped')) {
                updateQrAndStaffId(false);
            }
        }, 15000);
    }
    // Edit logic
    function showEditField(type, currentValue) {
        editFieldsContainer.innerHTML = '';
        const input = document.createElement('input');
        input.type = type === 'email' ? 'email' : 'text';
        input.value = currentValue;
        input.className = 'edit-field-input';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'edit-field-save';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'edit-field-cancel';
        editFieldsContainer.appendChild(input);
        editFieldsContainer.appendChild(saveBtn);
        editFieldsContainer.appendChild(cancelBtn);
        input.focus();
        saveBtn.onclick = async () => {
            if (type === 'name') profileName.textContent = input.value;
            if (type === 'email') profileEmail.textContent = input.value;
            // Department is not editable in portal
            // Save to backend after edit
            await upsertUserProfile();
            // Re-sync from Sheets after update
            await syncProfileFromSheets();
            editFieldsContainer.innerHTML = '';
        };
        cancelBtn.onclick = () => { editFieldsContainer.innerHTML = ''; };
    }
    if (editNameBtn) editNameBtn.onclick = () => showEditField('name', profileName.textContent);
    if (editEmailBtn) editEmailBtn.onclick = () => showEditField('email', profileEmail.textContent);
    // Department is not editable in portal
    if (editDeptBtn) editDeptBtn.style.display = 'none';
    // Reset profile with countdown
    if (resetProfileBtn) {
        resetProfileBtn.onclick = () => {
            if (resetCountdown) return;
            resetProfileBtn.textContent = 'Confirm Reset (10)';
            resetProfileBtn.classList.add('counting-down');
            let count = 10;
            resetCountdown = true;
            // Add cancel button to the right of reset button
            let cancel = document.getElementById('resetCancelBtn');
            if (!cancel) {
                cancel = document.createElement('button');
                cancel.textContent = 'Cancel';
                cancel.className = 'edit-field-cancel';
                cancel.id = 'resetCancelBtn';
                cancel.style.marginLeft = '18px';
                cancel.style.fontSize = '1.1em';
                resetProfileBtn.parentNode.appendChild(cancel);
            }
            cancel.onclick = () => {
                clearInterval(resetTimer);
                resetProfileBtn.textContent = 'Reset Profile';
                resetProfileBtn.classList.remove('counting-down');
                resetCountdown = false;
                cancel.remove();
            };
            resetTimer = setInterval(() => {
                count--;
                resetProfileBtn.textContent = `Confirm Reset (${count})`;
                if (count <= 0) {
                    clearInterval(resetTimer);
                    resetProfileBtn.textContent = 'Resetting...';
                    // TODO: Actually reset profile here
                    setTimeout(() => {
                        resetProfileBtn.textContent = 'Reset Profile';
                        resetProfileBtn.classList.remove('counting-down');
                        resetCountdown = false;
                        cancel.remove();
                    }, 2000);
                }
            }, 1000);
        };
    }
});
// --- USER PROFILE & STRIKES BACKEND INTEGRATION ---
const BACKEND_URL = 'https://timeclock-backend.marcusray.workers.dev';
// --- Backend Integration: Upsert User Profile ---
async function upsertUserProfile() {
    try {
        await fetch('https://timeclock-backend.marcusray.workers.dev/api/user/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                discordId: currentUser.id,
                name: currentUser.profile.name,
                email: currentUser.profile.email,
                department: currentUser.profile.department
            })
        });
        console.log('[User Upsert] Profile sent to backend.');
    } catch (e) {
        console.error('[User Upsert] Failed to upsert user profile:', e);
    }
}

async function fetchUserProfile(discordId) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/user/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId })
        });
        if (!res.ok) throw new Error('Failed to fetch user profile');
        return await res.json();
    } catch (e) {
        console.error('fetchUserProfile error:', e);
        return null;
    }
}

async function saveUserProfile(profile) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/user/upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });
        if (!res.ok) throw new Error('Failed to save user profile');
        return await res.json();
    } catch (e) {
        console.error('saveUserProfile error:', e);
        return null;
    }
}

async function fetchUserStrikes(discordId) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/user/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId })
        });
        if (!res.ok) throw new Error('Failed to fetch strikes');
        const data = await res.json();
        return data.strikes || [];
    } catch (e) {
        console.error('fetchUserStrikes error:', e);
        return [];
    }
}

async function addUserStrike(discordId, strike) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/user/strike`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId, strike })
        });
        if (!res.ok) throw new Error('Failed to add strike');
        return await res.json();
    } catch (e) {
        console.error('addUserStrike error:', e);
        return null;
    }
}

async function removeUserStrike(discordId, strikeIndex) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/user/strike/remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId, strikeIndex })
        });
        if (!res.ok) throw new Error('Failed to remove strike');
        return await res.json();
    } catch (e) {
        console.error('removeUserStrike error:', e);
        return null;
    }
}

async function submitStrikeAppeal(discordId, strikeIndex, reason) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/user/appeal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId, strikeIndex, reason })
        });
        if (!res.ok) throw new Error('Failed to submit appeal');
        return await res.json();
    } catch (e) {
        console.error('submitStrikeAppeal error:', e);
        return null;
    }
}

function renderStrikes(strikes) {
    const content = document.getElementById('disciplinariesContent');
    content.innerHTML = '';
    if (!strikes.length) {
        content.innerHTML = '<p>No strikes found.</p>';
        return;
    }
    strikes.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'strike-item';
        div.innerHTML = `
            <p>Level: ${s.level || ''}</p>
            <p>Reason: ${s.reason || ''}</p>
            <p>Details: ${s.details || ''}</p>
            <p>Action: ${s.action || ''}</p>
            <p>Timestamp: ${s.timestamp || ''}</p>
            <button class="appeal-strike-btn" data-index="${i}">Appeal</button>
        `;
        content.appendChild(div);
    });
    content.querySelectorAll('.appeal-strike-btn').forEach(btn => {
        btn.onclick = (e) => {
            const idx = btn.dataset.index;
            showAppealModal(idx);
        };
    });
}

function showAppealModal(strikeIndex) {
    let modal = document.getElementById('appealStrikeModal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'appealStrikeModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" id="closeAppealStrike">&times;</span>
            <h2>Appeal Strike</h2>
            <textarea id="appealReasonInput" placeholder="Enter your appeal reason..."></textarea>
            <button id="submitAppealBtn">Submit Appeal</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    document.getElementById('closeAppealStrike').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('submitAppealBtn').onclick = async () => {
        const reason = document.getElementById('appealReasonInput').value.trim();
        if (!reason) {
            alert('Please enter a reason for your appeal.');
            return;
        }
        const res = await submitStrikeAppeal(currentUser.id, strikeIndex, reason);
        if (res && res.success) {
            alert('Appeal submitted!');
            modal.style.display = 'none';
        } else {
            alert('Failed to submit appeal.');
        }
    };
}

// --- HOOK INTO DISCIPLINARIES BUTTON ---
document.getElementById('disciplinariesBtn').addEventListener('click', async () => {
    showScreen('disciplinaries');
    const strikes = await fetchUserStrikes(currentUser.id);
    renderStrikes(strikes);
});

// Removed broken updateProfileBtn logic (no such element in HTML)

// --- ON LOGIN, SYNC PROFILE FROM BACKEND ---
async function syncUserProfileOnLogin() {
    const profile = await fetchUserProfile(currentUser.id);
    if (profile) {
        const emp = getEmployee(currentUser.id);
        emp.profile = {
            name: profile.name || '',
            email: profile.email || '',
            department: profile.department || '',
            discordTag: profile.discordTag || ''
        };
        emp.strikes = profile.strikes || [];
        updateEmployee(emp);
        currentUser.profile = emp.profile;
        currentUser.strikes = emp.strikes;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        await upsertUserProfile(); // Log to Google Sheets after login/profile sync
    }
}

// Call syncUserProfileOnLogin() after successful login (e.g. after setting currentUser)
// Polling for absence status updates
setInterval(async () => {
    console.log('[DEBUG] Polling for absence status updates...');
    if (!window.currentUser) return;
    const emp = getEmployee(window.currentUser.id);
    if (!emp || !emp.absences) return;
    for (const absence of emp.absences) {
        if (absence.status === 'archived') continue;
        console.log(`[DEBUG] Checking absence:`, absence);
        try {
            const res = await fetch('https://timeclock-backend.marcusray.workers.dev/api/absence/getStatus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: emp.profile?.name || '',
                    startDate: absence.startDate,
                    endDate: absence.endDate
                })
            });
            if (!res.ok) continue;
            const data = await res.json();
            console.log(`[DEBUG] Received status from backend:`, data.status);
            if (data.status && absence.status !== data.status.toLowerCase()) {
                absence.status = data.status.toLowerCase();
                updateEmployee(emp);
                // Always re-render all absence tabs so they move to the correct tab
                ['pending', 'approved', 'rejected', 'archived'].forEach(tab => renderAbsences(tab));
                // Update Discord message if info available
                if (absence.messageId && absence.channelId) {
                    let statusText = data.status === 'APPROVE' || data.status === 'APPROVED' ? 'Approved' : (data.status === 'REJECT' || data.status === 'REJECTED' ? 'Rejected' : data.status);
                    const newMsg = `STATUS: ${statusText}`;
                    await updateEmbed(absence.channelId, absence.messageId, { description: newMsg });
                }
            }
        } catch (e) {
            // Ignore errors
        }
    }
}, 30000); // Poll every 30 seconds
// Update absence status (approve/reject) from backend
async function updateAbsenceStatus({ name, startDate, endDate, status, messageId }) {
    // 1. Update the absence in Google Sheets (column G)
    await fetch('https://timeclock-backend.marcusray.workers.dev/api/absence/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, startDate, endDate, status })
    });
    // 2. Update Discord message if messageId exists
    if (messageId) {
        let statusText = status === 'APPROVED' ? 'Approved' : 'Rejected';
        let color = status === 'APPROVED' ? 'GREEN' : 'RED';
        // Compose message update
        const newMsg = `STATUS: ${statusText}`;
        await updateEmbed(ABSENCE_CHANNEL, messageId, { description: newMsg });
    }
}
// Logoff sound
const LOGOFF_SOUND_URL = 'https://cdn.pixabay.com/audio/2024/11/29/audio_13c4a01b4b.mp3';
let logoffAudio = null;
function playLogoffSound() {
    if (!logoffAudio) {
        logoffAudio = new Audio(LOGOFF_SOUND_URL);
        logoffAudio.preload = 'auto';
        logoffAudio.load();
    }
    logoffAudio.currentTime = 0;
    logoffAudio.play();
}
// Handbooks button click handler
document.addEventListener('DOMContentLoaded', () => {
    const handbooksBtn = document.getElementById('handbooksBtn');
    if (handbooksBtn) {
        handbooksBtn.addEventListener('click', () => {
            window.open('https://docs.google.com/document/d/1SB48S4SiuT9_npDhgU1FT_CxAjdKGn40IpqUQKm2Nek/edit?tab=t.ib4suhnsfkzx#heading=h.5dly1dxe2rw', '_blank');
        });
    }
    // Absence submit handler
    const submitBtn = document.getElementById('submitAbsenceBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (window.absenceSubmitting || submitBtn.disabled) return;
            window.absenceSubmitting = true;
            submitBtn.disabled = true;
            const type = document.getElementById('absenceType').value;
            const startDate = document.getElementById('absenceStartDate').value;
            const endDate = document.getElementById('absenceEndDate').value;
            const comment = document.getElementById('absenceComment').value.trim();
            if (!startDate || !endDate || !comment) {
                showModal('alert', 'Please fill all fields');
                window.absenceSubmitting = false;
                return;
            }
            const emp = getEmployee(currentUser.id);
            emp.absences = emp.absences || [];
            const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
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
            // Send absence to backend for Google Sheets logging
            try {
                const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/absence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: emp.profile.name,
                        startDate,
                        endDate,
                        reason: type,
                        totalDays: days,
                        comment
                    })
                });
                if (response.ok) {
                    playSuccessSound();
                    setTimeout(() => {
                        showModal('alert', '<span class="success-tick"></span> Successfully submitted and sent!');
                    }, 100);
                } else {
                    showModal('alert', 'Failed to log absence in Google Sheets.');
                }
            } catch (e) {
                showModal('alert', 'Error connecting to backend.');
            }
            await sendAbsenceWebhook(absence);
            closeModal('absenceRequest');
            addNotification('absence', 'Absence request submitted!', 'absences');
            // Ensure pending tab is active and render
            document.querySelectorAll('.absence-tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('.absence-tab-btn[data-tab="pending"]').classList.add('active');
            document.getElementById('pendingFolder').classList.add('active');
            document.getElementById('approvedFolder').classList.remove('active');
            document.getElementById('rejectedFolder').classList.remove('active');
            document.getElementById('archivedFolder').classList.remove('active');
            renderAbsences('pending');
            window.absenceSubmitting = false;
            submitBtn.disabled = false;
        });
    }
});
// Animate the absence tab slider to the active tab
function updateAbsenceTabSlider() {
    const tabs = Array.from(document.querySelectorAll('.absence-tab-btn'));
    const slider = document.querySelector('.absence-tab-slider');
        if (!slider || tabs.length === 0) return;
        const activeIdx = tabs.findIndex(btn => btn.classList.contains('active'));
        if (activeIdx !== -1) {
            // Get the bounding box of the active tab relative to the parent (.absence-tabs)
            const tabsContainer = slider.parentElement;
            const activeTab = tabs[activeIdx];
            const tabRect = activeTab.getBoundingClientRect();
            const containerRect = tabsContainer.getBoundingClientRect();
            slider.style.left = (tabRect.left - containerRect.left) + 'px';
            slider.style.width = tabRect.width + 'px';
            slider.style.transform = 'none';
        }
}
// Fix absence tab slider logic

// Removed absence tab slider logic
// Absence webhook URL for Discord
const ABSENCE_WEBHOOK_URL = 'https://discord.com/api/webhooks/1422667332144201920/ijjZECto8hc2FxZdO0mPu0OnuhX4fJfRoR_nqq8bs7UEXO4ujugLd4Zc8b4F9BuV7fnw';

// Utility to send absence to Discord webhook
async function sendAbsenceWebhook(absence) {
    const emp = getEmployee(currentUser.id);
    const days = Math.ceil((new Date(absence.endDate) - new Date(absence.startDate)) / (1000 * 60 * 60 * 24)) + 1;
    const msg = [
        `**${absence.cancelled ? 'Absence Cancelled' : 'New Absence Request'}**`,
        `• **User:** <@${currentUser.id}> (${emp.profile.name})`,
        `• **Type:** ${absence.type}`,
        `• **Start Date:** ${absence.startDate}`,
        `• **End Date:** ${absence.endDate}`,
        `• **Days:** ${days}`,
        `• **Reason:** ${absence.comment || absence.reason || 'N/A'}`,
        absence.cancelled ? '• **Status:** Cancelled' : '',
        '',
        '_Please accept via HR Portal_'
    ].filter(Boolean).join('\n');
    await fetch(ABSENCE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msg })
    });
}
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
    confirmCancelAbsence: document.getElementById('confirmCancelAbsenceModal')
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
    if (screens[screenId]) {
        screens[screenId].classList.add('active');
        setTimeout(() => {
            screens[screenId].style.opacity = '1';
        }, 10);
        window.location.hash = screenId;
        const sidebar = document.getElementById('sidebar');
        const notificationPanel = document.getElementById('notificationPanel');
        if (screenId !== 'portalWelcome' && ['mainMenu', 'myProfile', 'myRoles', 'tasks', 'absences', 'payslips', 'disciplinaries', 'timeclock', 'mail'].includes(screenId)) {
            sidebar.classList.remove('hidden');
            notificationPanel.classList.remove('hidden');
        } else {
            sidebar.classList.add('hidden');
            notificationPanel.classList.add('hidden');
        }
        // Set profile pic on portal welcome screen
        if (screenId === 'portalWelcome' && currentUser && currentUser.avatar) {
            const portalPic = document.getElementById('portalWelcomeProfilePic');
            if (portalPic) portalPic.src = currentUser.avatar;
        }
    } else {
        console.error('Screen not found:', screenId);
        showScreen('discord');
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
            document.getElementById('alertMessage').innerHTML = message;
        }
        modal.style.display = 'flex';
    } else {
        console.error('Modal not found:', modalId);
    }
}

function closeModal(modalId) {
    console.log('Closing modal:', modalId);
    if (modals[modalId]) {
        modals[modalId].style.display = 'none';
        modals[modalId].classList.remove('success');
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
    if (!successAudio) {
        preloadAudio();
    }
    successAudio.currentTime = 0;
    successAudio.play().catch(e => console.error('Success sound playback error:', e));
}

function playNotificationSound() {
    if (!notificationAudio) {
        preloadAudio();
    }
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(e => console.error('Notification sound playback error:', e));
}

function showMailDeliveryAnimation() {
    const animation = document.getElementById('mailDeliveryAnimation');
    animation.classList.remove('hidden');
    setTimeout(() => animation.classList.add('hidden'), 1000);
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
        return await response.json();
    } catch (e) {
        console.error('Embed error:', e);
    }
}

async function updateEmbed(channelId, messageId, embed) {
    try {
        const response = await fetch(`${WORKER_URL}/updateEmbed?channel_id=${channelId}&message_id=${messageId}&embed_json=${encodeURIComponent(JSON.stringify(embed))}`);
        if (!response.ok) throw new Error(`Embed update failed: ${response.status} ${await response.text()}`);
        console.log('Embed updated successfully:', messageId);
    } catch (e) {
        console.error('Embed update error:', e);
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
    emp.notifications.push({ type, message, timestamp });
    updateEmployee(emp);
    playNotificationSound();
    renderNotifications();
// Listen for new mail and notify
function notifyNewMail(subject) {
    addNotification('mail', `New mail received: ${subject}`);
    playNotificationSound();
}
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
        li.textContent = `${n.type}: ${n.message} (${n.timestamp})`;
        li.addEventListener('click', () => {
            currentNotifications.splice(index, 1);
            const emp = getEmployee(currentUser.id);
            emp.notifications = currentNotifications;
            updateEmployee(emp);
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
    currentTasks.forEach((task) => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <span>${task.text}</span>
        `;
        const checkbox = li.querySelector('.task-checkbox');
        checkbox.addEventListener('change', () => {
            task.completed = checkbox.checked;
            if (checkbox.checked) {
                li.classList.add('completed');
                setTimeout(() => {
                    currentTasks = currentTasks.filter(t => t !== task);
                    saveTasks();
                    renderTasks();
                }, 5000);
            } else {
                li.classList.remove('completed');
                saveTasks();
            }
        });
        if (task.completed) {
            li.classList.add('completed');
            setTimeout(() => {
                currentTasks = currentTasks.filter(t => t !== task);
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

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
}

function updateMainScreen() {
    console.log('Updating main screen for user:', currentUser.id);
    const emp = getEmployee(currentUser.id);
    document.getElementById('greeting').textContent = `Good ${getGreeting()}, ${emp.profile.name}!`;
    document.getElementById('lastLogin').textContent = `Last Log In: ${emp.lastLogin || 'Never'}`;
    document.getElementById('mainProfilePic').src = currentUser.avatar || 'https://via.placeholder.com/100';
    document.getElementById('totalAbsences').textContent = emp.absences.length;
    let totalDays = 0;
    emp.absences.forEach(a => {
        const start = new Date(a.startDate);
        const end = new Date(a.endDate);
        if (end >= start) {
            totalDays += Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        }
    });
    document.getElementById('totalAbsenceDays').textContent = totalDays;
    document.getElementById('currentDepartment').textContent = emp.profile.department || 'N/A';
    if (emp.onLOA) {
        showModal('alert', 'You are currently on a Leave of Absence');
        document.getElementById('clockInBtn').disabled = true;
        document.getElementById('clockOutBtn').disabled = true;
    } else {
        document.getElementById('clockInBtn').disabled = isClockedIn;
        document.getElementById('clockInBtn').classList.toggle('hidden', isClockedIn);
        document.getElementById('clockOutBtn').disabled = !isClockedIn;
        document.getElementById('clockOutBtn').classList.toggle('hidden', !isClockedIn);
        document.getElementById('sessionInfo').classList.toggle('hidden', !isClockedIn);
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
                    await fetchEmployees();
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
                    await fetchEmployees();
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
            console.error('Auth response error:', { status: response.status, errorText });
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
    await fetchEmployees();

    // Always fetch user profile from backend after Discord login
    let backendProfile = await fetchUserProfile(user.id);
    let isFirstTime = false;
    if (backendProfile && backendProfile.name) {
        // Existing user: use backend profile
        currentUser = {
            id: user.id,
            name: user.global_name || user.username,
            avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : '',
            roles: member.roles,
            profile: {
                name: backendProfile.name,
                email: backendProfile.email,
                department: backendProfile.department,
                discordTag: backendProfile.discordTag || user.username
            },
            absences: backendProfile.absences || [],
            strikes: backendProfile.strikes || [],
            payslips: backendProfile.payslips || [],
            mail: backendProfile.mail || [],
            sentMail: backendProfile.sentMail || [],
            drafts: backendProfile.drafts || [],
            pendingDeptChange: backendProfile.pendingDeptChange || null,
            lastLogin: backendProfile.lastLogin || null
        };
    } else {
        // First time user: use local or empty profile
        isFirstTime = true;
        currentUser = {
            id: user.id,
            name: user.global_name || user.username,
            avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : '',
            roles: member.roles,
            profile: getEmployee(user.id).profile || {},
            absences: getEmployee(user.id).absences || [],
            strikes: getEmployee(user.id).strikes || [],
            payslips: getEmployee(user.id).payslips || [],
            mail: getEmployee(user.id).mail || [],
            sentMail: getEmployee(user.id).sentMail || [],
            drafts: getEmployee(user.id).drafts || [],
            pendingDeptChange: getEmployee(user.id).pendingDeptChange || null,
            lastLogin: getEmployee(user.id).lastLogin || null
        };
    }

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

    if (isFirstTime || !currentUser.profile.name) {
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
                document.getElementById('mailBtn').click();
            }, 6000)
        },
        {
            element: document.getElementById('composeMailBtn'),
            text: 'Click this icon to compose a new mail!',
            action: () => document.getElementById('composeMailBtn').click()
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
            <img src="${sender.avatar || 'https://via.placeholder.com/40'}" alt="Sender">
            <span class="subject">${m.subject || 'No Subject'}</span>
            <span class="timestamp">${m.timestamp}</span>
        `;
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
            document.getElementById('replyMailBtn').classList.toggle('hidden', m.senderId === 'system');
            showModal('viewMail');
        });
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
        li.addEventListener('click', () => {
            document.getElementById('viewMailContent').innerHTML = `
                <p><strong>To:</strong> ${m.to.join(', ')}</p>
                <p><strong>Subject:</strong> ${m.subject || 'No Subject'}</p>
                <p>${m.content}</p>
                <p><em>${m.timestamp}</em></p>
                ${m.attachments ? m.attachments.map(file => `<p><a href="${file.url}" download="${file.name}">Download ${file.name}</a></p>`).join('') : ''}
            `;
            document.getElementById('replyMailBtn').classList.add('hidden');
            showModal('viewMail');
        });
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
        li.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-draft') || e.target.classList.contains('delete-draft') || e.target.classList.contains('send-draft')) return;
            document.getElementById('viewMailContent').innerHTML = `
                <p><strong>To:</strong> ${d.recipients.join(', ') || 'None'}</p>
                <p><strong>Subject:</strong> ${d.subject || 'No Subject'}</p>
                <p>${d.content}</p>
                <p><em>${d.timestamp}</em></p>
                ${d.attachments ? d.attachments.map(file => `<p><a href="${file.url}" download="${file.name}">Download ${file.name}</a></p>`).join('') : ''}
            `;
            document.getElementById('replyMailBtn').classList.add('hidden');
            showModal('viewMail');
        });
        draftsContent.appendChild(li);
    });

    const recipientSelect = document.getElementById('mailRecipients');
    recipientSelect.innerHTML = '<option value="" disabled>Select Recipients</option>';
    employees.filter(e => e.profile.name && e.id !== currentUser.id && e.roles.includes(REQUIRED_ROLE)).forEach(e => {
        const option = document.createElement('option');
        option.value = e.id;
        option.textContent = e.profile.name;
        recipientSelect.appendChild(option);
    });

    draftsContent.querySelectorAll('.edit-draft').forEach(btn => {
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
    });

    draftsContent.querySelectorAll('.delete-draft').forEach(btn => {
        btn.addEventListener('click', () => {
            emp.drafts.splice(btn.dataset.index, 1);
            updateEmployee(emp);
            renderMail();
            showModal('alert', '<span class="success-tick"></span> Draft deleted successfully!');
            playSuccessSound();
        });
    });

    draftsContent.querySelectorAll('.send-draft').forEach(btn => {
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
    });
}

async function sendDraft(index) {
    const recipientIds = Array.from(document.getElementById('mailRecipients').selectedOptions).map(opt => opt.value);
    const subject = document.getElementById('mailSubject').value.trim();
    const content = document.getElementById('mailContent').value.trim();
    const files = document.getElementById('mailAttachments').files;
    if (!recipientIds.length || recipientIds.includes('')) {
        document.getElementById('mailError').classList.remove('hidden');
        setTimeout(() => document.getElementById('mailError').classList.add('hidden'), 2000);
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
    emp.drafts.splice(index, 1);
    updateEmployee(emp);
    showMailDeliveryAnimation();
    showModal('alert', '<span class="success-tick"></span> Successfully sent!');
    playSuccessSound();
    addNotification('mail', 'Your mail has been sent!', 'mail');
    renderMail();
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
        }, 2000);
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
    updateMainScreen();
});

document.getElementById('sidebarProfilePic').addEventListener('click', () => {
    showScreen('myProfile');
    const emp = getEmployee(currentUser.id);
    document.getElementById('profileName').textContent = emp.profile.name || 'N/A';
    document.getElementById('profileEmail').textContent = emp.profile.email || 'N/A';
    document.getElementById('profileDepartment').textContent = emp.profile.department || 'N/A';
    document.getElementById('profileDepartment').classList.toggle('pending-department', !!emp.pendingDeptChange);
    document.getElementById('updateNameInput').value = emp.profile.name || '';
    document.getElementById('updateEmailInput').value = emp.profile.email || '';
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

const updateProfileBtn = document.getElementById('updateProfileBtn');
if (updateProfileBtn) {
    updateProfileBtn.addEventListener('click', () => {
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
        addNotification('profile', 'Your profile has been updated!', 'myProfile');
        document.getElementById('profileName').textContent = name;
        document.getElementById('profileEmail').textContent = email;
    } else {
        showModal('alert', 'Please enter a valid name and email');
    }
    });
}

const changeDeptBtn = document.getElementById('changeDeptBtn');
if (changeDeptBtn) {
    changeDeptBtn.addEventListener('click', () => {
        showModal('deptChange');
    });
}

document.getElementById('changeDepartmentBtn').addEventListener('click', () => {
    showModal('deptChange');
});

document.getElementById('submitDeptChangeBtn').addEventListener('click', () => {
    const selectedDept = document.querySelector('input[name="newDepartment"]:checked');
    if (selectedDept) {
        const emp = getEmployee(currentUser.id);
        // Upsert user profile to backend after department is set
        upsertUserProfile();
        showScreen('setupVerify');
        setTimeout(() => {
            const deptRole = DEPT_ROLES[currentUser.profile.department];
            if (currentUser.roles.includes(deptRole)) {
                // ...existing code for success...
            } else {
                // ...existing code for failure...
            }
            // Send department change notification (simulate webhook or log)
            // Example: sendEmbed or webhook call can go here if needed
            // For now, just log
            console.log('Department Change Request:', {
                title: 'Department Change Request',
                description: `User: <@${currentUser.id}> (${emp.profile.name})\nRequested Department: ${selectedDept.value}`,
                color: 0xffff00
            });
            closeModal('deptChange');
            showModal('alert', '<span class="success-tick"></span> Request to change department has been sent.');
            playSuccessSound();
            addNotification('department', 'Department change request submitted!', 'myProfile');
            document.getElementById('profileDepartment').textContent = emp.profile.department;
            document.getElementById('profileDepartment').classList.add('pending-department');
        }, 2000);
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
    showModal('alert', '<span class="success-tick"></span> Profile reset successfully!');
    playSuccessSound();
    // No notification sent for profile reset
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
        showModal('alert', '<span class="success-tick"></span> Task added successfully!');
        playSuccessSound();
        addNotification('task', 'New task added!', 'tasks');
    } else {
        showModal('alert', 'Please enter a task');
    }
});

document.getElementById('absencesBtn').addEventListener('click', () => {
    showScreen('absences');
    document.querySelectorAll('.absence-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.absence-tab-btn[data-tab="pending"]').classList.add('active');
    document.getElementById('pendingFolder').classList.add('active');
    document.getElementById('approvedFolder').classList.remove('active');
    document.getElementById('rejectedFolder').classList.remove('active');
    document.getElementById('archivedFolder').classList.remove('active');
    updateAbsenceTabSlider();
    renderAbsences('pending');
});

document.getElementById('requestAbsenceBtn').addEventListener('click', () => {
    showModal('absenceRequest');
});

document.getElementById('absenceStartDate').addEventListener('change', calculateAbsenceDays);
document.getElementById('absenceEndDate').addEventListener('change', calculateAbsenceDays);

function calculateAbsenceDays() {
    const start = new Date(document.getElementById('absenceStartDate').value);
    const end = new Date(document.getElementById('absenceEndDate').value);
    if (start && end && end >= start) {
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        document.getElementById('absenceDays').textContent = `Total Days: ${days}`;
    } else {
        document.getElementById('absenceDays').textContent = `Total Days: 0`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // ...existing code...
    const submitBtn = document.getElementById('submitAbsenceBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (window.absenceSubmitting || submitBtn.disabled) return;
            window.absenceSubmitting = true;
            submitBtn.disabled = true;
            const type = document.getElementById('absenceType').value;
            const startDate = document.getElementById('absenceStartDate').value;
            const endDate = document.getElementById('absenceEndDate').value;
            const comment = document.getElementById('absenceComment').value.trim();
            if (!startDate || !endDate || !comment) {
                showModal('alert', 'Please fill all fields');
                window.absenceSubmitting = false;
                return;
            }
            const emp = getEmployee(currentUser.id);
            emp.absences = emp.absences || [];
            const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
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
            await sendAbsenceWebhook(absence);
            closeModal('absenceRequest');
            // Only show one success message: forcibly close any open alert modal
            const alertModal = document.getElementById('alertModal');
            if (alertModal && alertModal.style.display === 'flex') {
                alertModal.style.display = 'none';
            }
            setTimeout(() => {
                showModal('alert', '<span class="success-tick"></span> Successfully submitted and sent!');
            }, 100);
            addNotification('absence', 'Absence request submitted!', 'absences');
            // Ensure pending tab is active and render
            document.querySelectorAll('.absence-tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('.absence-tab-btn[data-tab="pending"]').classList.add('active');
            document.getElementById('pendingFolder').classList.add('active');
            document.getElementById('approvedFolder').classList.remove('active');
        });
    }
});

document.getElementById('absencesScreen').addEventListener('click', (e) => {
    if (e.target.classList.contains('absence-tab-btn')) {
        document.querySelectorAll('.absence-tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        const folder = e.target.dataset.tab;
        document.getElementById('pendingFolder').classList.toggle('active', folder === 'pending');
        document.getElementById('approvedFolder').classList.toggle('active', folder === 'approved');
        document.getElementById('rejectedFolder').classList.toggle('active', folder === 'rejected');
        document.getElementById('archivedFolder').classList.toggle('active', folder === 'archived');
        updateAbsenceTabSlider();
        renderAbsences(folder);
    }
});


function renderAbsences(tab) {
    console.log(`[DEBUG] Rendering absences for tab: ${tab}`);
    let empDebug = getEmployee(currentUser.id);
    if (empDebug && empDebug.absences) {
        empDebug.absences.forEach(a => {
            console.log(`[DEBUG] Absence:`, a, `Status: ${a.status}`);
        });
    }
    // UI debug: check if pendingAbsences UL is visible and if Pending tab/folder are active
    const pendingUl = document.getElementById('pendingAbsences');
    const pendingTabBtn = document.querySelector('.absence-tab-btn[data-tab="pending"]');
    const pendingFolderDiv = document.getElementById('pendingFolder');
    if (pendingUl) {
        console.log('[UI DEBUG] pendingAbsences UL exists. Child count:', pendingUl.childElementCount, 'Display:', getComputedStyle(pendingUl).display);
    } else {
        console.log('[UI DEBUG] pendingAbsences UL NOT FOUND');
    }
    if (pendingTabBtn) {
        console.log('[UI DEBUG] Pending tab button classList:', pendingTabBtn.classList.toString());
    } else {
        console.log('[UI DEBUG] Pending tab button NOT FOUND');
    }
    if (pendingFolderDiv) {
        console.log('[UI DEBUG] Pending folder classList:', pendingFolderDiv.classList.toString(), 'Display:', getComputedStyle(pendingFolderDiv).display);
    } else {
        console.log('[UI DEBUG] Pending folder NOT FOUND');
    }
    console.log('[DEBUG] Rendering absences for tab:', tab);
    // empDebug already declared above, reuse it
    console.log('[DEBUG] All absences for user:', JSON.stringify(empDebug.absences));
    const pendingList = document.getElementById('pendingAbsences');
    const approvedList = document.getElementById('approvedAbsences');
    const rejectedList = document.getElementById('rejectedAbsences');
    const archivedList = document.getElementById('archivedAbsences');
    if (!pendingList || !approvedList || !rejectedList || !archivedList) return;
    pendingList.innerHTML = '';
    approvedList.innerHTML = '';
    rejectedList.innerHTML = '';
    archivedList.innerHTML = '';
    const emp = getEmployee(currentUser.id);
    // Always render all absences in their respective lists, regardless of active tab
    emp.absences.forEach(a => {
        // Normalize status values for UI
        let status = a.status;
        if (status === 'approve') status = 'approved';
        if (status === 'reject') status = 'rejected';
        if (status !== a.status) a.status = status; // update in-memory for consistency
        if (status === 'pending') {
            console.log('[DEBUG] Rendering pending absence:', JSON.stringify(a));
        }
        const li = document.createElement('li');
        li.className = `absence-item ${status}`;
        let bg = '';
        if (status === 'pending') bg = 'background: var(--yellow-hazard); color: #212529;';
        if (status === 'approved') bg = 'background: #d4edda; color: #155724;';
        if (status === 'rejected') bg = 'background: #f8d7da; color: #721c24;';
        if (status === 'archived') bg = 'background: #e2e3e5; color: #41464b; opacity: 0.7;';
        li.setAttribute('style', bg);
        li.innerHTML = `
            <span>Type: ${a.type}</span>
            <span>Start: ${a.startDate}</span>
            <span>End: ${a.endDate}</span>
            <span style="background:rgba(255,255,0,0.2);padding:2px 6px;border-radius:4px;">Total Days: ${Math.ceil((new Date(a.endDate) - new Date(a.startDate)) / (1000 * 60 * 60 * 24)) + 1}</span>
            ${status === 'rejected' ? `<span>Reason: ${a.reason || 'N/A'}</span>` : ''}
            ${status === 'pending' ? `<button class="cancel-absence-btn" data-id="${a.id}">Cancel Absence</button>` : ''}
            ${status === 'archived' ? `<button class="delete-absence-btn" data-id="${a.id}">Delete Absence</button>` : ''}
        `;
        li.addEventListener('click', (e) => {
            if (e.target.classList.contains('cancel-absence-btn') || e.target.classList.contains('delete-absence-btn')) return;
            // Show all details as in the form
            const totalDays = Math.ceil((new Date(a.endDate) - new Date(a.startDate)) / (1000 * 60 * 60 * 24)) + 1;
            document.getElementById('absenceDetailContent').innerHTML = `
                <ul style="margin-left:1em;">
                  <li><strong>Type:</strong> ${a.type}</li>
                  <li><strong>Start Date:</strong> ${a.startDate}</li>
                  <li><strong>End Date:</strong> ${a.endDate}</li>
                  <li><strong>Total Days:</strong> ${totalDays}</li>
                  <li><strong>Comment:</strong> ${a.comment || 'N/A'}</li>
                  <li><strong>Status:</strong> ${status}</li>
                  <li><strong>ID:</strong> ${a.id}</li>
                  ${a.reason ? `<li><strong>Reason:</strong> ${a.reason}</li>` : ''}
                  ${a.messageId ? `<li><strong>Message ID:</strong> ${a.messageId}</li>` : ''}
                </ul>
            `;
            document.getElementById('cancelAbsenceBtn').classList.toggle('hidden', status !== 'pending');
            document.getElementById('cancelAbsenceBtn').dataset.id = a.id;
            const deleteBtn = document.getElementById('deleteAbsenceBtn');
            if (deleteBtn) {
                deleteBtn.classList.toggle('hidden', status !== 'archived');
                deleteBtn.dataset.id = a.id;
            }
            showModal('absenceDetail');
        });
        // Button click handlers for cancel/delete
        li.querySelectorAll('.cancel-absence-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                document.getElementById('confirmCancelAbsenceBtn').dataset.id = a.id;
                showModal('confirmCancelAbsence');
            };
        });
        // Only allow delete from archived folder
        if (status === 'archived') {
            li.querySelectorAll('.delete-absence-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    // Show custom delete confirmation modal
                    showDeleteAbsenceConfirm(a.id);
                };
            });
        }
        if (status === 'pending') pendingList.appendChild(li);
        else if (status === 'approved') approvedList.appendChild(li);
        else if (status === 'rejected') rejectedList.appendChild(li);
        else if (status === 'archived') archivedList.appendChild(li);
    });
    // Expand the folder/container to fit all absences in the active tab
    const folderElem = document.getElementById(tab + 'Folder');
    if (folderElem) {
        folderElem.style.height = 'auto';
        folderElem.style.minHeight = folderElem.scrollHeight + 'px';
        folderElem.style.transition = 'min-height 0.3s var(--transition-ease)';
    }
}

document.getElementById('confirmCancelAbsenceBtn').addEventListener('click', async () => {
    const absenceId = document.getElementById('confirmCancelAbsenceBtn').dataset.id;
    const emp = getEmployee(currentUser.id);
    const absence = emp.absences.find(a => a.id === absenceId);
    if (absence) {
        absence.status = 'archived';
        updateEmployee(emp);
        updateMainScreen(); // Update stats after cancel
        // 1. Update Google Sheets column H to 'CANCELLED' for this absence
        try {
            await fetch('https://timeclock-backend.marcusray.workers.dev/api/absence/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: emp.profile.name,
                    startDate: absence.startDate,
                    endDate: absence.endDate
                })
            });
        } catch (e) {
            console.error('Failed to update Sheets for cancellation:', e);
        }
        // 2. Update Discord message if messageId exists
        if (absence.messageId) {
            // Compose strikethrough message
            const days = Math.ceil((new Date(absence.endDate) - new Date(absence.startDate)) / (1000 * 60 * 60 * 24)) + 1;
            const oldMsg = [
                `**New Absence Request**`,
                `• **User:** <@${currentUser.id}> (${emp.profile.name})`,
                `• **Type:** ${absence.type}`,
                `• **Start Date:** ${absence.startDate}`,
                `• **End Date:** ${absence.endDate}`,
                `• **Days:** ${days}`,
                `• **Reason:** ${absence.comment || absence.reason || 'N/A'}`,
                '',
                '_Please accept via HR Portal_'
            ].filter(Boolean).join('\n');
            const newMsg = `~~${oldMsg}~~\n\n**Absence Cancelled**`;
            // Call your proxy worker to update the message
            await updateEmbed(ABSENCE_CHANNEL, absence.messageId, { description: newMsg });
        }
        // Animate folder scaling
        animateAbsenceFolderScale();
        closeModal('confirmCancelAbsence');
        document.getElementById('absenceDetailModal').style.display = 'none';
        showModal('alert', '<span class="success-tick"></span> Cancelled Absence');
        playSuccessSound();
        addNotification('absence', 'Absence request cancelled!', 'absences');
        setTimeout(() => renderAbsences('pending'), 200); // allow scale animation
    }
});

document.getElementById('noCancelAbsenceBtn').addEventListener('click', () => {
    closeModal('confirmCancelAbsence');
});


// Custom delete confirmation modal logic
function showDeleteAbsenceConfirm(absenceId) {
    // Always remove and recreate modal to avoid duplicate IDs or event listeners
    let modal = document.getElementById('deleteAbsenceConfirmModal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'deleteAbsenceConfirmModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span claswclose" id="closeDeleteAbsenceConfirm">&times;</span>
            <h2>Delete Absence</h2>
            <p>Are you sure? This will permanently delete it and you cannot retrieve it.</p>
            <div id="deleteAbsenceActions">
                <button id="confirmDeleteAbsenceBtn" class="delete-absence-btn">Delete</button>
                <button id="noDeleteAbsenceBtn">No</button>
            </div>
            <div id="deleteAbsenceLoading" style="display:none;text-align:center;margin-top:1em;">
                <div class="spinner"></div>
                <p>Deleting...</p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    // X button
    document.getElementById('closeDeleteAbsenceConfirm').onclick = () => { modal.style.display = 'none'; };
    // No button
    document.getElementById('noDeleteAbsenceBtn').onclick = () => { modal.style.display = 'none'; };
    // Confirm delete
    document.getElementById('confirmDeleteAbsenceBtn').onclick = async () => {
        document.getElementById('deleteAbsenceActions').style.display = 'none';
        document.getElementById('deleteAbsenceLoading').style.display = 'block';
        await new Promise(r => setTimeout(r, 2000));
        const emp = getEmployee(currentUser.id);
        emp.absences = emp.absences.filter(a => a.id !== absenceId);
        updateEmployee(emp);
        // Animate folder scaling
        animateAbsenceFolderScale();
        modal.style.display = 'none';
        document.getElementById('absenceDetailModal').style.display = 'none';
        showModal('alert', '<span class="success-tick"></span> Successfully deleted!');
        playSuccessSound();
        addNotification('absence', 'Absence deleted!', 'absences');
        const activeTab = document.querySelector('.absence-tab-btn.active')?.dataset.tab || 'pending';
        setTimeout(() => renderAbsences(activeTab), 200); // allow scale animation
        // Reset modal for next use
        document.getElementById('deleteAbsenceActions').style.display = 'block';
        document.getElementById('deleteAbsenceLoading').style.display = 'none';
    };
}

// Animate scaling of the active absence folder
function animateAbsenceFolderScale() {
    const activeTab = document.querySelector('.absence-tab-btn.active')?.dataset.tab || 'pending';
    const folderElem = document.getElementById(activeTab + 'Folder');
    if (folderElem) {
        folderElem.style.transition = 'transform 0.3s var(--transition-ease), min-height 0.3s var(--transition-ease)';
        folderElem.style.transform = 'scale(0.97)';
        setTimeout(() => {
            folderElem.style.transform = 'scale(1)';
        }, 180);
    }
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
    const button = document.getElementById('clockInBtn');
    button.style.background = '#0056b3';
    button.disabled = true;
    button.textContent = 'Loading...';
    await new Promise(r => setTimeout(r, 1000));
    clockInTime = Date.now();
    localStorage.setItem('clockInTime', clockInTime);
    isClockedIn = true;
    clockInActions = [];
    button.textContent = 'Clock In';
    button.style.background = '';
    updateMainScreen();
    const emp = getEmployee(currentUser.id);
    await sendWebhook(`<@${currentUser.id}> (${emp.profile.name}) clocked in at ${new Date().toLocaleString()}`);
    showModal('alert', '<span class="success-tick"></span> You have clocked in!');
    playSuccessSound();
    addNotification('timeclock', 'You have clocked in!', 'timeclock');
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
    const button = document.getElementById('clockOutBtn');
    button.style.background = '#0056b3';
    button.disabled = true;
    button.textContent = 'Loading...';
    await new Promise(r => setTimeout(r, 1000));
    const clockOutTime = Date.now();
    clearInterval(clockInInterval);
    isClockedIn = false;
    button.textContent = 'Clock Out';
    button.style.background = '';
    updateMainScreen();
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
    addNotification('timeclock', 'You have clocked out!', 'timeclock');
    renderPreviousSessions();
});

document.getElementById('mailBtn').addEventListener('click', () => {
    showScreen('mail');
    renderMail();
    document.querySelectorAll('.mail-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.mail-tabs .tab-btn[data-tab="inbox"]').classList.add('active');
    document.getElementById('inboxFolder').classList.add('active');
    document.getElementById('sentFolder').classList.remove('active');
    document.getElementById('draftsFolder').classList.remove('active');
    updateTabSlider();
});

document.getElementById('composeMailBtn').addEventListener('click', () => {
    setSelectValues('mailRecipients', []);
    document.getElementById('mailSubject').value = '';
    document.getElementById('mailContent').value = '';
    document.getElementById('mailAttachments').value = '';
    delete document.getElementById('sendMailBtn').dataset.draftIndex;
    showModal('composeMail');
});

document.getElementById('sendMailBtn').addEventListener('click', async () => {
    const recipientIds = Array.from(document.getElementById('mailRecipients').selectedOptions).map(opt => opt.value);
    const subject = document.getElementById('mailSubject').value.trim();
    const content = document.getElementById('mailContent').value.trim();
    const files = document.getElementById('mailAttachments').files;
    if (!recipientIds.length || recipientIds.includes('')) {
        document.getElementById('mailError').classList.remove('hidden');
        setTimeout(() => document.getElementById('mailError').classList.add('hidden'), 2000);
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
    if ('draftIndex' in document.getElementById('sendMailBtn').dataset) {
        emp.drafts.splice(parseInt(document.getElementById('sendMailBtn').dataset.draftIndex), 1);
        delete document.getElementById('sendMailBtn').dataset.draftIndex;
    }
    updateEmployee(emp);
    showMailDeliveryAnimation();
    showModal('alert', '<span class="success-tick"></span> Successfully sent!');
    playSuccessSound();
    addNotification('mail', 'Your mail has been sent!', 'mail');
    renderMail();
});

document.getElementById('saveDraftBtn').addEventListener('click', () => {
    const recipientIds = Array.from(document.getElementById('mailRecipients').selectedOptions).map(opt => opt.value);
    const subject = document.getElementById('mailSubject').value.trim();
    const content = document.getElementById('mailContent').value.trim();
    const files = document.getElementById('mailAttachments').files;
    const emp = getEmployee(currentUser.id);
    emp.drafts = emp.drafts || [];
    const draftData = {
        recipientIds,
        recipients: recipientIds.map(id => getEmployee(id).profile.name),
        subject,
        content,
        timestamp: new Date().toLocaleString(),
        attachments: null
    };
    if (files.length) {
        Promise.all(Array.from(files).map(file => {
            const reader = new FileReader();
            return new Promise(resolve => {
                reader.onload = () => resolve({ name: file.name, url: reader.result });
                reader.readAsDataURL(file);
            });
        })).then(attachments => {
            draftData.attachments = attachments;
            if ('draftIndex' in document.getElementById('sendMailBtn').dataset) {
                emp.drafts[parseInt(document.getElementById('sendMailBtn').dataset.draftIndex)] = draftData;
                delete document.getElementById('sendMailBtn').dataset.draftIndex;
            } else {
                emp.drafts.push(draftData);
            }
            updateEmployee(emp);
            closeModal('composeMail');
            showModal('alert', '<span class="success-tick"></span> Draft saved successfully!');
            playSuccessSound();
            addNotification('mail', 'Mail draft saved!', 'mail');
            renderMail();
        });
    } else {
        if ('draftIndex' in document.getElementById('sendMailBtn').dataset) {
            emp.drafts[parseInt(document.getElementById('sendMailBtn').dataset.draftIndex)] = draftData;
            delete document.getElementById('sendMailBtn').dataset.draftIndex;
        } else {
            emp.drafts.push(draftData);
        }
        updateEmployee(emp);
        closeModal('composeMail');
        showModal('alert', '<span class="success-tick"></span> Draft saved successfully!');
        playSuccessSound();
        addNotification('mail', 'Mail draft saved!', 'mail');
        renderMail();
    }
});

document.getElementById('replyMailBtn').addEventListener('click', () => {
    document.getElementById('replyContent').value = '';
    showModal('replyMail');
});

document.getElementById('sendReplyBtn').addEventListener('click', async () => {
    const content = document.getElementById('replyContent').value.trim();
    if (!content) {
        showModal('alert', 'Please enter a reply');
        return;
    }
    showModal('alert', 'Sending...');
    await new Promise(r => setTimeout(r, 1000));
    const emp = getEmployee(currentUser.id);
    const sender = getEmployee(currentMail.senderId);
    const timestamp = new Date().toLocaleString();
    const replyData = {
        from: emp.profile.name,
        senderId: currentUser.id,
        content,
        timestamp
    };
    currentMail.thread = currentMail.thread || [];
    currentMail.thread.push(replyData);
    emp.mail[currentMail.index] = currentMail;
    sender.mail = sender.mail || [];
    sender.mail.push({
        id: Date.now().toString(),
        from: emp.profile.name,
        senderId: currentUser.id,
        to: [sender.profile.name],
        recipientIds: [currentMail.senderId],
        subject: `Re: ${currentMail.subject || 'No Subject'}`,
        content,
        timestamp,
        thread: []
    });
    updateEmployee(emp);
    updateEmployee(sender);
    sendDM(currentMail.senderId, `Reply from ${emp.profile.name}: ${content}`);
    addNotification('mail', `Reply from ${emp.profile.name}: ${currentMail.subject}`, 'mail', currentMail.senderId);
    showMailDeliveryAnimation();
    closeModal('replyMail');
    closeModal('viewMail');
    showModal('alert', '<span class="success-tick"></span> Reply sent successfully!');
    playSuccessSound();
    addNotification('mail', 'Your reply has been sent!', 'mail');
    renderMail();
});

document.getElementById('mailScreen').addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
        document.querySelectorAll('.mail-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        const folder = e.target.dataset.tab;
        document.getElementById('inboxFolder').classList.toggle('active', folder === 'inbox');
        document.getElementById('sentFolder').classList.toggle('active', folder === 'sent');
        document.getElementById('draftsFolder').classList.toggle('active', folder === 'drafts');
        updateTabSlider();
    }
});

function updateTabSlider() {
    const activeTab = document.querySelector('.mail-tabs .tab-btn.active');
    if (!activeTab) return;
    const slider = document.querySelector('.tab-slider');
    if (!slider) return;
    const rect = activeTab.getBoundingClientRect();
    const containerRect = document.querySelector('.mail-tabs').getBoundingClientRect();
    slider.style.width = `${rect.width}px`;
    slider.style.transform = `translateX(${rect.left - containerRect.left}px)`;
}

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
    playLogoffSound();
    showScreen('setupVerify'); // show loading spinner screen
    setTimeout(() => showScreen('discord'), 2000);
});

document.querySelector('.sidebar-toggle').addEventListener('click', () => {
    console.log('Sidebar toggle clicked');
    document.getElementById('sidebar').classList.toggle('extended');
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
(async function init() {
    console.log('Initializing Staff Portal');
    preloadAudio();
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
            console.log('Loaded saved user:', currentUser);
            if (currentUser.id) {
                const emp = getEmployee(currentUser.id);
                document.getElementById('portalWelcomeName').textContent = emp.profile.name;
                document.getElementById('portalLastLogin').textContent = emp.lastLogin || 'Never';
                console.log('Showing portalWelcome screen with sidebar');
                showScreen('portalWelcome');
                updateSidebarProfile();
                await fetchEmployees();
                return;
            }
        } catch (e) {
            console.error('Error parsing saved user:', e);
            localStorage.removeItem('currentUser');
        }
    }
    await handleOAuthRedirect();
})();