import { render } from "@opentui/react"
import { useKeyboard } from "@opentui/react"
import { useTerminalDimensions } from "@opentui/react"
import { useAppStore } from "./store/app-store"
import { ProjectBox } from "./components/project-box"
import { RepoBox } from "./components/repo-box"
import { WorkspaceBox } from "./components/workspace-box"

function App() {
  const { width, height } = useTerminalDimensions()
  const {
    focusedBox,
    cycleFocus,
    selectedProject,
    loadRepos,
    setFocusedBox
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
      if (focusedBox === "repos") {
        console.log("repo selected")
      }
    }
  })

  return (
    <group width={width} height={height} flexDirection="row">
      <group flexDirection="column" flexGrow={1}>
        <ProjectBox />
        <RepoBox />
      </group>
      <WorkspaceBox />
    </group>
  )
}

render(<App />)
