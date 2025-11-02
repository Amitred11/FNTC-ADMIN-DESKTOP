// preload.js (Complete and Final)

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Authentication
  authLogin: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getUserProfile: () => ipcRenderer.invoke('user:get-profile'),
  getPrefillCredentials: () => ipcRenderer.invoke('login:get-prefill-credentials'),
  // Token Management
  saveTokens: (tokens) => ipcRenderer.invoke('tokens:save', tokens),
  
  // Standard API Requests
  apiPost: (endpoint, body) => ipcRenderer.invoke('api:post', endpoint, body),
  apiGet: (endpoint) => ipcRenderer.invoke('api:get', endpoint),
  apiPut: (endpoint, body, options) => ipcRenderer.invoke('api:put', endpoint, body, options),
  apiDelete: (endpoint, body) => ipcRenderer.invoke('api:delete', endpoint, body),
  uploadFile: (uploadData) => ipcRenderer.invoke('api:upload', uploadData),

  // Page Navigation
  loadPage: (htmlFile) => ipcRenderer.invoke('page:load', htmlFile),

  // Listener for Main Process to Renderer Process Communication
  onPrefillCredentials: (callback) => ipcRenderer.on('prefill-credentials', (event, ...args) => callback(...args)),
});