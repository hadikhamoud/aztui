import { render } from "@opentui/react"
import { useKeyboard } from "@opentui/react"
import { useTerminalDimensions } from "@opentui/react"
import { useAppStore } from "./store/app-store"
import { ProjectBox } from "./components/project-box"
import { RepoBox } from "./components/repo-box"
import { WorkspaceBox } from "./components/workspace-box"
import { Controls } from "./components/controls"

function App() {
  const { width, height } = useTerminalDimensions()
  const {
    focusedBox,
    cycleFocus,
    selectedProject,
    selectedRepo,
    loadRepos,
    setFocusedBox,
    enterWorkspace,
    exitWorkspace,
    isInWorkspace
  } = useAppStore()



  useKeyboard((key) => {
    if (key.name === "tab") {
      cycleFocus()
    }
    if (key.name === "return") {
      if (focusedBox === "projects" && selectedProject) {
        loadRepos(selectedProject.value)
        setFocusedBox("repos")
      }
      if (focusedBox === "repos" && selectedRepo) {
        enterWorkspace()
      }
      if (focusedBox === "workspace" && isInWorkspace) {
        console.log("workspace option selected")
      }
    }
    if (key.name === "escape") {
      if (isInWorkspace) {
        exitWorkspace()
      }
    }
  })

  return (
    <group width={width} height={height} flexDirection="column">
      <group width={width} height={height - 1} flexDirection="row">
        <group flexDirection="column" width={width / 2} height={height - 1}>
          <ProjectBox />
          <RepoBox />
        </group>
        <WorkspaceBox />
      </group>
      <Controls />
    </group>
  )
}

render(<App />)
