import { Select } from "./select"
import { useAppStore } from "../store/app-store"
import { useTerminalDimensions } from "@opentui/react"

export function RepoBox() {
  const { height } = useTerminalDimensions()
  const {
    repos,
    selectedProject,
    selectedRepo,
    focusedBox,
    selectRepo,
    getFilteredOptions,
    clearSearch,
    isSearchActive,
    isSelectMode,
    searchHighlightedIndex,
    searchTargetBox
  } = useAppStore()

  const isFocused = focusedBox === 'repos'
  const isSearchTarget = searchTargetBox === 'repos'
  const displayOptions = isSearchTarget ? getFilteredOptions('repos') : repos

  const handleChange = (value: string) => {
    // Track selection as we navigate with arrow keys
    const repo = repos.find(r => r.value === value)
    if (repo) {
      const index = repos.findIndex(r => r.value === value)
      selectRepo(repo, index)
    }
  }

  const handleSelect = (value: string) => {
    // On Enter, select and clear search
    const repo = repos.find(r => r.value === value)
    if (repo) {
      const index = repos.findIndex(r => r.value === value)
      selectRepo(repo, index)
      clearSearch()
    }
  }

  const title = selectedProject 
    ? `repos - ${selectedProject.name}` 
    : "repos"

  return (
    <box 
      title={title}
      padding={0.5} 
      borderStyle="rounded" 
      height={Math.floor((height - 2) / 2)}
      borderColor={isFocused ? "#007595" : "white"}
    >
      <Select 
        options={displayOptions} 
        focused={isFocused} 
        value={selectedRepo?.value}
        highlightedIndex={isSearchActive && isSearchTarget ? searchHighlightedIndex : undefined}
        isSearchActive={isSearchActive}
        isSelectMode={isSelectMode}
        onChange={handleChange}
        onSelect={handleSelect}
      />
    </box>
  )
}