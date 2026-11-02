const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lumina", {
  openMediaDialog: () => ipcRenderer.invoke("dialog:openMedia"),
  runFfmpeg: (args) => ipcRenderer.invoke("ffmpeg:run", args),
  platform: process.platform,
});
