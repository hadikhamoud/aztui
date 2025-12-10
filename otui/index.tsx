import { createCliRenderer } from "@opentui/core"
import { useKeyboard, createRoot } from "@opentui/react"
import { useTerminalDimensions } from "@opentui/react"
import { useAppStore } from "./store/app-store"
import { ProjectBox } from "./components/project-box"
import { RepoBox } from "./components/repo-box"
import { WorkspaceBox } from "./components/workspace-box"
import { Controls } from "./components/controls"
import { SearchBar } from "./components/search-bar"

function App() {
  const { width, height } = useTerminalDimensions()
  // Subscribe to trigger re-renders, but use getState() in keyboard handler for fresh values
  useAppStore()



  useKeyboard((key) => {
    // Get fresh state from store to avoid stale closures
    const state = useAppStore.getState()
    
    if (state.isSearchActive) {
      if (key.name === "escape") {
        state.clearSearch()
        return
      }

      if (key.name === "return") {
        state.selectHighlightedOption()
        return
      }

      if (key.name === "up") {
        state.moveSearchHighlight('up')
        return
      }

      if (key.name === "down") {
        state.moveSearchHighlight('down')
        return
      }

      if (key.name === "backspace") {
        state.setSearchQuery(state.searchQuery.slice(0, -1))
        return
      }

      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
        state.setSearchQuery(state.searchQuery + key.sequence)
        return
      }

      return
    }

    // Handle Clone View keyboard input
    if (state.isInCloneView && state.focusedBox === 'workspace') {
      if (key.name === "escape") {
        state.exitCloneView()
        return
      }
      
      if (key.name === "tab") {
        // Toggle between method and path fields
        state.setCloneFocusedField(state.cloneFocusedField === 'method' ? 'path' : 'method')
        return
      }
      
      if (state.cloneFocusedField === 'method') {
        if (key.name === "left" || key.name === "right") {
          state.toggleCloneMethod()
          return
        }
      }
      
      if (state.cloneFocusedField === 'path') {
        if (key.name === "backspace") {
          state.setCloneLocation(state.cloneLocation.slice(0, -1))
          return
        }
        if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
          state.setCloneLocation(state.cloneLocation + key.sequence)
          return
        }
      }
      
      if (key.name === "return") {
        // If no location specified, use current directory with repo name
        if (!state.cloneLocation.trim() && state.selectedRepo) {
          state.setCloneLocation(`./${state.selectedRepo.name}`)
        }
        state.executeClone()
        return
      }
      
      return
    }

    // Handle Pipelines View keyboard input
    if (state.isInPipelinesView && state.focusedBox === 'workspace') {
      if (key.name === "escape") {
        if (state.selectedPipeline) {
          // Go back from runs to pipeline list
          state.goBackFromRuns()
        } else {
          // Exit pipelines view
          state.exitPipelinesView()
        }
        return
      }
      return
    }

    // Handle PRs View keyboard input
    if (state.isInPRsView && state.focusedBox === 'workspace') {
      if (key.name === "escape") {
        state.exitPRsView()
        return
      }
      return
    }

    if (key.sequence === "/") {
      state.setSearchActive(true)
      state.setSearchQuery("")
      return
    }

    if (key.name === "tab") {
      state.cycleFocus()
    }
    if (key.name === "return") {
      if (state.focusedBox === "projects" && state.selectedProject) {
        state.loadRepos(state.selectedProject.value)
        state.setFocusedBox("repos")
      }
      if (state.focusedBox === "repos" && state.selectedRepo) {
        state.enterWorkspace()
      }
      if (state.focusedBox === "workspace" && state.isInWorkspace) {
        // Workspace option selection is handled by the Select component
      }
    }
    if (key.name === "escape") {
      if (state.isInWorkspace) {
        state.exitWorkspace()
      }
    }
  })

  return (
    <box width={width} height={height} flexDirection="column">
      <box width={width} height={height - 2} flexDirection="row">
        <box flexDirection="column" width={width / 2} height={height - 2}>
          <ProjectBox />
          <RepoBox />
        </box>
        <WorkspaceBox />
      </box>
      <SearchBar />
      <Controls />
    </box>
  )
}

const renderer = await createCliRenderer()
createRoot(renderer).render(<App />)
