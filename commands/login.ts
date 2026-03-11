import { getCredentials } from "../config"
import { useAppStore } from "../store/app-store"

export async function runLoginCommand(): Promise<void> {
  const existingCredentials = getCredentials()

  useAppStore.setState({
    needsSetup: true,
    setupOrgUrl: existingCredentials?.orgUrl || '',
    setupPat: '',
    setupError: null,
    setupSaving: false
  })
}
