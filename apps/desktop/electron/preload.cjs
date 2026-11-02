const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lumina", {
  openMediaDialog: () => ipcRenderer.invoke("dialog:openMedia"),
  openFolderDialog: () => ipcRenderer.invoke("dialog:openFolder"),
  runFfmpeg: (args) => ipcRenderer.invoke("ffmpeg:run", args),
  platform: process.platform,
});
