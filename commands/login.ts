import { getCredentials } from "../config"
import { useAppStore } from "../store/app-store"

export async function runLoginCommand(): Promise<void> {
  // Get existing credentials to pre-populate the org URL
  const existingCredentials = getCredentials()
  
  // Force the setup view to show, pre-populate with existing org URL
  // Don't pre-fill PAT for security reasons
  // Credentials are NOT deleted - they remain valid until new ones are saved
  useAppStore.setState({ 
    needsSetup: true,
    setupOrgUrl: existingCredentials?.orgUrl || '',
    setupPat: '',
    setupError: null,
    setupSaving: false
  })
}
