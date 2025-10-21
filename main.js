// main.js

const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron'); // Import 'shell'
const path = require('path');
const FormData = require('form-data');
const { Readable } = require('stream');

// --- Global Variables ---
const API_BASE_URL = 'http://192.168.100.12:5000/api/admin';
let mainWindow;
let store;

// --- Initialization ---
async function initializeStore() {
    try {
        const { default: Store } = await import('electron-store');
        store = new Store();
        console.log('✅ electron-store initialized successfully.');
    } catch (error)
    {
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
            console.warn('⚠️ Refresh token was invalid. Cleared stored tokens.');
            return false;
        }

        const newTokens = await response.json();
        store.set('adminAuthToken', newTokens.accessToken);
        store.set('user', newSessionData.user);
        const newEncryptedToken = safeStorage.encryptString(newTokens.refreshToken);
        store.set('adminRefreshTokenEncrypted', newEncryptedToken.toString('base64'));
        
        console.log('✅ Silent login successful.');
        return true;
    } catch (error) {
        console.error('❌ Failed to refresh token on startup:', error);
        store.delete('adminRefreshTokenEncrypted');
        store.delete('adminAuthToken');
        return false;
    }
}

async function makeApiRequest(endpoint, options = {}) {
    if (!store) return { ok: false, status: 500, message: 'Store not initialized.' };

    let accessToken = store.get('adminAuthToken');
    if (!accessToken) return { ok: false, status: 401, message: 'No access token found.' };

    const requestOptions = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            ...options.headers,
        },
    };

    let response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);

    if (response.status === 401 || response.status === 403) {
        console.log('Token expired. Attempting refresh...');
        const encryptedTokenBase64 = store.get('adminRefreshTokenEncrypted');
        let refreshToken = encryptedTokenBase64 
            ? safeStorage.decryptString(Buffer.from(encryptedTokenBase64, 'base64'))
            : store.get('adminRefreshToken');

        if (!refreshToken) return { ok: false, status: 401, message: 'Session expired. Please log in again.' };

        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (!refreshResponse.ok) {
            // If refresh fails, log the user out.
            ipcMain.handle('auth:logout');
            return { ok: false, status: 401, message: 'Could not refresh session.' };
        }

        const newTokens = await refreshResponse.json();
        store.set('adminAuthToken', newTokens.accessToken);

        if (newTokens.refreshToken) {
            console.log('ℹ️ Received a new refresh token from the API.');
            if (encryptedTokenBase64) {
                const newEncryptedToken = safeStorage.encryptString(newTokens.refreshToken);
                store.set('adminRefreshTokenEncrypted', newEncryptedToken.toString('base64'));
            } else {
                store.set('adminRefreshToken', newTokens.refreshToken);
            }
        }
        
        console.log('✅ Token refresh successful. Retrying original request...');
        requestOptions.headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);
    }
    
    if (response.status === 204) return { ok: true, status: 204, data: { message: 'Success' } };

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    return { ok: response.ok, status: response.status, data };
}


// --- IPC Handlers ---

ipcMain.handle('auth:login', async (event, credentials) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    console.error('❌ Login request failed:', error.message);
    return { ok: false, status: 500, message: 'Failed to connect to the server.' };
  }
});

ipcMain.handle('tokens:save', (event, { accessToken, refreshToken, rememberMe }) => {
    if (!store) return { ok: false, message: 'Store not initialized.' };
    try {
        store.set('adminAuthToken', accessToken);
        store.set('user', user); // <-- SAVE THE USER PROFILE
        console.log('✅ User profile saved:', user);
        if (rememberMe && refreshToken) {
            const encryptedRefreshToken = safeStorage.encryptString(refreshToken);
            store.set('adminRefreshTokenEncrypted', encryptedRefreshToken.toString('base64'));
            console.log('ℹ️ Refresh token encrypted for future sessions.');
        } else {
            store.delete('adminRefreshTokenEncrypted');
            store.set('adminRefreshToken', refreshToken);
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
      // Clear all session data
      store.delete('adminAuthToken');
      store.delete('adminRefreshToken');
      store.delete('adminRefreshTokenEncrypted');
      store.delete('user'); 
      console.log('✅ All user tokens and profile cleared on logout.');
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      const loginPath = path.join(__dirname, 'template', 'auth', 'login.html');
      await mainWindow.loadFile(loginPath);
      
      mainWindow.webContents.reload();
    }

    return { ok: true, message: 'Logout successful' };
  } catch (error) {
    console.error('❌ Logout failed:', error);
    return { ok: false, message: 'Logout failed due to an internal error.' };
  }
});
ipcMain.handle('user:get-profile', () => {
    if (!store) return null;
    const user = store.get('user');
    return user || null;
});

ipcMain.handle('api:get', (event, endpoint) => makeApiRequest(endpoint, { method: 'GET' }));
ipcMain.handle('api:post', (event, endpoint, body) => makeApiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }));
ipcMain.handle('api:put', (event, endpoint, body) => makeApiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body) }));
ipcMain.handle('api:delete', (event, endpoint, body) => makeApiRequest(endpoint, { method: 'DELETE', body: JSON.stringify(body) }));

ipcMain.handle('api:upload', async (event, { endpoint, fieldName, file }) => {
    const accessToken = store.get('adminAuthToken');
    if (!accessToken) return { ok: false, status: 401, message: 'No access token found.' };
    
    try {
        const form = new FormData();
        const buffer = Buffer.from(file.buffer); // Convert ArrayBuffer from renderer to Node.js Buffer
        
        // Create a readable stream from the buffer
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null); // End of stream

        form.append(fieldName, stream, {
            filename: file.name,
            contentType: file.type,
        });

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            body: form,
            headers: {
                ...form.getHeaders(),
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