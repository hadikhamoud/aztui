import { useAppStore } from "../store/app-store"

export function Controls() {
  const { focusedBox, isInWorkspace } = useAppStore()

  const getControlsText = () => {
    if (isInWorkspace) {
      return "Enter: Select option | Esc: Back to repos | Tab: Navigate | Arrow Keys: Move selection"
    }
    
    if (focusedBox === 'projects') {
      return "Enter: Load repos | Tab: Next | Arrow Keys: Move selection"
    }
    
    if (focusedBox === 'repos') {
      return "Enter: Open workspace | Tab: Navigate | Arrow Keys: Move selection"
    }
    
    return "Tab: Navigate | Arrow Keys: Move selection"
  }

  return (
    <text>
      {getControlsText()}
    </text>
  )
}