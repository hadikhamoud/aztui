import { useAppStore } from "../store/app-store"
import { Select } from "./select"
import { TextAttributes } from "@opentui/core"

export function PRsView() {
  const {
    selectedRepo,
    pullRequests,
    selectedPR,
    prsLoading,
    selectPR,
    focusedBox
  } = useAppStore()

  const isFocused = focusedBox === 'workspace'

  const handlePRSelect = (value: string) => {
    const pr = pullRequests.find(p => p.value === value)
    if (pr) {
      selectPR(pr)
    }
  }

  const getPRDetails = () => {
    if (!selectedPR) return null
    try {
      return JSON.parse(selectedPR.description)
    } catch {
      return null
    }
  }

  const prDetails = getPRDetails()

  return (
    <box flexDirection="column" gap={1}>
      <text attributes={TextAttributes.BOLD}>
        Pull Requests for: {selectedRepo?.name}
      </text>
      
      {prsLoading ? (
        <text fg="#888888">Loading pull requests...</text>
      ) : pullRequests.length === 0 ? (
        <text fg="#888888">No active pull requests found</text>
      ) : (
        <Select 
          options={pullRequests} 
          focused={isFocused} 
          value={selectedPR?.value}
          onSelect={handlePRSelect}
        />
      )}

      {selectedPR && prDetails && (
        <box flexDirection="column" gap={0} marginTop={1} borderStyle="rounded" borderColor="#007595" padding={0.5}>
          <text attributes={TextAttributes.BOLD}>PR Details:</text>
          <text>Author: {prDetails.author}</text>
          <text fg="#888888">Source: {prDetails.sourceBranch}</text>
          <text fg="#888888">Target: {prDetails.targetBranch}</text>
          <text fg={prDetails.status === 'active' ? 'green' : '#888888'}>
            Status: {prDetails.status}
          </text>
        </box>
      )}

      <text fg="#888888">
        Enter: Select PR | Esc: Back to options
      </text>
    </box>
  )
}
