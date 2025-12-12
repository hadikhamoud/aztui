import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const APP_NAME = 'aztui'

interface Config {
  orgUrl: string
  pat: string
}

// Get XDG data directory (or fallback for macOS/Windows)
function getDataDir(): string {
  // XDG_DATA_HOME or default to ~/.local/share on Linux
  // On macOS: ~/Library/Application Support
  // On Windows: %APPDATA%
  const platform = process.platform
  
  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', APP_NAME)
  } else if (platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), APP_NAME)
  } else {
    // Linux and others - use XDG
    const xdgData = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
    return join(xdgData, APP_NAME)
  }
}

function getConfigPath(): string {
  return join(getDataDir(), 'config.json')
}

// Ensure the data directory exists
function ensureDataDir(): void {
  const dataDir = getDataDir()
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
}

// Load config from file
export function loadConfig(): Config | null {
  try {
    const configPath = getConfigPath()
    if (!existsSync(configPath)) {
      return null
    }
    const content = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(content) as Config
    
    // Validate that both fields exist and are non-empty
    if (!config.orgUrl || !config.pat) {
      return null
    }
    
    return config
  } catch (error) {
    console.error('Failed to load config:', error)
    return null
  }
}

// Save config to file
export function saveConfig(config: Config): boolean {
  try {
    ensureDataDir()
    const configPath = getConfigPath()
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to save config:', error)
    return false
  }
}

// Check if credentials are configured (either in env or config file)
export function hasCredentials(): boolean {
  // First check environment variables
  if (process.env.AZURE_ORG_URL && process.env.AZURE_PAT) {
    return true
  }
  
  // Then check config file
  const config = loadConfig()
  return config !== null
}

// Get credentials (env vars take precedence)
export function getCredentials(): Config | null {
  // Environment variables take precedence
  if (process.env.AZURE_ORG_URL && process.env.AZURE_PAT) {
    return {
      orgUrl: process.env.AZURE_ORG_URL,
      pat: process.env.AZURE_PAT
    }
  }
  
  // Fall back to config file
  return loadConfig()
}

// Get the config file path (for display purposes)
export function getConfigFilePath(): string {
  return getConfigPath()
}
