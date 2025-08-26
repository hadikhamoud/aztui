import { Select } from "./select"
import { useAppStore } from "../store/app-store"
import { useTerminalDimensions } from "@opentui/react"

export function RepoBox() {
  const { height } = useTerminalDimensions()
  const {
    repos,
    selectedProject,
    focusedBox,
    selectRepo
  } = useAppStore()

  const isFocused = focusedBox === 'repos'

  const handleSelect = (value: string) => {
    const index = repos.findIndex(r => r.value === value)
    if (index !== -1) {
      selectRepo(repos[index], index)
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
      height={Math.floor((height - 1) / 2)}
      borderColor={isFocused ? "#007595" : "white"}
    >
      <Select 
        options={repos} 
        focused={isFocused} 
        onSelect={handleSelect}
      />
    </box>
  )
}