import { useCallback } from "react"
import { useAppStore } from "../store/app-store"
import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/react"
import { Toast } from "./toast"

export function CloneView() {
  const { height } = useTerminalDimensions()
  const {
    selectedRepo,
    cloneLocation,
    cloneMethod,
    cloneLoading,
    cloneStatus,
    cloneLogs,
    cloneLogsScrollOffset,
    cloneFocusedField,
    clearCloneStatus
  } = useAppStore()

  const handleToastDismiss = useCallback(() => {
    clearCloneStatus()
  }, [clearCloneStatus])

  const visibleLogLines = Math.max(8, height - 22)
  const maxScrollOffset = Math.max(0, cloneLogs.length - visibleLogLines)
  const scrollOffset = Math.min(cloneLogsScrollOffset, maxScrollOffset)
  const visibleLogs = cloneLogs.slice(scrollOffset, scrollOffset + visibleLogLines)

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

      <box flexDirection="column" gap={0}>
        <text>Clone Output{cloneLoading ? ' (live)' : ''}:</text>
        <text fg="#888888">
          Lines {cloneLogs.length === 0 ? 0 : scrollOffset + 1}-{Math.min(scrollOffset + visibleLogLines, cloneLogs.length)} of {cloneLogs.length} (j/k to scroll, Ctrl+d/u to page)
        </text>
        <box borderStyle="rounded" borderColor="gray" padding={0.5} minHeight={visibleLogLines + 1}>
          <box flexDirection="column">
            {cloneLogs.length === 0 ? (
              <text fg="#888888">No output yet</text>
            ) : (
              visibleLogs.map((line, index) => (
                <text key={`${scrollOffset + index}-${line}`}>
                  <span fg="#666666">{String(scrollOffset + index + 1).padStart(4, ' ')} </span>{line}
                </text>
              ))
            )}
          </box>
        </box>
        <text fg="#888888">SSH password/passphrase prompts are blocked so they do not take over the TUI</text>
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
