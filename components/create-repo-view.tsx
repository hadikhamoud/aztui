import { useCallback } from "react"
import { useAppStore } from "../store/app-store"
import { TextAttributes } from "@opentui/core"
import { Toast } from "./toast"

export function CreateRepoView() {
  const {
    selectedProject,
    createRepoName,
    createRepoStatus,
    createRepoLoading,
    clearCreateRepoStatus
  } = useAppStore()

  const handleToastDismiss = useCallback(() => {
    clearCreateRepoStatus()
  }, [clearCreateRepoStatus])

  return (
    <box flexDirection="column" gap={1}>
      <text attributes={TextAttributes.BOLD}>Create New Repository</text>
      <text fg="#888888">Project: {selectedProject?.name}</text>
      
      <box flexDirection="column" gap={0} marginTop={1}>
        <text>Repository Name:</text>
        <box 
          borderStyle="rounded" 
          borderColor="#007595"
          padding={0.5}
        >
          <text>
            {createRepoName || '(Enter repository name...)'}
            <span fg="#007595">_</span>
          </text>
        </box>
      </box>
      
      <text fg="#888888" marginTop={1}>
        Enter: Create Repository | Esc: Cancel
      </text>
      
      <Toast 
        message={createRepoStatus?.message ?? null}
        isError={createRepoStatus?.isError}
        duration={3000}
        onDismiss={handleToastDismiss}
      />
    </box>
  )
}
