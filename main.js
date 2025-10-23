// main.js (Corrected and Hardened)

const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const path = require('path');
const FormData = require('form-data');
const { Readable } = require('stream');

// --- Global Variables ---
const API_BASE_URL = 'https://nodefibear.onrender.com/api/admin';
let mainWindow;
let store;

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


// --- Core Application Logic ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });
}

async function attemptSilentLogin() {
    if (!store) return false;
    const encryptedTokenBase64 = store.get('adminRefreshTokenEncrypted');
    if (!encryptedTokenBase64) {
        console.log('ⓘ No remembered user found.');
        return false;
    }

    try {
        const encryptedToken = Buffer.from(encryptedTokenBase64, 'base64');
        const refreshToken = safeStorage.decryptString(encryptedToken);

        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
            store.delete('adminRefreshTokenEncrypted');
            store.delete('adminAuthToken');
            store.delete('user');
            console.warn('⚠️ Refresh token was invalid. Cleared stored tokens.');
            return false;
        }

        const newSessionData = await response.json();
        store.set('adminAuthToken', newSessionData.accessToken);
        
        if (newSessionData.user) {
            store.set('user', newSessionData.user);
            console.log('✅ User profile refreshed on silent login.');
        }

        const newEncryptedToken = safeStorage.encryptString(newSessionData.refreshToken);
        store.set('adminRefreshTokenEncrypted', newEncryptedToken.toString('base64'));
        
        console.log('✅ Silent login successful.');
        return true;
    } catch (error) {
        console.error('❌ Failed to refresh token on startup:', error);
        store.delete('adminRefreshTokenEncrypted');
        store.delete('adminAuthToken');
        store.delete('user');
        return false;
    }
}

async function makeApiRequest(endpoint, options = {}) {
    if (!store) return { ok: false, status: 500, data: { message: 'Store not initialized.' }};

    let accessToken = store.get('adminAuthToken');
    if (!accessToken) return { ok: false, status: 401, data: { message: 'No access token found.' }};

    const requestOptions = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            ...options.headers,
        },
    };
    
    try {
        let response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);

        // --- FIX #1: Corrected Token Refresh Logic ---
        if (response.status === 401 || response.status === 403) {
            console.log('Token expired or invalid. Attempting refresh...');
            const encryptedTokenBase64 = store.get('adminRefreshTokenEncrypted');
            if (!encryptedTokenBase64) {
                // If there's no refresh token, we can't recover. Force logout.
                await ipcMain.handlers['auth:logout']();
                return { ok: false, status: 401, data: { message: 'Your session has expired. Please log in again.' } };
            }
            const refreshToken = safeStorage.decryptString(Buffer.from(encryptedTokenBase64, 'base64'));
            
            const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
            });

            if (!refreshResponse.ok) {
                console.error('❌ Refresh token was invalid. Forcing logout.');
                await ipcMain.handlers['auth:logout']();
                return { ok: false, status: 401, data: { message: 'Your session has expired. Please log in again.' } };
            }

            const newTokens = await refreshResponse.json();
            store.set('adminAuthToken', newTokens.accessToken);

            if (newTokens.refreshToken) {
                const newEncryptedToken = safeStorage.encryptString(newTokens.refreshToken);
                store.set('adminRefreshTokenEncrypted', newEncryptedToken.toString('base64'));
            }
            
            console.log('✅ Token refresh successful. Retrying original request...');
            requestOptions.headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
            response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);
        }
        
        if (response.status === 204) return { ok: true, status: 204, data: { message: 'Success' } };

        // --- FIX #2: Robust JSON Parsing to prevent SyntaxError ---
        const responseText = await response.text();
        let data = {};

        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
            console.error(`❌ Failed to parse JSON for endpoint: ${endpoint}`);
            console.error('Server Response Text:', responseText); // Log the HTML
            // Return an error instead of crashing
            return { ok: false, status: response.status, data: { message: 'Server returned a non-JSON response.' } };
        }

        return { ok: response.ok, status: response.status, data };

    } catch (error) {
        console.error(`❌ Network error during API request to ${endpoint}:`, error);
        return { ok: false, status: 503, data: { message: `Failed to connect to the API server.` } };
    }
}


// --- IPC Handlers ---

ipcMain.handle('auth:login', async (event, credentials) => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
        });
        const responseText = await response.text();

        if (!response.ok) {
            console.error('❌ Login failed. Server Status:', response.status);
            console.error('Server Response Body:', responseText); 
            return { ok: false, status: response.status, message: 'Server returned an error. Check main process logs.' };
        }

        try {
            const data = JSON.parse(responseText);
            return { ok: true, status: response.status, data };
        } catch (jsonError) {
            console.error('❌ Failed to parse JSON response from login:', jsonError);
            return { ok: false, status: 500, message: 'Server sent an invalid JSON response.' };
        }
    } catch (error) {
        console.error('❌ Login request failed (network error):', error.message);
        return { ok: false, status: 503, message: 'Failed to connect to the login server.' };
    }
});

// --- FIX #3: The `user` object must be passed as an argument ---
ipcMain.handle('tokens:save', (event, { accessToken, refreshToken, rememberMe, user }) => {
    if (!store) return { ok: false, message: 'Store not initialized.' };
    try {
        store.set('adminAuthToken', accessToken);
        store.set('user', user); // Now `user` is defined
        console.log('✅ User profile saved:', user);

        if (rememberMe && refreshToken) {
            const encryptedRefreshToken = safeStorage.encryptString(refreshToken);
            store.set('adminRefreshTokenEncrypted', encryptedRefreshToken.toString('base64'));
            console.log('ℹ️ Refresh token encrypted for future sessions.');
        } else {
            // Clear any old encrypted token if "Remember Me" is unchecked
            store.delete('adminRefreshTokenEncrypted');
            // We don't save the non-encrypted refresh token for security.
            // It will only live for the session and be refreshed as needed.
        }
        return { ok: true };
    } catch (error) {
        console.error('❌ Failed to save tokens:', error);
        return { ok: false, message: 'Failed to save tokens.' };
    }
});

ipcMain.handle('auth:logout', async () => {
  try {
    if (store) {
      store.delete('adminAuthToken');
      store.delete('adminRefreshTokenEncrypted');
      store.delete('user'); 
      console.log('✅ All user tokens and profile cleared on logout.');
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      const loginPath = path.join(__dirname, 'template', 'auth', 'login.html');
      await mainWindow.loadFile(loginPath);
    }
    return { ok: true, message: 'Logout successful' };
  } catch (error) {
    console.error('❌ Logout failed:', error);
    return { ok: false, message: 'Logout failed.' };
  }
});

ipcMain.handle('user:get-profile', () => {
    if (!store) return null;
    return store.get('user') || null;
});

ipcMain.handle('api:get', (event, endpoint) => makeApiRequest(endpoint, { method: 'GET' }));
ipcMain.handle('api:post', (event, endpoint, body) => makeApiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }));
ipcMain.handle('api:put', (event, endpoint, body) => makeApiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body) }));
ipcMain.handle('api:delete', (event, endpoint, body) => makeApiRequest(endpoint, { method: 'DELETE', body: JSON.stringify(body) }));

// Other handlers remain the same...

ipcMain.handle('api:upload', async (event, { endpoint, fieldName, file }) => {
    const accessToken = store.get('adminAuthToken');
    if (!accessToken) return { ok: false, status: 401, message: 'No access token found.' };
    
    try {
        const form = new FormData();
        const buffer = Buffer.from(file.buffer);
        const stream = Readable.from(buffer);

        form.append(fieldName, stream, {
            filename: file.name,
            contentType: file.type,
        });

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            body: form,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        
        const data = await response.json();
        return { ok: response.ok, status: response.status, data };

    } catch (error) {
        console.error('❌ File upload failed in main process:', error);
        return { ok: false, status: 500, message: error.message };
    }
});

ipcMain.handle('page:load', (event, pagePath) => {
  if (mainWindow && pagePath) {
    const filePath = path.join(__dirname, 'template', pagePath);
    mainWindow.loadFile(filePath);
  }
});

// --- Electron App Lifecycle ---
app.whenReady().then(async () => {
  await initializeStore();
  createWindow();

  const isLoggedIn = await attemptSilentLogin();
  if (isLoggedIn) {
      mainWindow.loadFile(path.join(__dirname, 'template/main/dashboard.html'));
  } else {
      mainWindow.loadFile(path.join(__dirname, 'template/auth/login.html'));
  }
  
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });