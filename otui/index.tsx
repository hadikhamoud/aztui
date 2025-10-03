import { render } from "@opentui/react"
import { useKeyboard } from "@opentui/react"
import { useTerminalDimensions } from "@opentui/react"
import { useAppStore } from "./store/app-store"
import { ProjectBox } from "./components/project-box"
import { RepoBox } from "./components/repo-box"
import { WorkspaceBox } from "./components/workspace-box"
import { Controls } from "./components/controls"
import { SearchBar } from "./components/search-bar"

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
    isInWorkspace,
    isSearchActive,
    setSearchActive,
    searchQuery,
    setSearchQuery,
    clearSearch
  } = useAppStore()



  useKeyboard((key) => {
    if (isSearchActive) {
      if (key.name === "escape") {
        clearSearch()
        return
      }
      
      if (key.name === "return") {
        setSearchActive(false)
        return
      }
      
      if (key.name === "backspace") {
        setSearchQuery(searchQuery.slice(0, -1))
        return
      }
      
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
        setSearchQuery(searchQuery + key.sequence)
        return
      }
      
      return
    }
    
    if (key.sequence === "/" && !isSearchActive) {
      setSearchActive(true)
      setSearchQuery("")
      return
    }
    
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
      <group width={width} height={height - 2} flexDirection="row">
        <group flexDirection="column" width={width / 2} height={height - 2}>
          <ProjectBox />
          <RepoBox />
        </group>
        <WorkspaceBox />
      </group>
      <SearchBar />
      <Controls />
    </group>
  )
}

render(<App />)
