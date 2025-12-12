import { useEffect } from "react"
import { Select } from "./select"
import { useAppStore } from "../store/app-store"
import { useTerminalDimensions } from "@opentui/react"

export function ProjectBox() {
  const { height } = useTerminalDimensions()
  const {
    projects,
    focusedBox,
    loadProjects,
    selectProject,
    getFilteredOptions,
    selectedProject,
    clearSearch,
    isSearchActive,
    isSelectMode,
    searchHighlightedIndex,
    searchTargetBox
  } = useAppStore()

  const isFocused = focusedBox === 'projects'
  const isSearchTarget = searchTargetBox === 'projects'
  const displayOptions = isSearchTarget ? getFilteredOptions('projects') : projects

  useEffect(() => {
    // Only load if projects aren't already loaded and we're not initializing from cwd
    // The isInitializingFromCwd check prevents race condition with auto-detect
    const state = useAppStore.getState()
    if (projects.length === 0 && !state.isInitializingFromCwd) {
      loadProjects()
    }
  }, [loadProjects, projects.length])

  const handleChange = (value: string) => {
    // Track selection as we navigate with arrow keys
    const project = projects.find(p => p.value === value)
    if (project) {
      const index = projects.findIndex(p => p.value === value)
      selectProject(project, index)
    }
  }

  const handleSelect = (value: string) => {
    // On Enter, select and clear search
    const project = projects.find(p => p.value === value)
    if (project) {
      const index = projects.findIndex(p => p.value === value)
      selectProject(project, index)
      clearSearch()
    }
  }

  return (
    <box 
      title="projects" 
      padding={0.5} 
      borderStyle="rounded" 
      height={Math.floor((height - 2) / 2)}
      borderColor={isFocused ? "#007595" : "white"}
    >
      <Select 
        options={displayOptions} 
        focused={isFocused} 
        value={selectedProject?.value}
        highlightedIndex={isSearchActive && isSearchTarget ? searchHighlightedIndex : undefined}
        isSearchActive={isSearchActive}
        isSelectMode={isSelectMode}
        onChange={handleChange}
        onSelect={handleSelect}
      />
    </box>
  )
}