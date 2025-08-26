import { Logo } from "./logo_2"
import { Select } from "./select"
import { useAppStore } from "../store/app-store"
import { useTerminalDimensions } from "@opentui/react"

export function WorkspaceBox() {
  const { width, height } = useTerminalDimensions()
  const { 
    selectedProject, 
    selectedRepo, 
    isInWorkspace, 
    workspaceOptions,
    focusedBox,
    selectWorkspaceOption
  } = useAppStore()

  const isFocused = focusedBox === 'workspace'

  const handleSelect = (value: string) => {
    const option = workspaceOptions.find(opt => opt.value === value)
    if (option) {
      selectWorkspaceOption(option)
    }
  }

  const getTitle = () => {
    if (isInWorkspace && selectedRepo) {
      return `${selectedRepo.name} - options`
    }
    return "workspace"
  }

  return (
    <box 
      title={getTitle()}
      padding={2} 
      borderStyle="rounded"
      width={width / 2}
      height={height - 1}
      borderColor={isFocused ? "#007595" : "white"}
    >
      <group flexDirection="column">
        {isInWorkspace && selectedRepo ? (
          <Select 
            options={workspaceOptions}
            focused={isFocused}
            onSelect={handleSelect}
          />
        ) : (
          <>
            <Logo />
            {selectedProject && (
              <text>Selected Project: {selectedProject.name}</text>
            )}
            {selectedRepo && (
              <text>Selected Repo: {selectedRepo.name}</text>
            )}
            <text>
              Select a repo to view options
            </text>
          </>
        )}
      </group>
    </box>
  )
}
