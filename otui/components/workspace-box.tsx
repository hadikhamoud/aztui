import { Logo } from "./logo"
import { Select } from "./select"
import { CloneView } from "./clone-view"
import { useAppStore } from "../store/app-store"
import { useTerminalDimensions } from "@opentui/react"

export function WorkspaceBox() {
  const { width, height } = useTerminalDimensions()
  const { 
    selectedProject, 
    selectedRepo, 
    isInWorkspace, 
    workspaceOptions,
    selectedWorkspaceOption,
    focusedBox,
    selectWorkspaceOption,
    getFilteredOptions,
    clearSearch,
    isSearchActive,
    isSelectMode,
    searchHighlightedIndex,
    isInCloneView,
    enterCloneView
  } = useAppStore()

  const isFocused = focusedBox === 'workspace'
  const displayOptions = isFocused ? getFilteredOptions('workspace') : workspaceOptions

  const handleSelect = (value: string) => {
    const option = workspaceOptions.find(opt => opt.value === value)
    if (option) {
      selectWorkspaceOption(option)
      if (value === 'clone') {
        enterCloneView()
      }
      clearSearch()
    }
  }

  const getTitle = () => {
    if (isInWorkspace && selectedRepo) {
      if (isInCloneView) {
        return `${selectedRepo.name} - clone`
      }
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
      height={height - 2}
      borderColor={isFocused ? "#007595" : "white"}
    >
      <group flexDirection="column">
        {isInWorkspace && selectedRepo ? (
          isInCloneView ? (
            <CloneView />
          ) : (
            <Select 
              options={displayOptions}
              focused={isFocused}
              value={selectedWorkspaceOption?.value}
              highlightedIndex={isSearchActive && isFocused ? searchHighlightedIndex : undefined}
              isSearchActive={isSearchActive}
              isSelectMode={isSelectMode}
              onSelect={handleSelect}
            />
          )
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
