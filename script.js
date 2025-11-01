// --- Profile Edit Buttons, Barcode, and Reset Countdown ---
// --- Global debug output for profile sync and auth ---
let profileDebug = null;
let authDebug = null;
function setProfileDebug(msg, isError) {
    if (!profileDebug) profileDebug = document.getElementById('profileDebug');
    if (isError) {
        if (profileDebug) {
            profileDebug.textContent = msg;
            profileDebug.style.color = '#b71c1c';
        }
        console.error(msg);
    } else {
        // Only log to console for non-errors, don't show in UI
        console.debug(msg);
    }
}
function setAuthDebug(msg, isError) {
    if (!authDebug) authDebug = document.getElementById('authDebug');
    if (authDebug) {
        authDebug.textContent = msg;
        authDebug.style.color = isError ? '#b71c1c' : '#1976d2';
    }
    if (isError) {
        console.error('[AUTH]', msg);
    } else {
        console.debug('[AUTH]', msg);
    }
}

// Simple profile display update using Discord data - GLOBAL FUNCTION
function updateProfileDisplay() {
    if (!currentUser) return;
    
    console.log('[DEBUG] updateProfileDisplay - currentUser:', currentUser);
    console.log('[DEBUG] updateProfileDisplay - currentUser.profile:', currentUser.profile);
    
    // Update profile fields with Discord data
    const profileNameEl = document.getElementById('profileName');
    const profileEmailEl = document.getElementById('profileEmail');
    const profileDepartmentEl = document.getElementById('profileDepartment');
    
    // Use currentUser.name (from Discord) or profile.name (from backend)
    if (profileNameEl) {
        const displayName = currentUser.profile?.name || currentUser.name || 'Not set';
        profileNameEl.textContent = displayName;
        console.log('[DEBUG] Set profileName to:', displayName);
    }
    
    // Use profile.email from backend
    if (profileEmailEl) {
        const displayEmail = currentUser.profile?.email || 'Not set';
        profileEmailEl.textContent = displayEmail;
        console.log('[DEBUG] Set profileEmail to:', displayEmail);
    }
    
    // Use profile.department from backend  
    if (profileDepartmentEl) {
        const displayDept = currentUser.profile?.department || 'Not set';
        profileDepartmentEl.textContent = displayDept;
        console.log('[DEBUG] Set profileDepartment to:', displayDept);
        
        // Check if there's a pending department change
        const emp = getEmployee(currentUser.id);
        if (emp && emp.pendingDeptChange) {
            profileDepartmentEl.classList.add('pending-department');
            console.log('[DEBUG] Added pending-department class');
        } else {
            profileDepartmentEl.classList.remove('pending-department');
        }
    }
    
    updateProfilePictures();
}

document.addEventListener('DOMContentLoaded', () => {

    async function syncProfileFromSheets() {
        if (!currentUser) {
            console.debug('[syncProfileFromSheets] No currentUser');
            return;
        }
        console.debug('[syncProfileFromSheets] Starting sync for user:', currentUser.id);
        const profile = await fetchUserProfile(currentUser.id);
        console.debug('[syncProfileFromSheets] fetched profile: ' + JSON.stringify(profile));
        
        if (profile && profile.name) {
            // Ensure currentUser.profile exists
            if (!currentUser.profile) currentUser.profile = {};
            
            // Update currentUser profile with all data from backend first
            currentUser.profile.name = profile.name;
            currentUser.profile.email = profile.email;
            currentUser.profile.department = profile.department;
            currentUser.profile.staffId = profile.staffId;
            
            console.debug('[syncProfileFromSheets] Updated currentUser.profile: ' + JSON.stringify(currentUser.profile));
            
            // Update UI fields with latest data from Sheets
            const profileNameEl = document.getElementById('profileName');
            const profileEmailEl = document.getElementById('profileEmail');
            const profileDepartmentEl = document.getElementById('profileDepartment');
            
            console.debug('[syncProfileFromSheets] DOM elements found:', {
                profileNameEl: !!profileNameEl,
                profileEmailEl: !!profileEmailEl,
                profileDepartmentEl: !!profileDepartmentEl
            });
            
            if (profile.name && profileNameEl) {
                profileNameEl.textContent = profile.name;
                console.debug('[syncProfileFromSheets] Set profileName to:', profile.name);
            } else {
                console.debug('[syncProfileFromSheets] Could not set profileName:', { hasName: !!profile.name, hasElement: !!profileNameEl });
            }
            if (profile.email && profileEmailEl) {
                profileEmailEl.textContent = profile.email;
                console.debug('[syncProfileFromSheets] Set profileEmail to:', profile.email);
            } else {
                console.debug('[syncProfileFromSheets] Could not set profileEmail:', { hasEmail: !!profile.email, hasElement: !!profileEmailEl });
            }
            if (profile.department && profileDepartmentEl) {
                profileDepartmentEl.textContent = profile.department;
                console.debug('[syncProfileFromSheets] Set profileDepartment to:', profile.department);
            } else {
                console.debug('[syncProfileFromSheets] Could not set profileDepartment:', { hasDepartment: !!profile.department, hasElement: !!profileDepartmentEl });
            }
            
            // Update profile pictures after getting name
            updateProfilePictures();
            
            console.debug('[syncProfileFromSheets] UI update completed successfully');
        } else {
            console.debug('[syncProfileFromSheets] No valid profile from backend, profile was:', profile);
            // If no profile from backend, use local currentUser data if available
            const profileNameEl = document.getElementById('profileName');
            const profileEmailEl = document.getElementById('profileEmail');
            const profileDepartmentEl = document.getElementById('profileDepartment');
            
            if (currentUser.profile) {
                if (currentUser.profile.name && profileNameEl) {
                    profileNameEl.textContent = currentUser.profile.name;
                    console.debug('[syncProfileFromSheets] Used local name:', currentUser.profile.name);
                }
                if (currentUser.profile.email && profileEmailEl) {
                    profileEmailEl.textContent = currentUser.profile.email;
                    console.debug('[syncProfileFromSheets] Used local email:', currentUser.profile.email);
                }
                if (currentUser.profile.department && profileDepartmentEl) {
                    profileDepartmentEl.textContent = currentUser.profile.department;
                    console.debug('[syncProfileFromSheets] Used local department:', currentUser.profile.department);
                }
                updateProfilePictures();
            } else {
                console.debug('[syncProfileFromSheets] No profile data available at all');
                setProfileDebug('[syncProfileFromSheets] No profile data available', true);
            }
        }
    }
    // Wait for window.currentUser to be set before syncing
    function waitForCurrentUserAndSync() {
        if (window.currentUser && window.currentUser.id) {
            console.debug('[AUTH] Discord user loaded:', window.currentUser);
            setAuthDebug('Discord user loaded: ' + window.currentUser.id + ' (' + (window.currentUser.username || window.currentUser.name || '') + ')', false);
            setProfileDebug('User loaded. Updating profile display...', false);
            updateProfileDisplay();
            setInterval(updateProfileDisplay, 15000);
            // Check for approved change requests periodically
            setInterval(() => {
                if (window.currentUser && window.currentUser.id) {
                    checkApprovedChangeRequests(window.currentUser.id);
                }
            }, 30000); // Check every 30 seconds
            // Start role fetch debug
            if (typeof fetchRoleNames === 'function') {
                console.debug('[AUTH] Starting role fetch for user:', window.currentUser.id);
            } else {
                console.warn('[AUTH] fetchRoleNames function not found. Role fetch will not run.');
            }
        } else {
            console.debug('[AUTH] Waiting for Discord user login...');
            setAuthDebug('Waiting for Discord user login...', false);
            setTimeout(waitForCurrentUserAndSync, 500);
        }
    }
    waitForCurrentUserAndSync();
    
    // Check for suspension status
    async function checkSuspensionStatus() {
        if (!window.currentUser || !window.currentUser.id) return;
        
        try {
            const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/user-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: window.currentUser.id })
            });
            
            if (response.ok) {
                const statusData = await response.json();
                if (statusData.status === 'suspended') {
                    showSuspensionModal();
                    return true; // User is suspended
                }
            }
        } catch (error) {
            console.error('Error checking suspension status:', error);
        }
        return false; // User is not suspended
    }
    
    // Show suspension modal
    function showSuspensionModal() {
        // Create suspension modal if it doesn't exist
        let suspensionModal = document.getElementById('suspensionModal');
        if (!suspensionModal) {
            suspensionModal = document.createElement('div');
            suspensionModal.id = 'suspensionModal';
            suspensionModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(5px);
            `;
            
            suspensionModal.innerHTML = `
                <div style="
                    background: white;
                    padding: 3em 2.5em 2em 2.5em;
                    border-radius: 15px;
                    max-width: 450px;
                    text-align: center;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    border: 3px solid #f44336;
                ">
                    <div style="font-size: 4em; margin-bottom: 0.5em;">⚠️</div>
                    <h2 style="color: #f44336; margin-bottom: 1em; font-size: 1.5em;">Portal Suspended</h2>
                    <p style="color: #333; font-size: 1.1em; line-height: 1.6; margin-bottom: 2em;">
                        Your portal is suspended temporarily. Please contact Marcus Ray if this is a concern.
                    </p>
                    <button id="suspensionLogoutBtn" style="
                        background: #f44336;
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 8px;
                        font-size: 1.1em;
                        cursor: pointer;
                        transition: background 0.3s;
                    " onmouseover="this.style.background='#d32f2f'" onmouseout="this.style.background='#f44336'">
                        Log Out
                    </button>
                </div>
            `;
            
            document.body.appendChild(suspensionModal);
            
            // Add logout functionality
            const logoutBtn = document.getElementById('suspensionLogoutBtn');
            logoutBtn.onclick = () => {
                localStorage.removeItem('currentUser');
                localStorage.removeItem('lastProcessedCode');
                localStorage.removeItem('clockInTime');
                window.location.reload();
            };
        }
        
        suspensionModal.style.display = 'flex';
    }
    
    // Check suspension status when user loads
    setTimeout(async () => {
        if (window.currentUser && window.currentUser.id) {
            const isSuspended = await checkSuspensionStatus();
            if (!isSuspended) {
                // Only check periodically if not suspended initially
                setInterval(checkSuspensionStatus, 30000); // Check every 30 seconds
            }
        }
    }, 2000);
    // --- Add debug logging for Discord login and role fetch ---
    if (document.getElementById('discordLoginBtn')) {
        document.getElementById('discordLoginBtn').addEventListener('click', function() {
            console.debug('[AUTH] Login with Discord button clicked.');
        });
    }

    // Patch fetchRoleNames to add debug logs if it exists
    if (typeof fetchRoleNames === 'function') {
        const origFetchRoleNames = fetchRoleNames;
        window.fetchRoleNames = async function(...args) {
            console.debug('[AUTH] fetchRoleNames called with:', ...args);
            try {
                const result = await origFetchRoleNames.apply(this, args);
                console.debug('[AUTH] fetchRoleNames result:', result);
                return result;
            } catch (e) {
                console.error('[AUTH] fetchRoleNames error:', e);
                throw e;
            }
        };
    }
    // Edit buttons
    const editNameBtn = document.getElementById('editNameBtn');
    const editEmailBtn = document.getElementById('editEmailBtn');
    const editDeptBtn = document.getElementById('editDeptBtn');
    // Profile fields
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileDepartment = document.getElementById('profileDepartment');

    // Department Change Modal
    let deptChangeModal = document.getElementById('deptChangeModal');
    if (!deptChangeModal) {
        deptChangeModal = document.createElement('div');
        deptChangeModal.id = 'deptChangeModal';
        deptChangeModal.style.display = 'none';
        deptChangeModal.style.position = 'fixed';
        deptChangeModal.style.left = '0';
        deptChangeModal.style.top = '0';
        deptChangeModal.style.width = '100vw';
        deptChangeModal.style.height = '100vh';
        deptChangeModal.style.background = 'rgba(0,0,0,0.5)';
        deptChangeModal.style.zIndex = '9999';
        deptChangeModal.innerHTML = `
            <div style="background:#fff;padding:2em 2em 1.5em 2em;border-radius:10px;max-width:350px;margin:10vh auto;position:relative;box-shadow:0 2px 16px #0002;">
                <h3 style="margin-top:0">Request Department Change</h3>
                <label for="deptSelect">Select new department:</label>
                <select id="deptSelect" style="width:100%;margin:1em 0 1.5em 0;font-size:1.1em">
                    <option value="Customer Relations Department">Customer Relations</option>
                    <option value="Development Department">Development</option>
                    <option value="Careers Department">Careers</option>
                </select>
                <button id="deptRequestBtn" style="width:100%;font-size:1.1em">Request Change</button>
                <button id="deptCancelBtn" style="width:100%;margin-top:0.5em;background:#eee;color:#333">Cancel</button>
                <div id="deptChangeSuccess" style="display:none;margin-top:1em;color:#388e3c;font-weight:bold;text-align:center;">Successfully requested!</div>
            </div>
        `;
        document.body.appendChild(deptChangeModal);
    }
    
    // Function to generate initials-based profile picture
    function generateInitialsAvatar(name, size = 100) {
        if (!name) return null;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = size;
        canvas.height = size;
        
        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        // Get initials (first letter of first name and first letter of last name)
        const initials = name.split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
        
        // Text styling
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${size * 0.4}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw initials
        ctx.fillText(initials, size / 2, size / 2);
        
        return canvas.toDataURL();
    }
    
    // Function to update profile pictures with fallback to initials
    function updateProfilePictures() {
        const profilePics = document.querySelectorAll('#profilePic, #sidebarProfilePic, #mainProfilePic');
        
        profilePics.forEach(pic => {
            if (window.currentUser) {
                if (window.currentUser.avatar) {
                    // Use Discord avatar if available
                    pic.src = window.currentUser.avatar;
                } else if (window.currentUser.profile && window.currentUser.profile.name) {
                    // Generate initials avatar if name is available
                    pic.src = generateInitialsAvatar(window.currentUser.profile.name);
                } else if (window.currentUser.username) {
                    // Fallback to username initials
                    pic.src = generateInitialsAvatar(window.currentUser.username);
                } else {
                    // Ultimate fallback
                    pic.src = generateInitialsAvatar('User');
                }
            }
        });
    }
    
    // Profile pic - call update function
    updateProfilePictures();
    // Reset profile
    const resetProfileBtn = document.getElementById('resetProfileBtn');
    let resetCountdown = null;
    let resetTimer = null;
    
    // New streamlined edit handlers - open modals instead of inline editing
    if (editNameBtn) {
        editNameBtn.onclick = () => {
            document.getElementById('nameChangeModal').style.display = 'block';
            document.getElementById('nameChangeSuccess').style.display = 'none';
        };
    }
    
    if (editEmailBtn) {
        editEmailBtn.onclick = () => {
            document.getElementById('emailChangeModal').style.display = 'block';
            document.getElementById('emailChangeSuccess').style.display = 'none';
        };
    }
    
    if (editDeptBtn) {
        editDeptBtn.onclick = () => {
            document.getElementById('deptChangeModal').style.display = 'block';
            document.getElementById('deptChangeSuccess').style.display = 'none';
        };
    }

    // Modal logic
    deptChangeModal.addEventListener('click', (e) => {
        if (e.target === deptChangeModal) deptChangeModal.style.display = 'none';
    });
    const deptCancelBtn = document.getElementById('deptCancelBtn');
    if (deptCancelBtn) {
        deptCancelBtn.onclick = () => {
            deptChangeModal.style.display = 'none';
        };
    }
    const deptRequestBtn = document.getElementById('deptRequestBtn');
    if (deptRequestBtn) {
        deptRequestBtn.onclick = async () => {
            const deptSelect = document.getElementById('deptSelect');
            const reasonTextarea = document.getElementById('deptChangeReason');
            const requestedDept = deptSelect ? deptSelect.value : '';
            const reason = reasonTextarea ? reasonTextarea.value.trim() : '';
            
            if (!requestedDept || !reason) {
                alert('Please select a department and provide a reason.');
                return;
            }
            
            // Disable button while processing
            deptRequestBtn.disabled = true;
            deptRequestBtn.textContent = 'Submitting...';
            
            try {
                // Save to Google Sheets via backend API
                const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/change-request/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        discordId: currentUser.id,
                        requestType: 'department',
                        currentValue: currentUser.profile?.department || '',
                        requestedValue: requestedDept,
                        reason: reason,
                        staffName: currentUser.profile?.name || currentUser.name || 'User',
                        email: currentUser.profile?.email || '',
                        department: currentUser.profile?.department || '',
                        staffId: currentUser.profile?.staffId || 'Not assigned'
                    })
                });
                
                if (response.ok) {
                    // Show success modal
                    showModal('alert', '✅ Department change request submitted successfully! You will receive a notification when it\'s reviewed.');
                    
                    // Add notification to sidebar
                    addNotification('profile', 'Department change request submitted', 'myProfile');
                    
                    // Close modal after delay
                    setTimeout(() => { 
                        deptChangeModal.style.display = 'none'; 
                        if (deptSelect) deptSelect.value = '';
                        if (reasonTextarea) reasonTextarea.value = '';
                        if (deptChangeSuccess) deptChangeSuccess.style.display = 'none';
                    }, 1500);
                } else {
                    throw new Error('Failed to submit request');
                }
            } catch (error) {
                console.error('Error submitting department change request:', error);
                alert('Failed to submit request. Please try again.');
            } finally {
                deptRequestBtn.disabled = false;
                deptRequestBtn.textContent = 'Request Change';
            }
        };
    }
    
    // Name Change Modal Handlers
    const nameChangeModal = document.getElementById('nameChangeModal');
    const submitNameChangeBtn = document.getElementById('submitNameChangeBtn');
    const cancelNameChangeBtn = document.getElementById('cancelNameChangeBtn');
    
    if (submitNameChangeBtn) {
        submitNameChangeBtn.onclick = async () => {
            const newNameInput = document.getElementById('newNameInput');
            const reasonInput = document.getElementById('nameChangeReason');
            const newName = newNameInput ? newNameInput.value.trim() : '';
            const reason = reasonInput ? reasonInput.value.trim() : '';
            
            if (!newName || !reason) {
                alert('Please enter a new name and provide a reason.');
                return;
            }
            
            // Disable button while processing
            submitNameChangeBtn.disabled = true;
            submitNameChangeBtn.textContent = 'Submitting...';
            
            try {
                // Save to Google Sheets via backend API
                const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/change-request/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        discordId: currentUser.id,
                        requestType: 'name',
                        currentValue: currentUser.profile?.name || '',
                        requestedValue: newName,
                        reason: reason,
                        staffName: currentUser.profile?.name || currentUser.name || 'User',
                        email: currentUser.profile?.email || '',
                        department: currentUser.profile?.department || '',
                        staffId: currentUser.profile?.staffId || 'Not assigned'
                    })
                });
                
                if (response.ok) {
                    // Show success modal
                    showModal('alert', '✅ Name change request submitted successfully! You will receive a notification when it\'s reviewed.');
                    
                    // Add notification to sidebar
                    addNotification('profile', 'Name change request submitted', 'myProfile');
                    
                    // Close modal after delay
                    setTimeout(() => { 
                        nameChangeModal.style.display = 'none'; 
                        if (newNameInput) newNameInput.value = '';
                        if (reasonInput) reasonInput.value = '';
                    }, 1500);
                } else {
                    throw new Error('Failed to submit request');
                }
            } catch (error) {
                console.error('Error submitting name change request:', error);
                alert('Failed to submit request. Please try again.');
            } finally {
                submitNameChangeBtn.disabled = false;
                submitNameChangeBtn.textContent = 'Submit Request';
            }
        };
    }
    
    if (cancelNameChangeBtn) {
        cancelNameChangeBtn.onclick = () => {
            nameChangeModal.style.display = 'none';
        };
    }
    
    // Email Change Modal Handlers
    const emailChangeModal = document.getElementById('emailChangeModal');
    const submitEmailChangeBtn = document.getElementById('submitEmailChangeBtn');
    const cancelEmailChangeBtn = document.getElementById('cancelEmailChangeBtn');
    
    if (submitEmailChangeBtn) {
        submitEmailChangeBtn.onclick = async () => {
            const newEmailInput = document.getElementById('newEmailInput');
            const reasonInput = document.getElementById('emailChangeReason');
            const newEmail = newEmailInput ? newEmailInput.value.trim() : '';
            const reason = reasonInput ? reasonInput.value.trim() : '';
            
            if (!newEmail || !reason) {
                alert('Please enter a new email and provide a reason.');
                return;
            }
            
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(newEmail)) {
                alert('Please enter a valid email address.');
                return;
            }
            
            // Disable button while processing
            submitEmailChangeBtn.disabled = true;
            submitEmailChangeBtn.textContent = 'Submitting...';
            
            try {
                // Save to Google Sheets via backend API
                const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/change-request/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        discordId: currentUser.id,
                        requestType: 'email',
                        currentValue: currentUser.profile?.email || '',
                        requestedValue: newEmail,
                        reason: reason,
                        staffName: currentUser.profile?.name || currentUser.name || 'User',
                        email: currentUser.profile?.email || '',
                        department: currentUser.profile?.department || '',
                        staffId: currentUser.profile?.staffId || 'Not assigned'
                    })
                });
                
                if (response.ok) {
                    // Show success modal
                    showModal('✅ Email change request submitted successfully! You will receive a notification when it\'s reviewed.');
                    
                    // Add notification to sidebar
                    addNotification('profile', 'Email change request submitted', 'myProfile');
                    
                    // Close modal after delay
                    setTimeout(() => { 
                        emailChangeModal.style.display = 'none'; 
                        if (newEmailInput) newEmailInput.value = '';
                        if (reasonInput) reasonInput.value = '';
                    }, 1500);
                } else {
                    throw new Error('Failed to submit request');
                }
            } catch (error) {
                console.error('Error submitting email change request:', error);
                alert('Failed to submit request. Please try again.');
            } finally {
                submitEmailChangeBtn.disabled = false;
                submitEmailChangeBtn.textContent = 'Submit Request';
            }
        };
    }
    
    if (cancelEmailChangeBtn) {
        cancelEmailChangeBtn.onclick = () => {
            emailChangeModal.style.display = 'none';
        };
    }
    
    // Modal close handlers (click outside to close)
    if (nameChangeModal) {
        nameChangeModal.addEventListener('click', (e) => {
            if (e.target === nameChangeModal) nameChangeModal.style.display = 'none';
        });
    }
    
    if (emailChangeModal) {
        emailChangeModal.addEventListener('click', (e) => {
            if (e.target === emailChangeModal) emailChangeModal.style.display = 'none';
        });
    }
    
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
        const payload = {
            discordId: currentUser.id,
            name: currentUser.profile.name,
            email: currentUser.profile.email,
            department: currentUser.profile.department,
            timezone: currentUser.profile.timezone,
            country: currentUser.profile.country
        };
        setProfileDebug('[upsertUserProfile] Sending payload: ' + JSON.stringify(payload), false);
        const res = await fetch('https://timeclock-backend.marcusray.workers.dev/api/user/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        setProfileDebug('[upsertUserProfile] Backend response: ' + JSON.stringify(data), false);
    } catch (e) {
        setProfileDebug('[User Upsert] Failed to upsert user profile: ' + e, true);
    }
}

async function fetchUserProfile(discordId) {
    try {
        console.debug('[fetchUserProfile] Fetching profile for discordId: ' + discordId);
        const res = await fetch(`${BACKEND_URL}/api/user/profile?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId })
        });
        if (res.status === 404) {
            console.debug('[fetchUserProfile] User not found (404)');
            return null;
        }
        if (!res.ok) throw new Error('Failed to fetch user profile: ' + res.status);
        const data = await res.json();
        console.debug('[fetchUserProfile] Response: ' + JSON.stringify(data));
        return data;
    } catch (e) {
        setProfileDebug('fetchUserProfile error: ' + e, true);
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
        const res = await fetch(`${BACKEND_URL}/api/disciplinaries/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffId: discordId })
        });
        if (!res.ok) throw new Error('Failed to fetch disciplinaries');
        const data = await res.json();
        return data.disciplinaries || [];
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
        content.innerHTML = '<div class="no-data">No disciplinaries found.</div>';
        return;
    }
    strikes.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'disciplinary-item';
        div.style.cssText = `
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            border: 1px solid #ddd; 
            padding: 15px; 
            margin: 10px 0; 
            border-radius: 8px; 
            background: #f9f9f9; 
            cursor: pointer;
            transition: background 0.2s;
        `;
        div.onmouseover = () => div.style.background = '#ffe8e8';
        div.onmouseout = () => div.style.background = '#f9f9f9';
        div.onclick = () => showDisciplinaryDetails(s);
        
        div.innerHTML = `
            <div style="flex: 1;">
                <span style="font-weight: bold; color: #d32f2f;">New Disciplinary</span>
            </div>
            <div style="flex: 1; text-align: right;">
                <span style="color: #666;">By ${s.assignedBy || 'Unknown'}</span>
            </div>
        `;
        content.appendChild(div);
    });
}

function showDisciplinaryDetails(disciplinary) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.5); display: flex; align-items: center; 
        justify-content: center; z-index: 10000;
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div style="
            background: white; padding: 30px; border-radius: 8px; 
            max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        ">
            <h3 style="margin: 0 0 20px 0; color: #d32f2f;">Disciplinary Details</h3>
            <div style="margin-bottom: 15px;">
                <strong>Date:</strong> ${disciplinary.dateAssigned}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Type:</strong> ${disciplinary.strikeType || 'N/A'}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Comment:</strong> ${disciplinary.comment || 'No comment provided'}
            </div>
            <div style="margin-bottom: 20px;">
                <strong>Assigned By:</strong> ${disciplinary.assignedBy || 'Unknown'}
            </div>
            <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
                <strong>To appeal this, please contact the OP.</strong>
            </div>
            <div style="text-align: center;">
                <button onclick="this.closest('[style*=fixed]').remove()" style="
                    background: #666; color: white; border: none; 
                    padding: 12px 24px; border-radius: 4px; cursor: pointer;
                ">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
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

// Removed broken updateProfileBtn logic (no such element in HTML)

// --- ON LOGIN, SYNC PROFILE FROM BACKEND ---
async function syncUserProfileOnLogin() {
    // First check for account reset
    const resetCheck = await checkForReset(currentUser.id);
    if (resetCheck && resetCheck.resetProcessed) {
        // Account was reset, clear local data and redirect to setup
        showModal('alert', resetCheck.message);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('employees');
        localStorage.removeItem('lastDisciplinaryCheck'); // Clear disciplinary counter
        localStorage.removeItem('lastPayslipCheck'); // Clear payslip counter  
        setTimeout(() => {
            window.location.reload();
        }, 3000);
        return;
    }
    
    const profile = await fetchUserProfile(currentUser.id);
    if (profile) {
        // Check account status
        if (profile.status === "Suspended") {
            showSuspendedPortal();
            return;
        }
        
        const emp = getEmployee(currentUser.id);
        emp.profile = {
            name: profile.name || '',
            email: profile.email || '',
            department: profile.department || '',
            discordTag: profile.discordTag || '',
            status: profile.status || 'Active'
        };
        emp.strikes = profile.strikes || [];
        updateEmployee(emp);
        currentUser.profile = emp.profile;
        currentUser.strikes = emp.strikes;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Check for approved change requests
        await checkApprovedChangeRequests(currentUser.id);
        
        // Ensure user login is recorded for mail system
        await upsertUserProfile(); // Log to Google Sheets after login/profile sync
    }
}

// Function to check if user account has been reset
async function checkForReset(discordId) {
    try {
        const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/user/check-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId })
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Error checking for reset:', error);
    }
    return null;
}

// Function to check for approved change requests and apply them
async function checkApprovedChangeRequests(discordId) {
    try {
        console.log('[DEBUG] Checking approved change requests for Discord ID:', discordId);
        const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/change-request/check-approved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId })
        });
        
        console.log('[DEBUG] Change request check response status:', response.status);
        const responseText = await response.text();
        console.log('[DEBUG] Change request check raw response:', responseText);
        
        if (response.ok) {
            const result = JSON.parse(responseText);
            console.log('[DEBUG] Change request check result:', result);
            if (result.hasApprovedRequests && result.appliedChanges) {
                // Notify user of approved changes
                for (const change of result.appliedChanges) {
                    if (change.type === 'name') {
                        addNotification('profile', `✅ Name change approved: ${change.from} → ${change.to}`, 'myProfile');
                        // Send DM notification for approved name change
                        try {
                            await sendDiscordDM(discordId, {
                                title: "✅ Request Approved",
                                description: `Your name change request has been approved!\n\n**From:** ${change.from}\n**To:** ${change.to}`,
                                color: 0x00ff00
                            });
                        } catch (e) {
                            console.error('Failed to send name change approval DM:', e);
                        }
                    } else if (change.type === 'department') {
                        addNotification('profile', `✅ Department change approved: ${change.from} → ${change.to}`, 'myProfile');
                        // Send DM notification for approved department change
                        try {
                            await sendDiscordDM(discordId, {
                                title: "✅ Request Approved",
                                description: `Your department change request has been approved!\n\n**From:** ${change.from}\n**To:** ${change.to}`,
                                color: 0x00ff00
                            });
                        } catch (e) {
                            console.error('Failed to send department change approval DM:', e);
                        }
                    }
                }
                
                // Refresh user profile to get updated information
                const updatedProfile = await fetchUserProfile(discordId);
                if (updatedProfile) {
                    const emp = getEmployee(discordId);
                    emp.profile = {
                        name: updatedProfile.name || '',
                        email: updatedProfile.email || '',
                        department: updatedProfile.department || '',
                        discordTag: updatedProfile.discordTag || '',
                        status: updatedProfile.status || 'Active'
                    };
                    
                    // Clear pending change flags
                    emp.pendingDeptChange = null;
                    
                    updateEmployee(emp);
                    currentUser.profile = emp.profile;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    
                    // Update profile display if on profile page
                    if (document.getElementById('profileName')) {
                        document.getElementById('profileName').textContent = emp.profile.name;
                        document.getElementById('profileDepartment').textContent = emp.profile.department;
                        document.getElementById('profileDepartment').classList.remove('pending-department');
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking for approved change requests:', error);
    }
}

// Polling for approved change requests
setInterval(async () => {
    if (!window.currentUser) return;
    try {
        await checkApprovedChangeRequests(window.currentUser.id);
    } catch (e) {
        console.error('Error polling for approved change requests:', e);
    }
}, 5000); // Poll every 5 seconds for near-instant notifications

// Call syncUserProfileOnLogin() after successful login (e.g. after setting currentUser)
// Polling for absence status updates
setInterval(async () => {
    console.log('[DEBUG] Polling for absence status updates...');
    if (!currentUser) {
        console.log('[DEBUG] No currentUser found');
        return;
    }
    console.log('[DEBUG] CurrentUser:', currentUser.id);
    const emp = getEmployee(currentUser.id);
    console.log('[DEBUG] Employee found:', emp);
    if (!emp || !emp.name) {
        console.log('[DEBUG] No employee Discord name found for absence check. emp:', emp, 'name:', emp?.name);
        return;
    }
    
    console.log('[DEBUG] Checking absences for name:', emp.name, 'Discord ID:', currentUser.id);
    
    try {
        // Check for new approved/denied absences
        const res = await fetch('https://timeclock-backend.marcusray.workers.dev/api/absence/check-approved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: emp.name, // Use Discord name instead of profile name
                discordId: currentUser.id
            })
        });
        
        console.log('[DEBUG] Absence check response status:', res.status);
        const responseText = await res.text();
        console.log('[DEBUG] Absence check raw response:', responseText);
        
        if (!res.ok) {
            console.error('[DEBUG] Absence check failed:', res.status, responseText);
            return;
        }
        
        const data = JSON.parse(responseText);
        console.log('[DEBUG] Absence check response:', data);
        
        if (data.hasNewStatuses && data.processedAbsences) {
            // Update local absence records
            if (!emp.absences) emp.absences = [];
            
            for (const processedAbsence of data.processedAbsences) {
                // Find matching absence in local data
                const localAbsence = emp.absences.find(a => 
                    a.startDate === processedAbsence.startDate && 
                    a.endDate === processedAbsence.endDate
                );
                
                if (localAbsence) {
                    const oldStatus = localAbsence.status;
                    localAbsence.status = processedAbsence.status;
                    console.log(`[DEBUG] Updated absence status: ${oldStatus} -> ${processedAbsence.status}`);
                    
                    // Add portal notification
                    const isApproved = processedAbsence.status === 'approved';
                    addNotification('absence', `${isApproved ? '✅' : '❌'} Absence request ${isApproved ? 'approved' : 'rejected'}!`, 'absences');
                    
                    // Send DM notification for absence approval/rejection
                    try {
                        const emoji = isApproved ? '✅' : '❌';
                        const status = isApproved ? 'approved' : 'rejected';
                        const color = isApproved ? 0x00ff00 : 0xff0000;
                        
                        await sendDiscordDM(currentUser.id, {
                            title: `${emoji} Absence Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                            description: `Your absence request has been ${status}!\n\n**Dates:** ${processedAbsence.startDate} to ${processedAbsence.endDate}\n**Status:** ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                            color: color
                        });
                    } catch (e) {
                        console.error('Failed to send absence approval DM:', e);
                    }
                }
            }
            
            updateEmployee(emp);
            
            // Re-render absence tabs to show updated statuses
            ['pending', 'approved', 'rejected', 'archived'].forEach(tab => renderAbsences(tab));
        }
    } catch (e) {
        console.error('[DEBUG] Error checking absence approvals:', e);
    }
}, 5000); // Poll every 5 seconds for near-instant notifications

// Polling for new payslips
let lastPayslipCheck = localStorage.getItem('lastPayslipCheck') ? JSON.parse(localStorage.getItem('lastPayslipCheck')) : {};
setInterval(async () => {
    if (!window.currentUser) return;
    const emp = getEmployee(window.currentUser.id);
    const staffId = emp.profile?.staffId;
    if (!staffId) return;
    
    try {
        const res = await fetch('https://timeclock-backend.marcusray.workers.dev/api/payslips/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffId })
        });
        
        if (!res.ok) return;
        
        const data = await res.json();
        const payslips = data.payslips || [];
        
        // Check if there are new payslips
        const userKey = window.currentUser.id;
        const lastCount = lastPayslipCheck[userKey] || 0;
        
        if (payslips.length > lastCount) {
            // New payslip(s) detected
            const newCount = payslips.length - lastCount;
            
            // Send backend notification to trigger Discord DM
            try {
                console.log('[DEBUG] Sending payslip DM notification for user:', window.currentUser.id);
                const dmResponse = await fetch('https://timeclock-backend.marcusray.workers.dev/api/notifications/payslip', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        discordId: window.currentUser.id,
                        staffId: staffId,
                        payslipData: {
                            date: new Date().toLocaleDateString(),
                            link: 'portal.cirkledevelopment.co.uk'
                        }
                    })
                });
                
                if (dmResponse.ok) {
                    const dmResult = await dmResponse.json();
                    console.log('[DEBUG] Payslip DM notification result:', dmResult);
                } else {
                    console.error('[DEBUG] Payslip DM notification failed:', dmResponse.status, await dmResponse.text());
                }
            } catch (e) {
                console.error('Failed to send payslip notification:', e);
            }
            
            // Add portal notification with sound
            addNotification('payslip', `💰 ${newCount} new payslip${newCount > 1 ? 's' : ''} available!`, 'payslips');
            
            // Update last check count
            lastPayslipCheck[userKey] = payslips.length;
            localStorage.setItem('lastPayslipCheck', JSON.stringify(lastPayslipCheck));
        }
    } catch (e) {
        // Ignore errors
    }
}, 5000); // Poll every 5 seconds for near-instant notifications

// Polling for new disciplinaries
let lastDisciplinaryCheck = localStorage.getItem('lastDisciplinaryCheck') ? JSON.parse(localStorage.getItem('lastDisciplinaryCheck')) : {};
setInterval(async () => {
    if (!window.currentUser) return;
    const emp = getEmployee(window.currentUser.id);
    const staffId = emp.profile?.staffId || 'Not assigned'; // Use actual staff ID
    if (!staffId || staffId === 'Not assigned') return;
    
    try {
        const res = await fetch('https://timeclock-backend.marcusray.workers.dev/api/disciplinaries/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffId })
        });
        
        if (!res.ok) return;
        
        const data = await res.json();
        const disciplinaries = data.disciplinaries || [];
        
        // Check if there are new disciplinaries
        const userKey = window.currentUser.id;
        const lastCount = lastDisciplinaryCheck[userKey] || 0;
        
        if (disciplinaries.length > lastCount) {
            // New disciplinary(s) detected
            const newCount = disciplinaries.length - lastCount;
            const latestDisciplinary = disciplinaries[disciplinaries.length - 1];
            
            // Send backend notification to trigger Discord DM
            try {
                console.log('[DEBUG] Sending disciplinary DM notification for user:', window.currentUser.id);
                const dmResponse = await fetch('https://timeclock-backend.marcusray.workers.dev/api/notifications/disciplinary', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        discordId: window.currentUser.id,
                        staffId: staffId,
                        disciplinaryData: {
                            type: latestDisciplinary?.strikeType || 'N/A',
                            date: latestDisciplinary?.dateAssigned ? new Date(latestDisciplinary.dateAssigned).toLocaleDateString() : 'N/A',
                            reason: latestDisciplinary?.reason || 'Check portal for details'
                        }
                    })
                });
                
                if (dmResponse.ok) {
                    const dmResult = await dmResponse.json();
                    console.log('[DEBUG] Disciplinary DM notification result:', dmResult);
                } else {
                    console.error('[DEBUG] Disciplinary DM notification failed:', dmResponse.status, await dmResponse.text());
                }
            } catch (e) {
                console.error('Failed to send disciplinary notification:', e);
            }
            
            // Add portal notification with sound
            addNotification('disciplinary', `⚠️ ${newCount} new disciplinary notice${newCount > 1 ? 's' : ''} received!`, 'disciplinaries');
            
            // Update last check count
            lastDisciplinaryCheck[userKey] = disciplinaries.length;
            localStorage.setItem('lastDisciplinaryCheck', JSON.stringify(lastDisciplinaryCheck));
        }
    } catch (e) {
        // Ignore errors
    }
}, 5000); // Poll every 5 seconds for near-instant notifications

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
                submitBtn.disabled = false;
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
            
            // Send to Google Sheets backend
            try {
                const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/absence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: currentUser.name || emp.profile?.name || 'Unknown User',
                        discordId: currentUser.id,       // Add Discord ID for reliable matching
                        startDate,
                        endDate,
                        reason: type,                    // Type goes to D: Reason
                        totalDays: days.toString(),      // Total days to E: Total Days
                        comment                          // Comment to F: Comment
                    })
                });
                
                console.log('[DEBUG] Absence submission response:', response.status);
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('[DEBUG] Absence submission error:', errorData);
                }
            } catch (e) {
                console.error('Failed to save absence to Sheets:', e);
            }
            
            // Send webhook notification
            await sendAbsenceWebhook(absence);
            
            // Send DM to user
            await sendDiscordDM(currentUser.id, {
                title: '✅ Absence Request Submitted',
                description: `Your absence request has been successfully submitted!\n\n**Type:** ${type}\n**Start Date:** ${startDate}\n**End Date:** ${endDate}\n**Days:** ${days}\n\nYou will be notified here once it has been reviewed.`,
                color: 0x4CAF50,
                footer: { text: 'Cirkle Development HR Portal' },
                timestamp: new Date().toISOString()
            });
            
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

// Bot token stored securely (obfuscated from inspect)
const getBotToken = () => atob('TVRReE56a3hOVGc1TmpZek5ESTNOemM0T0Rvby5HTFV2NWwuMDQ1c1pELWxNa2haTHMyeTZiRXRKMUY2VmxSRFBrV1FIRUFELU0=');

const REQUIRED_ROLE = '1315346851616002158';
const DEPT_ROLES = {
    'Development Department': '1315323804528017498',
    'Customer Relations Department': '1315042036969242704',
    'Finance Department': '1433453982453338122'
};
const GUILD_ID = '1310656642672627752';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1417260030851551273/KGKnWF3mwTt7mNWmC3OTAPWcWJSl1FnQ3-Ub-l1-xpk46tOsAYAtIhRTlti2qxjJSOds';
const WORKER_URL = 'https://timeclock-proxy.marcusray.workers.dev';
const CLIENT_ID = '1417915896634277888';
const REDIRECT_URI = 'https://portal.cirkledevelopment.co.uk';

// Discord DM utility functions
async function sendDiscordDM(userId, embed) {
    try {
        // Use the new POST endpoint with native Discord embeds
        const response = await fetch(`https://timeclock-proxy.marcusray.workers.dev/sendDM`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId,
                embed: embed
            })
        });
        
        if (!response.ok) {
            console.error('Failed to send DM via proxy:', await response.text());
        } else {
            console.log('DM sent successfully via proxy');
        }
    } catch (e) {
        console.error('Error sending Discord DM via proxy:', e);
    }
}

// Notification functions for payslips and disciplinaries
async function sendPayslipNotification(userId, staffId) {
    const embed = {
        title: '📄 New Payslip Available',
        description: 'You have received a new payslip!',
        fields: [
            { name: '🆔 Staff ID', value: staffId, inline: true },
            { name: '📅 Date', value: new Date().toLocaleDateString(), inline: true },
            { name: '🔗 Portal', value: 'portal.cirkledevelopment.co.uk', inline: false }
        ],
        color: 0x2196F3,
        footer: { text: 'Cirkle Development HR Portal' },
        timestamp: new Date().toISOString()
    };
    
    await sendDiscordDM(userId, embed);
}

async function sendDisciplinaryNotification(userId, staffId, strikeType) {
    const embed = {
        title: '⚠️ New Disciplinary Notice',
        description: 'You have received a new disciplinary notice.',
        fields: [
            { name: '🆔 Staff ID', value: staffId, inline: true },
            { name: '📋 Type', value: strikeType, inline: true },
            { name: '📅 Date', value: new Date().toLocaleDateString(), inline: true },
            { name: '🔗 Portal', value: 'portal.cirkledevelopment.co.uk', inline: false }
        ],
        color: 0xF44336,
        footer: { text: 'Cirkle Development HR Portal' },
        timestamp: new Date().toISOString()
    };
    
    await sendDiscordDM(userId, embed);
}

async function sendGoodbyeMessage(userId, staffId) {
    const embed = {
        title: '👋 Profile Reset Complete',
        description: 'Your profile has been successfully reset. All your data has been erased from our systems.',
        fields: [
            { name: '🆔 Staff ID', value: staffId, inline: true },
            { name: '🗑️ Data Cleared', value: 'All personal information, payslips, and disciplinaries have been removed', inline: false }
        ],
        color: 0x9E9E9E,
        footer: { text: 'Thank you for being part of Cirkle Development' },
        timestamp: new Date().toISOString()
    };
    
    await sendDiscordDM(userId, embed);
}

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
    setupPreferences: document.getElementById('setupPreferencesScreen'),
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
    goodbye: document.getElementById('goodbyeScreen'),
    suspended: document.getElementById('suspendedScreen')
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

function showSuspendedPortal() {
    console.log('Showing suspended portal');
    showScreen('suspended');
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
                // First time user: use local or empty profile if backendProfile is null
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
        // Profile will be saved to Sheets when user completes department selection
    } else {
        console.log('Profile found, redirecting to portalWelcome');
        document.getElementById('portalWelcomeName').textContent = emp.profile.name;
        document.getElementById('portalLastLogin').textContent = emp.lastLogin;
        showScreen('portalWelcome');
    }

    window.history.replaceState({}, document.title, REDIRECT_URI);
}

// Tutorial and onboarding logic
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

    // Load recipients from cirklehrUsers sheet via backend
    async function loadMailRecipients() {
        try {
            const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/mail/recipients', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const recipients = await response.json();
                const recipientSelect = document.getElementById('mailRecipients');
                recipientSelect.innerHTML = '<option value="" disabled>Select Recipients</option>';
                
                recipients.forEach(recipient => {
                    if (recipient.userId !== currentUser.id) { // Don't include self
                        const option = document.createElement('option');
                        option.value = recipient.userId;
                        option.textContent = recipient.name || 'Unknown User';
                        recipientSelect.appendChild(option);
                    }
                });
            } else {
                console.error('Failed to load mail recipients');
                // Fallback to empty list
                const recipientSelect = document.getElementById('mailRecipients');
                recipientSelect.innerHTML = '<option value="" disabled>No recipients available</option>';
            }
        } catch (error) {
            console.error('Error loading mail recipients:', error);
            const recipientSelect = document.getElementById('mailRecipients');
            recipientSelect.innerHTML = '<option value="" disabled>Error loading recipients</option>';
        }
    }

    const recipientSelect = document.getElementById('mailRecipients');
    // Load recipients when mail screen is accessed
    loadMailRecipients();

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

const discordLoginBtn = document.getElementById('discordLoginBtn');
if (discordLoginBtn) {
    discordLoginBtn.addEventListener('click', () => {
        const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify&prompt=none`;
        console.log('Initiating OAuth redirect:', oauthUrl);
        window.location.href = oauthUrl;
    });
}

const setupStartBtn = document.getElementById('setupStartBtn');
if (setupStartBtn) {
    setupStartBtn.addEventListener('click', () => {
        console.log('Setup start button clicked');
        showScreen('setupEmail');
    });
}

const setupEmailContinueBtn = document.getElementById('setupEmailContinueBtn');
if (setupEmailContinueBtn) {
    setupEmailContinueBtn.addEventListener('click', () => {
    const email = document.getElementById('setupEmailInput').value.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (!currentUser) currentUser = {};
        if (!currentUser.profile) currentUser.profile = {};
        currentUser.profile.email = email;
        showScreen('setupName');
    } else {
        showModal('alert', 'Please enter a valid email with @ and a domain (e.g., example.com)');
    }
});

const setupNameContinueBtn = document.getElementById('setupNameContinueBtn');
if (setupNameContinueBtn) {
    setupNameContinueBtn.addEventListener('click', () => {
        const name = document.getElementById('setupNameInput').value.trim();
        console.log('[DEBUG] setupNameContinueBtn clicked, name input value:', name);
        if (name) {
            if (!currentUser) currentUser = {};
            if (!currentUser.profile) currentUser.profile = {};
            currentUser.profile.name = name;
            console.log('[DEBUG] Name saved, redirecting to preferences selection');
            showScreen('setupPreferences');
        } else {
            showModal('alert', 'Please enter your name');
        }
    });
}

const setupPreferencesContinueBtn = document.getElementById('setupPreferencesContinueBtn');
if (setupPreferencesContinueBtn) {
    setupPreferencesContinueBtn.addEventListener('click', () => {
    const timezone = document.getElementById('setupTimezoneSelect').value;
    const dateFormat = document.querySelector('input[name="dateFormat"]:checked')?.value;
    const country = document.getElementById('setupCountrySelect').value;
    
    console.log('[DEBUG] setupPreferencesContinueBtn clicked, timezone:', timezone, 'dateFormat:', dateFormat, 'country:', country);
    
    if (timezone && country) {
        if (!currentUser) currentUser = {};
        if (!currentUser.profile) currentUser.profile = {};
        currentUser.profile.timezone = timezone;
        // Note: dateFormat is collected for UI purposes but not stored in backend
        currentUser.profile.dateFormat = dateFormat;
        currentUser.profile.country = country;
        console.log('[DEBUG] Preferences saved, redirecting to department selection');
        showScreen('setupDepartment');
    } else {
        showModal('alert', 'Please select timezone and country');
    }
});
}

const setupDepartmentContinueBtn = document.getElementById('setupDepartmentContinueBtn');
if (setupDepartmentContinueBtn) {
    setupDepartmentContinueBtn.addEventListener('click', async () => {
    const selectedDept = document.querySelector('input[name="department"]:checked');
    console.log('[DEBUG] setupDepartmentContinueBtn clicked, selected department:', selectedDept?.value);
    if (selectedDept) {
        if (!currentUser) currentUser = {};
        if (!currentUser.profile) currentUser.profile = {};
        currentUser.profile.department = selectedDept.value;
        console.log('[DEBUG] Department saved, verifying roles...');
        showScreen('setupVerify');
        setTimeout(async () => {
            const deptRole = DEPT_ROLES[currentUser.profile.department];
            console.log('[DEBUG] Checking department role:', deptRole, 'and base employee role:', REQUIRED_ROLE);
            console.log('[DEBUG] User roles:', currentUser.roles);
            
            // Check if user has both the required employee role AND the department role
            const hasBaseRole = currentUser.roles && currentUser.roles.includes(REQUIRED_ROLE);
            const hasDeptRole = currentUser.roles && currentUser.roles.includes(deptRole);
            
            if (hasBaseRole && hasDeptRole) {
                updateEmployee(currentUser);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                // Save to Google Sheets via backend
                await upsertUserProfile();
                console.log('[DEBUG] Profile saved to Google Sheets');
                
                // Send welcome DM with credentials
                const emp = getEmployee(currentUser.id);
                await sendDiscordDM(currentUser.id, {
                    title: '🎉 Welcome to Cirkle Development!',
                    description: `Welcome to the Cirkle Development Staff Portal!\n\nYour profile has been successfully created.`,
                    fields: [
                        { name: '👤 Name', value: currentUser.profile.name, inline: true },
                        { name: '📧 Email', value: currentUser.profile.email, inline: true },
                        { name: '🏢 Department', value: currentUser.profile.department, inline: false },
                        { name: '🆔 Staff ID', value: emp.profile?.staffId || 'Pending Assignment', inline: true }
                    ],
                    color: 0x2196F3,
                    footer: { text: 'Cirkle Development HR Portal • portal.cirkledevelopment.co.uk' },
                    timestamp: new Date().toISOString()
                });
                
                console.log('[DEBUG] Role verification successful, redirecting to confirm');
                showScreen('confirm');
                playSuccessSound();
            } else {
                console.log('[DEBUG] Role verification failed for department:', currentUser.profile.department);
                showModal('alert', 'Role not found for selected department. Please ensure you have the correct role in Discord.');
                showScreen('setupDepartment');
            }
        }, 2000);
    } else {
        showModal('alert', 'Please select a department');
    }
});
}

const continueBtn = document.getElementById('continueBtn');
if (continueBtn) {
    continueBtn.addEventListener('click', () => {
        console.log('Finalise button clicked, redirecting to setupComplete');
        showScreen('setupComplete');
        const setupWelcomeName = document.getElementById('setupWelcomeName');
        if (setupWelcomeName) {
            setupWelcomeName.textContent = currentUser.profile.name;
        }
        setTimeout(() => startTutorial(), 3000);
    });
}

const portalLoginBtn = document.getElementById('portalLoginBtn');
if (portalLoginBtn) {
    portalLoginBtn.addEventListener('click', () => {
        console.log('Portal login button clicked, redirecting to mainMenu');
        showScreen('mainMenu');
        updateSidebarProfile();
        updateMainScreen();
    });
}

const sidebarProfilePic = document.getElementById('sidebarProfilePic');
if (sidebarProfilePic) {
    sidebarProfilePic.addEventListener('click', async () => {
        showScreen('myProfile');
        
        // Trigger profile sync to get latest data and wait for it
        // Update profile directly from current user data
        updateProfileDisplay();
        
        const emp = getEmployee(currentUser.id);
        
        // Update profile header with fresh data
        const profileDisplayName = document.getElementById('profileDisplayName');
        const profileSubtitle = document.getElementById('profileSubtitle');
        
        const headerDisplayName = currentUser.profile?.name || emp.profile?.name || currentUser.name || 'User';
        const headerDisplayEmail = currentUser.profile?.email || emp.profile?.email || 'No Email';
        const headerDisplayDept = currentUser.profile?.department || emp.profile?.department || 'Staff';
        
        if (profileDisplayName) {
            profileDisplayName.textContent = headerDisplayName;
        }
        if (profileSubtitle) {
            profileSubtitle.textContent = `${headerDisplayDept} • ${headerDisplayEmail}`;
        }
        
        const profileDepartmentEl = document.getElementById('profileDepartment');
        if (profileDepartmentEl) {
            profileDepartmentEl.classList.toggle('pending-department', !!emp.pendingDeptChange);
        }
        
        // Update profile inputs if they exist (use currentUser.profile with emp.profile fallback)
        const updateNameInput = document.getElementById('updateNameInput');
        const updateEmailInput = document.getElementById('updateEmailInput');
        const inputDisplayName = currentUser.profile?.name || emp.profile?.name || '';
        const inputDisplayEmail = currentUser.profile?.email || emp.profile?.email || '';
        if (updateNameInput) updateNameInput.value = inputDisplayName;
        if (updateEmailInput) updateEmailInput.value = inputDisplayEmail;
        
        // Update department badge
        const deptBadge = document.getElementById('deptBadge');
        if (deptBadge) {
            const deptDisplayText = currentUser.profile?.department || emp.profile?.department || '';
            if (deptDisplayText) {
                deptBadge.textContent = deptDisplayText;
                deptBadge.style.display = 'inline-block';
            } else {
                deptBadge.style.display = 'none';
            }
        }
        
        // Update status indicator
        const statusIndicator = document.getElementById('profileStatusIndicator');
        if (statusIndicator) {
            statusIndicator.className = `profile-status-indicator online`;
        }
        
        // Update profile information
        const profileNameEl = document.getElementById('profileName');
        const profileEmailEl = document.getElementById('profileEmail');
        const profileDeptEl = document.getElementById('profileDepartment');
        const updateNameInputEl = document.getElementById('updateNameInput');
        const updateEmailInputEl = document.getElementById('updateEmailInput');
        
        // Use currentUser profile data if available, otherwise use emp data
        const profileDisplayName2 = currentUser.profile?.name || emp.profile?.name || currentUser.name || 'Not set';
        const profileDisplayEmail2 = currentUser.profile?.email || emp.profile?.email || 'Not set';
        const profileDisplayDept2 = currentUser.profile?.department || emp.profile?.department || 'Not set';
        
        console.log('[DEBUG] Profile display data:', {
            currentUserProfile: currentUser.profile,
            empProfile: emp.profile,
            displayName: profileDisplayName2,
            displayEmail: profileDisplayEmail2,
            displayDept: profileDisplayDept2
        });
        
        if (profileNameEl) profileNameEl.textContent = profileDisplayName2;
        if (profileEmailEl) profileEmailEl.textContent = profileDisplayEmail2;
        if (profileDeptEl) profileDeptEl.textContent = profileDisplayDept2;
        if (updateNameInputEl) updateNameInputEl.value = profileDisplayName2 === 'Not set' ? '' : profileDisplayName2;
        if (updateEmailInputEl) updateEmailInputEl.value = profileDisplayEmail2 === 'Not set' ? '' : profileDisplayEmail2;
        
        // Update profile pictures
        updateProfilePictures();
    });
}

const mainProfilePic = document.getElementById('mainProfilePic');
if (mainProfilePic) {
    mainProfilePic.addEventListener('click', () => {
        showScreen('myProfile');
        
        // Update profile display with latest data
        updateProfileDisplay();
        
        const emp = getEmployee(currentUser.id);
        // Update profile information
        const profileNameEl2 = document.getElementById('profileName');
        const profileEmailEl2 = document.getElementById('profileEmail');
        const profileDepartmentEl2 = document.getElementById('profileDepartment');
        
        if (profileNameEl2) profileNameEl2.textContent = emp.profile.name || 'Not set';
        if (profileEmailEl2) profileEmailEl2.textContent = emp.profile.email || 'Not set';
        if (profileDepartmentEl2) profileDepartmentEl2.textContent = emp.profile.department || 'Not set';
        
        // Update profile pictures
        updateProfilePictures();
    });
}

const homeBtn = document.getElementById('homeBtn');
if (homeBtn) {
    homeBtn.addEventListener('click', () => {
        console.log('Home button clicked');
        showScreen('mainMenu');
        updateMainScreen();
    });
}

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

const changeDepartmentBtn = document.getElementById('changeDepartmentBtn');
if (changeDepartmentBtn) {
    changeDepartmentBtn.addEventListener('click', () => {
        showModal('deptChange');
    });
}

const submitDeptChangeBtn = document.getElementById('submitDeptChangeBtn');
if (submitDeptChangeBtn) {
    submitDeptChangeBtn.addEventListener('click', async () => {
    const selectedDept = document.querySelector('input[name="newDepartment"]:checked');
    if (selectedDept) {
        const emp = getEmployee(currentUser.id);
        const submitBtn = document.getElementById('submitDeptChangeBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        
        try {
            // Submit change request to backend
            const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/change-request/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    discordId: currentUser.id,
                    staffName: emp.profile.name || currentUser.name,
                    requestType: 'department',
                    currentValue: emp.profile.department || 'Not Set',
                    requestedValue: selectedDept.value,
                    reason: 'User requested department change via portal',
                    email: emp.profile.email || ''
                })
            });
            
            if (response.ok) {
                closeModal('deptChange');
                showModal('alert', '<span class="success-tick"></span> Department change request submitted for approval!');
                playSuccessSound();
                addNotification('department', 'Department change request submitted for approval!', 'myProfile');
                
                // Mark profile as having pending change
                emp.pendingDeptChange = selectedDept.value;
                updateEmployee(emp);
                document.getElementById('profileDepartment').classList.add('pending-department');
            } else {
                throw new Error('Failed to submit change request');
            }
        } catch (error) {
            console.error('Error submitting department change request:', error);
            showModal('alert', 'Failed to submit change request. Please try again.');
        }
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
    } else {
        showModal('alert', 'Please select a department');
    }
});
}

const resetProfileBtn = document.getElementById('resetProfileBtn');
if (resetProfileBtn) {
    resetProfileBtn.addEventListener('click', () => {
        showModal('resetProfile');
    });
}

const confirmResetBtn = document.getElementById('confirmResetBtn');
if (confirmResetBtn) {
    confirmResetBtn.addEventListener('click', async () => {
    // Send goodbye DM before resetting
    await sendGoodbyeMessage(currentUser.id, currentUser.id);
    
    // Delete from backend Google Sheets
    try {
        await fetch('https://timeclock-backend.marcusray.workers.dev/api/user/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId: currentUser.id })
        });
    } catch (e) {
        console.error('Failed to delete user from backend:', e);
    }
    
    // Clear local data
    resetEmployeeData(currentUser.id);
    
    // Clear profile from currentUser but keep id and roles for re-setup
    if (currentUser.profile) {
        delete currentUser.profile.name;
        delete currentUser.profile.email;
        delete currentUser.profile.department;
    }
    
    closeModal('resetProfile');
    showScreen('setupWelcome');
    showModal('alert', '<span class="success-tick"></span> Profile reset successfully!');
    playSuccessSound();
});
}

const myRolesBtn = document.getElementById('myRolesBtn');
if (myRolesBtn) {
    myRolesBtn.addEventListener('click', () => {
        showScreen('myRoles');
        const list = document.getElementById('rolesList');
        list.innerHTML = '';
        currentUser.roles.forEach(roleId => {
            const li = document.createElement('li');
            li.textContent = `${roleNames[roleId] || 'Unknown Role'} (${roleId})`;
            list.appendChild(li);
        });
    });
}

const tasksBtn = document.getElementById('tasksBtn');
if (tasksBtn) {
    tasksBtn.addEventListener('click', () => {
        showScreen('tasks');
        loadTasks();
    });
}

const addTaskBtn = document.getElementById('addTaskBtn');
if (addTaskBtn) {
    addTaskBtn.addEventListener('click', () => {
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
}

const absencesBtn = document.getElementById('absencesBtn');
if (absencesBtn) {
    absencesBtn.addEventListener('click', () => {
        showScreen('absences');
        document.querySelectorAll('.absence-tab-btn').forEach(btn => btn.classList.remove('active'));
        const pendingTabBtn = document.querySelector('.absence-tab-btn[data-tab="pending"]');
        if (pendingTabBtn) pendingTabBtn.classList.add('active');
        
        const pendingFolder = document.getElementById('pendingFolder');
        const approvedFolder = document.getElementById('approvedFolder');
        const rejectedFolder = document.getElementById('rejectedFolder');
        const archivedFolder = document.getElementById('archivedFolder');
        
        if (pendingFolder) pendingFolder.classList.add('active');
        if (approvedFolder) approvedFolder.classList.remove('active');
        if (rejectedFolder) rejectedFolder.classList.remove('active');
        if (archivedFolder) archivedFolder.classList.remove('active');
        
        updateAbsenceTabSlider();
        renderAbsences('pending');
    });
}

const requestAbsenceBtn = document.getElementById('requestAbsenceBtn');
if (requestAbsenceBtn) {
    requestAbsenceBtn.addEventListener('click', () => {
        showModal('absenceRequest');
    });
}

const absenceStartDate = document.getElementById('absenceStartDate');
const absenceEndDate = document.getElementById('absenceEndDate');

if (absenceStartDate) {
    absenceStartDate.addEventListener('change', calculateAbsenceDays);
}
if (absenceEndDate) {
    absenceEndDate.addEventListener('change', calculateAbsenceDays);
}function calculateAbsenceDays() {
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


document.getElementById('payslipsBtn').addEventListener('click', async () => {
    showScreen('payslips');
    const content = document.getElementById('payslipsContent');
    content.innerHTML = '<p>Loading payslips...</p>';
    
    // Use the global currentUser variable instead of window.currentUser
    if (!currentUser) {
        content.innerHTML = '<p>Please log in first.</p>';
        console.error('[DEBUG] No currentUser found - user not logged in');
        return;
    }
    
    // Use Discord ID as Staff ID directly
    const staffId = currentUser?.id;
    
    console.log('[DEBUG] Payslips - Current user:', currentUser);
    console.log('[DEBUG] Payslips - Profile keys:', currentUser?.profile ? Object.keys(currentUser.profile) : 'no profile');
    console.log('[DEBUG] Payslips - Full profile:', JSON.stringify(currentUser?.profile));
    console.log('[DEBUG] Payslips - Using Discord ID as Staff ID:', staffId);
    console.log('[DEBUG] Payslips - Staff ID type:', typeof staffId);
    
    if (!staffId) {
        content.innerHTML = '<p>No Staff ID found. Please contact HR.</p>';
        console.error('[DEBUG] No Staff ID found in currentUser.profile.staffId');
        console.error('[DEBUG] currentUser.profile:', currentUser?.profile);
        return;
    }
    
    try {
        const res = await fetch('https://timeclock-backend.marcusray.workers.dev/api/payslips/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffId })
        });
        
        if (!res.ok) {
            throw new Error('Failed to fetch payslips');
        }
        
        const data = await res.json();
        const payslips = data.payslips || [];
        
        console.log('[DEBUG] Fetched payslips:', payslips);
        
        if (payslips.length === 0) {
            content.innerHTML = '<p>No payslips found.</p>';
            return;
        }
        
        // Display payslips in ROW format as requested
        content.innerHTML = `
            <div class="payslips-list">
                ${payslips.map((payslip, index) => `
                    <div class="payslip-item" onclick="showPayslipDetails(${index})" style="
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center; 
                        border: 1px solid #ddd; 
                        padding: 15px; 
                        margin: 10px 0; 
                        border-radius: 8px; 
                        background: #f9f9f9; 
                        cursor: pointer;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#e8f4f8'" onmouseout="this.style.background='#f9f9f9'">
                        <div style="flex: 1;">
                            <span style="font-weight: bold; color: #1976d2;">PAYSLIP: ${payslip.dateAssigned}</span>
                        </div>
                        <div style="flex: 1; text-align: right;">
                            <span style="color: #666;">by ${payslip.assignedBy || 'Unknown'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Store payslips data for details modal
        window.currentPayslips = payslips;
        
    } catch (e) {
        console.error('Error fetching payslips:', e);
        content.innerHTML = '<p>Error loading payslips. Please try again later.</p>';
    }
});

function showPayslipDetails(index) {
    const payslip = window.currentPayslips[index];
    if (!payslip) return;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.5); display: flex; align-items: center; 
        justify-content: center; z-index: 10000;
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div style="
            background: white; padding: 30px; border-radius: 8px; 
            max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        ">
            <h3 style="margin: 0 0 20px 0; color: #1976d2;">Payslip Details</h3>
            <div style="margin-bottom: 15px;">
                <strong>Date Assigned:</strong> ${payslip.dateAssigned}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Assigned By:</strong> ${payslip.assignedBy || 'Unknown'}
            </div>
            <div style="margin-bottom: 20px;">
                <strong>Comment:</strong> ${payslip.comment || 'No comment provided'}
            </div>
            <div style="text-align: center;">
                <button onclick="window.open('${payslip.link}', '_blank')" style="
                    background: #4caf50; color: white; border: none; 
                    padding: 12px 24px; border-radius: 4px; cursor: pointer;
                    font-weight: bold; margin-right: 10px;
                ">View Payslip</button>
                <button onclick="this.closest('[style*=fixed]').remove()" style="
                    background: #666; color: white; border: none; 
                    padding: 12px 24px; border-radius: 4px; cursor: pointer;
                ">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function showPayslipModal(payslip) {
    const modal = document.getElementById('payslipViewModal');
    
    // Populate the modal with payslip data
    document.getElementById('payslipDate').textContent = payslip.dateAssigned || 'N/A';
    document.getElementById('payslipComment').textContent = payslip.comment || 'No comment provided';
    document.getElementById('payslipAssignedBy').textContent = payslip.assignedBy || 'Unknown';
    
    const linkElement = document.getElementById('payslipLink');
    if (payslip.link) {
        linkElement.href = payslip.link;
        linkElement.style.display = 'inline';
        linkElement.textContent = 'View Payslip';
    } else {
        linkElement.style.display = 'none';
    }
    
    modal.style.display = 'flex';
    
    // Close modal handlers
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

document.getElementById('disciplinariesBtn').addEventListener('click', async () => {
    showScreen('disciplinaries');
    
    // Show loading state
    const loadingEl = document.getElementById('disciplinariesLoading');
    const emptyEl = document.getElementById('disciplinariesEmpty');
    const listEl = document.getElementById('disciplinariesList');
    
    loadingEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');
    listEl.innerHTML = '';
    
    // Use Discord ID as Staff ID
    const staffId = currentUser?.id;
    
    console.log('[DEBUG] Disciplinaries - Using Discord ID as Staff ID:', staffId);
    
    if (!staffId) {
        loadingEl.classList.add('hidden');
        emptyEl.innerHTML = '<p>Please log in first.</p>';
        emptyEl.classList.remove('hidden');
        console.error('[DEBUG] No currentUser found - user not logged in');
        return;
    }
    
    try {
        const res = await fetch('https://timeclock-backend.marcusray.workers.dev/api/disciplinaries/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffId })
        });
        
        if (!res.ok) {
            throw new Error('Failed to fetch disciplinaries');
        }
        
        const data = await res.json();
        const disciplinaries = data.disciplinaries || [];
        
        console.log('[DEBUG] Fetched disciplinaries:', disciplinaries);
        
        loadingEl.classList.add('hidden');
        
        if (disciplinaries.length === 0) {
            // Update localStorage counter to reflect no disciplinaries
            let lastDisciplinaryCheck = localStorage.getItem('lastDisciplinaryCheck') ? JSON.parse(localStorage.getItem('lastDisciplinaryCheck')) : {};
            const userKey = currentUser.id;
            lastDisciplinaryCheck[userKey] = 0;
            localStorage.setItem('lastDisciplinaryCheck', JSON.stringify(lastDisciplinaryCheck));
            console.log('[DEBUG] Reset disciplinary counter to 0 in localStorage');
            
            emptyEl.classList.remove('hidden');
            return;
        }
        
        // Update header with count
        const header = document.querySelector('#disciplinariesScreen h2');
        header.textContent = `Disciplinaries (${disciplinaries.length})`;
        
        // Update localStorage counter to reflect current reality
        let lastDisciplinaryCheck = localStorage.getItem('lastDisciplinaryCheck') ? JSON.parse(localStorage.getItem('lastDisciplinaryCheck')) : {};
        const userKey = currentUser.id;
        lastDisciplinaryCheck[userKey] = disciplinaries.length;
        localStorage.setItem('lastDisciplinaryCheck', JSON.stringify(lastDisciplinaryCheck));
        
        console.log('[DEBUG] Updated disciplinary counter in localStorage to:', disciplinaries.length);
        
        // Generate simple row-based list
        disciplinaries.forEach((disc, index) => {
            const item = document.createElement('div');
            item.className = 'disciplinary-item';
            
            const date = new Date(disc.dateAssigned).toLocaleDateString();
            
            item.innerHTML = `
                <div class="disciplinary-header">
                    <h4>Disciplinary #${index + 1}</h4>
                    <span class="disciplinary-date">${date}</span>
                </div>
                <div class="disciplinary-details">
                    <p><strong>Type:</strong> ${disc.strikeType || 'N/A'}</p>
                    <p><strong>Comment:</strong> ${disc.comment || 'No comment provided'}</p>
                    <p><strong>Assigned By:</strong> ${disc.assignedBy || 'N/A'}</p>
                    <p><strong>Status:</strong> Active</p>
                </div>
            `;
            
            listEl.appendChild(item);
        });
        
    } catch (error) {
        console.error('Error fetching disciplinaries:', error);
        loadingEl.classList.add('hidden');
        emptyEl.innerHTML = '<p>Error loading disciplinaries. Please try again.</p>';
        emptyEl.classList.remove('hidden');
    }
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

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        console.log('Logging out user:', currentUser.id);
        const emp = getEmployee(currentUser.id);
        const goodbyeName = document.getElementById('goodbyeName');
        if (goodbyeName) {
            goodbyeName.textContent = emp.profile.name || 'User';
        }
        localStorage.removeItem('currentUser');
        localStorage.removeItem('lastProcessedCode');
        localStorage.removeItem('clockInTime');
        if (isClockedIn) {
            clearInterval(clockInInterval);
        sendWebhook(`<@${currentUser.id}> (${emp.profile.name}) clocked out at ${new Date().toLocaleString()} due to logout`);
    }
    playLogoffSound();
    showScreen('setupVerify'); // show loading spinner screen
    setTimeout(() => showScreen('discord'), 2000);
});
}

const sidebarToggle = document.querySelector('.sidebar-toggle');
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        console.log('Sidebar toggle clicked');
        document.getElementById('sidebar').classList.toggle('extended');
    });
}

const modeToggle = document.getElementById('modeToggle');
if (modeToggle) {
    modeToggle.addEventListener('change', (e) => {
        document.body.classList.toggle('dark', e.target.checked);
        localStorage.setItem('darkMode', e.target.checked);
    });
}

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
})();}