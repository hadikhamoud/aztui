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
    selectProject
  } = useAppStore()

  const isFocused = focusedBox === 'projects'

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleSelect = (value: string) => {
    const index = projects.findIndex(p => p.value === value)
    if (index !== -1) {
      selectProject(projects[index], index)
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
        options={projects} 
        focused={isFocused} 
        onSelect={handleSelect}
      />
    </box>
  )
}