const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const path = require('path');
const FormData = require('form-data');
const { Readable } = require('stream');

// --- Global Variables & Constants ---
const API_BASE_URL = 'https://nodefibear.onrender.com/api/admin';
const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000; 
let mainWindow;
let store;
let isRefreshing = false;
let refreshPromise = null;

// --- Initialization ---
async function initializeStore() {
    try {
        const { default: Store } = await import('electron-store');
        store = new Store();
        console.log('✅ electron-store initialized successfully.');
    } catch (error) {
        console.error('❌ Failed to initialize electron-store:', error);
        app.quit();
    }
}

async function warmUpServer(retries = 10, delayMs = 2000) {
    console.log(' Pinging server to wake it up...');
    for (let i = 0; i < retries; i++) {
        try {
            console.log(` Attempting to warm up server (attempt ${i + 1}/${retries})...`);
            const res = await fetch(API_BASE_URL.replace('/api/admin', '/'), { signal: AbortSignal.timeout(5000) }); 
            if (res.ok) {
                console.log(`✅ Server is warm and responded with status: ${res.status}`);
                return true;
            } else {
                console.warn(`⚠️ Server responded to warm-up ping with non-OK status: ${res.status}. Retrying...`);
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.warn(`⚠️ Server warm-up ping timed out (attempt ${i + 1}/${retries}). Retrying...`);
            } else {
                console.error(`❌ Server warm-up ping failed (attempt ${i + 1}/${retries}):`, err.message, '. Retrying...');
            }
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    console.error('❌ Server warm-up failed after multiple retries. The application might not function correctly.');
    return false;
}


// --- Core Application Logic ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    icon: path.join(__dirname, 'assets', 'icon.ico'), 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  //mainWindow.webContents.openDevTools(); 
}

async function attemptSilentLogin() {
    console.log('[Auth] Attempting silent login...');
    if (!store) {
        console.error('[Auth] Silent login failed: Store not initialized.');
        return { success: false };
    }

    const lastActivityTimestamp = store.get('lastActivityTimestamp');
    const elapsedTime = Date.now() - (lastActivityTimestamp || 0);

    if (elapsedTime > IDLE_TIMEOUT_MS) {
        console.log(`[Auth] User has been idle for over ${IDLE_TIMEOUT_MS / 3600000} hours. Attempting pre-fill login.`);
        const storedCredentials = store.get('userCredentials');
        if (storedCredentials) {
            try {
                const email = safeStorage.decryptString(Buffer.from(storedCredentials.email, 'base64'));
                const password = safeStorage.decryptString(Buffer.from(storedCredentials.password, 'base64'));
                store.set('prefillData', { email, password });
                return { success: false, reLoginRequired: true };
            } catch (e) {
                console.error('❌ [Auth] Failed to decrypt stored credentials for prefill. Clearing them and requiring full login.', e);
                store.delete('userCredentials');
                return { success: false };
            }
        }
        console.log('[Auth] No stored credentials found for pre-fill. Requiring full login.');
        return { success: false };
    }

    const encryptedTokenBase64 = store.get('adminRefreshTokenEncrypted');
    if (!encryptedTokenBase64) {
        console.log('[Auth] No encrypted refresh token found for silent login. Requiring full login.');
        return { success: false };
    }

    try {
        const refreshToken = safeStorage.decryptString(Buffer.from(encryptedTokenBase64, 'base64'));
        console.log('[Auth] Attempting silent login with refresh token...');
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'No response body');
            console.error(`❌ [Auth] Silent login refresh failed with status: ${response.status}. Response: ${errorText}`);
            await forceLogoutAndClear();
            return { success: false };
        }

        const newSessionData = await response.json();
        store.set('adminAuthToken', newSessionData.accessToken);
        if (newSessionData.user) store.set('user', newSessionData.user);
        store.set('lastActivityTimestamp', Date.now());
        
        const newEncryptedToken = safeStorage.encryptString(newSessionData.refreshToken);
        store.set('adminRefreshTokenEncrypted', newEncryptedToken.toString('base64'));
        
        console.log('✅ [Auth] Silent login successful.');
        return { success: true };
    } catch (error) {
        console.error('❌ [Auth] Failed to refresh token on startup (silent login):', error.message);
        await forceLogoutAndClear();
        return { success: false };
    }
}

async function handleTokenRefresh() {
    console.log('[Auth] handleTokenRefresh: Initiating token refresh process...');
    const encryptedTokenBase64 = store.get('adminRefreshTokenEncrypted');
    if (!encryptedTokenBase64) {
        console.warn('[Auth] handleTokenRefresh: No refresh token found in store when refresh was attempted. Forcing full logout.');
        await forceLogoutAndClear();
        throw new Error('No refresh token available. Please log in again.');
    }

    try {
        const refreshToken = safeStorage.decryptString(Buffer.from(encryptedTokenBase64, 'base64'));
        console.log('[Auth] handleTokenRefresh: Attempting to use refresh token to get new access token...');
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (!refreshResponse.ok) {
            const errorText = await refreshResponse.text().catch(() => 'No response body');
            console.error(`❌ [Auth] handleTokenRefresh: Refresh request failed with status: ${refreshResponse.status}. Response: ${errorText}`);
            if (refreshResponse.status === 401 || refreshResponse.status === 403 || refreshResponse.status === 400) { 
                console.warn('[Auth] handleTokenRefresh: Server indicated refresh token is invalid or expired. Forcing full logout.');
                await forceLogoutAndClear();
                throw new Error('Your session has expired. Please log in again.');
            } else {
                const errorData = JSON.parse(errorText).catch(() => ({ message: 'Unknown refresh error' }));
                throw new Error(`Failed to refresh token: ${errorData.message || refreshResponse.statusText}. Please check server status and try again.`);
            }
        }

        const newTokens = await refreshResponse.json();
        store.set('adminAuthToken', newTokens.accessToken);
        if (newTokens.refreshToken) {
            const newEncryptedToken = safeStorage.encryptString(newTokens.refreshToken);
            store.set('adminRefreshTokenEncrypted', newEncryptedToken.toString('base64'));
        }
        console.log('✅ [Auth] handleTokenRefresh: Access token refreshed successfully.');
        return newTokens.accessToken;
    } catch (error) {
        console.error('❌ [Auth] handleTokenRefresh: Error during refresh token process:', error.message);
        if (error.message.includes('decryptString') || error.message.includes('Your session has expired')) { 
             console.warn('[Auth] handleTokenRefresh: Decryption error or definitive expiration message. Forcing full logout.');
             await forceLogoutAndClear();
             throw new Error('Your session has been compromised or expired. Please log in again.');
        }
        throw error;
    }
}

async function makeApiRequest(endpoint, options = {}) {
    console.log(`[API] makeApiRequest: Preparing request for ${endpoint}`);
    if (!store) {
        console.error('[API] makeApiRequest: Store not initialized. Forcing logout.');
        await forceLogoutAndClear(); 
        return { ok: false, status: 500, data: { message: 'Internal error: Store not initialized.' }};
    }

    let accessToken = store.get('adminAuthToken');
    if (!accessToken) {
      console.warn(`[API] makeApiRequest: No access token found in store for ${endpoint}. This indicates a prior logout or failed authentication. Forcing logout path.`);
      await forceLogoutAndClear(); 
      return { ok: false, status: 401, data: { message: 'No access token found. Please log in again.' }};
    }

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
    };

    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    
    let requestBody = options.body;
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
        requestBody = options.body;
    } else if (options.body) {
        requestBody = JSON.stringify(options.body);
    }

    const requestOptions = { ...options, headers, body: requestBody };

    try {
        let response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);

        if ((response.status === 401 || response.status === 403) && endpoint !== '/auth/refresh') {
            if (!isRefreshing) {
                isRefreshing = true;
                refreshPromise = handleTokenRefresh().finally(() => { isRefreshing = false; refreshPromise = null; });
            }
            try {
                const newAccessToken = await refreshPromise;
                requestOptions.headers['Authorization'] = `Bearer ${newAccessToken}`;
                console.log(`[API] makeApiRequest: Retrying request to ${endpoint} with refreshed token.`);
                response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);
            } catch (refreshError) {
                console.error(`❌ [API] makeApiRequest: Failed to get a new access token after refresh attempt for ${endpoint}:`, refreshError.message);
                return { ok: false, status: 401, data: { message: refreshError.message || 'Authentication failed. Please log in again.' } };
            }
        }
        
        if (response.ok) store.set('lastActivityTimestamp', Date.now());
        if (response.status === 204) return { ok: true, status: 204, data: {} };
        
        const responseText = await response.text();
        const data = responseText ? JSON.parse(responseText) : {};
        return { ok: response.ok, status: response.status, data };

    } catch (error) {
        console.error(`❌ [API] makeApiRequest: Network error for ${API_BASE_URL}${endpoint}:`, error.message);
        return { ok: false, status: 503, data: { message: `Failed to connect to the API server: ${error.message}. Please check your internet connection.` } };
    }
}

async function handleUserInitiatedLogout() {
  console.log('[Auth] handleUserInitiatedLogout: User explicitly logging out.');
  try {
    if (store) {
      const storedCredentials = store.get('userCredentials');
      const rememberMeWasActive = !!storedCredentials;

      if (rememberMeWasActive) {
          console.log('[Auth] handleUserInitiatedLogout: User was remembered. Staging credentials for pre-fill.');
          try {
              const email = safeStorage.decryptString(Buffer.from(storedCredentials.email, 'base64'));
              const password = safeStorage.decryptString(Buffer.from(storedCredentials.password, 'base64'));
              store.set('prefillData', { email, password });
          } catch (e) {
              console.error('❌ [Auth] handleUserInitiatedLogout: Could not decrypt remembered credentials for prefill. Clearing them.', e);
              store.delete('userCredentials');
              store.delete('prefillData');
          }
      }
      
      store.delete('adminAuthToken');
      store.delete('user');
      store.delete('adminRefreshTokenEncrypted');

      console.log('✅ [Auth] handleUserInitiatedLogout: User session tokens and profile cleared on explicit logout.');
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      const loginPath = path.join(__dirname, 'template', 'auth', 'login.html');
      await mainWindow.loadFile(loginPath);
    }
    return { ok: true };
  } catch (error) {
    console.error('❌ [Auth] handleUserInitiatedLogout: User-initiated logout failed:', error);
    return { ok: false, message: 'Logout failed.' };
  }
}

async function forceLogoutAndClear() {
  console.log('[Auth] forceLogoutAndClear: Initiating forced logout and data clearance.');
  try {
    if (store) {
      store.delete('adminAuthToken');
      store.delete('adminRefreshTokenEncrypted');
      store.delete('user');
      store.delete('userCredentials');
      store.delete('prefillData');
      console.log('✅ [Auth] forceLogoutAndClear: All user tokens and profile data cleared.');
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('[Auth] forceLogoutAndClear: Attempting to load login page after forced logout.');
        await new Promise(resolve => setTimeout(resolve, 100)); 
        await mainWindow.loadFile(path.join(__dirname, 'template', 'auth', 'login.html'));
    } else {
        console.warn('⚠️ [Auth] forceLogoutAndClear: mainWindow not available or destroyed, cannot load login page.');
    }
    return { ok: true };
  } catch (error) {
    console.error('❌ [Auth] forceLogoutAndClear: Forced logout failed:', error);
    return { ok: false };
  }
}

// --- IPC Handlers ---
ipcMain.handle('auth:login', async (event, credentials) => {
    try {
        console.log('[IPC] auth:login: Received login attempt.');
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
        });
        const data = await response.json();
        console.log(`[IPC] auth:login: Login response status: ${response.status}, ok: ${response.ok}`);
        return { ok: response.ok, status: response.status, data };
    } catch (error) {
        console.error('❌ [IPC] auth:login: Failed to connect to login server:', error.message);
        return { ok: false, status: 503, data: { message: 'Failed to connect to the login server. Please check your internet connection.' } };
    }
});

ipcMain.handle('tokens:save', (event, { accessToken, refreshToken, rememberMe, user, credentials }) => {
    console.log(`[IPC] tokens:save: Called with: refreshToken=${refreshToken ? 'RECEIVED' : 'NOT RECEIVED'}, rememberMe=${rememberMe}`);
    if (!store || !user) {
        console.error('❌ [IPC] tokens:save: Store not initialized or user data missing. Cannot save tokens.');
        return { ok: false };
    }

    try {
        store.set('adminAuthToken', accessToken);
        store.set('user', user);
        store.set('lastActivityTimestamp', Date.now());

        if (refreshToken) {
            const encryptedRefreshToken = safeStorage.encryptString(refreshToken);
            store.set('adminRefreshTokenEncrypted', encryptedRefreshToken.toString('base64'));
            console.log('ⓘ [IPC] tokens:save: Refresh token encrypted and stored (always, for session management).');
        } else {
            store.delete('adminRefreshTokenEncrypted');
            console.warn('⚠️ [IPC] tokens:save: No refreshToken provided by server, ensuring adminRefreshTokenEncrypted is cleared from store.');
        }

        if (rememberMe && credentials) {
            const encryptedEmail = safeStorage.encryptString(credentials.email);
            const encryptedPassword = safeStorage.encryptString(credentials.password);

            store.set('userCredentials', {
                email: encryptedEmail.toString('base64'),
                password: encryptedPassword.toString('base64')
            });
            console.log('ⓘ [IPC] tokens:save: User credentials encrypted for pre-fill (rememberMe active).');
        } else {
            store.delete('userCredentials');
            console.log('ⓘ [IPC] tokens:save: User credentials cleared (rememberMe not active).');
        }
        return { ok: true };
    } catch (error) {
        console.error('❌ [IPC] tokens:save: Failed to save tokens/credentials:', error.message);
        return { ok: false };
    }
});

ipcMain.handle('auth:logout', () => handleUserInitiatedLogout());
ipcMain.handle('user:get-profile', () => {
    if (!store) {
        console.warn('⚠️ [IPC] user:get-profile: Store not initialized.');
        return null;
    }
    const user = store.get('user');
    console.log(`[IPC] user:get-profile: User profile retrieved. User exists: ${!!user}`);
    return user;
});

ipcMain.handle('login:get-prefill-credentials', () => {
    if (!store) return null;
    const prefillData = store.get('prefillData');
    if (prefillData) {
        console.log('[IPC] login:get-prefill-credentials: Prefill credentials delivered. Clearing temporary data.');
        store.delete('prefillData');
        return prefillData;
    }
    console.log('[IPC] login:get-prefill-credentials: No prefill data found.');
    return null;
});

ipcMain.handle('api:get', (event, endpoint) => makeApiRequest(endpoint, { method: 'GET' }));
ipcMain.handle('api:post', (event, endpoint, body) => makeApiRequest(endpoint, { method: 'POST', body }));
ipcMain.handle('api:put', (event, endpoint, body) => makeApiRequest(endpoint, { method: 'PUT', body }));
ipcMain.handle('api:delete', (event, endpoint, body) => makeApiRequest(endpoint, { method: 'DELETE', body }));


ipcMain.handle('api:upload', async (event, { endpoint, fieldName, file }) => {
    const form = new FormData();
    const buffer = Buffer.from(file.buffer);
    form.append(fieldName, buffer, file.name);

    try {
        console.log(`[IPC] api:upload: Attempting upload to ${endpoint} for field ${fieldName}.`);
        const result = await makeApiRequest(endpoint, {
            method: 'PUT',
            body: form,
        });
        console.log(`[IPC] api:upload: Upload result for ${endpoint}: ok=${result.ok}, status=${result.status}`);
        return result;
    } catch (error) {
        console.error('❌ [IPC] api:upload: File upload failed:', error.message);
        return { ok: false, status: 500, data: { message: error.message } };
    }
});

ipcMain.handle('page:load', (event, pagePath) => {
  if (mainWindow && pagePath) {
    console.log(`[IPC] page:load: Loading page: ${pagePath}`);
    mainWindow.loadFile(path.join(__dirname, 'template', pagePath));
  } else {
    console.warn(`⚠️ [IPC] page:load: Could not load page. mainWindow exists: ${!!mainWindow}, pagePath: ${pagePath}`);
  }
});

// --- Electron App Lifecycle ---
app.whenReady().then(async () => {
  await initializeStore();
  createWindow();
  
  const serverWarm = await warmUpServer(); 
  
  if (!serverWarm) {
      console.error('🚨 Critical Error: Could not establish a reliable connection to the backend server after multiple attempts. Proceeding with login, but expect potential connectivity issues.');
  }

  if (safeStorage.isEncryptionAvailable()) {
      const loginResult = await attemptSilentLogin();
      const targetPage = loginResult.success ? 'template/main/dashboard.html' : 'template/auth/login.html';
      console.log(`[App Lifecycle] Loading initial page: ${targetPage}. Silent login successful: ${loginResult.success}`);
      mainWindow.loadFile(path.join(__dirname, targetPage));
  } else {
      console.warn("⚠️ [App Lifecycle] SafeStorage encryption not available. User credentials cannot be securely stored/retrieved. Forcing full login.");
      await forceLogoutAndClear();
      mainWindow.loadFile(path.join(__dirname, 'template', 'auth', 'login.html'));
  }

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });