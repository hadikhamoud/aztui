import { createCliRenderer, PasteEvent } from "@opentui/core"
import { useKeyboard, createRoot, useAppContext } from "@opentui/react"
import { useTerminalDimensions } from "@opentui/react"
import { useEffect, useRef, useState } from "react"
import { useAppStore, autoInitialize } from "./store/app-store"
import { ProjectBox } from "./components/project-box"
import { RepoBox } from "./components/repo-box"
import { WorkspaceBox } from "./components/workspace-box"
import { Controls } from "./components/controls"
import { SearchBar } from "./components/search-bar"
import { SetupView } from "./components/setup-view"
import { checkForUpdates, UpdateCheckResult } from "./config/updater"
import { runConfigCommand } from "./commands/config"
import { runLoginCommand } from "./commands/login"

// Handle CLI commands before starting the TUI
const args = process.argv.slice(2)
const command = args[0]

// Commands that exit after running
switch (command) {
  case "config":
    await runConfigCommand()
    process.exit(0)
    break
}

// Commands that modify state before TUI starts
switch (command) {
  case "login":
    await runLoginCommand()
    break
  case "prs":
  case "pr":
    useAppStore.setState({ pendingView: 'prs' })
    break
  case "build":
  case "builds":
  case "pipelines":
    useAppStore.setState({ pendingView: 'pipelines' })
    break
}

// Now run auto-initialization (after pendingView is set)
autoInitialize()

function App() {
  const { width, height } = useTerminalDimensions()
  // Subscribe to trigger re-renders, but use getState() in keyboard handler for fresh values
  const { needsSetup } = useAppStore()
  
  // Update notification state
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  
  // Check for updates on app start
  useEffect(() => {
    checkForUpdates().then((result) => {
      setUpdateResult(result)
      // Show banner if update was applied or is pending
      if (result.updateApplied || result.hasUpdate) {
        setShowUpdateBanner(true)
        // Auto-hide the banner after 5 seconds
        setTimeout(() => setShowUpdateBanner(false), 5000)
      }
    }).catch(() => {
      // Silently ignore update check failures
    })
  }, [])
  
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
      if (key.sequence && key.name !== 'escape') {
        // Skip control key combos (Ctrl+C, Cmd+Q, etc.) but not multi-char sequences (paste)
        if (key.sequence.length === 1 && (key.ctrl || key.meta)) {
          return
        }
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

      // Handle typed characters and pasted text
      if (key.sequence && key.name !== 'escape') {
        if (key.sequence.length === 1 && (key.ctrl || key.meta)) {
          return
        }
        const printable = key.sequence.replace(/[\x00-\x1F\x7F]/g, '')
        if (printable.length > 0) {
          state.setSearchQuery(state.searchQuery + printable)
          return
        }
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
        // Handle typed characters and pasted text
        if (key.sequence && key.name !== 'escape') {
          if (key.sequence.length === 1 && (key.ctrl || key.meta)) {
            return
          }
          const printable = key.sequence.replace(/[\x00-\x1F\x7F]/g, '')
          if (printable.length > 0) {
            state.setCloneLocation(state.cloneLocation + printable)
            return
          }
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
        if (key.name === "o") {
          state.openBuildRunInBrowser()
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
      // Handle Create PR mode
      if (state.isCreatingPR) {
        if (key.name === "escape") {
          state.cancelCreatingPR()
          return
        }
        
        // Branch selection steps (source and target)
        if (state.createPRStep === 'source' || state.createPRStep === 'target') {
          if (key.name === "up") {
            state.navigateBranch('up')
            return
          }
          if (key.name === "down") {
            state.navigateBranch('down')
            return
          }
          if (key.name === "return") {
            state.selectCurrentBranch()
            return
          }
          if (key.name === "tab" && state.createPRStep === 'target') {
            state.prevCreatePRStep()
            return
          }
          if (key.name === "backspace") {
            state.setCreatePRSearchQuery(state.createPRSearchQuery.slice(0, -1))
            return
          }
          // Handle typed characters for search
          if (key.sequence && key.name !== 'escape' && key.name !== 'tab') {
            if (key.sequence.length === 1 && (key.ctrl || key.meta)) {
              return
            }
            const printable = key.sequence.replace(/[\x00-\x1F\x7F]/g, '')
            if (printable.length > 0) {
              state.setCreatePRSearchQuery(state.createPRSearchQuery + printable)
              return
            }
          }
          return
        }
        
        // Title input step
        if (state.createPRStep === 'title') {
          if (key.name === "backspace") {
            state.setCreatePRTitle(state.createPRTitle.slice(0, -1))
            return
          }
          if (key.name === "return") {
            state.nextCreatePRStep()
            return
          }
          if (key.name === "tab") {
            state.prevCreatePRStep()
            return
          }
          // Handle typed characters and pasted text
          if (key.sequence && key.name !== 'escape') {
            if (key.sequence.length === 1 && (key.ctrl || key.meta)) {
              return
            }
            const printable = key.sequence.replace(/[\x00-\x1F\x7F]/g, '')
            if (printable.length > 0) {
              state.setCreatePRTitle(state.createPRTitle + printable)
              return
            }
          }
          return
        }
        
        // Description input step
        if (state.createPRStep === 'description') {
          if (key.name === "backspace") {
            state.setCreatePRDescription(state.createPRDescription.slice(0, -1))
            return
          }
          if (key.name === "return" && key.ctrl) {
            state.nextCreatePRStep()
            return
          }
          if (key.name === "return") {
            state.setCreatePRDescription(state.createPRDescription + '\n')
            return
          }
          if (key.name === "tab") {
            state.prevCreatePRStep()
            return
          }
          // Handle typed characters and pasted text
          if (key.sequence && key.name !== 'escape') {
            if (key.sequence.length === 1 && (key.ctrl || key.meta)) {
              return
            }
            const printable = key.sequence.replace(/[\x00-\x1F\x7F]/g, '')
            if (printable.length > 0) {
              state.setCreatePRDescription(state.createPRDescription + printable)
              return
            }
          }
          return
        }
        
        // Reviewers selection step
        if (state.createPRStep === 'reviewers') {
          if (key.name === "up") {
            state.navigateBranch('up')
            return
          }
          if (key.name === "down") {
            state.navigateBranch('down')
            return
          }
          if (key.name === "space") {
            const filteredReviewers = state.getFilteredReviewers()
            const member = filteredReviewers[state.selectedBranchIndex]
            if (member) {
              state.toggleCreatePRReviewer(member.id)
            }
            return
          }
          if (key.name === "return") {
            state.nextCreatePRStep()
            return
          }
          if (key.name === "tab") {
            state.prevCreatePRStep()
            return
          }
          // Handle typed characters for search
          if (key.sequence && key.name !== 'escape' && key.name !== 'tab' && key.name !== 'space') {
            if (key.sequence.length === 1 && (key.ctrl || key.meta)) {
              return
            }
            const printable = key.sequence.replace(/[\x00-\x1F\x7F]/g, '')
            if (printable.length > 0) {
              state.setCreatePRSearchQuery(state.createPRSearchQuery + printable)
              return
            }
          }
          return
        }
        
        // Confirm step
        if (state.createPRStep === 'confirm') {
          if (key.name === "d") {
            state.toggleCreatePRDraft()
            return
          }
          if (key.name === "return") {
            state.submitCreatePR()
            return
          }
          if (key.name === "tab") {
            state.prevCreatePRStep()
            return
          }
          return
        }
        
        return
      }
      
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
        if (key.name === "return") {
          state.setCommentText(state.commentText + '\n')
          return
        }
        // Handle typed characters and pasted text
        if (key.sequence && key.name !== 'escape') {
          if (key.sequence.length === 1 && (key.ctrl || key.meta)) {
            return
          }
          const printable = key.sequence.replace(/[\x00-\x1F\x7F]/g, '')
          if (printable.length > 0) {
            state.setCommentText(state.commentText + printable)
            return
          }
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
        if (key.name === "t") {
          state.cycleCompletionMergeStrategy()
          return
        }
        if (key.name === "b") {
          state.toggleCompletionDeleteBranch()
          return
        }
        if (key.name === "backspace") {
          state.setCompletionMessage(state.completionMessage.slice(0, -1))
          return
        }
        if (key.name === "return") {
          state.setCompletionMessage(state.completionMessage + '\n')
          return
        }
        // Handle typed characters and pasted text (skip t and b as they're commands)
        if (key.sequence && key.name !== 'escape' && key.name !== 't' && key.name !== 'b') {
          if (key.sequence.length === 1 && (key.ctrl || key.meta)) {
            return
          }
          const printable = key.sequence.replace(/[\x00-\x1F\x7F]/g, '')
          if (printable.length > 0) {
            state.setCompletionMessage(state.completionMessage + printable)
            return
          }
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
        if (key.name === "v") {
          state.toggleDiffViewMode()
          return
        }
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
        if (key.name === "y") {
          state.copyPRLinkToClipboard()
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
      
      // Toggle diff view mode when viewing a file diff
      if (state.selectedPRFile && key.name === "v") {
        state.toggleDiffViewMode()
        return
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
      
      // Create new PR (when not viewing a specific PR)
      if (!state.selectedPR && key.name === "n") {
        state.startCreatingPR()
        return
      }
      
      // Tab to toggle between active and completed PRs (when viewing PR list)
      if (!state.selectedPR && key.name === "tab") {
        state.togglePRFilter()
        return
      }
      return
    }

    // Handle Create Repository view
    if (state.isCreatingRepo) {
      if (key.name === "escape") {
        state.cancelCreatingRepo()
        return
      }
      if (key.name === "return") {
        state.submitCreateRepo()
        return
      }
      if (key.name === "backspace") {
        state.setCreateRepoName(state.createRepoName.slice(0, -1))
        return
      }
      // Handle typed characters
      if (key.sequence && key.name !== 'escape') {
        if (key.sequence.length === 1 && (key.ctrl || key.meta)) {
          return
        }
        const printable = key.sequence.replace(/[\x00-\x1F\x7F]/g, '')
        if (printable.length > 0) {
          state.setCreateRepoName(state.createRepoName + printable)
          return
        }
      }
      return
    }

    // N to create new repo when in repos view
    if (state.focusedBox === "repos" && state.selectedProject && key.name === "n") {
      state.startCreatingRepo()
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
    
    // Repo shortcuts (available when in workspace but not in a specific view)
    if (state.focusedBox === "workspace" && state.isInWorkspace && 
        !state.isInCloneView && !state.isInPRsView && !state.isInPipelinesView) {
      if (key.name === "o") {
        state.openRepoInBrowser()
        return
      }
      if (key.name === "y" && !key.ctrl) {
        state.copyRepoHttpsLink()
        return
      }
      if (key.name === "y" && key.ctrl) {
        state.copyRepoSshLink()
        return
      }
    }
  })

  // Handle paste events (Cmd+V on macOS, Ctrl+V on Linux/Windows)
  const { keyHandler } = useAppContext()
  useEffect(() => {
    if (!keyHandler) return
    
    const handlePaste = (event: PasteEvent) => {
      const state = useAppStore.getState()
      const text = event.text
      
      // Handle paste in setup mode
      if (state.needsSetup) {
        if (state.setupFocusedField === 'orgUrl') {
          state.setSetupOrgUrl(state.setupOrgUrl + text)
        } else {
          state.setSetupPat(state.setupPat + text)
        }
        return
      }
      
      // Handle paste in search
      if (state.isSearchActive) {
        state.setSearchQuery(state.searchQuery + text)
        return
      }
      
      // Handle paste in clone view
      if (state.isInCloneView && state.focusedBox === 'workspace' && state.cloneFocusedField === 'path') {
        state.setCloneLocation(state.cloneLocation + text)
        return
      }
      
      // Handle paste in PR comment
      if (state.isInPRsView && state.isAddingComment) {
        state.setCommentText(state.commentText + text)
        return
      }
      
      // Handle paste in PR completion message
      if (state.isInPRsView && state.isCompletingPR) {
        state.setCompletionMessage(state.completionMessage + text)
        return
      }
      
      // Handle paste in create repo
      if (state.isCreatingRepo) {
        state.setCreateRepoName(state.createRepoName + text)
        return
      }
    }
    
    const handler = keyHandler as any
    handler.on("paste", handlePaste)
    return () => {
      handler.off("paste", handlePaste)
    }
  }, [keyHandler])

  // Update banner component
  const UpdateBanner = () => {
    if (!showUpdateBanner || !updateResult) return null
    
    const bgColor = updateResult.updateApplied ? '#22c55e' : '#3b82f6'
    const message = updateResult.updateApplied 
      ? `Updated to ${updateResult.latestVersion}!`
      : updateResult.hasUpdate
        ? `Update ${updateResult.latestVersion} ready - restart to apply`
        : ''
    
    if (!message) return null
    
    return (
      <box width={width} height={1} backgroundColor={bgColor}>
        <text fg="white">{` ${message} `}</text>
      </box>
    )
  }

  // Show setup view if credentials are missing
  if (needsSetup) {
    return (
      <box width={width} height={height} flexDirection="column">
        <UpdateBanner />
        <SetupView />
      </box>
    )
  }

  const mainHeight = showUpdateBanner && updateResult && (updateResult.updateApplied || updateResult.hasUpdate) 
    ? height - 3 
    : height - 2

  return (
    <box width={width} height={height} flexDirection="column">
      <UpdateBanner />
      <box width={width} height={mainHeight} flexDirection="row">
        <box flexDirection="column" width={Math.floor(width / 3)} height={mainHeight}>
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
