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
    selectedPipeline
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
      if (selectedPipeline) {
        return "Enter: Select run | Esc: Back to pipelines | Arrow Keys: Navigate"
      }
      return "Enter: View runs | Esc: Back to options | Arrow Keys: Navigate"
    }

    if (isInPRsView && focusedBox === 'workspace') {
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