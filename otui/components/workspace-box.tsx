import { Logo } from "./logo_2"
import { useAppStore } from "../store/app-store"

export function WorkspaceBox() {
  const { selectedProject, selectedRepo } = useAppStore()

  return (
    <box 
      title="workspace" 
      padding={2} 
      borderStyle="rounded"
      flexGrow={1}
    >
      <group flexDirection="column">
        <Logo />
        {selectedProject && (
          <text>Selected Project: {selectedProject.name}</text>
        )}
        {selectedRepo && (
          <text>Selected Repo: {selectedRepo.name}</text>
        )}
      </group>
    </box>
  )
}
