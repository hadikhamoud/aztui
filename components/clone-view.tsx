import { useCallback } from "react"
import { useAppStore } from "../store/app-store"
import { TextAttributes } from "@opentui/core"
import { Toast } from "./toast"

export function CloneView() {
  const {
    selectedRepo,
    cloneLocation,
    cloneMethod,
    cloneStatus,
    cloneFocusedField,
    clearCloneStatus
  } = useAppStore()

  const handleToastDismiss = useCallback(() => {
    clearCloneStatus()
  }, [clearCloneStatus])

  const getRepoUrl = () => {
    if (!selectedRepo) return ''
    try {
      const urlData = JSON.parse(selectedRepo.description)
      return cloneMethod === 'ssh' ? urlData.sshUrl : urlData.httpsUrl
    } catch {
      return selectedRepo.description
    }
  }

  return (
    <box flexDirection="column" gap={1}>
      <text attributes={TextAttributes.BOLD}>Clone Repository: {selectedRepo?.name}</text>
      
      <box flexDirection="column" gap={0}>
        <text>Clone Method:</text>
        <box flexDirection="row" gap={2}>
          <text fg={cloneFocusedField === 'method' ? '#007595' : 'white'}>
            [{cloneMethod === 'https' ? 'x' : ' '}] HTTPS
          </text>
          <text fg={cloneFocusedField === 'method' ? '#007595' : 'white'}>
            [{cloneMethod === 'ssh' ? 'x' : ' '}] SSH
          </text>
        </box>
      </box>

      <box flexDirection="column" gap={0}>
        <text>URL:</text>
        <text fg="#888888">{getRepoUrl()}</text>
      </box>

      <box flexDirection="column" gap={0}>
        <text>Target Path {cloneFocusedField === 'path' ? '(editing)' : ''}:</text>
        <box 
          borderStyle="rounded" 
          borderColor={cloneFocusedField === 'path' ? '#007595' : 'gray'}
          padding={0.5}
        >
          <text>
            {cloneLocation || '(current directory)'}
            {cloneFocusedField === 'path' ? '_' : ''}
          </text>
        </box>
        <text fg="#888888">Leave empty to clone to current directory</text>
      </box>

      <Toast 
        message={cloneStatus?.message ?? null}
        isError={cloneStatus?.isError}
        duration={3000}
        onDismiss={handleToastDismiss}
      />
    </box>
  )
}
