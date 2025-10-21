// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Authentication
  authLogin: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getUserProfile: () => ipcRenderer.invoke('user:get-profile'),

  // Token Management
  saveTokens: (tokens) => ipcRenderer.invoke('tokens:save', tokens),
  // Standard API Requests
  apiPost: (endpoint, body) => ipcRenderer.invoke('api:post', endpoint, body),
  apiGet: (endpoint) => ipcRenderer.invoke('api:get', endpoint), // You are using this
  apiPut: (endpoint, body) => ipcRenderer.invoke('api:put', endpoint, body), // And this
  apiDelete: (endpoint, body) => ipcRenderer.invoke('api:delete', endpoint, body),
  uploadFile: (uploadData) => ipcRenderer.invoke('api:upload', uploadData),

  // Page Navigation
  loadPage: (htmlFile) => ipcRenderer.invoke('page:load', htmlFile)
});