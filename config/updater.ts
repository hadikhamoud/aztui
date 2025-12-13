import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'

const APP_NAME = 'aztui'
const REPO = 'hadikhamoud/aztui'

// Current version - this should match the release tag
export const VERSION = 'v0.1.0'

interface UpdateInfo {
  lastCheck: number
  pendingUpdate: string | null
  pendingBinaryPath: string | null
}

// Get the data directory for update info
function getDataDir(): string {
  const platform = process.platform
  
  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', APP_NAME)
  } else if (platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), APP_NAME)
  } else {
    const xdgData = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
    return join(xdgData, APP_NAME)
  }
}

function getUpdateInfoPath(): string {
  return join(getDataDir(), 'update-info.json')
}

function loadUpdateInfo(): UpdateInfo | null {
  try {
    const path = getUpdateInfoPath()
    if (!existsSync(path)) {
      return null
    }
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function saveUpdateInfo(info: UpdateInfo): void {
  try {
    const dataDir = getDataDir()
    if (!existsSync(dataDir)) {
      const { mkdirSync } = require('fs')
      mkdirSync(dataDir, { recursive: true })
    }
    writeFileSync(getUpdateInfoPath(), JSON.stringify(info, null, 2))
  } catch (error) {
    // Silently fail - update info is not critical
  }
}

// Detect platform for downloading the correct binary
function detectPlatform(): string {
  const platform = process.platform
  const arch = process.arch
  
  let os: string
  if (platform === 'darwin') {
    os = 'darwin'
  } else if (platform === 'win32') {
    os = 'windows'
  } else {
    os = 'linux'
  }
  
  const archStr = arch === 'arm64' ? 'arm64' : 'x64'
  
  return `${os}-${archStr}`
}

// Get the latest version from GitHub
async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!response.ok) {
      return null
    }
    const data = await response.json() as { tag_name: string }
    return data.tag_name
  } catch {
    return null
  }
}

// Compare versions (returns true if remote is newer)
function isNewerVersion(current: string, remote: string): boolean {
  // Strip 'v' prefix if present
  const currentClean = current.replace(/^v/, '')
  const remoteClean = remote.replace(/^v/, '')
  
  const currentParts = currentClean.split('.').map(Number)
  const remoteParts = remoteClean.split('.').map(Number)
  
  for (let i = 0; i < Math.max(currentParts.length, remoteParts.length); i++) {
    const curr = currentParts[i] || 0
    const rem = remoteParts[i] || 0
    if (rem > curr) return true
    if (rem < curr) return false
  }
  
  return false
}

// Get the path where the binary should be installed
function getInstallPath(): string {
  // Try to find where aztui is currently installed
  try {
    const which = process.platform === 'win32' ? 'where' : 'which'
    const result = execSync(`${which} aztui`, { encoding: 'utf-8' }).trim()
    if (result) {
      // On windows 'where' can return multiple lines
      return result.split('\n')[0].trim()
    }
  } catch {
    // aztui not in PATH, use default location
  }
  
  // Default install location
  const installDir = process.env.AZTUI_INSTALL_DIR || join(homedir(), '.local', 'bin')
  const binaryName = process.platform === 'win32' ? 'aztui.exe' : 'aztui'
  return join(installDir, binaryName)
}

// Download the update to a temp location
async function downloadUpdate(version: string): Promise<string | null> {
  try {
    const platform = detectPlatform()
    const binaryName = platform.startsWith('windows') ? `aztui-${platform}.exe` : `aztui-${platform}`
    const url = `https://github.com/${REPO}/releases/download/${version}/${binaryName}`
    
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    
    const buffer = await response.arrayBuffer()
    const tempPath = join(getDataDir(), `aztui-update-${version}${platform.startsWith('windows') ? '.exe' : ''}`)
    
    // Ensure data dir exists
    const dataDir = getDataDir()
    if (!existsSync(dataDir)) {
      const { mkdirSync } = require('fs')
      mkdirSync(dataDir, { recursive: true })
    }
    
    writeFileSync(tempPath, new Uint8Array(buffer))
    
    // Make executable on Unix systems
    if (process.platform !== 'win32') {
      chmodSync(tempPath, 0o755)
    }
    
    return tempPath
  } catch {
    return null
  }
}

// Apply a pending update (replace current binary with downloaded one)
function applyUpdate(pendingBinaryPath: string): boolean {
  try {
    const installPath = getInstallPath()
    const { copyFileSync, unlinkSync } = require('fs')
    
    // Copy the new binary over the old one
    copyFileSync(pendingBinaryPath, installPath)
    
    // Make it executable
    if (process.platform !== 'win32') {
      chmodSync(installPath, 0o755)
    }
    
    // Clean up the temp file
    try {
      unlinkSync(pendingBinaryPath)
    } catch {
      // Ignore cleanup errors
    }
    
    return true
  } catch {
    return false
  }
}

export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string | null
  updateApplied: boolean
  message: string
}

/**
 * Check for updates and apply any pending updates.
 * 
 * Flow:
 * 1. On first run: Check for update, download if available, store for next run
 * 2. On subsequent runs: If pending update exists, apply it first, then check for new updates
 * 
 * This ensures the update is applied on restart rather than during the current session.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const result: UpdateCheckResult = {
    hasUpdate: false,
    currentVersion: VERSION,
    latestVersion: null,
    updateApplied: false,
    message: ''
  }
  
  // First, check if there's a pending update to apply
  const updateInfo = loadUpdateInfo()
  
  if (updateInfo?.pendingUpdate && updateInfo?.pendingBinaryPath) {
    if (existsSync(updateInfo.pendingBinaryPath)) {
      // Apply the pending update
      const applied = applyUpdate(updateInfo.pendingBinaryPath)
      
      if (applied) {
        result.updateApplied = true
        result.message = `Updated to ${updateInfo.pendingUpdate}`
        
        // Clear the pending update
        saveUpdateInfo({
          lastCheck: Date.now(),
          pendingUpdate: null,
          pendingBinaryPath: null
        })
        
        return result
      }
    }
    
    // If we couldn't apply the update, clear it
    saveUpdateInfo({
      lastCheck: updateInfo.lastCheck,
      pendingUpdate: null,
      pendingBinaryPath: null
    })
  }
  
  // Now check for new updates
  const latestVersion = await fetchLatestVersion()
  result.latestVersion = latestVersion
  
  if (!latestVersion) {
    result.message = 'Could not check for updates'
    return result
  }
  
  if (!isNewerVersion(VERSION, latestVersion)) {
    result.message = 'Already on latest version'
    saveUpdateInfo({
      lastCheck: Date.now(),
      pendingUpdate: null,
      pendingBinaryPath: null
    })
    return result
  }
  
  // New version available - download it for next restart
  result.hasUpdate = true
  result.message = `Downloading update ${latestVersion}...`
  
  const downloadedPath = await downloadUpdate(latestVersion)
  
  if (downloadedPath) {
    saveUpdateInfo({
      lastCheck: Date.now(),
      pendingUpdate: latestVersion,
      pendingBinaryPath: downloadedPath
    })
    result.message = `Update ${latestVersion} downloaded. Will be applied on next restart.`
  } else {
    result.message = `Update ${latestVersion} available but download failed`
  }
  
  return result
}

/**
 * Get the current version string
 */
export function getCurrentVersion(): string {
  return VERSION
}
