import { useAppStore } from "../store/app-store"

export function CloneView() {
  const {
    cloneLocation,
    cloneMethod,
    cloneStatus,
    selectedRepo,
    cloneFocusedField,
    focusedBox
  } = useAppStore()

  const isFocused = focusedBox === 'workspace'

  return (
    <group flexDirection="column" height="100%">
      <text color="white" marginBottom={1}>
        Clone {selectedRepo?.name} repository
      </text>
      
      <text color="gray" marginBottom={1}>
        Clone method:
      </text>
      
      <group flexDirection="row" marginBottom={2}>
        <box
          borderStyle="single"
          borderColor={cloneFocusedField === 'method' && isFocused ? "#007595" : "gray"}
          backgroundColor={cloneMethod === 'https' ? "#007595" : "black"}
          padding={0.5}
          marginRight={1}
        >
          <text color="white">{cloneMethod === 'https' ? '● HTTPS' : '○ HTTPS'}</text>
        </box>
        <box
          borderStyle="single"
          borderColor={cloneFocusedField === 'method' && isFocused ? "#007595" : "gray"}
          backgroundColor={cloneMethod === 'ssh' ? "#007595" : "black"}
          padding={0.5}
        >
          <text color="white">{cloneMethod === 'ssh' ? '● SSH' : '○ SSH'}</text>
        </box>
      </group>

      <text color="gray" marginBottom={1}>
        Clone to directory:
      </text>
      
      <box
        borderStyle="single"
        borderColor={cloneFocusedField === 'path' && isFocused ? "#007595" : "gray"}
        backgroundColor="black"
        padding={0.5}
        marginBottom={2}
      >
        <text color="white">
          {cloneLocation || "/path/to/clone/directory"}
        </text>
      </box>

      {cloneStatus && (
        <text 
          color={cloneStatus.isError ? "red" : "green"} 
          marginBottom={1}
        >
          {cloneStatus.message}
        </text>
      )}

      <text color="gray" marginTop="auto">
        {cloneFocusedField === 'method' ? 
          "Left/Right: Switch method • Tab: Next field • Enter: Clone • Esc: Back" :
          "Tab: Previous field • Enter: Clone • Esc: Back"
        }
      </text>
    </group>
  )
}