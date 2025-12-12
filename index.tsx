import { createCliRenderer } from "@opentui/core"
import { useKeyboard, createRoot } from "@opentui/react"
import { useTerminalDimensions } from "@opentui/react"
import { useEffect, useState, useRef } from "react"
import { useAppStore } from "./store/app-store"
import { ProjectBox } from "./components/project-box"
import { RepoBox } from "./components/repo-box"
import { WorkspaceBox } from "./components/workspace-box"
import { Controls } from "./components/controls"
import { SearchBar } from "./components/search-bar"
import { SetupView } from "./components/setup-view"

function App() {
  const { width, height } = useTerminalDimensions()
  // Subscribe to trigger re-renders, but use getState() in keyboard handler for fresh values
  const { needsSetup } = useAppStore()
  
  // Handle initialization after setup completes
  // The initial auto-detect is handled in the store module itself at load time
  // This effect handles the case when setup completes (needsSetup goes from true to false)
  const prevNeedsSetupRef = useRef(needsSetup)
  useEffect(() => {
    if (prevNeedsSetupRef.current && !needsSetup) {
      // Setup just completed, run initializeFromCwd
      useAppStore.getState().initializeFromCwd()
    }
    prevNeedsSetupRef.current = needsSetup
  }, [needsSetup])



  useKeyboard((key) => {
    // Get fresh state from store to avoid stale closures
    const state = useAppStore.getState()
    
    // Handle setup mode
    if (state.needsSetup) {
      if (key.name === "tab") {
        state.toggleSetupField()
        return
      }
      
      if (key.name === "return") {
        state.submitSetup()
        return
      }
      
      if (key.name === "backspace") {
        if (state.setupFocusedField === 'orgUrl') {
          state.setSetupOrgUrl(state.setupOrgUrl.slice(0, -1))
        } else {
          state.setSetupPat(state.setupPat.slice(0, -1))
        }
        return
      }
      
      // Handle typed characters and pasted text (sequence can be multiple characters on paste)
      if (key.sequence && !key.ctrl && !key.meta && key.name !== 'escape') {
        // Filter out control characters but allow printable characters
        const printable = key.sequence.replace(/[\x00-\x1F\x7F]/g, '')
        if (printable.length > 0) {
          if (state.setupFocusedField === 'orgUrl') {
            state.setSetupOrgUrl(state.setupOrgUrl + printable)
          } else {
            state.setSetupPat(state.setupPat + printable)
          }
          return
        }
      }
      
      return
    }
    
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
      // If viewing step logs
      if (state.selectedStep) {
        if (key.name === "escape") {
          state.exitStepLogs()
          return
        }
        if (key.name === "j" || key.name === "down") {
          state.scrollLogs('down')
          return
        }
        if (key.name === "k" || key.name === "up") {
          state.scrollLogs('up')
          return
        }
        if (key.name === "pagedown" || (key.name === "d" && key.ctrl)) {
          state.scrollLogs('pagedown')
          return
        }
        if (key.name === "pageup" || (key.name === "u" && key.ctrl)) {
          state.scrollLogs('pageup')
          return
        }
        return
      }
      
      // If viewing steps (run selected)
      if (state.selectedPipelineRun) {
        if (key.name === "escape") {
          state.goBackFromSteps()
          return
        }
        if (key.name === "j" || key.name === "down") {
          state.navigateStep('down')
          return
        }
        if (key.name === "k" || key.name === "up") {
          state.navigateStep('up')
          return
        }
        if (key.name === "return") {
          // Select the current step to view logs
          const tasks = state.pipelineSteps.filter(s => s.type === 'Task')
          const step = tasks[state.selectedStepIndex]
          if (step) {
            state.selectStep(step, state.selectedStepIndex)
          }
          return
        }
        return
      }
      
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
      // Handle comment input mode
      if (state.isAddingComment) {
        if (key.name === "escape") {
          state.cancelAddingComment()
          return
        }
        if (key.name === "return" && key.ctrl) {
          state.submitComment()
          return
        }
        if (key.name === "backspace") {
          state.setCommentText(state.commentText.slice(0, -1))
          return
        }
        if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
          state.setCommentText(state.commentText + key.sequence)
          return
        }
        if (key.name === "return") {
          state.setCommentText(state.commentText + '\n')
          return
        }
        return
      }
      
      // Handle completion message input mode
      if (state.isCompletingPR) {
        if (key.name === "escape") {
          state.cancelCompletingPR()
          return
        }
        if (key.name === "return" && key.ctrl) {
          state.submitCompletion()
          return
        }
        if (key.name === "backspace") {
          state.setCompletionMessage(state.completionMessage.slice(0, -1))
          return
        }
        if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
          state.setCompletionMessage(state.completionMessage + key.sequence)
          return
        }
        if (key.name === "return") {
          state.setCompletionMessage(state.completionMessage + '\n')
          return
        }
        return
      }
      
      // Handle adding reviewer mode
      if (state.isAddingReviewer) {
        if (key.name === "escape") {
          state.cancelAddingReviewer()
          return
        }
        if (key.name === "return") {
          state.submitReviewer()
          return
        }
        if (key.name === "up" || key.name === "k") {
          state.navigateReviewer('up')
          return
        }
        if (key.name === "down" || key.name === "j") {
          state.navigateReviewer('down')
          return
        }
        if (key.name === "r") {
          state.toggleReviewerRequired()
          return
        }
        return
      }
      
      if (key.name === "escape") {
        if (state.selectedConflict) {
          // Go back from conflict view
          state.exitConflictView()
        } else if (state.selectedPRFile) {
          // Go back from diff view to file list
          state.goBackFromPRFiles()
        } else if (state.selectedPR) {
          // Go back from file list to PR list
          state.goBackFromPRFiles()
        } else {
          // Exit PRs view completely
          state.exitPRsView()
        }
        return
      }
      
      // If viewing a conflict, handle navigation
      if (state.selectedConflict) {
        if (key.name === "up" || key.name === "k") {
          state.navigateConflict('up')
          return
        }
        if (key.name === "down" || key.name === "j") {
          state.navigateConflict('down')
          return
        }
        return
      }
      
      // PR Actions (when a PR is selected)
      if (state.selectedPR) {
        if (key.name === "o") {
          state.openPRInBrowser()
          return
        }
        if (key.name === "a") {
          state.approvePR()
          return
        }
        if (key.name === "c") {
          state.startAddingComment()
          return
        }
        if (key.name === "m") {
          state.startCompletingPR()
          return
        }
        if (key.name === "d") {
          state.toggleDraft()
          return
        }
        if (key.name === "r") {
          state.startAddingReviewer()
          return
        }
        // View conflicts
        if (key.name === "x" && state.prConflicts.length > 0) {
          state.selectConflict(state.selectedConflictIndex)
          return
        }
      }
      
      // Navigate through files when viewing a PR
      if (state.selectedPR && state.prFileChanges.length > 0) {
        if (key.name === "up" || key.name === "k") {
          state.navigatePRFile('up')
          return
        }
        if (key.name === "down" || key.name === "j") {
          state.navigatePRFile('down')
          return
        }
        if (key.name === "return") {
          // Select the highlighted file to view diff
          const file = state.prFileChanges[state.selectedPRFileIndex]
          if (file && !state.selectedPRFile) {
            state.selectPRFile(file, state.selectedPRFileIndex)
          }
          return
        }
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

  // Show setup view if credentials are missing
  if (needsSetup) {
    return (
      <box width={width} height={height} flexDirection="column">
        <SetupView />
      </box>
    )
  }

  return (
    <box width={width} height={height} flexDirection="column">
      <box width={width} height={height - 2} flexDirection="row">
        <box flexDirection="column" width={Math.floor(width / 3)} height={height - 2}>
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
