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
    searchHighlightedIndex
  } = useAppStore()

  const isFocused = focusedBox === 'repos'
  const displayOptions = isFocused ? getFilteredOptions('repos') : repos

  const handleSelect = (value: string) => {
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
        highlightedIndex={isSearchActive && isFocused ? searchHighlightedIndex : undefined}
        isSearchActive={isSearchActive}
        isSelectMode={isSelectMode}
        onSelect={handleSelect}
      />
    </box>
  )
}