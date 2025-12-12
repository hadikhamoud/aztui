import { TextAttributes } from "@opentui/core"
import { useAppStore } from "../store/app-store"

export function SetupView() {
  const {
    setupOrgUrl,
    setupPat,
    setupFocusedField,
    setupError,
    setupSaving
  } = useAppStore()

  return (
    <box flexDirection="column" padding={2} gap={1}>
      <text attributes={TextAttributes.BOLD} fg="#00BFFF">
        Azure DevOps TUI Setup
      </text>
      <text fg="#888888">
        Enter your Azure DevOps credentials to get started.
      </text>
      <text fg="#888888">
        These will be saved locally and used for future sessions.
      </text>
      
      <box flexDirection="column" marginTop={1} gap={1}>
        <box flexDirection="column">
          <text fg={setupFocusedField === 'orgUrl' ? '#00BFFF' : '#888888'}>
            {setupFocusedField === 'orgUrl' ? '> ' : '  '}Organization URL:
          </text>
          <box 
            borderStyle="rounded" 
            borderColor={setupFocusedField === 'orgUrl' ? '#00BFFF' : '#444444'}
            padding={0.5}
          >
            <text>
              {setupOrgUrl || (setupFocusedField === 'orgUrl' ? '|' : 'https://dev.azure.com/your-org')}
              {setupFocusedField === 'orgUrl' && setupOrgUrl ? '|' : ''}
            </text>
          </box>
          <text fg="#666666">
            Example: https://dev.azure.com/myorganization
          </text>
        </box>

        <box flexDirection="column" marginTop={1}>
          <text fg={setupFocusedField === 'pat' ? '#00BFFF' : '#888888'}>
            {setupFocusedField === 'pat' ? '> ' : '  '}Personal Access Token (PAT):
          </text>
          <box 
            borderStyle="rounded" 
            borderColor={setupFocusedField === 'pat' ? '#00BFFF' : '#444444'}
            padding={0.5}
          >
            <text>
              {setupPat ? '*'.repeat(Math.min(setupPat.length, 40)) : (setupFocusedField === 'pat' ? '|' : 'Enter your PAT')}
              {setupFocusedField === 'pat' && setupPat ? '|' : ''}
            </text>
          </box>
          <text fg="#666666">
            Create a PAT at: Organization Settings {'>'} Personal Access Tokens
          </text>
        </box>
      </box>

      {setupError && (
        <text fg="#FF4444" marginTop={1}>
          Error: {setupError}
        </text>
      )}

      {setupSaving && (
        <text fg="#FFD700" marginTop={1}>
          Saving and connecting...
        </text>
      )}

      <box marginTop={2}>
        <text fg="#888888">
          Tab: Switch fields | Enter: Save and connect | Ctrl+C: Quit
        </text>
      </box>
    </box>
  )
}
