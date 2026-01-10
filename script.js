// CRITICAL FIX v2.1 - Suspension check + Verification bypass + Mail recipients
// --- Profile Edit Buttons, Barcode, and Reset Countdown ---
// --- Global debug output for profile sync and auth ---
let profileDebug = null;
let authDebug = null;
function setProfileDebug(msg, isError) {
    if (!profileDebug) profileDebug = document.getElementById('profileDebug');
    const profileDebugPanel = document.getElementById('profileDebugPanel');
    
    if (isError && msg) {
        // Show error message
        if (profileDebug) {
            profileDebug.textContent = msg;
            profileDebug.style.color = '#b71c1c';
        }
        if (profileDebugPanel) {
            profileDebugPanel.style.display = 'block';
        }
        console.error('[PROFILE ERROR]', msg);
    } else if (!msg || msg === '') {
        // Clear/hide error message
        if (profileDebug) {
            profileDebug.textContent = '';
        }
        if (profileDebugPanel) {
            profileDebugPanel.style.display = 'none';
        }
    } else {
        // Non-error message - just log to console
        console.debug('[PROFILE]', msg);
    }
}
function setAuthDebug(msg, isError) {
    if (!authDebug) authDebug = document.getElementById('authDebug');
    // Only show visual debug for errors, not informational messages
    if (authDebug && isError) {
        authDebug.textContent = msg;
        authDebug.style.color = '#b71c1c';
    } else if (authDebug && !isError) {
        // Clear non-error messages from display
        authDebug.textContent = '';
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
    
    // Update country and timezone selects
    const profileCountrySelect = document.getElementById('profileCountrySelect');
    if (profileCountrySelect && currentUser.profile?.country) {
        profileCountrySelect.value = currentUser.profile.country;
    }
    
    const profileTimezoneSelect = document.getElementById('profileTimezoneSelect');
    if (profileTimezoneSelect && currentUser.profile?.timezone) {
        profileTimezoneSelect.value = currentUser.profile.timezone;
    }
    
    updateProfilePictures();
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered:', reg))
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}

// PWA Install Prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show custom install prompt after 3 seconds if not on standalone mode
    if (!window.matchMedia('(display-mode: standalone)').matches) {
        setTimeout(() => {
            const prompt = document.createElement('div');
            prompt.className = 'install-prompt';
            prompt.innerHTML = `
                <div>📱 Install Staff Portal as an app?</div>
                <button class="install-yes">Install</button>
                <button class="install-no">Not now</button>
            `;
            document.body.appendChild(prompt);
            
            prompt.querySelector('.install-yes').addEventListener('click', () => {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(() => {
                    prompt.remove();
                    deferredPrompt = null;
                });
            });
            
            prompt.querySelector('.install-no').addEventListener('click', () => {
                prompt.remove();
            });
        }, 3000);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded fired');
    
    // Setup disciplinaries/reports tabs
    setupDisciplinariesTabs();
    
    // If requests screen is active, reload the requests
    setTimeout(() => {
        if (document.getElementById('requestsScreen')?.classList.contains('active')) {
            console.log('[DEBUG] Requests screen active on load, reloading...');
            if (typeof reloadRequests === 'function') {
                reloadRequests();
            }
        }
    }, 500);

    async function syncAbsencesFromSheets() {
        if (!currentUser) {
            console.debug('[syncAbsencesFromSheets] No currentUser');
            return;
        }
        console.debug('[syncAbsencesFromSheets] Starting sync for user:', currentUser.id);
        
        try {
            const response = await fetch(`https://timeclock-backend.marcusray.workers.dev/api/user/absences/${currentUser.id}`);
            if (!response.ok) {
                console.error('[syncAbsencesFromSheets] Failed to fetch:', response.status);
                return;
            }
            
            const data = await response.json();
            console.debug('[syncAbsencesFromSheets] Fetched', data.absences?.length || 0, 'absences');
            
            if (data.absences && Array.isArray(data.absences)) {
                // Update the employee's absences in localStorage
                const emp = getEmployee(currentUser.id);
                if (emp) {
                    emp.absences = data.absences;
                    localStorage.setItem('employees', JSON.stringify(getEmployees()));
                    console.debug('[syncAbsencesFromSheets] Updated localStorage with', data.absences.length, 'absences');
                    
                    // Update dashboard if on absence tab
                    if (typeof updateAbsenceDashboard === 'function') {
                        updateAbsenceDashboard();
                    }
                    
                    // Re-render absence lists if visible
                    if (document.getElementById('absenceTab')?.classList.contains('active')) {
                        if (typeof renderAbsences === 'function') {
                            renderAbsences();
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[syncAbsencesFromSheets] Error:', err);
        }
    }

    async function syncProfileFromSheets() {
        if (!currentUser) {
            console.debug('[syncProfileFromSheets] No currentUser');
            return;
        }
        console.debug('[syncProfileFromSheets] Starting sync for user:', currentUser.id);
        console.debug('[syncProfileFromSheets] Current window.location:', window.location.href);
        console.debug('[syncProfileFromSheets] Backend URL:', BACKEND_URL);
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
            currentUser.profile.baseLevel = profile.baseLevel;
            console.log('[syncProfileFromSheets] Set baseLevel to:', profile.baseLevel);
            
            // Save to localStorage immediately
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            console.log('[syncProfileFromSheets] Saved to localStorage');
            
            // Update employee record
            const emp = getEmployee(currentUser.id);
            emp.profile = emp.profile || {};
            emp.profile.name = profile.name;
            emp.profile.email = profile.email;
            emp.profile.department = profile.department;
            emp.profile.staffId = profile.staffId;
            emp.profile.baseLevel = profile.baseLevel;
            updateEmployee(emp);
            
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
            
            // Initial sync
            syncProfileFromSheets().then(() => {
                updateProfileDisplay();
                updateMainScreen();
            });
            
            // Initial absence sync
            syncAbsencesFromSheets();
            
            // Periodic sync from backend (every 15 seconds)
            setInterval(async () => {
                await syncProfileFromSheets();
                updateProfileDisplay();
                updateMainScreen();
            }, 15000);
            
            // Periodic absence sync (every 20 seconds)
            setInterval(async () => {
                await syncAbsencesFromSheets();
            }, 20000);
            
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
    
    // Add retry button handler
    const retryProfileBtn = document.getElementById('retryProfileBtn');
    if (retryProfileBtn) {
        retryProfileBtn.addEventListener('click', async () => {
            console.log('[PROFILE] Manual retry requested');
            setProfileDebug('Retrying...', false);
            const profileDebugPanel = document.getElementById('profileDebugPanel');
            if (profileDebugPanel) profileDebugPanel.style.display = 'block';
            
            if (window.currentUser && window.currentUser.id) {
                await syncProfileFromSheets();
                updateProfileDisplay();
            } else {
                setProfileDebug('Not logged in. Please refresh and login again.', true);
            }
        });
    }
    
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
                    <option value="Finance Department">Finance</option>
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
        const profilePics = document.querySelectorAll('#profilePic, #sidebarProfilePic, #mainProfilePic, #portalWelcomeProfilePic');
        
        profilePics.forEach(pic => {
            if (window.currentUser) {
                // Priority: backend profile avatar > Discord avatar > initials
                const avatarUrl = window.currentUser.profile?.avatar || window.currentUser.avatar || null;
                
                if (avatarUrl) {
                    // Use backend or Discord avatar if available
                    pic.src = avatarUrl;
                    console.log('[PROFILE PIC] Setting avatar from backend/Discord:', avatarUrl);
                    
                    // Add error handler in case avatar fails to load
                    pic.onerror = () => {
                        console.warn('[PROFILE PIC] Failed to load avatar, using initials');
                        const name = window.currentUser.profile?.name || window.currentUser.name || window.currentUser.username || 'User';
                        pic.src = generateInitialsAvatar(name);
                        pic.onerror = null; // Remove error handler after fallback
                    };
                } else if (window.currentUser.profile && window.currentUser.profile.name) {
                    // Generate initials avatar if name is available
                    console.log('[PROFILE PIC] No avatar, using initials for:', window.currentUser.profile.name);
                    pic.src = generateInitialsAvatar(window.currentUser.profile.name);
                } else if (window.currentUser.name) {
                    // Fallback to currentUser.name
                    console.log('[PROFILE PIC] Using currentUser.name for initials:', window.currentUser.name);
                    pic.src = generateInitialsAvatar(window.currentUser.name);
                } else if (window.currentUser.username) {
                    // Fallback to username initials
                    console.log('[PROFILE PIC] Using username for initials:', window.currentUser.username);
                    pic.src = generateInitialsAvatar(window.currentUser.username);
                } else {
                    // Ultimate fallback
                    console.log('[PROFILE PIC] Using default User initials');
                    pic.src = generateInitialsAvatar('User');
                }
            } else {
                console.log('[PROFILE PIC] No currentUser available');
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
                    // Immediately close the modal
                    deptChangeModal.style.display = 'none';
                    if (deptSelect) deptSelect.value = '';
                    if (reasonTextarea) reasonTextarea.value = '';
                    
                    // Show success modal for 2 seconds
                    showModal('alert', '✅ Department change request submitted successfully! You will receive a notification when it\'s reviewed.');
                    setTimeout(() => {
                        closeModal('alert');
                    }, 2000);
                    
                    // Add notification to sidebar
                    addNotification('profile', 'Department change request submitted', 'myProfile');
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
                    // Mark profile as having pending name change
                    const emp = getEmployee(currentUser.id);
                    emp.pendingNameChange = newName;
                    updateEmployee(emp);
                    
                    // Immediately close the modal
                    nameChangeModal.style.display = 'none';
                    if (newNameInput) newNameInput.value = '';
                    if (reasonInput) reasonInput.value = '';
                    
                    // Show success modal for 2 seconds
                    showModal('alert', '✅ Name change request submitted successfully! You will receive a notification when it\'s reviewed.');
                    setTimeout(() => {
                        closeModal('alert');
                    }, 2000);
                    
                    // Add notification to sidebar
                    addNotification('profile', 'Name change request submitted', 'myProfile');
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
                    // Mark profile as having pending email change
                    const emp = getEmployee(currentUser.id);
                    emp.pendingEmailChange = newEmail;
                    updateEmployee(emp);
                    
                    // Immediately close the modal
                    emailChangeModal.style.display = 'none';
                    if (newEmailInput) newEmailInput.value = '';
                    if (reasonInput) reasonInput.value = '';
                    
                    // Show success modal for 2 seconds
                    showModal('alert', '✅ Email change request submitted successfully! You will receive a notification when it\'s reviewed.');
                    setTimeout(() => {
                        closeModal('alert');
                    }, 2000);
                    
                    // Add notification to sidebar
                    addNotification('profile', 'Email change request submitted', 'myProfile');
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
        console.log('[fetchUserProfile] Starting fetch for discordId:', discordId);
        console.log('[fetchUserProfile] Backend URL:', BACKEND_URL);
        console.log('[fetchUserProfile] Current origin:', window.location.origin);
        
        const url = `${BACKEND_URL}/api/user/profile?t=${Date.now()}`;
        console.log('[fetchUserProfile] Full URL:', url);
        
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId }),
            credentials: 'include'
        });
        
        console.log('[fetchUserProfile] Response status:', res.status);
        console.log('[fetchUserProfile] Response headers:', Object.fromEntries(res.headers.entries()));
        
        if (res.status === 404) {
            console.log('[fetchUserProfile] User not found (404) - User may need to be added to backend database');
            setProfileDebug('Profile not found in database. Contact admin if this persists.', true);
            return null;
        }
        if (!res.ok) {
            console.error('[fetchUserProfile] Failed with status:', res.status);
            const errorText = await res.text();
            console.error('[fetchUserProfile] Error response:', errorText);
            const errorMsg = `Failed to fetch profile: ${res.status} ${errorText}`;
            setProfileDebug(errorMsg, true);
            throw new Error(errorMsg);
        }
        const data = await res.json();
        console.log('[fetchUserProfile] Success! Data:', JSON.stringify(data));
        setProfileDebug('', false); // Clear any previous errors
        return data;
    } catch (e) {
        console.error('[fetchUserProfile] Exception caught:', e);
        console.error('[fetchUserProfile] Exception details:', {
            name: e.name,
            message: e.message,
            stack: e.stack
        });
        
        // Check if this might be a CORS error
        if (e.message.includes('Failed to fetch') || e.name === 'TypeError') {
            const corsMsg = 'Network error - possible CORS issue. Ensure you are accessing from: https://portal.cirkledevelopment.co.uk';
            console.error('[fetchUserProfile]', corsMsg);
            setProfileDebug(corsMsg, true);
        } else {
            setProfileDebug('Error loading profile: ' + e.message, true);
        }
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

// ===== EMPLOYEE REPORTS SYSTEM =====

// Fetch employee reports from backend
async function fetchEmployeeReports(userId) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/reports/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        if (!res.ok) throw new Error('Failed to fetch employee reports');
        const data = await res.json();
        return data.reports || [];
    } catch (e) {
        console.error('fetchEmployeeReports error:', e);
        return [];
    }
}

// Calculate staff points from reports
function calculateStaffPoints(reports) {
    let points = 0;
    reports.forEach(report => {
        const reportType = report.reportType?.toLowerCase();
        if (reportType === 'commendation') {
            points += 1;
        } else if (reportType === 'disruptive' || reportType === 'negative behaviour') {
            points -= 1;
        }
        // Monthly Report doesn't affect points
    });
    return points;
}

// Update staff points counter display
function updateStaffPointsCounter(points) {
    const counter = document.getElementById('staffPointsCounter');
    const needle = document.getElementById('staffPointsNeedle');
    
    if (counter) {
        counter.textContent = points;
        // Color code the points
        if (points > 0) {
            counter.style.color = '#4ade80'; // Green for positive
        } else if (points < 0) {
            counter.style.color = '#f87171'; // Red for negative
        } else {
            counter.style.color = 'white'; // White for zero
        }
    }
    
    // Animate speedometer needle
    if (needle) {
        // Map points (-10 to +10) to rotation (-90deg to +90deg)
        // Clamp points between -10 and 10
        const clampedPoints = Math.max(-10, Math.min(10, points));
        const rotation = (clampedPoints / 10) * 90; // -90 to +90 degrees
        needle.style.transform = `rotate(${rotation}deg)`;
        needle.style.transformOrigin = '60px 70px';
    }
}

// Render employee reports
function renderReports(reports) {
    const content = document.getElementById('reportsList');
    const loading = document.getElementById('reportsLoading');
    const empty = document.getElementById('reportsEmpty');
    
    if (loading) loading.style.display = 'none';
    
    if (!reports || reports.length === 0) {
        content.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        updateStaffPointsCounter(0);
        return;
    }
    
    if (empty) empty.classList.add('hidden');
    content.innerHTML = '';
    
    // Calculate and update staff points
    const staffPoints = calculateStaffPoints(reports);
    updateStaffPointsCounter(staffPoints);
    
    // Sort reports by timestamp (newest first)
    const sortedReports = [...reports].sort((a, b) => {
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    });
    
    sortedReports.forEach((report, index) => {
        const div = document.createElement('div');
        div.className = 'report-item';
        
        // Determine color based on report type
        let bgColor = '#f9f9f9';
        let borderColor = '#ddd';
        let iconColor = '#666';
        let icon = '📄';
        
        const reportType = report.reportType?.toLowerCase();
        if (reportType === 'commendation') {
            bgColor = '#f0fdf4';
            borderColor = '#86efac';
            iconColor = '#16a34a';
            icon = '⭐';
        } else if (reportType === 'disruptive') {
            bgColor = '#fef2f2';
            borderColor = '#fca5a5';
            iconColor = '#dc2626';
            icon = '⚠️';
        } else if (reportType === 'negative behaviour') {
            bgColor = '#fef2f2';
            borderColor = '#fca5a5';
            iconColor = '#b91c1c';
            icon = '❌';
        } else if (reportType === 'monthly report') {
            bgColor = '#eff6ff';
            borderColor = '#93c5fd';
            iconColor = '#2563eb';
            icon = '📊';
        }
        
        div.style.cssText = `
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            border: 2px solid ${borderColor}; 
            padding: 18px; 
            margin: 12px 0; 
            border-radius: 10px; 
            background: ${bgColor}; 
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;
        
        div.onmouseover = () => {
            div.style.transform = 'translateX(4px)';
            div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        };
        div.onmouseout = () => {
            div.style.transform = 'translateX(0)';
            div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        };
        
        div.onclick = () => showReportDetails(report);
        
        const timestamp = report.timestamp ? new Date(report.timestamp).toLocaleDateString() : 'N/A';
        
        div.innerHTML = `
            <div style="flex: 1; display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">${icon}</span>
                <div>
                    <div style="font-weight: 700; color: ${iconColor}; font-size: 16px; margin-bottom: 4px;">
                        ${report.reportType || 'Report'}
                    </div>
                    <div style="color: #666; font-size: 13px;">
                        ${timestamp}
                    </div>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="color: #666; font-size: 14px; margin-bottom: 4px;">Published by</div>
                <div style="font-weight: 600; color: #333;">${report.publishedBy || 'Unknown'}</div>
            </div>
        `;
        
        content.appendChild(div);
    });
}

// Show detailed report modal
function showReportDetails(report) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.6); display: flex; align-items: center; 
        justify-content: center; z-index: 10000; backdrop-filter: blur(2px);
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    // Determine styling based on report type
    let headerColor = '#667eea';
    let headerGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    let icon = '📄';
    
    const reportType = report.reportType?.toLowerCase();
    if (reportType === 'commendation') {
        headerGradient = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        icon = '⭐';
    } else if (reportType === 'disruptive') {
        headerGradient = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        icon = '⚠️';
    } else if (reportType === 'negative behaviour') {
        headerGradient = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
        icon = '❌';
    } else if (reportType === 'monthly report') {
        headerGradient = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        icon = '📊';
    }
    
    const timestamp = report.timestamp ? new Date(report.timestamp).toLocaleString() : 'N/A';
    
    modal.innerHTML = `
        <div style="
            background: white; padding: 0; border-radius: 12px; 
            max-width: 600px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        ">
            <div style="
                background: ${headerGradient};
                color: white; padding: 24px; 
                display: flex; align-items: center; gap: 12px;
            ">
                <span style="font-size: 32px;">${icon}</span>
                <div>
                    <h3 style="margin: 0; font-size: 24px; font-weight: 700;">Employee Report</h3>
                    <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px;">${report.reportType || 'Report'}</p>
                </div>
            </div>
            
            <div style="padding: 30px;">
                <div style="margin-bottom: 20px;">
                    <div style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Timestamp</div>
                    <div style="font-weight: 600; color: #333; font-size: 16px;">${timestamp}</div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <div style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Report Type</div>
                    <div style="font-weight: 600; color: #333; font-size: 16px;">${report.reportType || 'N/A'}</div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <div style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Published By</div>
                    <div style="font-weight: 600; color: #333; font-size: 16px;">${report.publishedBy || 'Unknown'}</div>
                </div>
                
                ${report.selectScale ? `
                <div style="margin-bottom: 20px;">
                    <div style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Scale</div>
                    <div style="font-weight: 600; color: #333; font-size: 16px;">${report.selectScale}</div>
                </div>
                ` : ''}
                
                <div style="margin-bottom: 20px;">
                    <div style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Comment</div>
                    <div style="
                        background: #f9fafb; 
                        padding: 16px; 
                        border-radius: 8px; 
                        border-left: 4px solid #667eea;
                        color: #333;
                        line-height: 1.6;
                        font-size: 15px;
                    ">${report.comment || 'No comment provided'}</div>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                    <button onclick="this.closest('[style*=fixed]').remove()" style="
                        background: #667eea; color: white; border: none; 
                        padding: 12px 32px; border-radius: 8px; cursor: pointer;
                        font-weight: 600; font-size: 15px;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#5568d3'" onmouseout="this.style.background='#667eea'">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Load and display employee reports
async function loadEmployeeReports() {
    if (!currentUser || !currentUser.id) {
        console.log('[REPORTS] No current user');
        return;
    }
    
    console.log('[REPORTS] Loading reports for user:', currentUser.id);
    const reports = await fetchEmployeeReports(currentUser.id);
    console.log('[REPORTS] Fetched reports:', reports);
    renderReports(reports);
}

// Toggle between disciplinaries and reports sections
function setupDisciplinariesTabs() {
    const disciplinariesBtn = document.getElementById('disciplinariesTabBtn');
    const reportsBtn = document.getElementById('reportsTabBtn');
    const disciplinariesSection = document.getElementById('disciplinariesSection');
    const reportsSection = document.getElementById('reportsSection');
    
    if (!disciplinariesBtn || !reportsBtn) return;
    
    disciplinariesBtn.addEventListener('click', () => {
        disciplinariesBtn.classList.add('active');
        disciplinariesBtn.style.background = '#7c3aed';
        disciplinariesBtn.style.color = 'white';
        reportsBtn.classList.remove('active');
        reportsBtn.style.background = '#e0e0e0';
        reportsBtn.style.color = '#666';
        
        if (disciplinariesSection) disciplinariesSection.style.display = 'block';
        if (reportsSection) reportsSection.style.display = 'none';
    });
    
    reportsBtn.addEventListener('click', () => {
        reportsBtn.classList.add('active');
        reportsBtn.style.background = '#7c3aed';
        reportsBtn.style.color = 'white';
        disciplinariesBtn.classList.remove('active');
        disciplinariesBtn.style.background = '#e0e0e0';
        disciplinariesBtn.style.color = '#666';
        
        if (reportsSection) reportsSection.style.display = 'block';
        if (disciplinariesSection) disciplinariesSection.style.display = 'none';
        
        // Load reports when tab is clicked
        loadEmployeeReports();
    });
}

// Polling for new employee reports
let lastReportCheck = localStorage.getItem('lastReportCheck') ? JSON.parse(localStorage.getItem('lastReportCheck')) : {};
setInterval(async () => {
    if (!window.currentUser) return;
    
    try {
        const reports = await fetchEmployeeReports(window.currentUser.id);
        
        // Check if there are new reports
        const userKey = window.currentUser.id;
        const lastCount = lastReportCheck[userKey] || 0;
        
        if (reports.length > lastCount) {
            // New report(s) detected
            const newCount = reports.length - lastCount;
            const latestReport = reports[reports.length - 1];
            
            // Send backend notification to trigger Discord DM
            try {
                console.log('[DEBUG] Sending report DM notification for user:', window.currentUser.id);
                const dmResponse = await fetch(`${BACKEND_URL}/api/notifications/report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        discordId: window.currentUser.id,
                        reportData: {
                            type: latestReport?.reportType || 'N/A',
                            date: latestReport?.timestamp ? new Date(latestReport.timestamp).toLocaleDateString() : 'N/A'
                        }
                    })
                });
                
                if (dmResponse.ok) {
                    const dmResult = await dmResponse.json();
                    console.log('[DEBUG] Report DM notification result:', dmResult);
                } else {
                    console.error('[DEBUG] Report DM notification failed:', dmResponse.status, await dmResponse.text());
                }
            } catch (e) {
                console.error('Failed to send report notification:', e);
            }
            
            // Add portal notification with sound
            addNotification('report', `📄 ${newCount} new report${newCount > 1 ? 's' : ''} available!`, 'disciplinaries');
            
            // Update last check count
            lastReportCheck[userKey] = reports.length;
            localStorage.setItem('lastReportCheck', JSON.stringify(lastReportCheck));
            
            // If on reports tab, refresh the display
            const reportsSection = document.getElementById('reportsSection');
            if (reportsSection && reportsSection.style.display !== 'none') {
                renderReports(reports);
            }
        }
    } catch (e) {
        // Ignore errors
    }
}, 5000); // Poll every 5 seconds for near-instant notifications

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

// Function to check for approved/rejected change requests and apply them
async function checkApprovedChangeRequests(discordId) {
    try {
        console.log('[DEBUG] checkApprovedChangeRequests called for Discord ID:', discordId);
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
            
            if (result.appliedChanges && result.appliedChanges.length > 0) {
                // Handle both approved and rejected changes
                for (const change of result.appliedChanges) {
                    if (change.approved) {
                        // Handle approved changes
                        if (change.type === 'name') {
                            addNotification('profile', `✅ Name change approved: ${change.from} → ${change.to}`, 'myProfile');
                        } else if (change.type === 'department') {
                            addNotification('profile', `✅ Department change approved: ${change.from} → ${change.to}`, 'myProfile');
                        } else if (change.type === 'email') {
                            addNotification('profile', `✅ Email change approved: ${change.from} → ${change.to}`, 'myProfile');
                        }
                    } else {
                        // Handle rejected changes
                        if (change.type === 'name') {
                            addNotification('profile', `❌ Name change rejected: ${change.from} → ${change.to}`, 'myProfile');
                        } else if (change.type === 'department') {
                            addNotification('profile', `❌ Department change rejected: ${change.from} → ${change.to}`, 'myProfile');
                        } else if (change.type === 'email') {
                            addNotification('profile', `❌ Email change rejected: ${change.from} → ${change.to}`, 'myProfile');
                        }
                    }
                }
                
                // If there were approved changes, refresh user profile
                if (result.hasApprovedRequests) {
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
                        emp.pendingNameChange = null;
                        emp.pendingEmailChange = null;
                        
                        updateEmployee(emp);
                        currentUser.profile = emp.profile;
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                        
                        // Update profile display if on profile page
                        if (document.getElementById('profileName')) {
                            document.getElementById('profileName').textContent = emp.profile.name;
                            document.getElementById('profileName').classList.remove('pending-name');
                        }
                        if (document.getElementById('profileDepartment')) {
                            document.getElementById('profileDepartment').textContent = emp.profile.department;
                            document.getElementById('profileDepartment').classList.remove('pending-department');
                        }
                        if (document.getElementById('profileEmail')) {
                            document.getElementById('profileEmail').textContent = emp.profile.email;
                            document.getElementById('profileEmail').classList.remove('pending-email');
                        }
                    }
                }
                
                // If there were rejected changes, clear any pending flags
                if (result.hasRejectedRequests) {
                    const emp = getEmployee(discordId);
                    if (emp) {
                        emp.pendingDeptChange = null;
                        emp.pendingNameChange = null;
                        emp.pendingEmailChange = null;
                        updateEmployee(emp);
                        
                        // Remove any pending styling
                        if (document.getElementById('profileDepartment')) {
                            document.getElementById('profileDepartment').classList.remove('pending-department');
                        }
                        if (document.getElementById('profileName')) {
                            document.getElementById('profileName').classList.remove('pending-name');
                        }
                        if (document.getElementById('profileEmail')) {
                            document.getElementById('profileEmail').classList.remove('pending-email');
                        }
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
    console.log('[DEBUG] Polling for change request updates...');
    if (!currentUser) {
        console.log('[DEBUG] No currentUser found for change requests');
        return;
    }
    console.log('[DEBUG] Checking change requests for Discord ID:', currentUser.id);
    try {
        await checkApprovedChangeRequests(currentUser.id);
    } catch (e) {
        console.error('Error polling for approved change requests:', e);
    }
}, 2000); // Poll every 2 seconds for faster notifications

// Polling for general request status updates (resignation, disputes, etc.)
let lastRequestCheck = localStorage.getItem('lastRequestCheck') ? JSON.parse(localStorage.getItem('lastRequestCheck')) : {};
setInterval(async () => {
    console.log('[DEBUG] Polling for request status updates...');
    if (!currentUser) {
        console.log('[DEBUG] No currentUser found for requests');
        return;
    }
    
    try {
        const res = await fetch('https://timeclock-backend.marcusray.workers.dev/api/requests/check-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.hasUpdates && data.updatedRequests) {
                console.log(`[DEBUG] Found ${data.updatedRequests.length} updated request(s)`);
                
                for (const request of data.updatedRequests) {
                    const isApproved = request.status === 'Approve' || request.status === 'Approved';
                    const statusEmoji = isApproved ? '✅' : '❌';
                    const statusText = isApproved ? 'approved' : 'denied';
                    addNotification('requests', `${statusEmoji} Your ${request.type} request was ${statusText}!`, 'requests');
                    
                    // Play notification sound
                    playNotificationSound();
                }
                
                // Refresh requests list if on requests screen
                if (document.getElementById('requestsScreen').classList.contains('active')) {
                    console.log('[DEBUG] Reloading requests list after status update');
                    try {
                        await reloadRequests();
                    } catch (e) {
                        console.error('[DEBUG] Error calling reloadRequests:', e);
                    }
                }
            }
        }
    } catch (e) {
        console.error('[DEBUG] Error checking request status:', e);
    }
}, 5000); // Poll every 5 seconds for request updates

// Polling for acknowledged payslips and disciplinaries
setInterval(async () => {
    console.log('[DEBUG] Polling for payslip/disciplinary acknowledgements...');
    if (!currentUser) {
        console.log('[DEBUG] No currentUser found for payslip/disciplinary check');
        return;
    }
    
    try {
        // Check for payslips that need acknowledgement
        const payslipRes = await fetch('https://timeclock-backend.marcusray.workers.dev/api/payslips/check-acknowledged', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId: currentUser.id })
        });
        
        if (payslipRes.ok) {
            const payslipData = await payslipRes.json();
            if (payslipData.hasNewPayslips) {
                console.log(`[DEBUG] Acknowledged ${payslipData.count} new payslip(s)`);
                addNotification('payslips', `💰 ${payslipData.count} new payslip${payslipData.count > 1 ? 's' : ''} available!`, 'payslips');
            }
        }
        
        // Check for disciplinaries that need acknowledgement
        const disciplinaryRes = await fetch('https://timeclock-backend.marcusray.workers.dev/api/disciplinaries/check-acknowledged', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId: currentUser.id })
        });
        
        if (disciplinaryRes.ok) {
            const disciplinaryData = await disciplinaryRes.json();
            if (disciplinaryData.hasNewDisciplinaries) {
                console.log(`[DEBUG] Acknowledged ${disciplinaryData.count} new disciplinary action(s)`);
                addNotification('disciplinaries', `⚠️ ${disciplinaryData.count} new disciplinary action${disciplinaryData.count > 1 ? 's' : ''} received!`, 'disciplinaries');
            }
        }
    } catch (e) {
        console.error('Error checking payslips/disciplinaries:', e);
    }
}, 3000); // Poll every 3 seconds

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

// Auto-process pending payslips and disciplinaries (check for "Submit" status in Google Sheets)
setInterval(async () => {
    try {
        // Check and process pending payslips
        await fetch('https://timeclock-backend.marcusray.workers.dev/api/payslips/check-pending', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        // Check and process pending disciplinaries
        await fetch('https://timeclock-backend.marcusray.workers.dev/api/disciplinaries/check-pending', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error('[DEBUG] Error auto-processing submissions:', e);
    }
}, 3000); // Check every 3 seconds for instant processing

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
                        name: currentUser.name || emp.profile?.name || 'Unknown User',  // A: Name
                        startDate,           // B: Start Date
                        endDate,             // C: End Date
                        reason: type,        // D: Reason
                        totalDays: days.toString(),  // E: Total Days
                        comment,             // F: Comment
                        // G: Approval (empty, filled by managers)
                        discordId: currentUser.id  // H: Discord ID
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

// ==============================================================================
// SENTINEL Security: All webhooks moved to secure backend
// No sensitive data exposed in frontend
// ==============================================================================

// Utility to send absence to Discord webhook (via secure backend)
async function sendAbsenceWebhook(absence) {
    const emp = getEmployee(currentUser.id);
    const days = Math.ceil((new Date(absence.endDate) - new Date(absence.startDate)) / (1000 * 60 * 60 * 24)) + 1;
    
    try {
        await fetch('https://timeclock-backend.marcusray.workers.dev/api/webhooks/absence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                userName: emp.profile.name,
                type: absence.type,
                startDate: absence.startDate,
                endDate: absence.endDate,
                days: days,
                reason: absence.comment || absence.reason || 'N/A',
                cancelled: absence.cancelled || false
            })
        });
    } catch (error) {
        console.error('Failed to send absence webhook:', error);
    }
}

const REQUIRED_ROLE = '1315346851616002158';
const DEPT_ROLES = {
    'Development Department': '1315323804528017498',
    'Customer Relations Department': '1315042036969242704',
    'Finance Department': '1433453982453338122'
};
const GUILD_ID = '1310656642672627752';
const WORKER_URL = 'https://timeclock-backend.marcusray.workers.dev';
const CLIENT_ID = '1417915896634277888';
const REDIRECT_URI = 'https://portal.cirkledevelopment.co.uk';

// Discord DM utility functions
async function sendDiscordDM(userId, embed) {
    try {
        // Use the new POST endpoint with native Discord embeds
        const response = await fetch(`https://timeclock-backend.marcusray.workers.dev/sendDM`, {
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
    requests: document.getElementById('requestsScreen'),
    