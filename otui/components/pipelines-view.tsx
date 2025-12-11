import { useAppStore } from "../store/app-store"
import { Select } from "./select"
import { TextAttributes } from "@opentui/core"

export function PipelinesView() {
  const {
    selectedRepo,
    pipelines,
    selectedPipeline,
    pipelineRuns,
    selectedPipelineRun,
    pipelinesLoading,
    pipelineRunsLoading,
    selectPipeline,
    selectPipelineRun,
    focusedBox
  } = useAppStore()

  const isFocused = focusedBox === 'workspace'

  const handlePipelineSelect = (value: string) => {
    // Only triggered on Enter - enter the pipeline runs view
    const pipeline = pipelines.find(p => p.value === value)
    if (pipeline) {
      selectPipeline(pipeline)
    }
  }

  const handleRunSelect = (value: string) => {
    // Only triggered on Enter - select the run
    const run = pipelineRuns.find(r => r.value === value)
    if (run) {
      selectPipelineRun(run)
    }
  }

  // Show pipeline runs if a pipeline is selected
  if (selectedPipeline) {
    return (
      <box flexDirection="column" gap={1}>
        <text attributes={TextAttributes.BOLD}>
          Pipeline: {selectedPipeline.name}
        </text>
        
        {pipelineRunsLoading ? (
          <text fg="#888888">Loading runs...</text>
        ) : pipelineRuns.length === 0 ? (
          <text fg="#888888">No runs found for this pipeline</text>
        ) : (
          <box flexDirection="column">
            <text fg="#888888">Recent Runs:</text>
            <Select 
              options={pipelineRuns} 
              focused={isFocused} 
              value={selectedPipelineRun?.value}
              onSelect={handleRunSelect}
            />
          </box>
        )}

        {selectedPipelineRun && (
          <box flexDirection="column" gap={0} marginTop={1}>
            <text attributes={TextAttributes.BOLD}>Run Details:</text>
            <text>Build: {selectedPipelineRun.name}</text>
            <text fg="#888888">Branch: {selectedPipelineRun.description}</text>
          </box>
        )}
      </box>
    )
  }

  // Show pipeline list
  return (
    <box flexDirection="column" gap={1}>
      <text attributes={TextAttributes.BOLD}>
        Build Pipelines for: {selectedRepo?.name}
      </text>
      
      {pipelinesLoading ? (
        <text fg="#888888">Loading pipelines...</text>
      ) : pipelines.length === 0 ? (
        <text fg="#888888">No pipelines found for this repository</text>
      ) : (
        <Select 
          options={pipelines} 
          focused={isFocused} 
          value={undefined}
          onSelect={handlePipelineSelect}
        />
      )}
    </box>
  )
}
