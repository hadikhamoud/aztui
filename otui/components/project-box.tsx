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
    searchHighlightedIndex
  } = useAppStore()

  const isFocused = focusedBox === 'projects'
  const displayOptions = isFocused ? getFilteredOptions('projects') : projects

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleSelect = (value: string) => {
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
      height={Math.floor((height - 1) / 2)}
      borderColor={isFocused ? "#007595" : "white"}
    >
      <Select 
        options={displayOptions} 
        focused={isFocused} 
        value={selectedProject?.value}
        highlightedIndex={isSearchActive && isFocused ? searchHighlightedIndex : undefined}
        isSearchActive={isSearchActive}
        isSelectMode={isSelectMode}
        onSelect={handleSelect}
      />
    </box>
  )
}