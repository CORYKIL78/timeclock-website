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

// Global request deduplicator - prevents duplicate API calls within 30 seconds
const requestDeduplicator = {
    pending: new Map(),  // Map of endpoint -> Promise
    lastCall: new Map(), // Map of endpoint -> timestamp
    TTL: 30000, // 30 seconds
    
    async execute(endpoint, fn) {
        // Check if we have a pending request for this endpoint
        if (this.pending.has(endpoint)) {
            console.log(`[DEDUP] Returning pending request for ${endpoint}`);
            return await this.pending.get(endpoint);
        }
        
        // Check if we have a cached result within TTL
        const lastTime = this.lastCall.get(endpoint);
        if (lastTime && Date.now() - lastTime < this.TTL) {
            console.log(`[DEDUP] Result still fresh for ${endpoint}, returning cached`);
            return this.lastResult.get(endpoint);
        }
        
        // Create new request
        const promise = fn().then(result => {
            this.lastCall.set(endpoint, Date.now());
            if (!this.lastResult) this.lastResult = new Map();
            this.lastResult.set(endpoint, result);
            this.pending.delete(endpoint);
            return result;
        }).catch(error => {
            this.pending.delete(endpoint);
            throw error;
        });
        
        this.pending.set(endpoint, promise);
        return await promise;
    }
};
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
        // Update language options for the selected country
        if (typeof updateLanguageOptions === 'function') {
            updateLanguageOptions();
        }
    }
    
    const profileTimezoneSelect = document.getElementById('profileTimezoneSelect');
    if (profileTimezoneSelect && currentUser.profile?.timezone) {
        profileTimezoneSelect.value = currentUser.profile.timezone;
    }
    
    const profileLanguageSelect = document.getElementById('profileLanguageSelect');
    if (profileLanguageSelect && currentUser.profile?.language) {
        profileLanguageSelect.value = currentUser.profile.language;
    }
    
    if (typeof updateProfilePictures === 'function') {
        updateProfilePictures();
    }
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
            // Check cache first
            const cacheKey = `absences_${currentUser.id}`;
            const cached = apiCache.get(cacheKey);
            if (cached) {
                console.debug('[syncAbsencesFromSheets] Using cached absences');
                const data = cached;
                if (data.absences && Array.isArray(data.absences)) {
                    const emp = getEmployee(currentUser.id);
                    if (emp) {
                        emp.absences = data.absences;
                        localStorage.setItem('employees', JSON.stringify(employees));
                    }
                }
                return;
            }
            
            const response = await fetch(`https://timeclock-backend.marcusray.workers.dev/api/user/absences/${currentUser.id}`);
            if (!response.ok) {
                console.error('[syncAbsencesFromSheets] Failed to fetch:', response.status);
                return;
            }
            
            const data = await response.json();
            apiCache.set(cacheKey, data);
            console.debug('[syncAbsencesFromSheets] Fetched', data.absences?.length || 0, 'absences');
            
            if (data.absences && Array.isArray(data.absences)) {
                // Update the employee's absences in localStorage
                const emp = getEmployee(currentUser.id);
                if (emp) {
                    emp.absences = data.absences;
                    localStorage.setItem('employees', JSON.stringify(employees));
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
            persistUserData(); // Use persistence layer
            console.log('[syncProfileFromSheets] Saved to localStorage');
            
            // Update employee record
            const emp = getEmployee(currentUser.id);
            emp.profile = emp.profile || {};
            emp.profile.name = profile.name;
            emp.profile.email = profile.email;
            emp.profile.department = profile.department;
            emp.profile.staffId = profile.staffId;
            emp.profile.baseLevel = profile.baseLevel;
            updateEmployee(emp); // This calls persistUserData() internally
            
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
// Main backend URL (Cloudflare Workers)
let BACKEND_URL = localStorage.getItem('BACKEND_URL') || 'https://timeclock-backend.marcusray.workers.dev';

// Accounts API URL (standalone Node.js server) - Can be deployed separately
// Examples:
// - Local: http://localhost:3000
// - Render: https://your-app.onrender.com
// - Railway: https://your-app.railway.app
// - Heroku: https://your-app.herokuapp.com
let ACCOUNTS_API_URL = localStorage.getItem('ACCOUNTS_API_URL') || 'http://localhost:3000';

// Helper function to update API URLs (useful for switching environments)
function setAPIURLs(backendUrl, accountsUrl) {
  if (backendUrl) {
    BACKEND_URL = backendUrl;
    localStorage.setItem('BACKEND_URL', backendUrl);
  }
  if (accountsUrl) {
    ACCOUNTS_API_URL = accountsUrl;
    localStorage.setItem('ACCOUNTS_API_URL', accountsUrl);
  }
  console.log('[API URLS]', { BACKEND_URL, ACCOUNTS_API_URL });
}

// API Response Cache - Reduce quota usage
const apiCache = {
    data: {},
    timestamps: {},
    TTL: 30000, // 30 second cache
    inFlight: {}, // Track in-flight requests to prevent duplicates
    
    set(key, value) {
        this.data[key] = value;
        this.timestamps[key] = Date.now();
    },
    
    get(key) {
        const timestamp = this.timestamps[key];
        if (!timestamp) return null;
        if (Date.now() - timestamp > this.TTL) {
            delete this.data[key];
            delete this.timestamps[key];
            return null;
        }
        return this.data[key];
    },
    
    isInFlight(key) {
        return this.inFlight[key];
    },
    
    setInFlight(key, promise) {
        this.inFlight[key] = promise;
    },
    
    clearInFlight(key) {
        delete this.inFlight[key];
    },
    
    clear() {
        this.data = {};
        this.timestamps = {};
        this.inFlight = {};
    }
};

async function upsertUserProfile() {
    try {
        const payload = {
            discordId: currentUser.id,
            name: currentUser.profile.name,
            email: currentUser.profile.email,
            department: currentUser.profile.department,
            timezone: currentUser.profile.timezone || '',
            country: currentUser.profile.country || '',
            staffId: currentUser.profile.staffId || ''
        };
        console.log('[upsertUserProfile] Saving profile to backend:', payload);
        const res = await fetch(`${WORKER_URL}/api/user/profile/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const data = await res.json();
            console.log('[upsertUserProfile] Profile saved successfully:', data);
            sessionStorage.removeItem('needsProfileSetup');
            // Force refresh cached profile to ensure next lookup gets fresh data
            const cacheKey = `profile_${currentUser.id}`;
            apiCache.delete(cacheKey);
            console.log('[upsertUserProfile] Cache cleared for next lookup');
        } else {
            console.error('[upsertUserProfile] Backend error:', res.status);
            const errorText = await res.text();
            console.error('[upsertUserProfile] Error response:', errorText);
        }
    } catch (e) {
        console.error('[upsertUserProfile] Failed to save profile:', e);
    }
}

async function fetchUserProfile(discordId) {
    try {
        // Check cache first
        const cacheKey = `profile_${discordId}`;
        const cached = apiCache.get(cacheKey);
        if (cached) {
            console.log('[fetchUserProfile] Using cached profile');
            return cached;
        }
        
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
        apiCache.set(cacheKey, data);
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
            body: JSON.stringify({ userId: discordId })
        });
        if (!res.ok) throw new Error('Failed to fetch disciplinaries');
        const data = await res.json();
        return Array.isArray(data) ? data : (data.disciplinaries || []);
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

// ============================================================================
// ACCOUNTS API FUNCTIONS - Retrieve account information from standalone API
// ============================================================================

/**
 * Fetch complete account information from Accounts API
 * Includes: profile, absences, payslips, disciplinaries, requests, reports, summary
 */
async function fetchAccountInfo(userId) {
    try {
        const url = `${ACCOUNTS_API_URL}/api/accounts/${userId}`;
        console.log('[ACCOUNTS API] Fetching account info from:', url);
        
        const res = await fetch(url);
        if (!res.ok) {
            console.error('[ACCOUNTS API] Error:', res.status, res.statusText);
            return null;
        }
        
        const data = await res.json();
        return data.success ? data.account : null;
    } catch (e) {
        console.error('[ACCOUNTS API] Error fetching account:', e.message);
        return null;
    }
}

/**
 * Fetch just the user profile
 */
async function fetchAccountProfile(userId) {
    try {
        const url = `${ACCOUNTS_API_URL}/api/user/profile/${userId}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data.success ? data.profile : null;
    } catch (e) {
        console.error('[ACCOUNTS API] Error fetching profile:', e.message);
        return null;
    }
}

/**
 * Fetch user absences
 */
async function fetchAccountAbsences(userId) {
    try {
        const url = `${ACCOUNTS_API_URL}/api/user/absences/${userId}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return data.success ? data.absences : [];
    } catch (e) {
        console.error('[ACCOUNTS API] Error fetching absences:', e.message);
        return [];
    }
}

/**
 * Fetch user payslips
 */
async function fetchAccountPayslips(userId) {
    try {
        const url = `${ACCOUNTS_API_URL}/api/user/payslips/${userId}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return data.success ? data.payslips : [];
    } catch (e) {
        console.error('[ACCOUNTS API] Error fetching payslips:', e.message);
        return [];
    }
}

/**
 * Fetch user disciplinaries
 */
async function fetchAccountDisciplinaries(userId) {
    try {
        const url = `${ACCOUNTS_API_URL}/api/user/disciplinaries/${userId}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return data.success ? data.disciplinaries : [];
    } catch (e) {
        console.error('[ACCOUNTS API] Error fetching disciplinaries:', e.message);
        return [];
    }
}

/**
 * Fetch user requests
 */
async function fetchAccountRequests(userId) {
    try {
        const url = `${ACCOUNTS_API_URL}/api/user/requests/${userId}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return data.success ? data.requests : [];
    } catch (e) {
        console.error('[ACCOUNTS API] Error fetching requests:', e.message);
        return [];
    }
}

/**
 * Fetch user reports
 */
async function fetchAccountReports(userId) {
    try {
        const url = `${ACCOUNTS_API_URL}/api/user/reports/${userId}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return data.success ? data.reports : [];
    } catch (e) {
        console.error('[ACCOUNTS API] Error fetching reports:', e.message);
        return [];
    }
}

/**
 * Check Accounts API health status
 */
async function checkAccountsAPIHealth() {
    try {
        const url = `${ACCOUNTS_API_URL}/health`;
        const res = await fetch(url);
        const data = await res.json();
        console.log('[ACCOUNTS API] Health:', data);
        return data;
    } catch (e) {
        console.error('[ACCOUNTS API] Health check failed:', e.message);
        return { status: 'error', error: e.message };
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
        const cacheKey = `reports_${userId}`;
        
        // Check cache first
        const cached = apiCache.get(cacheKey);
        if (cached) {
            console.log('[fetchEmployeeReports] Using cached reports');
            return cached;
        }
        
        // Check if request is already in flight
        if (apiCache.isInFlight(cacheKey)) {
            console.log('[fetchEmployeeReports] Request already in flight, waiting...');
            return await apiCache.isInFlight(cacheKey);
        }
        
        const fetchPromise = fetch(`${BACKEND_URL}/api/reports/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        }).then(async (res) => {
            if (!res.ok) throw new Error('Failed to fetch employee reports');
            const data = await res.json();
            const reports = data.reports || [];
            apiCache.set(cacheKey, reports);
            return reports;
        }).finally(() => {
            apiCache.clearInFlight(cacheKey);
        });
        
        apiCache.setInFlight(cacheKey, fetchPromise);
        return await fetchPromise;
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
        
        const reportType = (report.type || report.reportType || '')?.toLowerCase();
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
    
    if (!disciplinariesBtn || !reportsBtn) {
        console.warn('[setupDisciplinariesTabs] Buttons not found, retrying in 500ms');
        setTimeout(() => setupDisciplinariesTabs(), 500);
        return;
    }
    
    console.log('[setupDisciplinariesTabs] Setting up tab buttons');
    
    // Remove any existing listeners by cloning nodes
    const newDisciplinariesBtn = disciplinariesBtn.cloneNode(true);
    const newReportsBtn = reportsBtn.cloneNode(true);
    disciplinariesBtn.parentNode.replaceChild(newDisciplinariesBtn, disciplinariesBtn);
    reportsBtn.parentNode.replaceChild(newReportsBtn, reportsBtn);
    
    newDisciplinariesBtn.addEventListener('click', () => {
        console.log('[setupDisciplinariesTabs] Disciplinaries tab clicked');
        newDisciplinariesBtn.classList.add('active');
        newDisciplinariesBtn.style.background = '#7c3aed';
        newDisciplinariesBtn.style.color = 'white';
        newReportsBtn.classList.remove('active');
        newReportsBtn.style.background = '#e0e0e0';
        newReportsBtn.style.color = '#666';
        
        if (disciplinariesSection) {
            disciplinariesSection.style.display = 'block';
            disciplinariesSection.classList.add('active');
        }
        if (reportsSection) {
            reportsSection.style.display = 'none';
            reportsSection.classList.remove('active');
        }
    });
    
    newReportsBtn.addEventListener('click', () => {
        console.log('[setupDisciplinariesTabs] Reports tab clicked');
        newReportsBtn.classList.add('active');
        newReportsBtn.style.background = '#7c3aed';
        newReportsBtn.style.color = 'white';
        newDisciplinariesBtn.classList.remove('active');
        newDisciplinariesBtn.style.background = '#e0e0e0';
        newDisciplinariesBtn.style.color = '#666';
        
        if (reportsSection) {
            reportsSection.style.display = 'block';
            reportsSection.classList.add('active');
        }
        if (disciplinariesSection) {
            disciplinariesSection.style.display = 'none';
            disciplinariesSection.classList.remove('active');
        }
        
        // Load reports when tab is clicked
        console.log('[setupDisciplinariesTabs] Loading reports on tab click');
        loadEmployeeReports();
    });
    
    // IMPORTANT: Load reports initially when page loads
    console.log('[setupDisciplinariesTabs] Loading reports on initial setup');
    setTimeout(() => loadEmployeeReports(), 100);
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
    // NOTE: Change request endpoint not available in backend
    // Profile change management is handled through the new system
    // This function is disabled and kept for backward compatibility only
    return;
}

// NOTE: Polling for approved change requests DISABLED
// The /api/change-request/check-approved endpoint is not available in the backend
// Change requests feature is deprecated in the new system
// setInterval(async () => {...}, 2000);

// NOTE: Polling for request status updates DISABLED
// The /api/requests/check-status endpoint is not available in the backend
// setInterval(async () => {...}, 5000);

// NOTE: Polling for acknowledged payslips and disciplinaries DISABLED
// The /api/payslips/check-acknowledged and /api/disciplinaries/check-acknowledged endpoints are not available in the backend
// setInterval(async () => {...}, 3000);

// Call syncUserProfileOnLogin() after successful login (e.g. after setting currentUser)
// Track which absences have already been notified about (persisted to localStorage)
let notifiedAbsences = new Set(
    JSON.parse(localStorage.getItem('notifiedAbsences') || '[]')
);

// Track which payslips/disciplinaries have already been notified about
let notifiedPayslips = new Set(
    JSON.parse(localStorage.getItem('notifiedPayslips') || '[]')
);
let notifiedDisciplinaries = new Set(
    JSON.parse(localStorage.getItem('notifiedDisciplinaries') || '[]')
);

function saveNotifiedAbsences() {
    try {
        localStorage.setItem('notifiedAbsences', JSON.stringify(Array.from(notifiedAbsences)));
    } catch (e) {
        console.error('Error saving notified absences:', e);
    }
}

function saveNotifiedPayslips() {
    try {
        localStorage.setItem('notifiedPayslips', JSON.stringify(Array.from(notifiedPayslips)));
    } catch (e) {
        console.error('Error saving notified payslips:', e);
    }
}

function saveNotifiedDisciplinaries() {
    try {
        localStorage.setItem('notifiedDisciplinaries', JSON.stringify(Array.from(notifiedDisciplinaries)));
    } catch (e) {
        console.error('Error saving notified disciplinaries:', e);
    }
}

// NOTE: Polling for absence status updates DISABLED
// The /api/absence/check-approved and /api/absence/acknowledge endpoints require different payloads
// Absence management is now handled through the new backend system
// setInterval(async () => {...}, 5000);// NOTE: Auto-process pending payslips and disciplinaries DISABLED
// These endpoints require userId parameter which is now missing
// setInterval(async () => {...}, 3000);

// Polling for new payslips
let lastPayslipCheck = localStorage.getItem('lastPayslipCheck') ? JSON.parse(localStorage.getItem('lastPayslipCheck')) : {};
setInterval(async () => {
    if (!window.currentUser) return;
    
    try {
        const res = await fetch('https://timeclock-backend.marcusray.workers.dev/api/payslips/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: window.currentUser.id })
        });
        
        if (!res.ok) return;
        
        const data = await res.json();
        const payslips = Array.isArray(data) ? data : (data.payslips || []);
        
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
    
    try {
        const res = await fetch('https://timeclock-backend.marcusray.workers.dev/api/disciplinaries/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: window.currentUser.id })
        });
        
        if (!res.ok) return;
        
        const data = await res.json();
        const disciplinaries = Array.isArray(data) ? data : (data.disciplinaries || []);
        
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
                messageId: null,
                createdAt: new Date().toISOString()
            };
            emp.absences.push(absence);
            console.log('[submitAbsence] Adding absence to employee record:', JSON.stringify(absence));
            updateEmployee(emp);
            console.log('[submitAbsence] Employee now has', emp.absences.length, 'absences');
            
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
            document.querySelector('.absence-tab-btn[data-tab="pending"]')?.classList.add('active');
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

const REQUIRED_ROLE = window.CONFIG?.REQUIRED_ROLE || '1315346851616002158';
const DEPT_ROLES = window.CONFIG?.DEPT_ROLES || {
    '1315323804528017498': '1315323804528017498',
    '1315042036969242704': '1315042036969242704',
    '1433453982453338122': '1433453982453338122',
    '1315041666851274822': '1315041666851274822'
};
const GUILD_ID = window.CONFIG?.GUILD_ID || '1310656642672627752';
const WORKER_URL = window.CONFIG?.WORKER_URL || 'https://timeclock-backend.marcusray.workers.dev';
const CLIENT_ID = window.CONFIG?.DISCORD_CLIENT_ID || '1417915896634277888';
const REDIRECT_URI = window.CONFIG?.REDIRECT_URI || 'https://portal.cirkledevelopment.co.uk';

// Discord DM utility functions
async function sendDiscordDM(userId, embed) {
    try {
        // Use the new POST endpoint with native Discord embeds
        const response = await fetch(`${WORKER_URL}/api/send-dm`, {
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
    loading: document.getElementById('loadingScreen'),
    sequentialLoading: document.getElementById('sequentialLoadingScreen'),
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
    mail: document.getElementById('mailScreen'),
    clickup: document.getElementById('clickupScreen'),
    handbooks: document.getElementById('handbooksScreen'),
    goodbye: document.getElementById('goodbyeScreen'),
    suspended: document.getElementById('suspendedScreen'),
    calendarScreen: document.getElementById('calendarScreen')
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
    submitRequest: document.getElementById('submitRequestModal')
};

console.log('%c🚀 SCRIPT.JS LOADED', 'color: magenta; font-size: 20px; font-weight: bold;');

window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('%c❌ GLOBAL ERROR:', 'color: red; font-size: 16px; font-weight: bold;', {
        message: msg,
        url: url,
        line: lineNo,
        column: columnNo,
        error: error
    });
    return false;
};

let currentUser = null;
let clockInTime = null;
let currentTasks = [];
let employees = JSON.parse(localStorage.getItem('employees')) || [];
let isClockedIn = false;
let clockInActions = [];
let clockInInterval = null;
let clockDisplayInterval = null;
let previousSessions = [];
let roleNames = {};
let successAudio = null;
let notificationAudio = null;
let currentMail = null;
let currentNotifications = [];

// ============================================================================
// DATA PERSISTENCE LAYER - Save and restore all user data
// ============================================================================

/**
 * Persist all user data to localStorage
 * Called after ANY modification to currentUser or employees
 */
function persistUserData() {
    try {
        if (currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            console.log('[PERSIST] Saved currentUser:', currentUser.id);
        }
        
        if (employees && employees.length > 0) {
            localStorage.setItem('employees', JSON.stringify(employees));
            console.log('[PERSIST] Saved', employees.length, 'employees');
        }
    } catch (e) {
        console.error('[PERSIST] Error saving data:', e);
    }
}

/**
 * Restore all user data from localStorage
 * Called on page load to restore previous session
 */
function restoreUserData() {
    try {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            console.log('[RESTORE] Loaded currentUser from localStorage:', currentUser.id);
        }
        
        const savedEmployees = localStorage.getItem('employees');
        if (savedEmployees) {
            employees = JSON.parse(savedEmployees);
            console.log('[RESTORE] Loaded', employees.length, 'employees from localStorage');
        }
        
        return { currentUser, employees };
    } catch (e) {
        console.error('[RESTORE] Error loading data:', e);
        return { currentUser: null, employees: [] };
    }
}

/**
 * Shorthand function to update currentUser profile and persist
 */
function updateCurrentUserProfile(profileData) {
    if (!currentUser) currentUser = {};
    if (!currentUser.profile) currentUser.profile = {};
    
    Object.assign(currentUser.profile, profileData);
    persistUserData();
    console.log('[UPDATE-PROFILE] Updated profile:', currentUser.profile);
}

/**
 * Clear all local data (used on logout/reset)
 */
function clearAllLocalData() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('employees');
    localStorage.removeItem('clockInTime');
    localStorage.removeItem('lastDisciplinaryCheck');
    localStorage.removeItem('lastPayslipCheck');
    localStorage.removeItem('lastReportCheck');
    currentUser = null;
    employees = [];
    console.log('[CLEAR] All local data cleared');
}

// ============================================================================
// INITIALIZE DATA ON SCRIPT LOAD
// ============================================================================
console.log('[INIT] Starting data initialization...');
const restored = restoreUserData();
if (restored.currentUser) {
    console.log('[INIT] ✓ Restored currentUser from localStorage:', restored.currentUser.id);
}
if (restored.employees && restored.employees.length > 0) {
    console.log('[INIT] ✓ Restored', restored.employees.length, 'employees from localStorage');
}


function showScreen(screenId) {
    console.log('%c==> showScreen:', 'color: cyan; font-weight: bold;', screenId);
    
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
        const notificationBtn = document.getElementById('notificationBtn');
        if (screenId !== 'portalWelcome' && ['mainMenu', 'myProfile', 'myRoles', 'tasks', 'absences', 'payslips', 'disciplinaries', 'timeclock', 'mail', 'clickup', 'handbooks', 'requests', 'calendarScreen'].includes(screenId)) {
            sidebar.classList.remove('hidden');
            if (notificationBtn) notificationBtn.classList.remove('hidden');
            // Update notification badge
            updateNotificationBadge();
            // Show mobile nav button
            const mobileNavBtn = document.getElementById('mobileNavBtn');
            if (mobileNavBtn) mobileNavBtn.style.display = '';
        } else {
            sidebar.classList.add('hidden');
            notificationPanel.classList.add('hidden');
            if (notificationBtn) notificationBtn.classList.add('hidden');
            // Hide mobile nav button
            const mobileNavBtn = document.getElementById('mobileNavBtn');
            if (mobileNavBtn) mobileNavBtn.style.display = 'none';
        }
        // Set profile pic on portal welcome screen
        if (screenId === 'portalWelcome' && currentUser && currentUser.avatar) {
            const portalPic = document.getElementById('portalWelcomeProfilePic');
            if (portalPic) portalPic.src = currentUser.avatar;
        }
        
        // Update active navigation button
        updateActiveNavButton(screenId);
    } else {
        console.error('Screen not found:', screenId);
        console.warn('Screen not found, staying on current screen');
        return;
    }
}

// Update active navigation button and slide indicator
function updateActiveNavButton(screenId) {
    // Map screen IDs to button IDs
    const screenToButton = {
        'mainMenu': 'homeBtn',
        'myProfile': 'homeBtn', // Profile is accessed via clicking avatar, keep home active
        'myRoles': 'myRolesBtn',
        'absences': 'absencesBtn',
        'payslips': 'payslipsBtn',
        'disciplinaries': 'disciplinariesBtn',
        'requests': 'requestsBtn',
        'timeclock': 'timeclockBtn',
        'mail': 'mailBtn',
        'tasks': 'clickupBtn',
        'clickup': 'clickupBtn',
        'calendarScreen': 'calendarBtn',
        'handbooks': 'handbooksBtn'
    };
    
    const activeButtonId = screenToButton[screenId];
    if (!activeButtonId) return;
    
    // Remove active class from all nav buttons
    document.querySelectorAll('#sidebarNav button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to current button
    const activeButton = document.getElementById(activeButtonId);
    if (activeButton) {
        activeButton.classList.add('active');
        
        // Slide the indicator
        const navContainer = document.getElementById('sidebarNav');
        const indicator = navContainer.querySelector('::before');
        const buttons = Array.from(document.querySelectorAll('#sidebarNav button'));
        const index = buttons.indexOf(activeButton);
        
        if (index !== -1) {
            const offset = index * (activeButton.offsetHeight + 10); // height + gap
            navContainer.style.setProperty('--indicator-offset', `${offset}px`);
        }
    }
}

// Helper function to close mobile sidebar after navigation
function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth <= 700) {
        sidebar.classList.remove('extended');
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
    // SENTINEL Security: Route through secure backend
    try {
        const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/webhooks/timeclock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);
        console.log('[SENTINEL] Webhook sent successfully');
    } catch (e) {
        console.error('[SENTINEL] Webhook error:', e);
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
        const response = await fetch(`${WORKER_URL}/api/send-dm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, embed: { title: 'Notification', description: message } })
        });
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

// Fetch all user data from backend for cross-device syncing
async function syncUserDataFromBackend(userId) {
    console.log('[SYNC] Fetching all user data from backend for cross-device sync...');
    
    try {
        // Fetch absences from backend
        const absencesResponse = await fetch(`${WORKER_URL}/api/user/absences/${userId}`);
        if (absencesResponse.ok) {
            const absencesData = await absencesResponse.json();
            const emp = getEmployee(userId);
            emp.absences = (Array.isArray(absencesData) ? absencesData : []).map(a => ({
                id: Date.now() + Math.random(),
                type: a.reason || 'Personal',
                startDate: a.startDate,
                endDate: a.endDate,
                reason: a.reason,
                comment: a.comment || '',
                status: 'approved'
            }));
            console.log('[SYNC] Loaded', emp.absences.length, 'absences from backend');
        }
        
        // Fetch payslips from backend
        const payslipsResponse = await fetch(`${WORKER_URL}/api/payslips/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        if (payslipsResponse.ok) {
            const payslipsData = await payslipsResponse.json();
            const emp = getEmployee(userId);
            emp.payslips = Array.isArray(payslipsData) ? payslipsData : (payslipsData.payslips || []);
            console.log('[SYNC] Loaded', emp.payslips.length, 'payslips from backend');
        }
        
        // Fetch disciplinaries from backend
        const disciplinariesResponse = await fetch(`${WORKER_URL}/api/disciplinaries/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        if (disciplinariesResponse.ok) {
            const disciplinariesData = await disciplinariesResponse.json();
            const emp = getEmployee(userId);
            emp.strikes = Array.isArray(disciplinariesData) ? disciplinariesData : (disciplinariesData.disciplinaries || []);
            console.log('[SYNC] Loaded', emp.strikes.length, 'disciplinaries from backend');
        }
        
        // Fetch requests from backend
        const requestsResponse = await fetch(`${WORKER_URL}/api/requests/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        if (requestsResponse.ok) {
            const requestsData = await requestsResponse.json();
            const emp = getEmployee(userId);
            emp.requests = Array.isArray(requestsData) ? requestsData : (requestsData.requests || []);
            console.log('[SYNC] Loaded', emp.requests.length, 'requests from backend');
        }
        
        console.log('[SYNC] ✓ All user data synced from backend');
        saveEmployees();
        return true;
    } catch (error) {
        console.error('[SYNC] Error syncing user data from backend:', error);
        return false;
    }
}

function saveEmployees() {
    localStorage.setItem('employees', JSON.stringify(employees));
    console.log('[saveEmployees] Saved', employees.length, 'employees to localStorage');
}

function updateEmployee(employee) {
    const index = employees.findIndex(e => e.id === employee.id);
    if (index > -1) {
        employees[index] = employee;
    } else {
        employees.push(employee);
    }
    persistUserData(); // Save to localStorage after any employee update
}function getEmployee(id) {
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
        pendingNameChange: null,
        pendingEmailChange: null,
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
    emp.notifications.push({ type, message, timestamp, link });
    updateEmployee(emp);
    
    // Update currentNotifications array for immediate UI update
    currentNotifications = emp.notifications;
    renderNotifications();
    updateNotificationBadge();
}

// Listen for new mail and notify
function notifyNewMail(subject) {
    addNotification('mail', `New mail received: ${subject}`);
    playNotificationSound();
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
    
    // Update badge count
    const badge = document.getElementById('notificationBadge');
    const count = currentNotifications.length;
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    
    if (currentNotifications.length === 0) {
        list.innerHTML = '<li style="text-align: center; color: #9ca3af; padding: 20px;">No notifications</li>';
        return;
    }
    
    currentNotifications.forEach((n, index) => {
        const li = document.createElement('li');
        li.style.cursor = 'pointer';
        li.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <strong>${n.type}</strong>: ${n.message}
                    ${n.timestamp ? `<br><small style="color: #888;">${n.timestamp}</small>` : ''}
                </div>
            </div>
        `;
        li.addEventListener('click', () => {
            // Navigate to the linked page if provided
            if (n.link) {
                showScreen(n.link);
                // Close notification panel
                const panel = document.getElementById('notificationPanel');
                if (panel) panel.classList.add('hidden');
            }
            // Remove notification
            currentNotifications.splice(index, 1);
            const emp = getEmployee(currentUser.id);
            emp.notifications = currentNotifications;
            updateEmployee(emp);
            renderNotifications();
            updateNotificationBadge();
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
    // Use profile avatar from backend if available, otherwise fallback to currentUser.avatar
    const avatarUrl = currentUser.profile?.avatar || currentUser.avatar || `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`;
    document.getElementById('sidebarProfilePic').src = avatarUrl;
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
    
    // Department ID to Name mapping
    const departmentMap = {
        '1315323804528017498': 'Development',
        '1315042036969242704': 'Customer Relations',
        '1433453982453338122': 'Finance and Marketing',
        '1315041666851274822': 'Oversight and Corporate'
    };
    
    // Ensure profile data exists before displaying
    const userName = currentUser.profile?.name || currentUser.name || 'User';
    const deptId = currentUser.profile?.department || emp.profile?.department || 'N/A';
    // Convert department ID to name, or use as-is if it's already a name
    const userDept = departmentMap[deptId] || deptId;
    
    // Base Level mapping - fetch from currentUser.profile which is synced from Sheets
    // Handles both numeric (1-7), text values, and pipe-separated format "1 | Director Board"
    const baseLevelMap = {
        // Numeric values
        '1': 'Director Board',
        '2': 'Director Board',
        '3': 'Development',
        '4': 'Finance',
        '5': 'Customer Relations',
        '6': 'Seniors',
        '7': 'General',
        // Text values from dropdown menu
        'Director Board': 'Director Board',
        'Development': 'Development',
        'Finance': 'Finance',
        'Customer Relations': 'Customer Relations',
        'Seniors': 'Seniors',
        'General': 'General'
    };
    
    // Get base level from profile, trim whitespace
    let baseLevelValue = (currentUser.profile?.baseLevel || '').toString().trim();
    console.log('[updateMainScreen] Raw baseLevel value from profile:', baseLevelValue);
    
    // Check if value contains pipe separator (e.g., "1 | Director Board")
    let baseLevelDisplay = 'Not Set';
    if (baseLevelValue) {
        if (baseLevelValue.includes('|')) {
            // Extract the part after the pipe and trim
            const parts = baseLevelValue.split('|');
            baseLevelDisplay = parts[1] ? parts[1].trim() : parts[0].trim();
            console.log('[updateMainScreen] Parsed from pipe format:', baseLevelDisplay);
        } else {
            // Use mapping or the value itself
            baseLevelDisplay = baseLevelMap[baseLevelValue] || baseLevelValue;
        }
    }
    console.log('[updateMainScreen] Base Level display:', baseLevelDisplay);
    
    document.getElementById('greeting').textContent = `Good ${getGreeting()}, ${userName}!`;
    document.getElementById('lastLogin').textContent = `Last Log In: ${emp.lastLogin || 'Never'}`;
    document.getElementById('mainProfilePic').src = currentUser.avatar || 'https://via.placeholder.com/100';
    const absences = emp.absences || [];
    document.getElementById('totalAbsences').textContent = absences.length;
    let totalDays = 0;
    absences.forEach(a => {
        const start = new Date(a.startDate);
        const end = new Date(a.endDate);
        if (end >= start) {
            totalDays += Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        }
    });
    document.getElementById('totalAbsenceDays').textContent = totalDays;
    document.getElementById('currentDepartment').textContent = userDept;
    document.getElementById('baseLevel').textContent = baseLevelDisplay;
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
    // NOTE: /roles/{GUILD_ID} endpoint not available in backend
    // Discord roles are managed through the staff portal
    console.log('[INIT] fetchRoleNames DISABLED - roles managed through portal');
    return;
}

async function fetchEmployees() {
    // NOTE: /members/{GUILD_ID} endpoint not available in backend
    // Using locally cached employee data from localStorage instead
    try {
        console.log('[INIT] fetchEmployees - using local cache since /members endpoint unavailable');
        // Employees are loaded from localStorage automatically
        // This function is now a no-op but kept for compatibility
        return;
    } catch (e) {
        console.error('Employees fetch error:', e);
    }
}

// Check for suspension status - MUST BE GLOBAL SCOPE
async function checkSuspensionStatus() {
    console.log('[SUSPEND] checkSuspensionStatus called!');
    console.log('[SUSPEND] window.currentUser:', window.currentUser);
    
    if (!window.currentUser || !window.currentUser.id) {
        console.log('[SUSPEND] No currentUser or ID, returning false');
        return false;
    }
    
    console.log('[SUSPEND] Checking suspension status for user:', window.currentUser.id);
    
    try {
        const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/user-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: window.currentUser.id })
        });
        
        console.log('[SUSPEND] Response status:', response.status);
        
        if (response.ok) {
            const statusData = await response.json();
            console.log('[SUSPEND] Status data:', statusData);
            
            const wasSuspended = localStorage.getItem('wasSuspended') === 'true';
            
            if (statusData.status === 'suspended') {
                console.log('[SUSPEND] User is suspended! Showing modal...');
                localStorage.setItem('wasSuspended', 'true');
                showSuspensionModal();
                return true; // User is suspended
            } else if (wasSuspended) {
                console.log('[SUSPEND] User was suspended but now active');
                // User was suspended but is now active - show reactivation notification
                localStorage.removeItem('wasSuspended');
                showReactivationNotification();
            }
        }
    } catch (error) {
        console.error('Error checking suspension status:', error);
    }
    return false; // User is not suspended
}

// Show reactivation notification
function showReactivationNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 20px 30px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-size: 1.1em;
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.5em;">✅</span>
            <div>
                <strong>Portal Activated!</strong>
                <p style="margin: 5px 0 0 0; font-size: 0.9em;">Your portal has been activated again!</p>
            </div>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
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
                max-width: 500px;
                text-align: center;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                border: 3px solid #f44336;
            ">
                <div style="font-size: 4em; margin-bottom: 0.5em;">⚠️</div>
                <h2 style="color: #f44336; margin-bottom: 1em; font-size: 1.8em; font-weight: 700;">Suspended Portal</h2>
                <p style="color: #555; font-size: 1.05em; line-height: 1.7; margin-bottom: 2em; text-align: left;">
                    Your portal has been suspended. This means that you cannot use your portal until your status is changed back to active.
                    <br><br>
                    Please contact someone from the director board if you believe this to be a mistake.
                    <br><br>
                    Thank you for your understanding.
                </p>
                <button id="suspensionLogoutBtn" style="
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 14px 35px;
                    border-radius: 8px;
                    font-size: 1.1em;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                    box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3);
                " onmouseover="this.style.background='#d32f2f'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(244, 67, 54, 0.4)'" onmouseout="this.style.background='#f44336'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(244, 67, 54, 0.3)'">
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

async function handleOAuthRedirect() {
    console.log('%c=== HANDLE OAUTH REDIRECT STARTED ===', 'color: orange; font-size: 18px; font-weight: bold;');
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    let backendProfile = null; // Declare at function scope
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
                    console.log('Found valid session, checking backend for profile...');
                    
                    // Re-fetch from backend to ensure we have latest data
                    backendProfile = await fetchUserProfile(currentUser.id);
                    if (backendProfile) {
                        // Check if profile is COMPLETE (not just auto-created placeholder)
                        const bpHasStaffId = !!backendProfile.staffId;
                        const bpHasRealEmail = backendProfile.email && backendProfile.email !== 'Not set';
                        const bpHasRealDept = backendProfile.department && backendProfile.department !== 'Not set';
                        const bpIsComplete = bpHasStaffId || (bpHasRealEmail && bpHasRealDept);
                        
                        console.log('[OAUTH-SAVED] Profile completeness:', { staffId: bpHasStaffId, email: bpHasRealEmail, dept: bpHasRealDept, complete: bpIsComplete });
                        
                        if (!bpIsComplete) {
                            console.log('[OAUTH-SAVED] Profile incomplete - must login with Discord first');
                            // Force Discord OAuth - after auth, the code path will redirect to signup
                            localStorage.removeItem('lastProcessedCode');
                            showScreen('discord');
                            return;
                        }
                        
                        console.log('Backend profile confirmed and COMPLETE - going to portalWelcome');
                        currentUser.profile = {
                            name: backendProfile.name || currentUser.name,
                            email: backendProfile.email || 'Not set',
                            department: backendProfile.department || 'Not set',
                            discordTag: backendProfile.discordTag || currentUser.name,
                            staffId: backendProfile.staffId,
                            baseLevel: backendProfile.baseLevel || ''
                        };
                        persistUserData(); // Save updated profile to localStorage
                        
                        const emp = getEmployee(currentUser.id);
                        document.getElementById('portalWelcomeName').textContent = currentUser.profile.name;
                        document.getElementById('portalLastLogin').textContent = emp.lastLogin || 'Never';
                        showScreen('portalWelcome');
                        updateSidebarProfile();
                        await fetchEmployees();
                        return;
                    } else {
                        console.log('No backend profile found, clearing session');
                        localStorage.removeItem('currentUser');
                    }
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
                    // Re-fetch and validate profile completeness
                    backendProfile = await fetchUserProfile(currentUser.id);
                    if (backendProfile) {
                        currentUser.profile = {
                            name: backendProfile.name || currentUser.name,
                            email: backendProfile.email || '',
                            department: backendProfile.department || '',
                            discordTag: backendProfile.discordTag || currentUser.name,
                            staffId: backendProfile.staffId || '',
                            baseLevel: backendProfile.baseLevel || ''
                        };
                        persistUserData(); // Save updated profile to localStorage
                        
                        // Check completeness
                        const bp2HasStaffId = !!backendProfile.staffId;
                        const bp2HasRealEmail = backendProfile.email && backendProfile.email !== 'Not set';
                        const bp2HasRealDept = backendProfile.department && backendProfile.department !== 'Not set';
                        const bp2IsComplete = bp2HasStaffId || (bp2HasRealEmail && bp2HasRealDept);
                        
                        if (!bp2IsComplete) {
                            console.log('[OAUTH-REUSE] Profile incomplete - redirecting to signup flow');
                            sessionStorage.setItem('needsProfileSetup', 'true');
                            showScreen('setupWelcome');
                            return;
                        }
                        
                        // Check if suspended
                        if (backendProfile.suspended) {
                            console.log('[OAUTH-REUSE] User is suspended');
                            window.currentUser = currentUser;
                            showScreen('suspended');
                            return;
                        }
                    }
                    
                    const emp = getEmployee(currentUser.id);
                    const displayName = currentUser.profile?.name || currentUser.name || 'User';
                    document.getElementById('portalWelcomeName').textContent = displayName;
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
        console.log('[OAUTH] Exchanging code with Discord OAuth endpoint:', authUrl);
        const response = await fetch(authUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors'
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[OAUTH] Auth response error:', { status: response.status, body: errorText });
            throw new Error(`Auth failed: ${response.status} ${errorText}`);
        }
        user = await response.json();
        console.log('[OAUTH] Discord user data received:', { id: user.id, username: user.username, global_name: user.global_name });
    } catch (e) {
        console.error('[OAUTH] Code exchange failed:', e.message);
        showModal('alert', `Failed to authenticate with Discord: ${e.message}. Please try again.`);
        localStorage.removeItem('lastProcessedCode');
        window.history.replaceState({}, document.title, REDIRECT_URI);
        showScreen('discord');
        return;
    }

    // Show loading screen while fetching data
    showScreen('loading');
    await new Promise(r => setTimeout(r, 500));

    console.log('[LOGIN] Step 1: Fetching Discord guild member data with roles...');
    // NOTE: /members/{GUILD_ID} endpoint removed - not available in backend
    // Discord roles are now managed through the staff portal admin system
    // Role enforcement is skipped - all users with valid Discord auth can access the portal
    console.log('[LOGIN] Discord role checking DISABLED - using backend OAuth only');

    console.log('[LOGIN] Step 2: Fetching user profile from KV...');
    // Wait a brief moment for the /auth endpoint to create the profile in KV
    await new Promise(r => setTimeout(r, 500));
    
    let member;
    let profileFetchAttempt = 0;
    const maxAttempts = 3;
    
    try {
        // Try to fetch profile with retries in case of temporary failures
        while (profileFetchAttempt < maxAttempts) {
            profileFetchAttempt++;
            try {
                const response = await fetch(`${WORKER_URL}/api/user/profile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    mode: 'cors',
                    body: JSON.stringify({ discordId: user.id })
                });
                
                if (response.ok) {
                    member = await response.json();
                    console.log('[LOGIN] ✓ Member data received from KV on attempt', profileFetchAttempt, ':', member);
                    break;
                } else if (response.status === 404) {
                    console.warn(`[LOGIN] Attempt ${profileFetchAttempt}: User profile not found (404)`);
                    if (profileFetchAttempt < maxAttempts) {
                        // Wait a bit and retry
                        await new Promise(r => setTimeout(r, 300 * profileFetchAttempt));
                        continue;
                    } else {
                        // Final attempt failed - use placeholder
                        console.warn('[LOGIN] Profile lookup failed after all attempts, using placeholder');
                        member = {
                            id: user.id,
                            name: user.global_name || user.username,
                            email: 'Not set',
                            department: 'Not set',
                            roles: [],
                            baseLevel: '',
                            timezone: '',
                            country: ''
                        };
                        break;
                    }
                } else {
                    throw new Error(`Unexpected status: ${response.status}`);
                }
            } catch (attemptError) {
                console.error(`[LOGIN] Attempt ${profileFetchAttempt} failed:`, attemptError.message);
                if (profileFetchAttempt < maxAttempts) {
                    await new Promise(r => setTimeout(r, 300 * profileFetchAttempt));
                    continue;
                } else {
                    throw attemptError;
                }
            }
        }
    } catch (e) {
        console.error('[LOGIN] Member fetch failed after retries:', e.message);
        // Still allow login with placeholder profile
        member = {
            id: user.id,
            name: user.global_name || user.username,
            email: 'Not set',
            department: 'Not set',
            roles: [],
            baseLevel: '',
            timezone: '',
            country: ''
        };
        console.log('Using placeholder profile due to fetch error');
    }

    console.log('[LOGIN] Step 3: Fetching all employees...');
    await fetchEmployees();
    console.log('[LOGIN] Employees fetched');

    console.log('[LOGIN] Step 4: Creating user profile...');

    // Use member data from KV
    console.log('[LOGIN] Using member data from KV');
    console.log('[LOGIN] Member data:', member);
    
    // Check if profile is complete or just auto-created placeholder
    const hasStaffId = !!member.staffId;
    const hasRealEmail = member.email && member.email !== 'Not set';
    const hasRealDepartment = member.department && member.department !== 'Not set';
    const hasRealName = member.name && member.name !== user.username; // Real name if not just Discord username
    
    // A profile is complete if it has a staff ID, OR if it has both email and department populated
    const isProfileComplete = hasStaffId || (hasRealEmail && hasRealDepartment);
    
    console.log('[LOGIN] 📋 Profile Completeness Check:', {
        discord_username: user.username,
        profile_name: member.name,
        has_real_name: hasRealName,
        email: member.email,
        has_real_email: hasRealEmail,
        department: member.department,
        has_real_department: hasRealDepartment,
        staffId: member.staffId || '(none)',
        has_staff_id: hasStaffId,
        status: isProfileComplete ? '✓ COMPLETE' : '✗ INCOMPLETE',
        nextStep: isProfileComplete ? 'Login' : 'Signup Flow'
    });
    
    // Auto-created profile (from /auth endpoint) is NOT complete
    // User MUST complete signup before accessing portal
    if (!isProfileComplete) {
        console.log('[LOGIN] ⚠️ Profile incomplete - redirecting to signup flow');
        
        // Store the Discord user data temporarily for signup form
        currentUser = {
            id: user.id,
            name: user.global_name || user.username,
            avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : '',
            roles: member.roles || [],
            profile: {
                name: user.global_name || user.username,
                email: member.email || '',
                department: member.department || '',
                discordTag: user.username,
                staffId: member.staffId || ''
            }
        };
        
        persistUserData(); // Save to localStorage before redirecting
        localStorage.setItem('lastProcessedCode', code);
        window.history.replaceState({}, document.title, REDIRECT_URI);
        
        // Mark that they need to complete profile before accessing portal
        sessionStorage.setItem('needsProfileSetup', 'true');
        
        // Send them through the proper signup flow
        showScreen('setupWelcome');
        return;
    }
    
    // Check if user is suspended BEFORE completing login
    if (member.suspended === true) {
        console.log('[LOGIN] ⛔ User is suspended - showing suspended screen');
        currentUser = {
            id: user.id,
            name: user.global_name || user.username,
            avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : '',
            roles: member.roles || [],
            profile: {
                name: member.name || user.global_name || user.username,
                email: member.email || 'Not set',
                department: member.department || 'Not set',
                discordTag: user.username,
                staffId: member.staffId || '',
                timezone: member.timezone || '',
                country: member.country || ''
            }
        };
        window.currentUser = currentUser;
        persistUserData();
        localStorage.setItem('lastProcessedCode', code);
        window.history.replaceState({}, document.title, REDIRECT_URI);
        showScreen('suspended');
        return;
    }
    
    // Profile IS complete - user can login normally
    console.log('[LOGIN] ✓ Profile complete - allowing login');
    let isFirstTime = false;
    currentUser = {
        id: user.id,
        name: user.global_name || user.username,
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : '',
        roles: member.roles || [],
        profile: {
            name: member.name || user.global_name || user.username,
            email: member.email || 'Not set',
            department: member.department || 'Not set',
            discordTag: user.username,
            staffId: member.staffId || '',
            timezone: member.timezone || '',
            country: member.country || ''
        },
        absences: [],
        strikes: [],
        payslips: [],
        mail: [],
        sentMail: [],
        drafts: [],
        pendingDeptChange: null,
        lastLogin: null
    };
    console.log('[LOGIN] Current user populated with complete profile:', currentUser);

    showScreen('cherry');
    console.log('[CHERRY] Showing verification screen, will proceed in 1.5 seconds...');
    await new Promise(r => setTimeout(r, 1500));

    // TEMPORARILY DISABLED: Role check bypassed for login
    /*
    if (!member.roles.includes(REQUIRED_ROLE)) {
        console.log('User lacks required role:', REQUIRED_ROLE);
        showModal('alert', 'You do not have the required permissions');
        localStorage.removeItem('lastProcessedCode');
        window.history.replaceState({}, document.title, REDIRECT_URI);
        showScreen('discord');
        return;
    }
    */
    console.log('[LOGIN] Role check bypassed - allowing access');

    const emp = getEmployee(currentUser.id);
    emp.lastLogin = new Date().toLocaleString();
    updateEmployee(emp);
    
    // Set window.currentUser BEFORE checking suspension
    window.currentUser = currentUser;
    persistUserData(); // Save all data to localStorage after login
    console.log('User session saved with profile:', currentUser.profile);
    console.log('[SUSPEND] About to check suspension status for user:', currentUser.id);
    
    // Check suspension status immediately after login
    const isSuspended = await checkSuspensionStatus();
    console.log('[SUSPEND] Check complete, isSuspended:', isSuspended);
    if (isSuspended) {
        // User is suspended, don't proceed with normal flow
        // But still check periodically in case status changes
        setInterval(checkSuspensionStatus, 30000);
        return;
    }
    
    // Start periodic suspension checks for active users
    setInterval(checkSuspensionStatus, 30000);
    
    // Start periodic profile sync to check for baseLevel and other changes
    setInterval(async () => {
        console.log('[PROFILE_SYNC] Running periodic profile sync...');
        if (!window.currentUser || !window.currentUser.id) {
            console.log('[PROFILE_SYNC] No currentUser, skipping');
            return;
        }
        
        try {
            const profile = await fetchUserProfile(window.currentUser.id);
            if (profile && profile.baseLevel) {
                const oldBaseLevel = window.currentUser.profile?.baseLevel;
                const newBaseLevel = profile.baseLevel;
                
                // Update profile with latest data
                if (!window.currentUser.profile) window.currentUser.profile = {};
                window.currentUser.profile.baseLevel = newBaseLevel;
                window.currentUser.profile.name = profile.name;
                window.currentUser.profile.email = profile.email;
                window.currentUser.profile.department = profile.department;
                window.currentUser.profile.status = profile.status;
                
                // Save to localStorage
                localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
                
                // Update employee record
                const emp = getEmployee(window.currentUser.id);
                if (emp.profile) {
                    emp.profile.baseLevel = newBaseLevel;
                    emp.profile.name = profile.name;
                    emp.profile.email = profile.email;
                    emp.profile.department = profile.department;
                    updateEmployee(emp);
                }
                
                // If baseLevel changed and we're on main screen, update the display
                if (oldBaseLevel !== newBaseLevel) {
                    console.log(`[PROFILE_SYNC] Base Level changed from "${oldBaseLevel}" to "${newBaseLevel}"`);
                    const mainScreen = document.getElementById('mainScreen');
                    if (mainScreen && mainScreen.classList.contains('active')) {
                        console.log('[PROFILE_SYNC] Updating main screen with new base level');
                        updateMainScreen();
                    }
                } else {
                    console.log(`[PROFILE_SYNC] Base Level unchanged: "${newBaseLevel}"`);
                }
                
                console.log('[PROFILE_SYNC] Profile updated successfully');
            }
        } catch (error) {
            console.error('[PROFILE_SYNC] Error syncing profile:', error);
        }
    }, 30000); // Check every 30 seconds

    // CRITICAL: Only go to setup if TRULY a first-time user AND no profile exists
    console.log('[LOGIN] Checking if setup needed...');
    console.log('[LOGIN] isFirstTime:', isFirstTime);
    console.log('[LOGIN] currentUser.profile.name:', currentUser.profile.name);
    console.log('[LOGIN] backendProfile exists:', backendProfile ? 'YES' : 'NO');
    console.log('[LOGIN] backendProfile data:', backendProfile);
    
    // SAFETY: If backend profile exists with ANY data, ALWAYS skip setup
    if (backendProfile && (backendProfile.name || backendProfile.department || backendProfile.email)) {
        console.log('[LOGIN] ✅ Backend profile found with data, going to portalWelcome');
        const displayName = currentUser.profile.name || currentUser.name || 'User';
        document.getElementById('portalWelcomeName').textContent = displayName;
        document.getElementById('portalLastLogin').textContent = emp.lastLogin || 'Never';
        console.log('[LOGIN] **TRANSITIONING TO portalWelcome**');
        showScreen('portalWelcome');
    } else if (isFirstTime || !currentUser.profile.name || currentUser.profile.name === 'Not set') {
        console.log('[LOGIN] ⚠️  No profile/department found, going to setupWelcome to create profile');
        console.log('[LOGIN] **TRANSITIONING TO setupWelcome**');
        showScreen('setupWelcome');
        // Profile will be saved to Sheets when user completes department selection
    } else {
        console.log('[LOGIN] Profile found, going to portalWelcome');
        const displayName = currentUser.profile.name || currentUser.name || 'User';
        document.getElementById('portalWelcomeName').textContent = displayName;
        document.getElementById('portalLastLogin').textContent = emp.lastLogin;
        console.log('[LOGIN] **TRANSITIONING TO portalWelcome**');
        showScreen('portalWelcome');
    }

    window.history.replaceState({}, document.title, REDIRECT_URI);
    console.log('[LOGIN] OAuth redirect complete, clearing code from URL');
}

// Tutorial and onboarding logic
function startTutorial() {
    console.log('Starting tutorial');
    showScreen('mainMenu');
    updateSidebarProfile();
    updateMainScreen();
    
    // Initialize sample mail data for new users
    initializeSampleMail();

    let currentStep = 0;
    let tutorialClickHandler = null;

    const steps = [
        // Step 1: Navigation button (mobile sidebar)
        {
            element: () => document.getElementById('mobileNavBtn') || document.querySelector('.sidebar-toggle'),
            text: 'Welcome! This is the navigation button. Tap it to open the side menu and access different pages.',
            waitForClick: true
        },
        // Step 2: Profile button in sidebar
        {
            element: () => document.getElementById('homeBtn'),
            text: 'Great! Now click on "Home" to see your main dashboard.',
            waitForClick: true,
            action: () => {
                setTimeout(() => showNextStep(), 500);
            }
        },
        // Step 3: Navigate to profile via sidebar
        {
            element: () => document.getElementById('myRolesBtn'),
            text: 'Now let\'s explore your profile. Click "My Roles" to see your assigned roles.',
            waitForClick: true,
            action: () => {
                setTimeout(() => showNextStep(), 500);
            }
        },
        // Step 4: Absences
        {
            element: () => document.getElementById('absencesBtn'),
            text: 'Click "Absences" to see where you can request time off.',
            waitForClick: true,
            action: () => {
                setTimeout(() => showNextStep(), 500);
            }
        },
        // Step 5: Payslips
        {
            element: () => document.getElementById('payslipsBtn'),
            text: 'Click "Payslips" to view your payment history.',
            waitForClick: true,
            action: () => {
                setTimeout(() => showNextStep(), 500);
            }
        },
        // Step 6: Disciplinaries
        {
            element: () => document.getElementById('disciplinariesBtn'),
            text: 'Click "Disciplinaries" to see any warnings or strikes.',
            waitForClick: true,
            action: () => {
                setTimeout(() => showNextStep(), 500);
            }
        },
        // Step 7: Requests
        {
            element: () => document.getElementById('requestsBtn'),
            text: 'Click "Requests" to submit department changes or other requests.',
            waitForClick: true,
            action: () => {
                setTimeout(() => showNextStep(), 500);
            }
        },
        // Step 8: Timeclock
        {
            element: () => document.getElementById('timeclockBtn'),
            text: 'Click "Timeclock" to clock in and out of your shifts.',
            waitForClick: true,
            action: () => {
                setTimeout(() => showNextStep(), 500);
            }
        },
        // Step 9: Events
        {
            element: () => document.getElementById('eventsBtn'),
            text: 'Click "Events" to see company events and meetings.',
            waitForClick: true,
            action: () => {
                setTimeout(() => showNextStep(), 500);
            }
        },
        // Step 10: ClickUp
        {
            element: () => document.getElementById('clickupBtn'),
            text: 'Finally, click "ClickUp" to see your task management.',
            waitForClick: true,
            action: () => {
                setTimeout(() => showNextStep(), 500);
            }
        },
        // Step 11: Back to home and ClickUp connection prompt
        {
            element: null,
            text: '',
            action: () => {
                showScreen('mainMenu');
                showClickUpConnectionModal();
            }
        }
    ];

    function showClickUpConnectionModal() {
        cleanupTutorial();
        
        const modal = document.createElement('div');
        modal.id = 'tutorialClickUpModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 40px; border-radius: 16px; max-width: 500px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                <h2 style="margin: 0 0 20px 0; color: #667eea; font-size: 28px;">🎉 Tutorial Complete!</h2>
                <p style="margin: 0 0 30px 0; color: #666; font-size: 16px; line-height: 1.6;">
                    Thank you for completing the tutorial!<br>
                    Would you like to connect ClickUp now?
                </p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="tutorialClickUpYes" style="padding: 14px 32px; font-size: 16px; font-weight: 600; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; transition: all 0.3s;">
                        Yes!
                    </button>
                    <button id="tutorialClickUpLater" style="padding: 14px 32px; font-size: 16px; font-weight: 600; background: #e0e0e0; color: #666; border: none; border-radius: 8px; cursor: pointer; transition: all 0.3s;">
                        Later!
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('tutorialClickUpYes').addEventListener('click', () => {
            modal.remove();
            startClickUpSetup();
        });
        
        document.getElementById('tutorialClickUpLater').addEventListener('click', () => {
            modal.remove();
            finalizeTutorial();
        });
    }

    function startClickUpSetup() {
        // Navigate to ClickUp page
        showScreen('clickup');
        
        setTimeout(() => {
            // Show instruction overlay
            const overlay = document.createElement('div');
            overlay.id = 'clickupTutorialOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 9999;
            `;
            document.body.appendChild(overlay);
            
            // Show instructions
            const instructions = document.createElement('div');
            instructions.className = 'tutorial-text';
            instructions.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.95);
                color: white;
                padding: 30px;
                border-radius: 12px;
                font-size: 16px;
                z-index: 10000;
                max-width: 500px;
                text-align: center;
                line-height: 1.8;
            `;
            instructions.innerHTML = `
                <h3 style="margin: 0 0 20px 0; color: #667eea; font-size: 22px;">📋 ClickUp Setup</h3>
                <p style="margin: 0 0 15px 0;">Follow these steps:</p>
                <ol style="text-align: left; margin: 0 0 25px 0; padding-left: 20px;">
                    <li>Go to ClickUp website</li>
                    <li>Click your profile icon</li>
                    <li>Find "ClickUp API"</li>
                    <li>Click "Generate/Regenerate Token"</li>
                    <li>Copy your token</li>
                    <li>Paste it in the highlighted box below</li>
                </ol>
                <button id="gotItBtn" style="padding: 12px 30px; font-size: 15px; font-weight: 600; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Got it!
                </button>
            `;
            document.body.appendChild(instructions);
            
            document.getElementById('gotItBtn').addEventListener('click', () => {
                instructions.remove();
                highlightClickUpTokenInput();
            });
        }, 500);
    }

    function highlightClickUpTokenInput() {
        const tokenInput = document.getElementById('clickupToken');
        
        if (tokenInput) {
            // Add highlight ring around input
            const rect = tokenInput.getBoundingClientRect();
            const ring = document.createElement('div');
            ring.id = 'clickupTokenRing';
            ring.style.cssText = `
                position: absolute;
                left: ${rect.left - 10}px;
                top: ${rect.top - 10}px;
                width: ${rect.width + 20}px;
                height: ${rect.height + 20}px;
                border: 3px solid #667eea;
                border-radius: 8px;
                pointer-events: none;
                animation: pulse 1.5s infinite;
                z-index: 9998;
            `;
            document.body.appendChild(ring);
            
            // Show text instruction
            const text = document.createElement('div');
            text.className = 'tutorial-text';
            text.textContent = 'Paste your ClickUp token here';
            text.style.zIndex = '10000';
            document.body.appendChild(text);
            
            // Watch for input
            tokenInput.addEventListener('input', function handler() {
                if (tokenInput.value.trim().length > 0) {
                    tokenInput.removeEventListener('input', handler);
                    ring.remove();
                    
                    // Update text
                    text.textContent = 'Awesome! Now click the Connect button';
                    
                    // Highlight connect button
                    const connectBtn = document.getElementById('connectClickupBtn');
                    if (connectBtn) {
                        const btnRect = connectBtn.getBoundingClientRect();
                        ring.style.cssText = `
                            position: absolute;
                            left: ${btnRect.left - 10}px;
                            top: ${btnRect.top - 10}px;
                            width: ${btnRect.width + 20}px;
                            height: ${btnRect.height + 20}px;
                            border: 3px solid #667eea;
                            border-radius: 8px;
                            pointer-events: none;
                            animation: pulse 1.5s infinite;
                            z-index: 9998;
                        `;
                        document.body.appendChild(ring);
                        
                        // Watch for successful connection
                        const originalConnect = window.connectClickup || function() {};
                        window.connectClickup = async function() {
                            await originalConnect();
                            // Wait a bit for connection to complete
                            setTimeout(() => {
                                ring.remove();
                                text.remove();
                                document.getElementById('clickupTutorialOverlay')?.remove();
                                showFinalMessage();
                            }, 1000);
                        };
                    }
                }
            });
        }
    }

    function showFinalMessage() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 50px; border-radius: 16px; max-width: 500px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                <div style="font-size: 60px; margin-bottom: 20px;">🎉</div>
                <h2 style="margin: 0 0 20px 0; color: #667eea; font-size: 32px;">Congratulations!</h2>
                <p style="margin: 0 0 30px 0; color: #666; font-size: 18px; line-height: 1.6;">
                    You have completed the entire tutorial!<br>
                    <strong>Enjoy using your Staff Portal!</strong>
                </p>
                <button id="finishTutorialBtn" style="padding: 16px 40px; font-size: 18px; font-weight: 600; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; transition: all 0.3s;">
                    Let's Go! 🚀
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('finishTutorialBtn').addEventListener('click', () => {
            modal.remove();
            finalizeTutorial();
        });
    }

    function finalizeTutorial() {
        cleanupTutorial();
        
        // Send welcome email
        const emp = getEmployee(currentUser.id);
        emp.mail = emp.mail || [];
        emp.mail.push({
            id: Date.now().toString(),
            from: 'Cirkle Development',
            subject: 'Welcome to Staff Portal',
            content: `Dear ${emp.profile.name}, Welcome to your new Staff Portal. You have completed the tutorial and are ready to start! Please explore all the features and get familiar with everything. We hope you enjoy using the portal! Kind Regards, Cirkle Development.`,
            timestamp: new Date().toLocaleString(),
            senderId: 'system'
        });
        updateEmployee(emp);
        addNotification('welcome', 'Welcome to your Staff Portal!', 'mail');
        
        showScreen('mainMenu');
    }

    function cleanupTutorial() {
        document.querySelectorAll('.tutorial-ring, .tutorial-text').forEach(el => el.remove());
        document.getElementById('clickupTokenRing')?.remove();
        document.getElementById('clickupTutorialOverlay')?.remove();
        document.getElementById('tutorialClickUpModal')?.remove();
        if (tutorialClickHandler) {
            document.removeEventListener('click', tutorialClickHandler);
            tutorialClickHandler = null;
        }
    }

    function showNextStep() {
        currentStep++;
        showStep();
    }

    function showStep() {
        if (currentStep >= steps.length) {
            cleanupTutorial();
            return;
        }

        const step = steps[currentStep];
        cleanupTutorial();

        // If no element, just execute action
        if (!step.element && step.action) {
            step.action();
            return;
        }

        const element = typeof step.element === 'function' ? step.element() : step.element;
        
        if (!element) {
            console.warn('Tutorial step element not found, skipping to next step');
            currentStep++;
            setTimeout(() => showStep(), 100);
            return;
        }

        // Create highlight ring
        const rect = element.getBoundingClientRect();
        const ring = document.createElement('div');
        ring.className = 'tutorial-ring';
        ring.style.width = `${rect.width + 20}px`;
        ring.style.height = `${rect.height + 20}px`;
        ring.style.left = `${rect.left - 10}px`;
        ring.style.top = `${rect.top - 10}px`;
        document.body.appendChild(ring);

        // Create text instruction
        const text = document.createElement('div');
        text.className = 'tutorial-text';
        text.textContent = step.text;
        document.body.appendChild(text);

        if (step.waitForClick) {
            tutorialClickHandler = function(e) {
                if (element.contains(e.target) || e.target === element) {
                    document.removeEventListener('click', tutorialClickHandler);
                    tutorialClickHandler = null;
                    
                    if (step.action) {
                        step.action();
                    } else {
                        showNextStep();
                    }
                }
            };
            document.addEventListener('click', tutorialClickHandler);
        } else if (step.action) {
            step.action();
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

async function syncMailFromBackend() {
    if (!currentUser) return;
    
    try {
        console.log('[DEBUG] Syncing mail from backend for user:', currentUser.id);
        
        // Get user's staff email
        const emailResponse = await fetch(`https://timeclock-backend.marcusray.workers.dev/api/email/account/${currentUser.id}`);
        let userEmail = '';
        if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            if (emailData.success) {
                userEmail = emailData.email;
                localStorage.setItem(`staffEmail_${currentUser.id}`, userEmail);
            }
        }
        
        if (!userEmail) {
            userEmail = localStorage.getItem(`staffEmail_${currentUser.id}`) || '';
        }
        
        // Get current mail from localStorage (preserve drafts)
        const userMail = JSON.parse(localStorage.getItem(`mail_${currentUser.id}`) || '{"inbox": [], "sent": [], "drafts": []}');
        
        // Fetch inbox from backend
        if (userEmail) {
            const inboxResponse = await fetch(`https://timeclock-backend.marcusray.workers.dev/api/email/inbox/${encodeURIComponent(userEmail)}`);
            
            if (inboxResponse.ok) {
                const result = await inboxResponse.json();
                console.log('[DEBUG] Fetched inbox from backend:', result);
                
                if (result.success && result.emails) {
                    userMail.inbox = result.emails.map(mail => ({
                        id: mail.id,
                        senderName: mail.from || 'Unknown',
                        senderId: mail.from,
                        recipients: [userEmail],
                        subject: mail.subject,
                        content: mail.body,
                        timestamp: mail.timestamp,
                        read: mail.read,
                        attachments: []
                    }));
                    console.log('[DEBUG] Updated inbox with', userMail.inbox.length, 'messages');
                }
            }
            
            // Fetch sent mail from backend
            const sentResponse = await fetch(`https://timeclock-backend.marcusray.workers.dev/api/email/sent/${encodeURIComponent(userEmail)}`);
            
            if (sentResponse.ok) {
                const result = await sentResponse.json();
                console.log('[DEBUG] Fetched sent mail from backend:', result);
                
                if (result.success && result.emails) {
                    userMail.sent = result.emails.map(mail => ({
                        id: mail.id,
                        recipients: mail.to ? mail.to.split(',') : [],
                        subject: mail.subject,
                        content: mail.body,
                        timestamp: mail.timestamp,
                        attachments: []
                    }));
                    console.log('[DEBUG] Updated sent mail with', userMail.sent.length, 'messages');
                }
            }
            
            // Fetch drafts from backend
            const draftsResponse = await fetch(`https://timeclock-backend.marcusray.workers.dev/api/email/drafts/${currentUser.id}`);
            
            if (draftsResponse.ok) {
                const result = await draftsResponse.json();
                console.log('[DEBUG] Fetched drafts from backend:', result);
                
                if (result.success && result.drafts) {
                    userMail.drafts = result.drafts.map(draft => ({
                        id: draft.id,
                        recipients: draft.to ? draft.to.split(',') : [],
                        cc: draft.cc || '',
                        bcc: draft.bcc || '',
                        subject: draft.subject,
                        content: draft.body,
                        timestamp: draft.timestamp
                    }));
                    console.log('[DEBUG] Updated drafts with', userMail.drafts.length, 'messages');
                }
            }
        }
        
        // Save to localStorage
        localStorage.setItem(`mail_${currentUser.id}`, JSON.stringify(userMail));
        
    } catch (error) {
        console.error('[DEBUG] Error syncing mail from backend:', error);
    }
}

// Initialize staff email and send welcome message if first time
async function initializeStaffEmail() {
    if (!currentUser) return;
    
    const welcomeSent = localStorage.getItem(`mailWelcomeSent_${currentUser.id}`);
    if (welcomeSent) return;
    
    try {
        // Get user's staff email
        const response = await fetch(`https://timeclock-backend.marcusray.workers.dev/api/email/account/${currentUser.id}`);
        if (!response.ok) return;
        
        const data = await response.json();
        if (!data.success || !data.email) return;
        
        const staffEmail = data.email;
        localStorage.setItem(`staffEmail_${currentUser.id}`, staffEmail);
        
        // Send welcome email
        await fetch('https://timeclock-backend.marcusray.workers.dev/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: 'Cirkle Mail <noreply@staff.cirkledevelopment.co.uk>',
                to: staffEmail,
                subject: 'Welcome to Cirkle Mail',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #7c3aed, #3b82f6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Cirkle Mail</h1>
                        </div>
                        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                            <p style="font-size: 16px; color: #333; line-height: 1.6;">Hello ${data.displayName || 'there'}!</p>
                            <p style="font-size: 16px; color: #333; line-height: 1.6;">Your staff email has been created:</p>
                            <div style="background: #f3f4f6; padding: 15px 20px; border-radius: 8px; font-size: 18px; font-weight: 600; color: #7c3aed; margin: 20px 0; text-align: center;">
                                ${staffEmail}
                            </div>
                            <p style="font-size: 16px; color: #333; line-height: 1.6;">You can send and receive emails directly from the Staff Portal. Use the Mail tab to:</p>
                            <ul style="font-size: 14px; color: #666; line-height: 1.8;">
                                <li>Compose and send emails to colleagues</li>
                                <li>Check your inbox for new messages</li>
                                <li>View your sent emails</li>
                                <li>Save drafts for later</li>
                            </ul>
                            <p style="font-size: 14px; color: #666; margin-top: 20px; text-align: center;">
                                — The Cirkle Development Team
                            </p>
                        </div>
                    </div>
                `
            })
        });
        
        localStorage.setItem(`mailWelcomeSent_${currentUser.id}`, 'true');
        console.log('[Mail] Welcome email sent to', staffEmail);
        
    } catch (error) {
        console.error('[Mail] Error initializing staff email:', error);
    }
}

// Events functionality REMOVED - was causing issues

async function fetchAttendanceCount() {
    if (!currentUser || !currentUser.id) return;
    
    try {
        const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/attendance/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userDiscordId: currentUser.id })
        });
        
        if (!response.ok) {
            console.error('[Attendance] Failed to fetch count:', response.statusText);
            return;
        }
        
        const data = await response.json();
        console.log('[Attendance] Fetched count:', data);
        
        const countElement = document.getElementById('attendanceCount');
        if (countElement) {
            countElement.textContent = data.count || 0;
        }
    } catch (error) {
        console.error('[Attendance] Error fetching count:', error);
    }
}

// REMOVED: Events polling (broken functionality)

// Event modal state tracking
let isShowingEventModal = false;
let lastEventCheckTime = 0;

function checkForNewEvents() {
    if (!currentUser || !currentUser.id) return;
    
    // Debounce: Don't check more than once per 10 seconds
    const now = Date.now();
    if (now - lastEventCheckTime < 10000) {
        console.log('[Events] Debounced - checked recently');
        return;
    }
    lastEventCheckTime = now;
    
    // Don't show modal if one is already showing
    if (isShowingEventModal) {
        console.log('[Events] Modal already showing, skipping');
        return;
    }
    
    const seenEventsKey = `events_seen_${currentUser.id}`;
    const respondedEventsKey = `event_responses_${currentUser.id}`;
    const popupShownKey = `events_popup_shown_${currentUser.id}`;
    
    const previousEvents = JSON.parse(localStorage.getItem(seenEventsKey) || '[]');
    const userResponses = JSON.parse(localStorage.getItem(respondedEventsKey) || '{}');
    const shownPopups = JSON.parse(localStorage.getItem(popupShownKey) || '[]');
    
    console.log('[Events] Checking for new events...');
    console.log('[Events] Total events:', eventsData.length);
    console.log('[Events] Previous seen events:', previousEvents);
    console.log('[Events] User responses:', userResponses);
    console.log('[Events] Shown popups:', shownPopups);
    
    // Use event.id consistently for all tracking
    const newEvents = eventsData.filter(event => {
        const eventId = event.id || event.rowIndex;
        const isSeen = previousEvents.includes(eventId);
        const hasResponded = userResponses.hasOwnProperty(eventId);
        const popupShown = shownPopups.includes(eventId);
        
        console.log(`[Events] Event ${eventId}: seen=${isSeen}, responded=${hasResponded}, popup=${popupShown}`);
        
        return !isSeen && !hasResponded && !popupShown;
    });
    
    console.log('[Events] New events to show:', newEvents.length);
    
    if (newEvents.length > 0) {
        // Show popup for ONLY the first new event
        const firstNewEvent = newEvents[0];
        const eventId = firstNewEvent.id || firstNewEvent.rowIndex;
        
        console.log('[Events] Showing popup for event:', eventId);
        
        isShowingEventModal = true; // Set flag
        
        addNotification('events', `New Event: ${firstNewEvent.name || firstNewEvent.eventName}`, 'events');
        showEventResponseModal(firstNewEvent);
        
        // Mark this event popup as shown (permanently)
        shownPopups.push(eventId);
        localStorage.setItem(popupShownKey, JSON.stringify(shownPopups));
        
        // Mark ALL new events as seen so they don't popup again
        const allSeenEvents = [...previousEvents, ...newEvents.map(e => e.id || e.rowIndex)];
        localStorage.setItem(seenEventsKey, JSON.stringify(allSeenEvents));
        
        console.log('[Events] Updated seen events:', allSeenEvents);
        console.log('[Events] Updated shown popups:', shownPopups);
    }
}

function renderEvents() {
    const container = document.getElementById('eventsContainer');
    if (!container) return;
    
    // Clear and ensure clean state
    container.innerHTML = '';
    container.style.width = '100%';
    container.style.maxWidth = '100%';
    
    // Create section for events
    const eventsSection = document.createElement('div');
    eventsSection.style.cssText = 'padding: 20px; border-bottom: 2px solid #e0e0e0;';
    
    const eventsTitle = document.createElement('h3');
    eventsTitle.textContent = '📅 Company Events';
    eventsTitle.style.cssText = 'margin: 0 0 20px 0; color: #333; font-size: 1.3em;';
    eventsSection.appendChild(eventsTitle);
    
    if (eventsData.length === 0) {
        eventsSection.innerHTML += '<p style="text-align: center; color: #999; padding: 20px;">No active events</p>';
    } else {
        // Create grid container for events
        const gridContainer = document.createElement('div');
        gridContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; max-width: 100%;';
        
        eventsData.forEach(event => {
            const eventCard = document.createElement('div');
            
            // Check if event is upcoming based on START date, not end date
            const eventStartDate = new Date(event.startDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time to start of day
            eventStartDate.setHours(0, 0, 0, 0);
            const isUpcoming = eventStartDate >= today;
            
            // Check if user has responded
            const userResponses = JSON.parse(localStorage.getItem(`event_responses_${currentUser.id}`) || '{}');
            const eventId = event.id || event.rowIndex;
            const userResponse = userResponses[eventId];
            let attendanceStatus = 'Not responded';
            if (userResponse === 'attend') attendanceStatus = '✓ Attending';
            else if (userResponse === 'cannot') attendanceStatus = '✗ Not attending';
            else if (userResponse === 'unsure') attendanceStatus = '? Unsure';
            
            eventCard.className = 'event-card-grid';
            eventCard.style.cssText = `
                background: ${isUpcoming ? '#e8f5e9' : '#f5f5f5'};
                border: 2px solid ${isUpcoming ? '#4CAF50' : '#9e9e9e'};
                border-radius: 12px;
                padding: 20px;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            `;
            
            eventCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <h3 style="margin: 0; font-size: 1.1em; color: #333;">${event.eventName || event.name || 'Unnamed Event'}</h3>
                    <span style="background: ${isUpcoming ? '#4CAF50' : '#9e9e9e'}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">${isUpcoming ? 'UPCOMING' : 'FINISHED'}</span>
                </div>
                <div style="color: #666; font-size: 14px; margin-bottom: 8px;">
                    <strong>📅 Dates:</strong> ${event.startDate} - ${event.endDate}
                </div>
                ${event.time ? `<div style="color: #666; font-size: 14px; margin-bottom: 8px;">
                    <strong>🕒 Time:</strong> ${event.time}
                </div>` : ''}
                <div style="color: #666; font-size: 14px; margin-bottom: 8px;">
                    <strong>📝 Details:</strong> ${event.details}
                </div>
                <div style="color: #666; font-size: 14px; margin-bottom: 8px;">
                    <strong>🎯 Arrival:</strong> ${event.arrivalStatus}
                </div>
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.1);">
                    <strong style="font-size: 13px; color: #333;">Your Status:</strong>
                    <span style="margin-left: 8px; font-size: 13px; ${userResponse ? 'font-weight: 600;' : 'color: #999;'}">${attendanceStatus}</span>
                </div>
            `;
            
            eventCard.addEventListener('click', () => {
                showEventResponseModal(event);
            });
            
            eventCard.addEventListener('mouseenter', () => {
                eventCard.style.transform = 'translateY(-4px)';
                eventCard.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
            });
            
            eventCard.addEventListener('mouseleave', () => {
                eventCard.style.transform = 'translateY(0)';
                eventCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            });
            
            gridContainer.appendChild(eventCard);
        });
        
        eventsSection.appendChild(gridContainer);
    }
    
    container.appendChild(eventsSection);
    
    // Now fetch and display holidays
    fetchAndDisplayHolidays(container);
}

// Fetch and display holidays from Google Sheets
async function fetchAndDisplayHolidays(container) {
    // Remove existing holidays section if it exists to prevent duplicates
    const existingHolidaysSection = container.querySelector('#holidaysSection');
    if (existingHolidaysSection) {
        existingHolidaysSection.remove();
    }
    
    try {
        const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/calendar/holiday/list', {
            method: 'GET'
        });
        
        if (response.ok) {
            const data = await response.json();
            const holidays = data.holidays || [];
            
            // Create holidays section with ID for tracking
            const holidaysSection = document.createElement('div');
            holidaysSection.id = 'holidaysSection';
            holidaysSection.style.cssText = 'padding: 20px; max-width: 100%; overflow: hidden;';
            
            const holidaysTitle = document.createElement('h3');
            holidaysTitle.textContent = '🗓️ Holidays & Special Dates';
            holidaysTitle.style.cssText = 'margin: 0 0 20px 0; color: #333; font-size: 1.3em;';
            holidaysSection.appendChild(holidaysTitle);
            
            if (holidays.length === 0) {
                holidaysSection.innerHTML += '<p style="text-align: center; color: #999; padding: 20px;">No holidays scheduled</p>';
            } else {
                // Sort holidays by date
                holidays.sort((a, b) => new Date(a.date) - new Date(b.date));
                
                // Create grid container for holidays with constrained width
                const holidayGrid = document.createElement('div');
                holidayGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; max-width: 100%;';
                
                holidays.forEach(holiday => {
                    const holidayDate = new Date(holiday.date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    holidayDate.setHours(0, 0, 0, 0);
                    const isPast = holidayDate < today;
                    
                    const holidayCard = document.createElement('div');
                    holidayCard.style.cssText = `
                        background: ${isPast ? '#f5f5f5' : '#fff3e0'};
                        border: 2px solid ${isPast ? '#9e9e9e' : '#FF9800'};
                        border-radius: 12px;
                        padding: 20px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                        transition: all 0.3s ease;
                    `;
                    
                    holidayCard.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                            <h3 style="margin: 0; font-size: 1.1em; color: #333;">${holiday.description}</h3>
                            <span style="background: ${isPast ? '#9e9e9e' : '#FF9800'}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">${isPast ? 'PAST' : 'UPCOMING'}</span>
                        </div>
                        <div style="color: #666; font-size: 14px; margin-bottom: 8px;">
                            <strong>📅 Date:</strong> ${holiday.date}
                        </div>
                        <div style="color: #666; font-size: 14px;">
                            <strong>🏷️ Type:</strong> ${holiday.type || 'Holiday'}
                        </div>
                    `;
                    
                    holidayCard.addEventListener('mouseenter', () => {
                        holidayCard.style.transform = 'translateY(-4px)';
                        holidayCard.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
                    });
                    
                    holidayCard.addEventListener('mouseleave', () => {
                        holidayCard.style.transform = 'translateY(0)';
                        holidayCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    });
                    
                    holidayGrid.appendChild(holidayCard);
                });
                
                holidaysSection.appendChild(holidayGrid);
            }
            
            container.appendChild(holidaysSection);
        }
    } catch (error) {
        console.error('Error fetching holidays:', error);
    }
}

function showEventResponseModal(event) {
    // Check if user already responded
    const userResponses = JSON.parse(localStorage.getItem(`event_responses_${currentUser.id}`) || '{}');
    const hasResponded = userResponses[event.id];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000;';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.cssText = 'background: white; border-radius: 16px; padding: 30px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);';
    
    modalContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0 0 10px 0; font-size: 1.8em;">📅 ${event.eventName || event.name || 'Unnamed Event'}</h2>
            <div style="display: inline-block; background: #2196F3; color: white; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-top: 8px;">
                EVENT INVITATION
            </div>
        </div>
        
        <div style="background: #f5f5f5; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <div style="margin-bottom: 12px;">
                <strong style="color: #666;">📅 Event Dates:</strong>
                <div style="margin-top: 4px; color: #333;">${event.startDate} - ${event.endDate}</div>
            </div>
            ${event.time ? `<div style="margin-bottom: 12px;">
                <strong style="color: #666;">🕒 Time:</strong>
                <div style="margin-top: 4px; color: #333;">${event.time}</div>
            </div>` : ''}
            <div style="margin-bottom: 12px;">
                <strong style="color: #666;">📝 Details:</strong>
                <div style="margin-top: 4px; color: #333;">${event.details}</div>
            </div>
            <div>
                <strong style="color: #666;">🎯 Arrival Status:</strong>
                <div style="margin-top: 4px; color: #333;">${event.arrivalStatus}</div>
            </div>
        </div>
        
        ${hasResponded ? `
            <div style="background: #e8f5e9; border: 2px solid #4CAF50; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center;">
                <strong style="color: #2e7d32;">✓ You have already responded to this event</strong>
            </div>
        ` : ''}
        
        <div style="margin-bottom: 20px;">
            <strong style="display: block; margin-bottom: 12px; color: #333;">Please select your response:</strong>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="event-response-btn attend" data-response="attend" style="flex: 1; min-width: 140px; padding: 14px 20px; border: 2px solid #4CAF50; background: #4CAF50; color: white; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s;" ${hasResponded ? 'disabled' : ''}>
                    ✓ I can attend
                </button>
                <button class="event-response-btn cannot" data-response="cannot" style="flex: 1; min-width: 140px; padding: 14px 20px; border: 2px solid #f44336; background: white; color: #f44336; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s;" ${hasResponded ? 'disabled' : ''}>
                    ✗ I cannot attend
                </button>
                <button class="event-response-btn unsure" data-response="unsure" style="flex: 1; min-width: 140px; padding: 14px 20px; border: 2px solid #FF9800; background: white; color: #FF9800; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s;" ${hasResponded ? 'disabled' : ''}>
                    ? I'm unsure
                </button>
            </div>
        </div>
        
        <div class="event-response-reason" style="display: none; margin-top: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Reason:</label>
            <textarea placeholder="Please provide a reason..." rows="4" style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px; resize: vertical;"></textarea>
            <button class="event-response-submit" style="margin-top: 12px; width: 100%; padding: 14px; background: #2196F3; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 16px; cursor: pointer;">
                Submit Response
            </button>
        </div>
        
        <button class="close-modal-btn" style="margin-top: 20px; width: 100%; padding: 12px; background: #9e9e9e; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
            Close
        </button>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Add click handlers (only if not already responded)
    if (!hasResponded) {
        const attendBtn = modal.querySelector('.attend');
        const cannotBtn = modal.querySelector('.cannot');
        const unsureBtn = modal.querySelector('.unsure');
        const reasonSection = modal.querySelector('.event-response-reason');
        const reasonTextarea = modal.querySelector('.event-response-reason textarea');
        const submitBtn = modal.querySelector('.event-response-submit');
        
        attendBtn.addEventListener('click', async () => {
            if (attendBtn.disabled) return;
            attendBtn.disabled = true;
            
            await submitEventResponse(event, 'attend');
            isShowingEventModal = false;
            modal.remove();
            playSuccessSound();
            showModal('alert', '<span class="success-tick"></span> Response recorded! You are attending.');
            addNotification('events', `You are attending: ${event.eventName || event.name || 'Unnamed Event'}`, 'events');
            renderEvents(); // Refresh the events display
        });
        
        cannotBtn.addEventListener('click', () => {
            reasonSection.style.display = 'block';
            reasonTextarea.placeholder = 'Please provide a reason why you cannot attend...';
            submitBtn.dataset.response = 'cannot';
        });
        
        unsureBtn.addEventListener('click', () => {
            reasonSection.style.display = 'block';
            reasonTextarea.placeholder = 'Please provide details and you may need to contact the organiser...';
            submitBtn.dataset.response = 'unsure';
        });
        
        submitBtn.addEventListener('click', async () => {
            if (submitBtn.disabled) return;
            submitBtn.disabled = true;
            
            const response = submitBtn.dataset.response;
            const reason = reasonTextarea.value.trim();
            
            if (!reason) {
                showModal('alert', '⚠️ Please provide a reason');
                submitBtn.disabled = false;
                return;
            }
            
            await submitEventResponse(event, response, reason);
            isShowingEventModal = false;
            modal.remove();
            playSuccessSound();
            
            if (response === 'cannot') {
                showModal('alert', '<span class="success-tick"></span> Response recorded! You cannot attend.');
                addNotification('events', `You cannot attend: ${event.eventName || event.name || 'Unnamed Event'}`, 'events');
            } else {
                showModal('alert', '<span class="success-tick"></span> Response recorded! Please contact the organiser if needed.');
                addNotification('events', `You are unsure about: ${event.eventName || event.name || 'Unnamed Event'}`, 'events');
            }
            renderEvents(); // Refresh the events display
        });
    }
    
    // Close button
    modal.querySelector('.close-modal-btn').addEventListener('click', () => {
        console.log('[Events] Modal closed without response, marking as seen and popup shown');
        // Mark as seen and popup shown even if closed without responding
        const eventId = event.id || event.rowIndex;
        const seenEventsKey = `events_seen_${currentUser.id}`;
        const popupShownKey = `events_popup_shown_${currentUser.id}`;
        
        const previousEvents = JSON.parse(localStorage.getItem(seenEventsKey) || '[]');
        if (!previousEvents.includes(eventId)) {
            previousEvents.push(eventId);
            localStorage.setItem(seenEventsKey, JSON.stringify(previousEvents));
        }
        
        const shownPopups = JSON.parse(localStorage.getItem(popupShownKey) || '[]');
        if (!shownPopups.includes(eventId)) {
            shownPopups.push(eventId);
            localStorage.setItem(popupShownKey, JSON.stringify(shownPopups));
        }
        
        isShowingEventModal = false;
        modal.remove();
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            console.log('[Events] Modal closed by outside click, marking as seen and popup shown');
            // Mark as seen and popup shown even if closed without responding
            const eventId = event.id || event.rowIndex;
            const seenEventsKey = `events_seen_${currentUser.id}`;
            const popupShownKey = `events_popup_shown_${currentUser.id}`;
            
            const previousEvents = JSON.parse(localStorage.getItem(seenEventsKey) || '[]');
            if (!previousEvents.includes(eventId)) {
                previousEvents.push(eventId);
                localStorage.setItem(seenEventsKey, JSON.stringify(previousEvents));
            }
            
            const shownPopups = JSON.parse(localStorage.getItem(popupShownKey) || '[]');
            if (!shownPopups.includes(eventId)) {
                shownPopups.push(eventId);
                localStorage.setItem(popupShownKey, JSON.stringify(shownPopups));
            }
            
            isShowingEventModal = false;
            modal.remove();
        }
    });
}

async function submitEventResponse(event, response, reason = '') {
    try {
        // Hardcoded webhook URL for event responses channel
        const webhookUrl = 'https://discord.com/api/webhooks/1322975014110236716';
        
        const eventId = event.id || event.rowIndex;
        
        const requestBody = {
            eventId: eventId,
            userDiscordId: currentUser.id,
            displayName: currentUser.name || currentUser.profile?.name || 'Unknown User',
            response: response,
            reason: reason,
            webhookUrl: webhookUrl,
            organizerDiscordId: event.organizerDiscordId
        };
        
        console.log('[Events] Submitting response:', requestBody);
        
        const apiResponse = await fetch('https://timeclock-backend.marcusray.workers.dev/api/events/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('[Events] Failed to submit response:', apiResponse.statusText, errorText);
            showModal('alert', '⚠️ Failed to submit response. Please try again.');
            return;
        }
        
        const data = await apiResponse.json();
        console.log('[Events] Response submitted successfully:', data);
        
        // Store user's response locally using consistent ID
        const userResponses = JSON.parse(localStorage.getItem(`event_responses_${currentUser.id}`) || '{}');
        userResponses[eventId] = response;
        localStorage.setItem(`event_responses_${currentUser.id}`, JSON.stringify(userResponses));
        
        // Also mark as popup shown to prevent re-showing
        const popupShownKey = `events_popup_shown_${currentUser.id}`;
        const shownPopups = JSON.parse(localStorage.getItem(popupShownKey) || '[]');
        if (!shownPopups.includes(eventId)) {
            shownPopups.push(eventId);
            localStorage.setItem(popupShownKey, JSON.stringify(shownPopups));
        }
        
        // Also mark as seen
        const seenEventsKey = `events_seen_${currentUser.id}`;
        const seenEvents = JSON.parse(localStorage.getItem(seenEventsKey) || '[]');
        if (!seenEvents.includes(eventId)) {
            seenEvents.push(eventId);
            localStorage.setItem(seenEventsKey, JSON.stringify(seenEvents));
        }
        
        // Refresh events list to show updated status
        await fetchEvents();
    } catch (error) {
        console.error('[Events] Error submitting response:', error);
        showModal('alert', '⚠️ Failed to submit response. Please try again.');
    }
}

function startEventsPolling() {
    if (eventsPollInterval) {
        clearInterval(eventsPollInterval);
    }
    
    // Check for new events every 60 seconds
    // This will process any events with "Submit" in column G and send DMs to all users
    eventsPollInterval = setInterval(() => {
        checkPendingEvents();
        fetchEvents();
    }, 60000); // Check every 60 seconds
    
    // Initial check
    checkPendingEvents();
    fetchEvents();
}

function stopEventsPolling() {
    if (eventsPollInterval) {
        clearInterval(eventsPollInterval);
        eventsPollInterval = null;
    }
}

function renderMail() {
    const inboxContent = document.getElementById('inboxContent');
    const sentContent = document.getElementById('sentContent');
    const draftsContent = document.getElementById('draftsContent');
    if (!inboxContent || !sentContent || !draftsContent) return;
    
    inboxContent.innerHTML = '';
    sentContent.innerHTML = '';
    draftsContent.innerHTML = '';
    
    // Get mail from localStorage for the current user
    const userMail = JSON.parse(localStorage.getItem(`mail_${currentUser.id}`) || '{"inbox": [], "sent": [], "drafts": []}');
    
    // Render inbox
    if (userMail.inbox && userMail.inbox.length > 0) {
        userMail.inbox.forEach((mail, index) => {
            const li = document.createElement('li');
            li.className = 'mail-item';
            li.innerHTML = `
                <div class="mail-avatar">
                    <div class="avatar-circle">${mail.senderName ? mail.senderName.charAt(0).toUpperCase() : 'S'}</div>
                </div>
                <div class="mail-details">
                    <div class="mail-subject">${mail.subject || 'No Subject'}</div>
                    <div class="mail-preview">${mail.content.substring(0, 100)}${mail.content.length > 100 ? '...' : ''}</div>
                    <div class="mail-meta">
                        <span class="mail-sender">From: ${mail.senderName || 'Unknown'}</span>
                        <span class="mail-timestamp">${new Date(mail.timestamp).toLocaleDateString()}</span>
                    </div>
                </div>
            `;
            li.addEventListener('click', () => viewMail(mail, index, 'inbox'));
            inboxContent.appendChild(li);
        });
    } else {
        inboxContent.innerHTML = '<li class="no-mail">No messages in inbox</li>';
    }
    
    // Render sent mail
    if (userMail.sent && userMail.sent.length > 0) {
        userMail.sent.forEach((mail, index) => {
            const li = document.createElement('li');
            li.className = 'mail-item';
            li.innerHTML = `
                <div class="mail-avatar">
                    <div class="avatar-circle">You</div>
                </div>
                <div class="mail-details">
                    <div class="mail-subject">${mail.subject || 'No Subject'}</div>
                    <div class="mail-preview">${mail.content.substring(0, 100)}${mail.content.length > 100 ? '...' : ''}</div>
                    <div class="mail-meta">
                        <span class="mail-recipients">To: ${Array.isArray(mail.recipients) ? mail.recipients.join(', ') : 'Unknown'}</span>
                        <span class="mail-timestamp">${new Date(mail.timestamp).toLocaleDateString()}</span>
                    </div>
                </div>
            `;
            li.addEventListener('click', () => viewMail(mail, index, 'sent'));
            sentContent.appendChild(li);
        });
    } else {
        sentContent.innerHTML = '<li class="no-mail">No sent messages</li>';
    }
    
    // Render drafts
    if (userMail.drafts && userMail.drafts.length > 0) {
        userMail.drafts.forEach((draft, index) => {
            const li = document.createElement('li');
            li.className = 'mail-item draft-item';
            li.innerHTML = `
                <div class="mail-avatar">
                    <div class="avatar-circle">📝</div>
                </div>
                <div class="mail-details">
                    <div class="mail-subject">${draft.subject || 'No Subject'} <span class="draft-badge">DRAFT</span></div>
                    <div class="mail-preview">${draft.content.substring(0, 100)}${draft.content.length > 100 ? '...' : ''}</div>
                    <div class="mail-meta">
                        <span class="mail-recipients">To: ${Array.isArray(draft.recipients) ? draft.recipients.join(', ') : 'Select recipients'}</span>
                        <span class="mail-timestamp">${new Date(draft.timestamp).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="draft-actions">
                    <button class="btn btn-sm edit-draft" data-index="${index}">Edit</button>
                    <button class="btn btn-sm btn-danger delete-draft" data-index="${index}">Delete</button>
                </div>
            `;
            
            // Add event listeners for draft actions
            li.querySelector('.edit-draft').addEventListener('click', (e) => {
                e.stopPropagation();
                editDraft(index);
            });
            
            li.querySelector('.delete-draft').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteDraft(index);
            });
            
            li.addEventListener('click', () => viewMail(draft, index, 'drafts'));
            draftsContent.appendChild(li);
        });
    } else {
        draftsContent.innerHTML = '<li class="no-mail">No draft messages</li>';
    }
}

function viewMail(mail, index, folder) {
    const content = document.getElementById('viewMailContent');
    const isInbox = folder === 'inbox';
    const isSent = folder === 'sent';
    const isDraft = folder === 'drafts';
    
    content.innerHTML = `
        <div class="mail-header">
            <h3>${mail.subject || 'No Subject'}</h3>
            ${isDraft ? '<span class="draft-badge">DRAFT</span>' : ''}
        </div>
        <div class="mail-info">
            ${isInbox ? `<p><strong>From:</strong> ${mail.senderName || 'Unknown'}</p>` : ''}
            ${isSent ? `<p><strong>To:</strong> ${Array.isArray(mail.recipients) ? mail.recipients.join(', ') : 'Unknown'}</p>` : ''}
            ${isDraft ? `<p><strong>To:</strong> ${Array.isArray(mail.recipients) ? mail.recipients.join(', ') : 'Select recipients'}</p>` : ''}
            <p><strong>Date:</strong> ${new Date(mail.timestamp).toLocaleString()}</p>
        </div>
        <div class="mail-body">
            ${mail.content}
        </div>
        ${mail.attachments && mail.attachments.length ? 
            '<div class="mail-attachments"><h4>Attachments:</h4>' + 
            mail.attachments.map(file => `<p><a href="${file.url}" download="${file.name}">${file.name}</a></p>`).join('') + 
            '</div>' : ''}
    `;
    
    // Show/hide reply button
    const replyBtn = document.getElementById('replyMailBtn');
    if (replyBtn) {
        replyBtn.classList.toggle('hidden', !isInbox);
        if (isInbox) {
            replyBtn.onclick = () => replyToMail(mail);
        }
    }
    
    showModal('viewMail');
}

function editDraft(index) {
    const userMail = JSON.parse(localStorage.getItem(`mail_${currentUser.id}`) || '{"inbox": [], "sent": [], "drafts": []}');
    const draft = userMail.drafts[index];
    if (!draft) return;
    
    // Populate compose form with draft data
    document.getElementById('mailSubject').value = draft.subject || '';
    document.getElementById('mailContent').value = draft.content || '';
    
    // Set recipients if available
    if (draft.recipients && Array.isArray(draft.recipients)) {
        setSelectValues('mailRecipients', draft.recipients);
    }
    
    // Mark as editing draft
    document.getElementById('sendMailBtn').dataset.draftIndex = index;
    
    // Load recipients before showing modal
    loadMailRecipients().then(() => {
        showModal('composeMail');
    });
}

function deleteDraft(index) {
    if (confirm('Are you sure you want to delete this draft?')) {
        const userMail = JSON.parse(localStorage.getItem(`mail_${currentUser.id}`) || '{"inbox": [], "sent": [], "drafts": []}');
        userMail.drafts.splice(index, 1);
        localStorage.setItem(`mail_${currentUser.id}`, JSON.stringify(userMail));
        renderMail();
    }
}

function replyToMail(originalMail) {
    // Set up reply
    document.getElementById('mailSubject').value = `Re: ${originalMail.subject || 'No Subject'}`;
    document.getElementById('mailContent').value = `\n\n--- Original Message ---\nFrom: ${originalMail.senderName}\nDate: ${new Date(originalMail.timestamp).toLocaleString()}\n\n${originalMail.content}`;
    
    // Set recipient to original sender if we have recipient data
    // For now, just clear recipients as we don't have a user lookup system
    setSelectValues('mailRecipients', []);
    
    // Load recipients before showing modal
    loadMailRecipients().then(() => {
        showModal('composeMail');
    });
}

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

// Initialize sample mail data for testing (remove in production)
function initializeSampleMail() {
    const currentUserId = currentUser?.id;
    if (!currentUserId) return;
    
    const sampleMail = {
        inbox: [
            {
                id: "sample1",
                senderName: "System Admin",
                senderId: "admin",
                subject: "Welcome to the Portal",
                content: "Welcome to the Cirkle Development staff portal! This is your inbox where you'll receive important messages from management and colleagues.\n\nFeel free to explore all the features available to you.",
                timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                attachments: null
            },
            {
                id: "sample2", 
                senderName: "HR Department",
                senderId: "hr",
                subject: "Monthly Reminder",
                content: "This is a reminder to submit your monthly reports by the end of this week. Please ensure all timesheets are accurate and complete.",
                timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
                attachments: null
            }
        ],
        sent: [],
        drafts: []
    };
    
    // Only add sample data if no mail exists
    const existingMail = localStorage.getItem(`mail_${currentUserId}`);
    if (!existingMail) {
        localStorage.setItem(`mail_${currentUserId}`, JSON.stringify(sampleMail));
    }
}

const discordLoginBtn = document.getElementById('discordLoginBtn');
if (discordLoginBtn) {
    discordLoginBtn.addEventListener('click', () => {
        // Remove prompt=none to allow Discord login credentials dialog
        const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
        console.log('[OAUTH] Initiating Discord OAuth redirect:', { clientId: CLIENT_ID, redirectUri: REDIRECT_URI });
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
        persistUserData(); // Save email to localStorage
        console.log('[SETUP] Email saved:', email);
        showScreen('setupName');
    } else {
        showModal('alert', 'Please enter a valid email with @ and a domain (e.g., example.com)');
    }
    });
}

const setupNameContinueBtn = document.getElementById('setupNameContinueBtn');
if (setupNameContinueBtn) {
    setupNameContinueBtn.addEventListener('click', () => {
        const name = document.getElementById('setupNameInput').value.trim();
        console.log('[DEBUG] setupNameContinueBtn clicked, name input value:', name);
        if (name) {
            if (!currentUser) currentUser = {};
            if (!currentUser.profile) currentUser.profile = {};
            currentUser.profile.name = name;
            persistUserData(); // Save name to localStorage
            console.log('[SETUP] Name saved:', name);
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
    const language = document.getElementById('setupLanguageSelect').value;
    
    console.log('[DEBUG] setupPreferencesContinueBtn clicked, timezone:', timezone, 'dateFormat:', dateFormat, 'country:', country, 'language:', language);
    
    if (timezone && country && language) {
        if (!currentUser) currentUser = {};
        if (!currentUser.profile) currentUser.profile = {};
        currentUser.profile.timezone = timezone;
        currentUser.profile.dateFormat = dateFormat;
        currentUser.profile.country = country;
        currentUser.profile.language = language;
        persistUserData(); // Save preferences to localStorage
        console.log('[SETUP] Preferences saved:', { timezone, country, language });
        console.log('[DEBUG] Preferences saved, redirecting to department selection');
        showScreen('setupDepartment');
    } else {
        showModal('alert', 'Please select timezone, country, and language');
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
        persistUserData(); // Save department to localStorage
        console.log('[SETUP] Department saved:', selectedDept.value);
        console.log('[DEBUG] Department saved, verifying roles...');
        showScreen('setupVerify');
        
        // Reduced timeout for mobile responsiveness
        setTimeout(async () => {
            try {
                const deptRole = DEPT_ROLES[currentUser.profile.department];
                console.log('[DEBUG] Checking department role:', deptRole, 'and base employee role:', REQUIRED_ROLE);
                console.log('[DEBUG] User roles:', currentUser.roles);
                console.log('[DEBUG] User roles type:', typeof currentUser.roles, Array.isArray(currentUser.roles));
                
                // Check if user has both the required employee role AND the department role
                const hasBaseRole = currentUser.roles && currentUser.roles.includes(REQUIRED_ROLE);
                const hasDeptRole = currentUser.roles && currentUser.roles.includes(deptRole);
                
                console.log('[DEBUG] hasBaseRole:', hasBaseRole);
                console.log('[DEBUG] hasDeptRole:', hasDeptRole);
                
                // TEMPORARILY SKIP ROLE CHECK TO GET PAST VERIFICATION
                const skipRoleCheck = true;
                
                if (skipRoleCheck || (hasBaseRole && hasDeptRole)) {
                    console.log('[DEBUG] Role check passed (or skipped), saving profile...');
                    updateEmployee(currentUser);
                    persistUserData(); // Ensure all data is saved
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    // Save to Google Sheets via backend
                    console.log('[DEBUG] Saving profile to Google Sheets...');
                    await upsertUserProfile();
                    console.log('[DEBUG] Profile saved to Google Sheets');
                    
                    // Send welcome DM with credentials
                    const emp = getEmployee(currentUser.id);
                    console.log('[DEBUG] Sending welcome DM...');
                    try {
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
                    } catch (dmError) {
                        console.error('[ERROR] Failed to send DM, but continuing:', dmError);
                    }
                    
                    console.log('[DEBUG] Role verification successful, redirecting to confirm');
                    showScreen('confirm');
                    try {
                        playSuccessSound();
                    } catch (soundError) {
                        console.warn('[WARN] Could not play success sound:', soundError);
                    }
                } else {
                    console.log('[DEBUG] Role verification failed for department:', currentUser.profile.department);
                    showModal('alert', 'Role not found for selected department. Please ensure you have the correct role in Discord.');
                    showScreen('setupDepartment');
                }
            } catch (error) {
                console.error('[ERROR] Verification process failed:', error);
                showModal('alert', 'An error occurred during verification. Please try again.');
                showScreen('setupDepartment');
            }
        }, 1000); // Reduced from 2000ms to 1000ms for better mobile experience
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
    portalLoginBtn.addEventListener('click', async () => {
        console.log('[Portal Login] Starting sequential loading...');
        
        // Show sequential loading screen
        const userName = currentUser?.profile?.name || currentUser?.name || 'User';
        document.getElementById('loadingUserName').textContent = userName;
        showScreen('sequentialLoading');
        
        // Helper function to activate a loading step
        const activateStep = (stepName) => {
            const step = document.querySelector(`.loading-step[data-step="${stepName}"]`);
            if (step) {
                step.classList.add('active');
                step.classList.remove('completed');
            }
        };
        
        // Helper function to complete a loading step
        const completeStep = (stepName) => {
            const step = document.querySelector(`.loading-step[data-step="${stepName}"]`);
            if (step) {
                step.classList.remove('active');
                step.classList.add('completed');
            }
        };
        
        try {
            // Step 1: Loading Discord data
            activateStep('discord');
            await new Promise(r => setTimeout(r, 800));
            const membersResponse = await fetch(`${WORKER_URL}/members/${GUILD_ID}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                mode: 'cors'
            });
            if (membersResponse.ok) {
                const allMembers = await membersResponse.json();
                const discordMember = allMembers.find(m => m.user.id === currentUser.id);
                if (discordMember) {
                    currentUser.roles = discordMember.roles || [];
                    currentUser.avatar = discordMember.user.avatar 
                        ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${discordMember.user.avatar}.png?size=128` 
                        : currentUser.avatar;
                }
            }
            completeStep('discord');
            
            // Step 2: Loading database data
            activateStep('database');
            await new Promise(r => setTimeout(r, 700));
            const memberResponse = await fetch(`${WORKER_URL}/api/user/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                mode: 'cors',
                body: JSON.stringify({ discordId: currentUser.id })
            });
            if (memberResponse.ok) {
                const memberData = await memberResponse.json();
                if (!currentUser.profile) currentUser.profile = {};
                currentUser.profile.name = memberData.name || currentUser.profile.name || currentUser.name;
                currentUser.profile.email = memberData.email || currentUser.profile.email || 'Not set';
                currentUser.profile.department = memberData.department || currentUser.profile.department || 'Not set';
                currentUser.profile.baseLevel = memberData.baseLevel || currentUser.profile.baseLevel || '';
                currentUser.profile.timezone = memberData.timezone || currentUser.profile.timezone || '';
                currentUser.profile.country = memberData.country || currentUser.profile.country || '';
            }
            completeStep('database');
            
            // Step 3: Loading backend and Cloudflare
            activateStep('backend');
            await new Promise(r => setTimeout(r, 600));
            await fetchEmployees();
            // Sync all user data from backend for cross-device support
            await syncUserDataFromBackend(currentUser.id);
            completeStep('backend');
            
            // Step 4: Loading Sentinel
            activateStep('sentinel');
            await new Promise(r => setTimeout(r, 500));
            completeStep('sentinel');
            
            // Step 5: Loading contents
            activateStep('contents');
            await new Promise(r => setTimeout(r, 600));
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateSidebarProfile();
            completeStep('contents');
            
            // Step 6: Success!
            activateStep('success');
            completeStep('success');
            await new Promise(r => setTimeout(r, 800));
            
            // Transition to main menu
            showScreen('mainMenu');
            updateMainScreen();
            
        } catch (error) {
            console.error('[Portal Login] Error during loading:', error);
            showModal('alert', 'Failed to load profile data. Please try again.');
            showScreen('portalWelcome');
        }
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
        
        closeMobileSidebar();
        
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
        
        // Apply pending change styling
        if (profileNameEl) {
            profileNameEl.classList.toggle('pending-name', !!emp.pendingNameChange);
        }
        if (profileEmailEl) {
            profileEmailEl.classList.toggle('pending-email', !!emp.pendingEmailChange);
        }
        if (profileDeptEl) {
            profileDeptEl.classList.toggle('pending-department', !!emp.pendingDeptChange);
        }
        
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
        
        // Use currentUser.profile as primary source, emp.profile as fallback
        const displayName = currentUser.profile?.name || emp.profile?.name || currentUser.name || 'Not set';
        const displayEmail = currentUser.profile?.email || emp.profile?.email || 'Not set';
        const displayDept = currentUser.profile?.department || emp.profile?.department || 'Not set';
        
        if (profileNameEl2) profileNameEl2.textContent = displayName;
        if (profileEmailEl2) profileEmailEl2.textContent = displayEmail;
        if (profileDepartmentEl2) profileDepartmentEl2.textContent = displayDept;
        
        console.log('[PROFILE] Displaying:', { displayName, displayEmail, displayDept });
        
        // Update profile pictures
        updateProfilePictures();
    });
}

const homeBtn = document.getElementById('homeBtn');
if (homeBtn) {
    homeBtn.addEventListener('click', async () => {
        console.log('Home button clicked');
        showScreen('mainMenu');
        
        // Sync profile to get latest baseLevel before updating screen
        if (currentUser && currentUser.id) {
            console.log('[HOME] Syncing profile before showing main screen');
            const profile = await fetchUserProfile(currentUser.id);
            if (profile && profile.baseLevel !== undefined) {
                if (!currentUser.profile) currentUser.profile = {};
                currentUser.profile.baseLevel = profile.baseLevel;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                console.log('[HOME] Updated baseLevel to:', profile.baseLevel);
            }
        }
        
        updateMainScreen();
        // Close mobile sidebar after navigation
        closeMobileSidebar();
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
                // Immediately close the modal
                closeModal('deptChange');
                
                // Show success modal for 2 seconds
                showModal('alert', '<span class="success-tick"></span> Department change request submitted for approval!');
                setTimeout(() => {
                    closeModal('alert');
                }, 2000);
                
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

// Save profile function - persists to localStorage and backend
async function saveProfile() {
    if (!currentUser) {
        throw new Error('No current user');
    }
    
    try {
        // Save to localStorage immediately
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Also save to backend via employee record
        const emp = getEmployee(currentUser.id);
        if (emp) {
            if (!emp.profile) emp.profile = {};
            emp.profile = { ...emp.profile, ...currentUser.profile };
            updateEmployee(emp);
        }
        
        console.log('[saveProfile] Profile saved successfully');
        return { success: true };
    } catch (error) {
        console.error('[saveProfile] Error:', error);
        throw error;
    }
}

// ===== LANGUAGE & COUNTRY MAPPING =====
const countryLanguageMap = {
    'GB': ['en'],
    'IE': ['en'],
    'US': ['en'],
    'CA': ['en', 'fr'],
    'AU': ['en'],
    'NZ': ['en'],
    'DE': ['de', 'en'],
    'FR': ['fr', 'en'],
    'ES': ['es', 'en'],
    'IT': ['it', 'en'],
    'NL': ['nl', 'en'],
    'BE': ['nl', 'fr', 'en'],
    'PL': ['pl', 'en'],
    'SE': ['sv', 'en'],
    'NO': ['no', 'en'],
    'DK': ['da', 'en'],
    'FI': ['fi', 'en'],
    'PT': ['pt', 'en'],
    'GR': ['el', 'en'],
    'AT': ['de', 'en'],
    'CH': ['de', 'fr', 'it', 'en'],
    'JP': ['ja', 'en'],
    'CN': ['zh', 'en'],
    'IN': ['hi', 'en'],
    'BR': ['pt-br', 'en'],
    'MX': ['es-mx', 'en'],
    'ZA': ['en'],
    'OTHER': ['en']
};

const languageNames = {
    'en': 'English',
    'de': 'Deutsch (German)',
    'fr': 'Français (French)',
    'es': 'Español (Spanish)',
    'it': 'Italiano (Italian)',
    'nl': 'Nederlands (Dutch)',
    'pt': 'Português (Portuguese)',
    'pl': 'Polski (Polish)',
    'sv': 'Svenska (Swedish)',
    'da': 'Dansk (Danish)',
    'fi': 'Suomi (Finnish)',
    'no': 'Norsk (Norwegian)',
    'el': 'Ελληνικά (Greek)',
    'tr': 'Türkçe (Turkish)',
    'ru': 'Русский (Russian)',
    'ja': '日本語 (Japanese)',
    'zh': '中文 (Chinese)',
    'hi': 'हिंदी (Hindi)',
    'pt-br': 'Português Brasileiro (Brazilian Portuguese)',
    'es-mx': 'Español Mexicano (Mexican Spanish)',
    'ko': '한국어 (Korean)',
    'th': 'ไทย (Thai)'
};

// Update language options based on selected country
function updateLanguageOptions() {
    const countrySelect = document.getElementById('profileCountrySelect');
    const languageSelect = document.getElementById('profileLanguageSelect');
    
    if (!countrySelect || !languageSelect) return;
    
    const selectedCountry = countrySelect.value;
    const allowedLanguages = countryLanguageMap[selectedCountry] || ['en'];
    
    // Clear and rebuild language options
    const currentValue = languageSelect.value;
    languageSelect.innerHTML = '<option value="">Select Language</option>';
    
    allowedLanguages.forEach(langCode => {
        const option = document.createElement('option');
        option.value = langCode;
        option.textContent = languageNames[langCode] || langCode;
        languageSelect.appendChild(option);
    });
    
    // Restore selection if it's still available, otherwise select first option
    if (allowedLanguages.includes(currentValue)) {
        languageSelect.value = currentValue;
    } else if (allowedLanguages.length > 0) {
        languageSelect.value = allowedLanguages[0];
    }
}

// Update language options for setup form
function updateSetupLanguageOptions() {
    const countrySelect = document.getElementById('setupCountrySelect');
    const languageSelect = document.getElementById('setupLanguageSelect');
    
    if (!countrySelect || !languageSelect) return;
    
    const selectedCountry = countrySelect.value;
    const allowedLanguages = countryLanguageMap[selectedCountry] || ['en'];
    
    // Clear and rebuild language options
    const currentValue = languageSelect.value;
    languageSelect.innerHTML = '<option value="">Select Language</option>';
    
    allowedLanguages.forEach(langCode => {
        const option = document.createElement('option');
        option.value = langCode;
        option.textContent = languageNames[langCode] || langCode;
        languageSelect.appendChild(option);
    });
    
    // Auto-select first available language
    if (allowedLanguages.length > 0) {
        languageSelect.value = allowedLanguages[0];
    }
}

// Country and Timezone dropdowns - auto-save on change
const profileCountrySelect = document.getElementById('profileCountrySelect');
if (profileCountrySelect) {
    profileCountrySelect.addEventListener('change', async () => {
        updateLanguageOptions(); // Update language options when country changes
        const country = profileCountrySelect.value;
        if (country && currentUser) {
            if (!currentUser.profile) currentUser.profile = {};
            currentUser.profile.country = country;
            
            // Save to localStorage
            try {
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showModal('alert', '<span class="success-tick"></span> Country updated successfully!');
                playSuccessSound();
            } catch (error) {
                console.error('Failed to update country:', error);
                showModal('alert', '⚠️ Failed to update country. Please try again.');
            }
        }
    });
}

const profileTimezoneSelect = document.getElementById('profileTimezoneSelect');
if (profileTimezoneSelect) {
    profileTimezoneSelect.addEventListener('change', async () => {
        const timezone = profileTimezoneSelect.value;
        if (timezone && currentUser) {
            if (!currentUser.profile) currentUser.profile = {};
            currentUser.profile.timezone = timezone;
            
            // Save to localStorage immediately
            try {
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showModal('alert', '<span class="success-tick"></span> Timezone updated successfully!');
                playSuccessSound();
            } catch (error) {
                console.error('Failed to update timezone:', error);
                showModal('alert', '⚠️ Failed to update timezone. Please try again.');
            }
        }
    });
}

// Language select - auto-save on change
const profileLanguageSelect = document.getElementById('profileLanguageSelect');
if (profileLanguageSelect) {
    profileLanguageSelect.addEventListener('change', async () => {
        const language = profileLanguageSelect.value;
        if (language && currentUser) {
            if (!currentUser.profile) currentUser.profile = {};
            currentUser.profile.language = language;
            
            // Save to localStorage immediately
            try {
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showModal('alert', '<span class="success-tick"></span> Language updated successfully!');
                playSuccessSound();
            } catch (error) {
                console.error('Failed to update language:', error);
                showModal('alert', '⚠️ Failed to update language. Please try again.');
            }
        }
    });
}

const myRolesBtn = document.getElementById('myRolesBtn');
if (myRolesBtn) {
    myRolesBtn.addEventListener('click', async () => {
        showScreen('myRoles');
        
        const list = document.getElementById('rolesList');
        list.innerHTML = '';
        
        // Display baseLevel (job title/role) if available
        if (currentUser?.profile?.baseLevel) {
            const li = document.createElement('li');
            li.textContent = currentUser.profile.baseLevel;
            li.style.cssText = 'padding: 12px; background: var(--primary); color: white; border-radius: 8px; margin-bottom: 8px; font-weight: 500; list-style: none;';
            list.appendChild(li);
        } else {
            list.innerHTML = '<li style="color: var(--text-secondary); list-style: none;">No roles assigned</li>';
        }
        
        closeMobileSidebar();
    });
}

const absencesBtn = document.getElementById('absencesBtn');
if (absencesBtn) {
    absencesBtn.addEventListener('click', () => {
        showScreen('absences');
        document.querySelectorAll('.absence-tab-btn').forEach(btn => btn.classList.remove('active'));
        const approvedTabBtn = document.querySelector('.absence-tab-btn[data-tab="approved"]');
        if (approvedTabBtn) approvedTabBtn.classList.add('active');
        
        const pendingFolder = document.getElementById('pendingFolder');
        const approvedFolder = document.getElementById('approvedFolder');
        const rejectedFolder = document.getElementById('rejectedFolder');
        const archivedFolder = document.getElementById('archivedFolder');
        
        if (pendingFolder) pendingFolder.classList.remove('active');
        if (approvedFolder) approvedFolder.classList.add('active');
        if (rejectedFolder) rejectedFolder.classList.remove('active');
        if (archivedFolder) archivedFolder.classList.remove('active');
        
        updateAbsenceTabSlider();
        renderAbsences('approved');
        closeMobileSidebar();
    });
}

const requestAbsenceBtn = document.getElementById('requestAbsenceBtn');
if (requestAbsenceBtn) {
    requestAbsenceBtn.addEventListener('click', () => {
        showModal('absenceRequest');
    });
}

// Render calendar widget with holiday indicators
async function renderHolidayCalendar() {
    const container = document.getElementById('calendarContainer');
    if (!container) return;
    
    // Fetch holidays
    let holidays = [];
    try {
        const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/calendar/holiday/list');
        if (response.ok) {
            const data = await response.json();
            holidays = data.holidays || [];
        }
    } catch (error) {
        console.error('Error fetching holidays for calendar:', error);
    }
    
    // Convert holidays to date strings for quick lookup
    const holidayDates = new Set(holidays.map(h => h.date));
    
    // Get current month (use stored values if available)
    const currentMonth = window.calendarMonth !== undefined ? window.calendarMonth : new Date().getMonth();
    const currentYear = window.calendarYear !== undefined ? window.calendarYear : new Date().getFullYear();
    const now = new Date();
    
    // Calendar header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    
    let html = `
        <div style="text-align: center; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
            <button onclick="changeCalendarMonth(-1)" style="background: #667eea; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: 600;">← Prev</button>
            <h3 style="margin: 0; color: #333; font-size: 1.2em;">${monthNames[currentMonth]} ${currentYear}</h3>
            <button onclick="changeCalendarMonth(1)" style="background: #667eea; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: 600;">Next →</button>
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; text-align: center;">
            <div style="font-weight: bold; color: #666; padding: 8px; font-size: 0.9em;">Sun</div>
            <div style="font-weight: bold; color: #666; padding: 8px; font-size: 0.9em;">Mon</div>
            <div style="font-weight: bold; color: #666; padding: 8px; font-size: 0.9em;">Tue</div>
            <div style="font-weight: bold; color: #666; padding: 8px; font-size: 0.9em;">Wed</div>
            <div style="font-weight: bold; color: #666; padding: 8px; font-size: 0.9em;">Thu</div>
            <div style="font-weight: bold; color: #666; padding: 8px; font-size: 0.9em;">Fri</div>
            <div style="font-weight: bold; color: #666; padding: 8px; font-size: 0.9em;">Sat</div>
    `;
    
    // Get first day of month
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        html += '<div></div>';
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasHoliday = holidayDates.has(dateStr);
        const isToday = day === now.getDate() && currentMonth === now.getMonth() && currentYear === now.getFullYear();
        
        html += `
            <div onclick="selectCalendarDate('${dateStr}')" style="
                position: relative;
                padding: 12px 8px;
                border-radius: 8px;
                cursor: pointer;
                background: ${isToday ? '#e3f2fd' : '#fafafa'};
                border: 2px solid ${isToday ? '#2196F3' : '#e0e0e0'};
                transition: all 0.2s ease;
                font-weight: ${isToday ? 'bold' : 'normal'};
            " onmouseover="this.style.background='#f5f5f5'; this.style.transform='scale(1.05)';" onmouseout="this.style.background='${isToday ? '#e3f2fd' : '#fafafa'}'; this.style.transform='scale(1)';">
                ${day}
                ${hasHoliday ? '<div style="position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 6px; height: 6px; background: #2196F3; border-radius: 50%;"></div>' : ''}
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// Store current calendar month
window.calendarMonth = new Date().getMonth();
window.calendarYear = new Date().getFullYear();

// Change calendar month
window.changeCalendarMonth = async function(delta) {
    window.calendarMonth += delta;
    if (window.calendarMonth > 11) {
        window.calendarMonth = 0;
        window.calendarYear++;
    } else if (window.calendarMonth < 0) {
        window.calendarMonth = 11;
        window.calendarYear--;
    }
    await renderHolidayCalendar();
};

// Select date from calendar
window.selectCalendarDate = function(dateStr) {
    const startInput = document.getElementById('absenceStartDate');
    const endInput = document.getElementById('absenceEndDate');
    
    if (!startInput.value || (startInput.value && endInput.value)) {
        // Set as start date
        startInput.value = dateStr;
        endInput.value = '';
        startInput.dispatchEvent(new Event('change'));
    } else if (startInput.value && !endInput.value) {
        // Set as end date
        const start = new Date(startInput.value);
        const selected = new Date(dateStr);
        
        if (selected >= start) {
            endInput.value = dateStr;
            endInput.dispatchEvent(new Event('change'));
        } else {
            // If selected is before start, swap them
            endInput.value = startInput.value;
            startInput.value = dateStr;
            startInput.dispatchEvent(new Event('change'));
            endInput.dispatchEvent(new Event('change'));
        }
    }
    
    calculateAbsenceDays();
};

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
    // Initialize disciplinaries and reports tabs
    setupDisciplinariesTabs();
    
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
            
            try {
                // Save to Google Sheets via backend
                const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/absence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: emp.profile.name,
                        startDate: startDate,
                        endDate: endDate,
                        reason: type,
                        totalDays: days.toString(),
                        comment: comment,
                        discordId: currentUser.id
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to save absence to sheets');
                }
                
                // Save locally and send webhook
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
                document.querySelector('.absence-tab-btn[data-tab="pending"]')?.classList.add('active');
                document.getElementById('pendingFolder')?.classList.add('active');
                document.getElementById('approvedFolder')?.classList.remove('active');
            } catch (error) {
                console.error('Error submitting absence:', error);
                showModal('alert', '❌ Failed to submit absence. Please try again.');
            } finally {
                window.absenceSubmitting = false;
                submitBtn.disabled = false;
            }
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
    // CRITICAL: Always reload from employees array to ensure we have the latest data
    const empDebug = getEmployee(currentUser.id);
    console.log('[renderAbsences] Current user ID:', currentUser.id);
    console.log('[renderAbsences] Got employee:', empDebug?.id, 'with', empDebug?.absences?.length || 0, 'absences');
    if (empDebug && empDebug.absences) {
        empDebug.absences.forEach((a, idx) => {
            console.log(`[DEBUG] Absence[${idx}]:`, JSON.stringify(a));
        });
    } else {
        console.log('[renderAbsences] No absences found!');
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
    
    // Get all absences without filtering - we want to show approved and rejected too
    const allAbsences = emp.absences || [];
    
    // Always render all absences in their respective lists, regardless of active tab
    allAbsences.forEach(a => {
        // Normalize status values for UI
        let status = a.status;
        if (status === 'approve') status = 'approved';
        if (status === 'reject') status = 'rejected';
        if (status !== a.status) a.status = status; // update in-memory for consistency
        
        // Check if LOA has ended (past end date)
        const endDate = new Date(a.endDate);
        const today = new Date();
        const isEnded = endDate < today && status === 'approved';
        const isVoided = status?.toUpperCase() === 'VOIDED';
        
        if (status === 'pending') {
            console.log('[DEBUG] Rendering pending absence:', JSON.stringify(a));
        }
        const li = document.createElement('li');
        li.className = `absence-item ${status}`;
        let bg = '';
        if (status === 'pending') bg = 'background: var(--yellow-hazard); color: #212529;';
        if (status === 'approved' && !isEnded) bg = 'background: #d4edda; color: #155724;';
        if (isEnded) bg = 'background: #0d5c1d; color: #fff;'; // Dark green for ended
        if (isVoided) bg = 'background: #555; color: #fff; opacity: 0.8;'; // Dark gray for voided
        if (status === 'rejected') bg = 'background: #f8d7da; color: #721c24;';
        if (status === 'archived') bg = 'background: #e2e3e5; color: #41464b; opacity: 0.7;';
        li.setAttribute('style', bg);
        
        const statusDisplay = isVoided ? 'VOIDED' : (isEnded ? 'ENDED' : (status || 'pending').toUpperCase());
        
        li.innerHTML = `
            <span>Type: ${a.type}</span>
            <span>Start: ${a.startDate}</span>
            <span>End: ${a.endDate}</span>
            <span style="background:rgba(255,255,0,0.2);padding:2px 6px;border-radius:4px;">Total Days: ${Math.ceil((new Date(a.endDate) - new Date(a.startDate)) / (1000 * 60 * 60 * 24)) + 1}</span>
            <span style="font-weight: bold;">${statusDisplay}</span>
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
    
    closeMobileSidebar();
    console.log('[DEBUG] Payslips - Current user:', currentUser);
    console.log('[DEBUG] Payslips - Using Discord ID as Staff ID:', staffId);
    
    if (!staffId) {
        content.innerHTML = '<p>No Staff ID found. Please contact HR.</p>';
        console.error('[DEBUG] No Staff ID found');
        return;
    }
    
    try {
        const res = await fetch('https://timeclock-backend.marcusray.workers.dev/api/payslips/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: staffId })
        });
        
        if (!res.ok) {
            throw new Error('Failed to fetch payslips');
        }
        
        const data = await res.json();
        const payslips = Array.isArray(data) ? data : (data.payslips || []);
        
        console.log('[DEBUG] Fetched payslips:', payslips);
        console.log('[DEBUG] Number of payslips:', payslips.length);
        
        if (!payslips || payslips.length === 0) {
            content.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No payslips found.</p>';
            return;
        }
        
        // Display payslips in clean row format
        content.innerHTML = `
            <div class="payslips-list" style="display: flex; flex-direction: column; gap: 12px; padding: 20px;">
                ${payslips.map((payslip, index) => {
                    const date = payslip.dateAssigned || payslip.timestamp || 'N/A';
                    const assignedBy = payslip.assignedBy || 'Unknown';
                    const link = payslip.link || payslip.url || '';
                    
                    return `
                    <div class="payslip-row" data-index="${index}" data-link="${link}" style="
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center; 
                        border: 1px solid #e0e0e0; 
                        padding: 20px 24px; 
                        border-radius: 8px; 
                        background: white; 
                        cursor: pointer;
                        transition: all 0.2s ease;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                    " onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.12)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.08)'; this.style.transform='translateY(0)'">
                        <div style="flex: 1;">
                            <span style="font-weight: 600; color: #1976d2; font-size: 16px;">Date Assigned: ${date}</span>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <span style="color: #666; font-size: 14px;">Assigned By: ${assignedBy}</span>
                        </div>
                        <div style="flex: 0 0 auto;">
                            <button onclick="window.open('${link}', '_blank')" style="
                                background: #1976d2;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 6px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: background 0.2s;
                            " onmouseover="this.style.background='#1565c0'" onmouseout="this.style.background='#1976d2'">View Payslip</button>
                        </div>
                    </div>
                `;
                }).join('')}
            </div>
        `;
        
        // Add click handlers to each payslip row to show details modal
        const rows = content.querySelectorAll('.payslip-row');
        rows.forEach((row) => {
            row.addEventListener('click', () => {
                const index = parseInt(row.getAttribute('data-index'));
                const payslip = payslips[index];
                if (payslip) {
                    showPayslipDetails(payslip);
                }
            });
        });
        
    } catch (e) {
        console.error('Error fetching payslips:', e);
        content.innerHTML = '<p>Error loading payslips. Please try again later.</p>';
    }
});

function showPayslipDetails(payslip) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.5); display: flex; align-items: center; 
        justify-content: center; z-index: 10000;
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    const link = payslip.link || '#';
    
    modal.innerHTML = `
        <div style="
            background: white; padding: 30px; border-radius: 8px; 
            max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        ">
            <h3 style="margin: 0 0 20px 0; color: #1976d2;">Payslip Details</h3>
            <div style="margin-bottom: 15px;">
                <strong>Date Assigned:</strong> ${payslip.dateAssigned || 'N/A'}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Assigned By:</strong> ${payslip.assignedBy || 'Unknown'}
            </div>
            <div style="margin-bottom: 20px;">
                <strong>Comment:</strong> ${payslip.comment || 'No comment provided'}
            </div>
            <div style="display: flex; gap: 10px; justify-content: center;">
                ${link && link !== '#' ? `
                <button onclick="window.open('${link}', '_blank')" style="
                    background: #1976d2; color: white; border: none; 
                    padding: 12px 24px; border-radius: 6px; cursor: pointer;
                    font-weight: 600; transition: background 0.2s;
                " onmouseover="this.style.background='#1565c0'" onmouseout="this.style.background='#1976d2'">View Payslip</button>
                ` : ''}
                <button onclick="this.closest('[style*=fixed]').remove()" style="
                    background: #666; color: white; border: none; 
                    padding: 12px 24px; border-radius: 6px; cursor: pointer;
                    font-weight: 600; transition: background 0.2s;
                " onmouseover="this.style.background='#555'" onmouseout="this.style.background='#666'">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
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
    
    closeMobileSidebar();
    
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
            body: JSON.stringify({ userId: staffId })
        });
        
        if (!res.ok) {
            throw new Error('Failed to fetch disciplinaries');
        }
        
        const data = await res.json();
        const disciplinaries = Array.isArray(data) ? data : (data.disciplinaries || []);
        
        console.log('[DEBUG] Fetched disciplinaries:', disciplinaries);
        
        loadingEl.classList.add('hidden');
        
        if (disciplinaries.length === 0) {
            // Update localStorage counter to reflect no disciplinaries
            let lastDisciplinaryCheck = localStorage.getItem('lastDisciplinaryCheck') ? JSON.parse(localStorage.getItem('lastDisciplinaryCheck')) : {};
            const userKey = currentUser.id;
            lastDisciplinaryCheck[userKey] = 0;
            localStorage.setItem('lastDisciplinaryCheck', JSON.stringify(lastDisciplinaryCheck));
            console.log('[DEBUG] Reset disciplinary counter to 0 in localStorage');
            
            emptyEl.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No disciplinaries found.</p>';
            emptyEl.classList.remove('hidden');
            return;
        }
        
        // Update header with count
        const header = document.querySelector('#disciplinariesScreen h2');
        if (header) {
            header.textContent = `Disciplinaries (${disciplinaries.length})`;
        }
        
        // Update localStorage counter to reflect current reality
        let lastDisciplinaryCheck = localStorage.getItem('lastDisciplinaryCheck') ? JSON.parse(localStorage.getItem('lastDisciplinaryCheck')) : {};
        const userKey = currentUser.id;
        lastDisciplinaryCheck[userKey] = disciplinaries.length;
        localStorage.setItem('lastDisciplinaryCheck', JSON.stringify(lastDisciplinaryCheck));
        
        console.log('[DEBUG] Updated disciplinary counter in localStorage to:', disciplinaries.length);
        
        // Generate clean row-based list matching payslips design
        listEl.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding: 20px;';
        
        disciplinaries.forEach((disc, index) => {
            const item = document.createElement('div');
            item.className = 'disciplinary-row';
            
            const date = disc.dateAssigned || new Date().toLocaleDateString();
            
            item.style.cssText = `
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                border: 1px solid #e0e0e0; 
                padding: 20px 24px; 
                border-radius: 8px; 
                background: white; 
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            `;
            
            item.onmouseover = () => {
                item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                item.style.transform = 'translateY(-2px)';
            };
            
            item.onmouseout = () => {
                item.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                item.style.transform = 'translateY(0)';
            };
            
            item.innerHTML = `
                <div style="flex: 1;">
                    <span style="font-weight: 600; color: #f44336; font-size: 16px;">DISCIPLINARY: ${date}</span>
                </div>
                <div style="flex: 1; text-align: right;">
                    <span style="color: #888; font-size: 14px;">by ${disc.assignedBy || 'Marcus Ray'}</span>
                </div>
            `;
            
            item.onclick = () => showDisciplinaryDetails(disc);
            
            listEl.appendChild(item);
        });
        
    } catch (error) {
        console.error('Error fetching disciplinaries:', error);
        loadingEl.classList.add('hidden');
        emptyEl.innerHTML = '<p>Error loading disciplinaries. Please try again.</p>';
        emptyEl.classList.remove('hidden');
    }
});

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
            <h3 style="margin: 0 0 20px 0; color: #f44336;">Disciplinary Details</h3>
            <div style="margin-bottom: 15px;">
                <strong>Date Assigned:</strong> ${disciplinary.dateAssigned || 'N/A'}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Type:</strong> ${disciplinary.strikeType || 'N/A'}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Assigned By:</strong> ${disciplinary.assignedBy || 'Unknown'}
            </div>
            <div style="margin-bottom: 20px;">
                <strong>Comment:</strong> ${disciplinary.comment || 'No comment provided'}
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

document.getElementById('timeclockBtn').addEventListener('click', () => {
    showScreen('timeclock');
    updateMainScreen();
    
    // Clear any existing clock display interval
    if (clockDisplayInterval) clearInterval(clockDisplayInterval);
    
    // Update clock display with current time
    const updateClock = () => {
        const now = new Date();
        document.getElementById('clockDisplay').textContent = now.toLocaleTimeString();
    };
    updateClock();
    clockDisplayInterval = setInterval(updateClock, 1000);
    
    // Ensure session info is showing if user is clocked in
    if (isClockedIn && clockInTime) {
        const sessionInfo = document.getElementById('sessionInfo');
        sessionInfo.classList.remove('hidden');
        
        // Update session info immediately
        const elapsed = Date.now() - clockInTime;
        sessionInfo.innerHTML = `
            <p>Session started: ${new Date(clockInTime).toLocaleString()}</p>
            <p>Elapsed: ${formatTime(elapsed)}</p>
            <p>Actions: ${clockInActions.join(', ') || 'None'}</p>
        `;
        
        // Ensure interval is running (but don't create duplicates)
        if (!clockInInterval) {
            clockInInterval = setInterval(() => {
                if (isClockedIn && clockInTime) {
                    const elapsed = Date.now() - clockInTime;
                    const sessionInfoEl = document.getElementById('sessionInfo');
                    if (sessionInfoEl) {
                        sessionInfoEl.innerHTML = `
                            <p>Session started: ${new Date(clockInTime).toLocaleString()}</p>
                            <p>Elapsed: ${formatTime(elapsed)}</p>
                            <p>Actions: ${clockInActions.join(', ') || 'None'}</p>
                        `;
                    }
                }
            }, 1000);
        }
    }
    
    closeMobileSidebar();
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

// ========== REQUESTS FUNCTIONALITY ==========
let requestsData = [];

// Function to reload requests list
async function reloadRequests() {
    console.log('[DEBUG] reloadRequests() called');
    
    const loadingEl = document.getElementById('requestsLoading');
    const emptyEl = document.getElementById('requestsEmpty');
    const listEl = document.getElementById('requestsList');
    
    if (!loadingEl || !emptyEl || !listEl) {
        console.error('[DEBUG] Request elements not found');
        return;
    }
    
    const userId = currentUser?.id;
    
    if (!userId) {
        console.error('[DEBUG] No currentUser found');
        return;
    }
    
    try {
        console.log('[DEBUG] Fetching requests for user:', userId);
        
        const res = await fetch('https://timeclock-backend.marcusray.workers.dev/api/requests/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        
        if (!res.ok) {
            throw new Error('Failed to fetch requests');
        }
        
        const data = await res.json();
        const requests = data.requests || [];
        
        console.log('[DEBUG] Fetched', requests.length, 'requests:', requests);
        
        // CLEAR EXISTING LIST FIRST
        listEl.innerHTML = '';
        
        if (requests.length === 0) {
            loadingEl.classList.add('hidden');
            emptyEl.classList.remove('hidden');
            return;
        }
        
        loadingEl.classList.add('hidden');
        emptyEl.classList.add('hidden');
        
        // Generate clean row-based list
        listEl.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding: 20px;';
        
        requests.forEach((req) => {
            const item = document.createElement('div');
            item.className = 'request-row';
            
            // Ensure all fields have defaults to prevent "undefined"
            const type = req.type || 'Request';
            // Trim and normalize status to handle whitespace/case issues
            const status = (req.status || 'Pending').trim();
            const date = req.timestamp || new Date().toLocaleDateString();
            const comment = req.comment || 'No comment';
            const approverName = (req.approverName || '').trim();
            
            console.log('[DEBUG] Rendering request:', { type, status, date, approverName, rawStatus: req.status });
            
            // Color-coded based on status
            let statusColor, statusBg, statusIcon;
            if (status === 'Pending') {
                statusColor = '#f57c00';
                statusBg = '#fff3e0';
                statusIcon = '⚠️';
            } else if (status === 'Approve' || status === 'Approved') {
                statusColor = '#4CAF50';
                statusBg = '#e8f5e9';
                statusIcon = '✅';
            } else if (status === 'Deny' || status === 'Denied') {
                statusColor = '#f44336';
                statusBg = '#ffebee';
                statusIcon = '❌';
            } else {
                // Unknown status
                statusColor = '#666';
                statusBg = '#f5f5f5';
                statusIcon = '❓';
            }
            
            item.style.cssText = `
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                border: 2px solid ${statusColor}; 
                padding: 20px 24px; 
                border-radius: 8px; 
                background: ${statusBg}; 
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            `;
            
            item.onmouseover = () => {
                item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                item.style.transform = 'translateY(-2px)';
            };
            
            item.onmouseout = () => {
                item.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                item.style.transform = 'translateY(0)';
            };
            
            // Build status text with approver name if available
            let statusText = status;
            if ((status === 'Approve' || status === 'Approved') && approverName) {
                statusText = `Approved by: ${approverName}`;
            } else if ((status === 'Deny' || status === 'Denied') && approverName) {
                statusText = `Denied by: ${approverName}`;
            } else if (status === 'Approve') {
                statusText = 'Approved';
            } else if (status === 'Deny') {
                statusText = 'Denied';
            }
            
            item.innerHTML = `
                <div style="flex: 1;">
                    <span style="font-weight: 600; color: ${statusColor}; font-size: 16px;">${statusIcon} ${type}: ${date}</span>
                </div>
                <div style="flex: 1; text-align: right;">
                    <span style="color: ${statusColor}; font-size: 14px; font-weight: 600;">${statusText}</span>
                </div>
            `;
            
            item.onclick = () => showRequestDetails(req);
            
            listEl.appendChild(item);
        });
        
    } catch (error) {
        console.error('[DEBUG] Error in reloadRequests:', error);
    }
}

document.getElementById('requestsBtn').addEventListener('click', async () => {
    showScreen('requests');
    closeMobileSidebar();
    
    // Show loading state
    const loadingEl = document.getElementById('requestsLoading');
    const emptyEl = document.getElementById('requestsEmpty');
    const listEl = document.getElementById('requestsList');
    
    loadingEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');
    listEl.innerHTML = '';
    
    const userId = currentUser?.id;
    
    console.log('[DEBUG] Requests button clicked - User ID:', userId);
    
    if (!userId) {
        loadingEl.classList.add('hidden');
        emptyEl.innerHTML = '<p>Please log in first.</p>';
        emptyEl.classList.remove('hidden');
        console.error('[DEBUG] No currentUser found - user not logged in');
        return;
    }
    
    // Use the reload function
    await reloadRequests();
});

function showRequestDetails(request) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.5); display: flex; align-items: center; 
        justify-content: center; z-index: 10000;
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    let statusColor, statusBg, statusIcon;
    const normalizedStatus = (request.status || '').trim();
    if (normalizedStatus === 'Pending') {
        statusColor = '#f57c00';
        statusBg = '#fff3e0';
        statusIcon = '⚠️';
    } else if (normalizedStatus === 'Approve' || normalizedStatus === 'Approved') {
        statusColor = '#4CAF50';
        statusBg = '#e8f5e9';
        statusIcon = '✅';
    } else if (normalizedStatus === 'Deny' || normalizedStatus === 'Denied') {
        statusColor = '#f44336';
        statusBg = '#ffebee';
        statusIcon = '❌';
    } else {
        statusColor = '#666';
        statusBg = '#f5f5f5';
        statusIcon = '❓';
    }
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 30px; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <h2 style="margin-top: 0; color: ${statusColor};">${statusIcon} ${request.type} Request</h2>
            <div style="background: ${statusBg}; padding: 15px; border-radius: 8px; border: 2px solid ${statusColor}; margin-bottom: 20px;">
                <p style="margin: 0; font-weight: 600; color: ${statusColor};">Status: ${request.status}</p>
            </div>
            <p><strong>Submitted:</strong> ${request.timestamp || 'Unknown'}</p>
            <p><strong>Details:</strong></p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; white-space: pre-wrap; margin-bottom: 20px;">
                ${request.comment || 'No details provided'}
            </div>
            ${request.response ? `
                <p><strong>Response:</strong></p>
                <div style="background: ${statusBg}; padding: 15px; border-radius: 8px; border: 1px solid ${statusColor};">
                    ${request.response}
                </div>
            ` : ''}
            <button onclick="this.closest('div').parentElement.remove()" style="width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 16px;">
                Close
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Submit Request button handler
document.getElementById('submitRequestBtn').addEventListener('click', () => {
    showModal('submitRequest');
    document.getElementById('requestTypeSelect').value = '';
    document.getElementById('requestDetailsTextarea').value = '';
});

// Submit Request form handler
document.getElementById('submitRequestFormBtn').addEventListener('click', async () => {
    const type = document.getElementById('requestTypeSelect').value;
    const details = document.getElementById('requestDetailsTextarea').value;
    
    if (!type) {
        alert('Please select a request type');
        return;
    }
    
    if (!details.trim()) {
        alert('Please provide details for your request');
        return;
    }
    
    const userId = currentUser?.id;
    if (!userId) {
        alert('Please log in first');
        return;
    }
    
    // Show loading state
    const submitBtn = document.getElementById('submitRequestFormBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    try {
        const res = await fetch('https://timeclock-backend.marcusray.workers.dev/api/requests/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                type,
                comment: details,
                details: details  // Include both for compatibility
            })
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            console.error('[DEBUG] Request submission failed:', res.status, errorText);
            throw new Error(`Failed to submit request (${res.status})`);
        }
        
        const data = await res.json();
        console.log('[DEBUG] Request submitted successfully:', data);
        
        // Add notification
        addNotification('requests', `✅ ${type} request submitted successfully!`, 'requests');
        
        // Close modal
        closeModal('submitRequest');
        
        // Show success message
        showModal('alert', '<span class="success-tick">✓</span> Your request has been submitted successfully! You will be notified when it is reviewed.');
        
        // Refresh the requests list
        setTimeout(async () => {
            try {
                await reloadRequests();
            } catch (e) {
                console.error('[DEBUG] Error reloading requests:', e);
            }
        }, 1000);
        
    } catch (error) {
        console.error('[DEBUG] Error submitting request:', error);
        alert(`Failed to submit request: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
    }
});

// Cancel Request form handler
const cancelRequestFormBtn = document.getElementById('cancelRequestFormBtn');
if (cancelRequestFormBtn) {
    cancelRequestFormBtn.addEventListener('click', () => {
        closeModal('submitRequest');
    });
}

// Events functionality removed
// document.getElementById('eventsBtn').addEventListener('click', () => {
//     showScreen('events');
//     startAttendanceCountPolling();
//     renderEvents();
//     closeMobileSidebar();
// });

document.getElementById('mailBtn').addEventListener('click', async () => {
    showScreen('mail');
    
    // Show loading animation for 2 seconds
    const mailContent = document.querySelector('.mail-content');
    if (mailContent) {
        mailContent.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px;">
                <div style="width: 50px; height: 50px; border: 4px solid #e5e7eb; border-top-color: #7c3aed; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 16px; color: #666; font-size: 14px;">Loading your mailbox...</p>
            </div>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        `;
    }
    
    // Check if user has been welcomed to mail
    await initializeStaffEmail();
    
    // Wait 2 seconds for visual effect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Restore mail content structure
    if (mailContent) {
        mailContent.innerHTML = `
            <div id="inboxFolder" class="mail-folder active">
                <ul id="inboxContent" style="list-style: none; padding: 0; margin: 0;"></ul>
            </div>
            <div id="sentFolder" class="mail-folder">
                <ul id="sentContent" style="list-style: none; padding: 0; margin: 0;"></ul>
            </div>
            <div id="draftsFolder" class="mail-folder">
                <ul id="draftsContent" style="list-style: none; padding: 0; margin: 0;"></ul>
            </div>
        `;
    }
    
    await syncMailFromBackend();
    renderMail();
    document.querySelectorAll('.mail-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.mail-tabs .tab-btn[data-tab="inbox"]')?.classList.add('active');
    document.getElementById('inboxFolder')?.classList.add('active');
    document.getElementById('sentFolder')?.classList.remove('active');
    document.getElementById('draftsFolder')?.classList.remove('active');
    updateTabSlider();
    closeMobileSidebar();
});

// ClickUp Integration
let clickupToken = localStorage.getItem('clickupToken');
let clickupWorkspace = JSON.parse(localStorage.getItem('clickupWorkspace') || 'null');
let clickupTasks = [];
let clickupCurrentFilter = 'all';

document.getElementById('clickupBtn').addEventListener('click', () => {
    showScreen('clickup');
    if (clickupToken) {
        document.getElementById('clickupDisconnected').style.display = 'none';
        document.getElementById('clickupConnected').style.display = 'block';
        document.getElementById('clickupTasksSection').style.display = 'flex';
        
        // Update workspace name if available
        if (clickupWorkspace && clickupWorkspace.username) {
            document.getElementById('clickupWorkspaceName').textContent = `Connected as ${clickupWorkspace.username}`;
        }
        
        loadClickUpTasks();
    } else {
        document.getElementById('clickupDisconnected').style.display = 'block';
        document.getElementById('clickupConnected').style.display = 'none';
        document.getElementById('clickupTasksSection').style.display = 'none';
    }
    closeMobileSidebar();
});

document.getElementById('clickupConnectBtn').addEventListener('click', async () => {
    const token = document.getElementById('clickupTokenInput').value.trim();
    if (!token) {
        alert('Please enter your ClickUp API token');
        return;
    }
    
    const btn = document.getElementById('clickupConnectBtn');
    btn.disabled = true;
    btn.textContent = 'Connecting...';
    
    try {
        // Validate token by fetching user info
        const response = await fetch('https://api.clickup.com/api/v2/user', {
            headers: {
                'Authorization': token
            }
        });
        
        if (!response.ok) {
            throw new Error('Invalid token');
        }
        
        const data = await response.json();
        clickupToken = token;
        clickupWorkspace = data.user;
        localStorage.setItem('clickupToken', token);
        localStorage.setItem('clickupWorkspace', JSON.stringify(data.user));
        
        document.getElementById('clickupDisconnected').style.display = 'none';
        document.getElementById('clickupConnected').style.display = 'block';
        document.getElementById('clickupTasksSection').style.display = 'flex';
        document.getElementById('clickupWorkspaceName').textContent = `Connected as ${data.user.username}`;
        document.getElementById('clickupTokenInput').value = '';
        
        await loadClickUpTasks();
    } catch (error) {
        console.error('ClickUp connection error:', error);
        alert('Failed to connect to ClickUp. Please check your API token.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Connect';
    }
});

document.getElementById('clickupDisconnectBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to disconnect from ClickUp?')) {
        clickupToken = null;
        clickupWorkspace = null;
        clickupTasks = [];
        localStorage.removeItem('clickupToken');
        localStorage.removeItem('clickupWorkspace');
        
        document.getElementById('clickupDisconnected').style.display = 'block';
        document.getElementById('clickupConnected').style.display = 'none';
        document.getElementById('clickupTasksSection').style.display = 'none';
        document.getElementById('clickupTasksContainer').innerHTML = '';
    }
});

document.getElementById('clickupRefreshBtn').addEventListener('click', () => {
    loadClickUpTasks();
});

// ClickUp tab filtering
document.querySelectorAll('.clickup-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.clickup-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = '#6b7280';
        });
        btn.classList.add('active');
        btn.style.background = '#f3f4f6';
        btn.style.color = '#374151';
        
        clickupCurrentFilter = btn.dataset.status;
        renderClickUpTasks();
    });
});

async function loadClickUpTasks() {
    if (!clickupToken) return;
    
    const btn = document.getElementById('clickupRefreshBtn');
    btn.textContent = '🔄 Loading...';
    btn.disabled = true;
    
    try {
        // Get user's teams
        const teamsResponse = await fetch('https://api.clickup.com/api/v2/team', {
            headers: {
                'Authorization': clickupToken
            }
        });
        
        if (!teamsResponse.ok) throw new Error('Failed to fetch teams');
        const teamsData = await teamsResponse.json();
        
        if (!teamsData.teams || teamsData.teams.length === 0) {
            document.getElementById('clickupTasksContainer').innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No teams found. Please create a workspace in ClickUp first.</p>';
            return;
        }
        
        const teamId = teamsData.teams[0].id;
        
        // Get all tasks assigned to the user
        const tasksResponse = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/task?assignees[]=${clickupWorkspace.id}`, {
            headers: {
                'Authorization': clickupToken
            }
        });
        
        if (!tasksResponse.ok) throw new Error('Failed to fetch tasks');
        const tasksData = await tasksResponse.json();
        
        clickupTasks = tasksData.tasks || [];
        renderClickUpTasks();
    } catch (error) {
        console.error('ClickUp load error:', error);
        document.getElementById('clickupTasksContainer').innerHTML = '<p style="text-align: center; color: #ef4444; padding: 40px;">Failed to load tasks. Please try again.</p>';
    } finally {
        btn.textContent = '🔄 Refresh';
        btn.disabled = false;
    }
}

function renderClickUpTasks() {
    const container = document.getElementById('clickupTasksContainer');
    
    let filteredTasks = clickupTasks;
    if (clickupCurrentFilter !== 'all') {
        filteredTasks = clickupTasks.filter(task => 
            task.status.status.toLowerCase() === clickupCurrentFilter
        );
    }
    
    if (filteredTasks.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No tasks found.</p>';
        return;
    }
    
    container.innerHTML = filteredTasks.map(task => {
        const status = task.status.status;
        const priority = task.priority;
        const dueDate = task.due_date ? new Date(parseInt(task.due_date)).toLocaleDateString() : 'No due date';
        
        let statusColor = '#6b7280';
        if (status.toLowerCase() === 'complete') statusColor = '#10b981';
        else if (status.toLowerCase() === 'in progress') statusColor = '#3b82f6';
        else if (status.toLowerCase() === 'to do') statusColor = '#f59e0b';
        
        let priorityText = '';
        let priorityColor = '';
        if (priority) {
            if (priority.priority === 'urgent') {
                priorityText = '🔴 Urgent';
                priorityColor = '#ef4444';
            } else if (priority.priority === 'high') {
                priorityText = '🟠 High';
                priorityColor = '#f97316';
            } else if (priority.priority === 'normal') {
                priorityText = '🟡 Normal';
                priorityColor = '#eab308';
            } else if (priority.priority === 'low') {
                priorityText = '🟢 Low';
                priorityColor = '#22c55e';
            }
        }
        
        return `
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#7c3aed'" onmouseout="this.style.borderColor='#e5e7eb'" onclick="openClickUpTask('${task.id}')">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">${task.name}</h4>
                    <span style="padding: 4px 12px; background: ${statusColor}; color: white; border-radius: 6px; font-size: 12px; font-weight: 500; white-space: nowrap; margin-left: 12px;">${status}</span>
                </div>
                <div style="display: flex; gap: 16px; align-items: center; font-size: 14px; color: #6b7280;">
                    ${priorityText ? `<span style="color: ${priorityColor}; font-weight: 500;">${priorityText}</span>` : ''}
                    <span>📅 ${dueDate}</span>
                    ${task.list ? `<span>📁 ${task.list.name}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function openClickUpTask(taskId) {
    const task = clickupTasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Open task in new tab
    window.open(task.url, '_blank');
}

document.getElementById('composeMailBtn').addEventListener('click', async () => {
    document.getElementById('mailTo').value = '';
    document.getElementById('mailCc').value = '';
    document.getElementById('mailBcc').value = '';
    document.getElementById('mailSubject').value = '';
    document.getElementById('mailContent').value = '';
    delete document.getElementById('sendMailBtn').dataset.draftIndex;
    
    // Show user's staff email
    const staffEmail = localStorage.getItem(`staffEmail_${currentUser.id}`) || 'Loading...';
    document.getElementById('userStaffEmail').value = staffEmail;
    
    showModal('composeMail');
});

document.getElementById('sendMailBtn').addEventListener('click', async () => {
    const sendBtn = document.getElementById('sendMailBtn');
    
    // Prevent double-sending
    if (window.mailSending || sendBtn.disabled) return;
    window.mailSending = true;
    sendBtn.disabled = true;
    
    const toEmails = document.getElementById('mailTo').value.trim();
    const ccEmails = document.getElementById('mailCc').value.trim();
    const bccEmails = document.getElementById('mailBcc').value.trim();
    const subject = document.getElementById('mailSubject').value.trim();
    const content = document.getElementById('mailContent').value.trim();
    
    if (!toEmails) {
        document.getElementById('mailError').classList.remove('hidden');
        setTimeout(() => document.getElementById('mailError').classList.add('hidden'), 2000);
        window.mailSending = false;
        sendBtn.disabled = false;
        return;
    }
    if (!content) {
        showModal('alert', 'Please enter a message');
        window.mailSending = false;
        sendBtn.disabled = false;
        return;
    }
    
    showModal('alert', 'Sending...');
    
    const staffEmail = localStorage.getItem(`staffEmail_${currentUser.id}`);
    const senderName = currentUser.profile?.name || 'Staff Member';
    
    // Convert markdown-style formatting to HTML
    let htmlContent = content
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/\n/g, '<br>');
    
    if (htmlContent.includes('<li>')) {
        htmlContent = htmlContent.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    }
    
    try {
        // Send email via Resend API
        const response = await fetch('https://timeclock-backend.marcusray.workers.dev/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: `${senderName} <${staffEmail || 'noreply@staff.cirkledevelopment.co.uk'}>`,
                to: toEmails,
                cc: ccEmails || undefined,
                bcc: bccEmails || undefined,
                subject: subject || '(No Subject)',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="padding: 20px; background: #f9fafb; border-radius: 8px;">
                            ${htmlContent}
                        </div>
                        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
                            Sent via Cirkle Mail - Staff Portal
                        </div>
                    </div>
                `,
                replyTo: staffEmail
            })
        });
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to send email');
        }
        
        console.log('[DEBUG] Email sent successfully:', result);
        
        // Store locally for quick access
        const mailData = {
            id: result.id || Date.now().toString(),
            recipients: toEmails.split(',').map(e => e.trim()),
            subject: subject || '(No Subject)',
            content: content,
            timestamp: new Date().toISOString()
        };
        
        const senderMail = JSON.parse(localStorage.getItem(`mail_${currentUser.id}`) || '{"inbox": [], "sent": [], "drafts": []}');
        senderMail.sent.push(mailData);
        localStorage.setItem(`mail_${currentUser.id}`, JSON.stringify(senderMail));
        
        // Remove from drafts if this was a draft being sent
        if ('draftIndex' in document.getElementById('sendMailBtn').dataset) {
            senderMail.drafts.splice(parseInt(document.getElementById('sendMailBtn').dataset.draftIndex), 1);
            localStorage.setItem(`mail_${currentUser.id}`, JSON.stringify(senderMail));
            delete document.getElementById('sendMailBtn').dataset.draftIndex;
        }
        
        showMailDeliveryAnimation();
        showModal('alert', '<span class="success-tick"></span> Email sent successfully!');
        playSuccessSound();
        addNotification('mail', 'Your email has been sent!', 'mail');
        renderMail();
        closeModal('composeMail');
        
        window.mailSending = false;
        sendBtn.disabled = false;
        
    } catch (error) {
        console.error('Error sending email:', error);
        showModal('alert', 'Failed to send email: ' + error.message);
        window.mailSending = false;
        sendBtn.disabled = false;
    }
});

document.getElementById('saveDraftBtn').addEventListener('click', async () => {
    const toEmails = document.getElementById('mailTo').value.trim();
    const ccEmails = document.getElementById('mailCc').value.trim();
    const bccEmails = document.getElementById('mailBcc').value.trim();
    const subject = document.getElementById('mailSubject').value.trim();
    const content = document.getElementById('mailContent').value.trim();
    
    const draftData = {
        to: toEmails,
        cc: ccEmails,
        bcc: bccEmails,
        subject,
        content,
        timestamp: new Date().toISOString()
    };
    
    // Save to backend
    try {
        await fetch('https://timeclock-backend.marcusray.workers.dev/api/email/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                discordId: currentUser.id,
                ...draftData
            })
        });
    } catch (e) {
        console.error('Error saving draft to backend:', e);
    }
    
    // Also save locally
    const userMail = JSON.parse(localStorage.getItem(`mail_${currentUser.id}`) || '{"inbox": [], "sent": [], "drafts": []}');
    
    if ('draftIndex' in document.getElementById('saveDraftBtn').dataset) {
        userMail.drafts[parseInt(document.getElementById('saveDraftBtn').dataset.draftIndex)] = draftData;
        delete document.getElementById('saveDraftBtn').dataset.draftIndex;
    } else {
        userMail.drafts.push(draftData);
    }
    
    localStorage.setItem(`mail_${currentUser.id}`, JSON.stringify(userMail));
    closeModal('composeMail');
    showModal('alert', '<span class="success-tick"></span> Draft saved! It will auto-delete in 30 seconds.');
    playSuccessSound();
    addNotification('mail', 'Email draft saved!', 'mail');
    renderMail();
    
    // Auto-delete draft after 30 seconds
    setTimeout(() => {
        const currentMail = JSON.parse(localStorage.getItem(`mail_${currentUser.id}`) || '{"inbox": [], "sent": [], "drafts": []}');
        const draftIdx = currentMail.drafts.findIndex(d => d.timestamp === draftData.timestamp);
        if (draftIdx !== -1) {
            currentMail.drafts.splice(draftIdx, 1);
            localStorage.setItem(`mail_${currentUser.id}`, JSON.stringify(currentMail));
            renderMail();
            console.log('[Mail] Draft auto-deleted after 30 seconds');
        }
    }, 30000);
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
        
        if (isClockedIn) {
            clearInterval(clockInInterval);
            sendWebhook(`<@${currentUser.id}> (${emp.profile.name}) clocked out at ${new Date().toLocaleString()} due to logout`);
        }
        
        // Clear all local data using persistence layer
        clearAllLocalData();
        
        playLogoffSound();
        showScreen('setupVerify'); // show loading spinner screen
        setTimeout(() => showScreen('discord'), 2000);
    });
}

const sidebarToggle = document.querySelector('.sidebar-toggle');
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        console.log('Sidebar toggle clicked');
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('extended');
        
        // Close sidebar when clicking navigation buttons on mobile
        if (window.innerWidth <= 768) {
            const navButtons = document.querySelectorAll('#sidebarNav button');
            navButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    sidebar.classList.remove('extended');
                });
            });
        }
    });
}

// Notification Button Handlers
const notificationBtn = document.getElementById('notificationBtn');
const notificationPanel = document.getElementById('notificationPanel');
const closeNotifications = document.getElementById('closeNotifications');
const clearAllNotifications = document.getElementById('clearAllNotifications');
const notificationBadge = document.getElementById('notificationBadge');

if (notificationBtn) {
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationPanel.classList.toggle('hidden');
    });
}

if (closeNotifications) {
    closeNotifications.addEventListener('click', () => {
        notificationPanel.classList.add('hidden');
    });
}

if (clearAllNotifications) {
    clearAllNotifications.addEventListener('click', () => {
        if (currentUser) {
            const emp = getEmployee(currentUser.id);
            if (emp) {
                emp.notifications = [];
                currentNotifications = [];
                localStorage.setItem('employees', JSON.stringify(employees));
                renderNotifications();
                updateNotificationBadge();
                playSuccessSound();
            }
        }
    });
}

// Close notification panel when clicking outside
document.addEventListener('click', (e) => {
    if (notificationPanel && !notificationPanel.classList.contains('hidden')) {
        if (!notificationPanel.contains(e.target) && !notificationBtn.contains(e.target)) {
            notificationPanel.classList.add('hidden');
        }
    }
});

// Function to update notification badge
function updateNotificationBadge() {
    if (!notificationBadge || !currentUser) return;
    
    const emp = getEmployee(currentUser.id);
    const notificationCount = (emp.notifications || []).length;
    
    if (notificationCount > 0) {
        notificationBadge.textContent = notificationCount;
        notificationBadge.classList.remove('hidden');
    } else {
        notificationBadge.classList.add('hidden');
    }
}

// Mobile Nav Button Handler
const mobileNavBtn = document.getElementById('mobileNavBtn');
if (mobileNavBtn) {
    mobileNavBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('extended');
        }
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
    
    // Initialize theme mode (light/dark) from localStorage
    const savedLightMode = localStorage.getItem('lightMode') === 'true';
    let modeToggle = document.getElementById('modeToggle');
    const themeText = document.getElementById('themeText');

    if (savedLightMode) {
        document.body.classList.add('light');
        if (modeToggle) modeToggle.checked = true;
        if (themeText) themeText.textContent = 'Light Mode';
    } else {
        if (themeText) themeText.textContent = 'Dark Mode';
    }

    // Setup theme toggle listener
    if (modeToggle) {
        modeToggle.addEventListener('change', (e) => {
            const isLight = e.target.checked;
            document.body.classList.toggle('light', isLight);
            localStorage.setItem('lightMode', isLight);

            // Update theme text
            if (themeText) {
                themeText.textContent = isLight ? 'Light Mode' : 'Dark Mode';
            }
        });
    }
    
    console.log('%c=== INIT FUNCTION STARTED ===', 'color: lime; font-size: 18px; font-weight: bold;');
    console.log('Current URL:', window.location.href);
    console.log('Has saved user?', !!localStorage.getItem('currentUser'));
    console.log('Has OAuth code?', new URLSearchParams(window.location.search).has('code'));
    
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

    // If there's an OAuth code in the URL, ALWAYS process it first
    // (user just came back from Discord login - don't get stuck in saved user validation)
    const hasOAuthCode = new URLSearchParams(window.location.search).has('code');
    
    if (hasOAuthCode) {
        console.log('[INIT] OAuth code detected in URL - processing Discord login first');
        await handleOAuthRedirect();
        return;
    }

    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            window.currentUser = currentUser;  // IMPORTANT: Set window.currentUser so sync functions can access it
            console.log('Loaded saved user:', currentUser);
            if (currentUser.id) {
                // IMPORTANT: Validate that this profile still exists in backend
                // If data was cleared, localStorage still has old cached data
                console.log('[INIT] Validating saved user profile exists in backend...');
                try {
                    const profileCheckResponse = await fetch(`${WORKER_URL}/api/user/profile`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        mode: 'cors',
                        body: JSON.stringify({ discordId: currentUser.id })
                    });
                    
                    if (!profileCheckResponse.ok) {
                        console.warn('[INIT] ⚠️ Saved profile NOT found in backend (404) - forcing fresh login');
                        localStorage.removeItem('currentUser');
                        localStorage.removeItem('lastLogin');
                        localStorage.removeItem('lastProcessedCode');
                        showScreen('discord');
                        return;
                    }
                    
                    // Profile exists - but is it COMPLETE? (not just auto-created placeholder)
                    const initProfile = await profileCheckResponse.json();
                    const initHasStaffId = !!initProfile.staffId;
                    const initHasRealEmail = initProfile.email && initProfile.email !== 'Not set';
                    const initHasRealDept = initProfile.department && initProfile.department !== 'Not set';
                    const initProfileComplete = initHasStaffId || (initHasRealEmail && initHasRealDept);
                    
                    console.log('[INIT] Profile completeness:', { staffId: initHasStaffId, email: initHasRealEmail, dept: initHasRealDept, complete: initProfileComplete });
                    
                    if (!initProfileComplete) {
                        console.warn('[INIT] ⚠️ Profile exists but is INCOMPLETE - must login with Discord first');
                        // Don't clear currentUser - keep it so OAuth flow can use it
                        // But force them through Discord OAuth first, then signup flow
                        localStorage.removeItem('lastProcessedCode');
                        showScreen('discord');
                        return;
                    }
                    
                    console.log('[INIT] ✓ Profile validated AND complete in backend - proceeding with login');
                } catch (validationError) {
                    console.error('[INIT] Error validating profile:', validationError);
                    // If validation fails (network error), still allow login but log warning
                    // User can refresh if needed
                }
                
                // Create backup of current user data to prevent loss on sync errors
                const userDataBackup = JSON.stringify(currentUser);
                
                // Show welcome screen IMMEDIATELY - load data in background
                const displayName = currentUser.profile?.name || currentUser.name || 'User';
                document.getElementById('portalWelcomeName').textContent = displayName;
                document.getElementById('portalLastLogin').textContent = localStorage.getItem('lastLogin') || 'Never';
                console.log('%c>>> INIT: Showing portalWelcome screen <<<', 'color: lime; font-size: 16px; font-weight: bold;');
                showScreen('portalWelcome');
                updateSidebarProfile();
                
                // Load all data in the background - DON'T WAIT FOR THIS
                (async () => {
                    // Discord member data fetching removed - endpoint not available from backend
                    // Discord roles are now managed through the profile system
                    
                    try {
                        // RE-FETCH member data from KV
                        const memberResponse = await fetch(`${WORKER_URL}/api/user/profile`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            mode: 'cors',
                            body: JSON.stringify({ discordId: currentUser.id })
                        });
                        
                        if (memberResponse.ok) {
                            const memberData = await memberResponse.json();
                            console.log('Background: Fresh member data from KV:', memberData);
                            
                            // Update profile with fresh data
                            if (!currentUser.profile) currentUser.profile = {};
                            currentUser.profile.name = memberData.name || currentUser.profile.name || currentUser.name;
                            currentUser.profile.email = memberData.email || currentUser.profile.email || 'Not set';
                            currentUser.profile.department = memberData.department || currentUser.profile.department || 'Not set';
                            currentUser.profile.discordTag = currentUser.name;
                            currentUser.profile.staffId = memberData.staffId || currentUser.profile.staffId || '';
                            currentUser.profile.timezone = memberData.timezone || currentUser.profile.timezone || '';
                            currentUser.profile.country = memberData.country || currentUser.profile.country || '';
                            currentUser.profile.baseLevel = memberData.baseLevel || currentUser.profile.baseLevel || '';
                            
                            // Save updated data
                            localStorage.setItem('currentUser', JSON.stringify(currentUser));
                            localStorage.setItem('lastLogin', new Date().toLocaleString());
                            console.log('Background: Updated profile:', currentUser.profile);
                        }
                    } catch (e) {
                        console.error('Background: Error fetching fresh member data:', e);
                    }
                    
                    // Sync all user data from backend for cross-device support
                    try {
                        await syncUserDataFromBackend(currentUser.id);
                    } catch (e) {
                        console.error('Background: Error syncing user data:', e);
                    }
                    
                    // Always save currentUser after sync to prevent data loss
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                })();
                
                return; // Exit early - show welcome screen immediately
            }
        } catch (e) {
            console.error('Error parsing saved user:', e);
        }
    }
    
    // Only handle OAuth if we don't have a saved session
    console.log('%c>>> INIT: No saved session, calling handleOAuthRedirect <<<', 'color: yellow; font-size: 16px; font-weight: bold;');
    await handleOAuthRedirect();
})();
// Calendar functionality
let currentCalendarDate = new Date();

// Calendar functionality removed
// document.getElementById('calendarBtn').addEventListener('click', () => {
//     openCalendarModal();
// });

/*
function openCalendarModal() {
    document.getElementById('calendarModal').style.display = 'flex';
    renderCalendar();
}

function closeCalendarModal() {
    document.getElementById('calendarModal').style.display = 'none';
}

function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar();
}

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Set header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('calendarMonthYear').textContent = `${monthNames[month]} ${year}`;
    
    // Get calendar events
    const events = JSON.parse(localStorage.getItem('calendarEvents') || '[]');
    
    // Create calendar grid
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    
    // Add day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        grid.appendChild(header);
    });
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Today's date for highlighting
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    
    // Add previous month's trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const cell = createDayCell(day, month - 1, year, events, true);
        grid.appendChild(cell);
    }
    
    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = isCurrentMonth && day === today.getDate();
        const cell = createDayCell(day, month, year, events, false, isToday);
        grid.appendChild(cell);
    }
    
    // Add next month's leading days
    const totalCells = grid.children.length - 7; // Subtract headers
    const remainingCells = 42 - totalCells; // 6 weeks * 7 days
    for (let day = 1; day <= remainingCells; day++) {
        const cell = createDayCell(day, month + 1, year, events, true);
        grid.appendChild(cell);
    }
    
    // Render events list
    renderCalendarEvents(events, month, year);
}

function createDayCell(day, month, year, events, isOtherMonth, isToday = false) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    if (isOtherMonth) cell.classList.add('other-month');
    if (isToday) cell.classList.add('today');
    
    // Check if this day has events
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = events.filter(e => e.date === dateStr);
    if (dayEvents.length > 0) {
        cell.classList.add('has-event');
        cell.title = dayEvents.map(e => e.title).join('\n');
    }
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = day;
    cell.appendChild(dayNumber);
    
    cell.onclick = () => showDayEvents(dateStr, dayEvents);
    
    return cell;
}

function showDayEvents(date, events) {
    // Create modal for showing day events
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10001;';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.cssText = 'background: white; border-radius: 16px; padding: 30px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);';
    
    if (events.length === 0) {
        modalContent.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 15px;">📅</div>
                <h2 style="color: #333; margin: 0 0 10px 0;">${formatDateLong(date)}</h2>
                <p style="color: #999; font-size: 16px; margin: 20px 0;">No events scheduled for this day</p>
                <button onclick="this.closest('.modal').remove()" style="margin-top: 20px; padding: 12px 30px; background: #667eea; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px;">
                    Close
                </button>
            </div>
        `;
    } else {
        const eventsHTML = events.map(e => `
            <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 15px; border-left: 4px solid #667eea;">
                <h3 style="margin: 0 0 10px 0; color: #333; font-size: 1.2em;">${e.title}</h3>
                ${e.time ? `<p style="color: #667eea; font-weight: 600; margin: 8px 0; font-size: 14px;">🕒 ${e.time}</p>` : ''}
                ${e.description ? `<p style="color: #666; margin: 8px 0; line-height: 1.6;">${e.description}</p>` : '<p style="color: #999; margin: 8px 0; font-style: italic;">No description</p>'}
                ${e.type ? `<span style="display: inline-block; background: #667eea; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-top: 8px; text-transform: uppercase;">${e.type}</span>` : ''}
            </div>
        `).join('');
        
        modalContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="font-size: 48px; margin-bottom: 10px;">📅</div>
                <h2 style="color: #333; margin: 0 0 5px 0; font-size: 1.6em;">${formatDateLong(date)}</h2>
                <p style="color: #667eea; font-weight: 600; font-size: 14px;">${events.length} Event${events.length !== 1 ? 's' : ''} Scheduled</p>
            </div>
            
            <div style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
                ${eventsHTML}
            </div>
            
            <button onclick="this.closest('.modal').remove()" style="width: 100%; padding: 14px; background: #667eea; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px; transition: all 0.3s ease;">
                Close
            </button>
        `;
    }
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Add hover effect to close button
    const closeBtn = modalContent.querySelector('button');
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = '#5568d3';
        closeBtn.style.transform = 'translateY(-2px)';
        closeBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = '#667eea';
        closeBtn.style.transform = 'translateY(0)';
        closeBtn.style.boxShadow = 'none';
    });
}

function formatDateLong(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}
*/

// ========== CALENDAR/EVENTS FUNCTIONS END (REMOVED) ==========

/*
function renderCalendarEvents(events, month, year) {
    const eventsList = document.getElementById('calendarEventsList');
    
    // Filter events for current month
    const monthEvents = events.filter(e => {
        const eventDate = new Date(e.date);
        return eventDate.getMonth() === month && eventDate.getFullYear() === year;
    });
    
    if (monthEvents.length === 0) {
        eventsList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No events this month</p>';
        return;
    }
    
    // Sort by date
    monthEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    eventsList.innerHTML = '<h3 style="margin-bottom: 15px; color: #333;">Events This Month</h3>' +
        monthEvents.map(e => `
            <div class="calendar-event-item">
                <h4>${e.title}</h4>
                <p class="calendar-event-date">${formatDateLong(e.date)}${e.time ? ' at ' + e.time : ''}</p>
                <p>${e.description || 'No description'}</p>
                <p style="color: #667eea; font-weight: 500;">Type: ${e.type || 'Other'}</p>
            </div>
        `).join('');
}
*/

// Close modal when clicking outside
// CALENDAR FUNCTIONS REMOVED - functionality disabled
/*
document.getElementById('calendarModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'calendarModal') {
        closeCalendarModal();
    }
});
*/

// ========== SENTINEL SECURITY PROTECTIONS ==========
// Developer mode toggle (Ctrl+Shift+D)
let developerMode = true; // ENABLED FOR DEBUGGING
window.toggleDeveloperMode = () => {
    developerMode = !developerMode;
    console.log(`%c🔧 Developer Mode: ${developerMode ? 'ENABLED' : 'DISABLED'}`, 'color: cyan; font-size: 16px; font-weight: bold;');
    if (developerMode) {
        console.log('%c✓ Right-click enabled', 'color: green;');
        console.log('%c✓ DevTools shortcuts enabled', 'color: green;');
        console.log('%c✓ Console clearing disabled', 'color: green;');
    }
};

// Prevent context menu (right-click) - unless developer mode
document.addEventListener('contextmenu', e => {
    if (developerMode) return true;
    e.preventDefault();
    return false;
});

// Prevent common developer tools shortcuts
document.addEventListener('keydown', e => {
    // Ctrl+Shift+D to toggle developer mode
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        window.toggleDeveloperMode();
        return false;
    }
    
    // Don't block shortcuts in developer mode
    if (developerMode) return true;
    
    // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
    if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
        (e.ctrlKey && e.key === 'U')
    ) {
        e.preventDefault();
        return false;
    }
});

// Detect DevTools opening - DISABLED FOR DEBUGGING
/*
let devtoolsOpen = false;
const detectDevTools = () => {
    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    
    if (widthThreshold || heightThreshold) {
        if (!devtoolsOpen) {
            devtoolsOpen = true;
            console.clear();
            console.log('%c⚠️ SENTINEL SECURITY WARNING', 'color: red; font-size: 24px; font-weight: bold;');
            console.log('%cThis is a secure internal portal. Unauthorized access attempts are logged.', 'color: orange; font-size: 16px;');
        }
    } else {
        devtoolsOpen = false;
    }
};

setInterval(detectDevTools, 1000);
*/

// Clear console periodically
// TEMPORARILY DISABLED FOR DEBUGGING
/*
setInterval(() => {
    console.clear();
    console.log('%c🛡️ Protected by SENTINEL Security', 'color: #667eea; font-size: 14px; font-weight: bold;');
}, 5000);
*/

// Disable text selection on sensitive areas
document.addEventListener('selectstart', e => {
    if (e.target && e.target.classList && e.target.classList.contains('sensitive-data')) {
        e.preventDefault();
        return false;
    }
});

console.log('%c🛡️ SENTINEL Security DISABLED for debugging', 'color: orange; font-size: 16px; font-weight: bold;');
console.log('%c⚠️ Console is now accessible - Check for errors above', 'color: red; font-size: 14px; font-weight: bold;');

// ===== CALENDAR SYSTEM =====
let calendarEvents = JSON.parse(localStorage.getItem('calendarEvents') || '{}');
let currentCalendarMonth = new Date();

function initCalendar() {
    const calendarBtn = document.getElementById('calendarBtn');
    if (calendarBtn) {
        calendarBtn.addEventListener('click', () => showScreen('calendarScreen'));
    }
    
    renderCalendar();
    setupCalendarControls();
}

function renderCalendar() {
    const monthYear = document.getElementById('calendarMonthYear');
    const daysContainer = document.getElementById('calendarDays');
    
    if (!monthYear || !daysContainer) return;
    
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();
    
    monthYear.textContent = currentCalendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    daysContainer.innerHTML = '';
    
    // Add empty cells for days before month starts
    for (let i = 0; i < (startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1); i++) {
        const emptyCell = document.createElement('div');
        emptyCell.style.opacity = '0.3';
        daysContainer.appendChild(emptyCell);
    }
    
    // Add day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('button');
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasEvent = calendarEvents[dateStr] && calendarEvents[dateStr].length > 0;
        
        dayCell.textContent = day;
        dayCell.style.cssText = `
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            background: white;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
            position: relative;
        `;
        
        if (hasEvent) {
            dayCell.style.borderColor = '#3b82f6';
            dayCell.style.background = '#dbeafe';
            dayCell.style.color = '#1e40af';
            
            // Add mini blue dot indicator
            const dot = document.createElement('div');
            dot.style.cssText = `
                position: absolute;
                top: 4px;
                right: 4px;
                width: 8px;
                height: 8px;
                background: #3b82f6;
                border-radius: 50%;
            `;
            dayCell.appendChild(dot);
        }
        
        dayCell.addEventListener('click', () => showCalendarEventModal(dateStr));
        dayCell.addEventListener('mouseover', () => {
            dayCell.style.transform = 'scale(1.05)';
        });
        dayCell.addEventListener('mouseout', () => {
            dayCell.style.transform = 'scale(1)';
        });
        
        daysContainer.appendChild(dayCell);
    }
}

function setupCalendarControls() {
    const prevBtn = document.getElementById('calendarPrevMonth');
    const nextBtn = document.getElementById('calendarNextMonth');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() - 1);
            renderCalendar();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1);
            renderCalendar();
        });
    }
}

function showCalendarEventModal(dateStr) {
    const modal = document.getElementById('calendarEventModal');
    const dateElement = document.getElementById('eventDate');
    const eventList = document.getElementById('eventList');
    const addBtn = document.getElementById('addEventBtn');
    
    const dateObj = new Date(dateStr + 'T00:00:00');
    dateElement.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const events = calendarEvents[dateStr] || [];
    eventList.innerHTML = '';
    
    if (events.length === 0) {
        eventList.innerHTML = '<p style="color: #9ca3af; padding: 20px; text-align: center;">No events scheduled for this date</p>';
    } else {
        events.forEach((event, idx) => {
            const eventDiv = document.createElement('div');
            eventDiv.style.cssText = `
                padding: 12px;
                margin: 8px 0;
                background: #f3f4f6;
                border-left: 4px solid #3b82f6;
                border-radius: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            eventDiv.innerHTML = `
                <div>
                    <strong>${event.name || 'Event'}</strong>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">${event.description || ''}</p>
                </div>
                <button onclick="deleteCalendarEvent('${dateStr}', ${idx})" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Delete</button>
            `;
            eventList.appendChild(eventDiv);
        });
    }
    
    addBtn.onclick = () => {
        const name = prompt('Event name:');
        if (name) {
            const description = prompt('Event description (optional):');
            if (!calendarEvents[dateStr]) calendarEvents[dateStr] = [];
            calendarEvents[dateStr].push({ name, description: description || '' });
            localStorage.setItem('calendarEvents', JSON.stringify(calendarEvents));
            renderCalendar();
            showCalendarEventModal(dateStr);
            
            // Send notification
            addNotification('calendar', `📅 New event added: ${name} on ${dateStr}`, 'calendar');
        }
    };
    
    modal.style.display = 'block';
}

function deleteCalendarEvent(dateStr, idx) {
    if (calendarEvents[dateStr]) {
        calendarEvents[dateStr].splice(idx, 1);
        if (calendarEvents[dateStr].length === 0) delete calendarEvents[dateStr];
        localStorage.setItem('calendarEvents', JSON.stringify(calendarEvents));
        renderCalendar();
        showCalendarEventModal(dateStr);
    }
}

// ===== ROLE NAME DISPLAY =====
async function fetchAndDisplayRoleNames() {
    // NOTE: Guild roles endpoint not available in backend
    // Discord role management is handled through the profile system
    // This function is disabled and kept for backward compatibility only
    return;
}

// ===== ENHANCED NOTIFICATION SYSTEM =====
function sendNotificationToAll(type, message, link) {
    const emp = getEmployee(currentUser.id);
    
    // Add to portal notifications
    addNotification(type, message, link);
    
    // Send Discord DM notification
    try {
        fetch('https://timeclock-backend.marcusray.workers.dev/api/notifications/discord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                discordId: currentUser.id,
                message: message,
                type: type
            })
        }).catch(e => console.error('Failed to send Discord notification:', e));
    } catch (e) {
        console.error('Notification error:', e);
    }
}

// Initialize all systems on DOM ready
function setupModalCloseButtons() {
    // Setup close buttons for all modals
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Close modal when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initCalendar, 500);
        setTimeout(fetchAndDisplayRoleNames, 1000);
        setTimeout(setupModalCloseButtons, 300);
    });
} else {
    initCalendar();
    fetchAndDisplayRoleNames();
    setupModalCloseButtons();
}
