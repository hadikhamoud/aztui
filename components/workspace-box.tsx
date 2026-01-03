import { useCallback } from "react"
import { Logo } from "./logo"
import { Select } from "./select"
import { CloneView } from "./clone-view"
import { PipelinesView } from "./pipelines-view"
import { PRsView } from "./prs-view"
import { Toast } from "./toast"
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
    isInPipelinesView,
    isInPRsView,
    enterCloneView,
    enterPipelinesView,
    enterPRsView,
    repoActionStatus,
    clearRepoActionStatus
  } = useAppStore()
  
  const handleToastDismiss = useCallback(() => {
    clearRepoActionStatus()
  }, [clearRepoActionStatus])

  const isFocused = focusedBox === 'workspace'
  const displayOptions = isFocused ? getFilteredOptions('workspace') : workspaceOptions

  const handleSelect = (value: string) => {
    const option = workspaceOptions.find(opt => opt.value === value)
    if (option) {
      selectWorkspaceOption(option)
      if (value === 'clone') {
        enterCloneView()
      } else if (value === 'pipelines') {
        enterPipelinesView()
      } else if (value === 'prs') {
        enterPRsView()
      }
      clearSearch()
    }
  }

  const getTitle = () => {
    if (isInWorkspace && selectedRepo) {
      if (isInCloneView) {
        return `${selectedRepo.name} - clone`
      }
      if (isInPipelinesView) {
        return `${selectedRepo.name} - pipelines`
      }
      if (isInPRsView) {
        return `${selectedRepo.name} - pull requests`
      }
      return `${selectedRepo.name} - options`
    }
    return "workspace"
  }

  const renderContent = () => {
    if (!isInWorkspace || !selectedRepo) {
      return (
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
      )
    }

    if (isInCloneView) {
      return <CloneView />
    }

    if (isInPipelinesView) {
      return <PipelinesView />
    }

    if (isInPRsView) {
      return <PRsView />
    }

    return (
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
  }

  return (
    <box
      title={getTitle()}
      padding={2}
      borderStyle="rounded"
      flexGrow={1}
      height={height - 2}
      borderColor={isFocused ? "#007595" : "white"}
    >
      <box flexDirection="column">
        {renderContent()}
      </box>
      <Toast 
        message={repoActionStatus?.message ?? null}
        isError={repoActionStatus?.isError}
        duration={3000}
        onDismiss={handleToastDismiss}
      />
    </box>
  )
}
