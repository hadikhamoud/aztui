import { useAppStore } from "../store/app-store"

export function Controls() {
  const { 
    focusedBox, 
    isInWorkspace, 
    isInCloneView, 
    isInPipelinesView,
    isInPRsView,
    cloneFocusedField, 
    isSearchActive,
    selectedPipeline,
    selectedPipelineRun,
    selectedStep,
    selectedPR,
    selectedPRFile,
    isAddingComment,
    isCompletingPR,
    isAddingReviewer,
    selectedConflict,
    prConflicts
  } = useAppStore()

  const getControlsText = () => {
    if (isSearchActive) {
      return "Type to search | Enter: Keep filter | Esc: Clear search"
    }
    
    if (isInCloneView && focusedBox === 'workspace') {
      if (cloneFocusedField === 'method') {
        return "Left/Right: Switch method | Tab: Next field | Enter: Clone | Esc: Back"
      } else {
        return "Tab: Previous field | Enter: Clone | Esc: Back | Type: Enter path"
      }
    }

    if (isInPipelinesView && focusedBox === 'workspace') {
      if (selectedStep) {
        return "j/k: Scroll logs | Ctrl+d/u: Page down/up | Esc: Back to steps"
      }
      if (selectedPipelineRun) {
        return "j/k: Navigate steps | Enter: View logs | Esc: Back to runs"
      }
      if (selectedPipeline) {
        return "Enter: View steps | Esc: Back to pipelines | Arrow Keys: Navigate"
      }
      return "Enter: View runs | Esc: Back to options | Arrow Keys: Navigate"
    }

    if (isInPRsView && focusedBox === 'workspace') {
      if (isAddingComment) {
        return "Ctrl+Enter: Submit | Esc: Cancel"
      }
      if (isCompletingPR) {
        return "Ctrl+Enter: Complete PR | Esc: Cancel"
      }
      if (isAddingReviewer) {
        return "Enter: Add reviewer | R: Toggle required | j/k: Navigate | Esc: Cancel"
      }
      if (selectedConflict) {
        return "j/k: Navigate conflicts | Esc: Back to PR"
      }
      if (selectedPRFile) {
        return "j/k: Files | O: Open | Y: Copy link | A: Approve | C: Comment | M: Merge | D: Draft | R: Reviewer | Esc: Back"
      }
      if (selectedPR) {
        const hasConflicts = prConflicts.length > 0
        return `Enter: Diff | j/k: Nav | O: Open | Y: Copy link | A: Approve | C: Comment | M: Merge | D: Draft | R: Reviewer${hasConflicts ? ' | X: Conflicts' : ''}`
      }
      return "Enter: Select PR | Esc: Back to options | Arrow Keys: Navigate"
    }
    
    if (isInWorkspace) {
      return "Enter: Select option | Esc: Back to repos | Tab: Navigate | Arrow Keys: Move selection | /: Search"
    }
    
    if (focusedBox === 'projects') {
      return "Enter: Load repos | Tab: Next | Arrow Keys: Move selection | /: Search"
    }
    
    if (focusedBox === 'repos') {
      return "Enter: Open workspace | Tab: Navigate | Arrow Keys: Move selection | /: Search"
    }
    
    return "Tab: Navigate | Arrow Keys: Move selection | /: Search"
  }

  return (
    <text>
      {getControlsText()}
    </text>
  )
}