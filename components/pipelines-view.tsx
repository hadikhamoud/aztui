import React from "react"
import { useAppStore } from "../store/app-store"
import { Select } from "./select"
import { TextAttributes, type MouseEvent } from "@opentui/core"
import { getLoggableBuildSteps, type BuildStep } from "../api"

// Get status icon and color for a step
function getStepStatusDisplay(step: BuildStep): { icon: string; color: string } {
  if (step.state === 'inProgress') {
    return { icon: '⟳', color: '#FFD700' } // Yellow for in progress
  }

  if (step.state === 'pending') {
    return { icon: '○', color: '#888888' } // Gray for pending
  }

  switch (step.result) {
    case 'succeeded':
      return { icon: '✓', color: '#00FF00' } // Green
    case 'failed':
      return { icon: '✗', color: '#FF4444' } // Red
    case 'canceled':
      return { icon: '⊘', color: '#FFA500' } // Orange
    case 'skipped':
      return { icon: '⊖', color: '#888888' } // Gray
    default:
      return { icon: '?', color: '#888888' }
  }
}

// Format duration
function formatDuration(start?: Date, finish?: Date): string {
  if (!start) return ''
  const end = finish || new Date()
  const ms = end.getTime() - start.getTime()
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

function StepRow({ step, indent = 0, showDetails = false, isSelected = false }: { step: BuildStep; indent?: number; showDetails?: boolean; isSelected?: boolean }) {
  const { icon, color } = getStepStatusDisplay(step)
  const duration = formatDuration(step.startTime, step.finishTime)
  const indentStr = '  '.repeat(indent)

  // Show percentage for in-progress steps
  const progress = step.state === 'inProgress' && step.percentComplete !== undefined
    ? ` (${step.percentComplete}%)`
    : ''

  // Show error/warning counts if any
  const issueCounts = []
  if (step.errorCount && step.errorCount > 0) issueCounts.push(`${step.errorCount} errors`)
  if (step.warningCount && step.warningCount > 0) issueCounts.push(`${step.warningCount} warnings`)
  const issueCountStr = issueCounts.length > 0 ? ` [${issueCounts.join(', ')}]` : ''

  // Selection indicator
  const selectionIndicator = isSelected ? '▶ ' : '  '
  const textColor = step.state === 'inProgress' ? '#FFD700' : isSelected ? '#00BFFF' : undefined

  return (
    <box flexDirection="column">
      <box flexDirection="row" gap={1}>
        <text fg={color}>{indentStr}{selectionIndicator}{icon}</text>
        <text fg={textColor}>
          {String(step.name || '')}{progress}
        </text>
        {duration && <text fg="#888888">({duration})</text>}
        {issueCountStr && <text fg={step.errorCount ? '#FF4444' : '#FFA500'}>{issueCountStr}</text>}
      </box>

      {/* Show current operation for in-progress steps */}
      {step.state === 'inProgress' && step.currentOperation && (
        <text fg="#888888">{indentStr}      ↳ {String(step.currentOperation)}</text>
      )}

      {/* Show issue messages (errors/warnings) when showDetails is true */}
      {showDetails && step.issues && step.issues.length > 0 && (
        <box flexDirection="column">
          {step.issues.slice(0, 5).map((issue, idx) => {
            const msg = String(issue.message ?? '')
            return (
              <text
                key={idx}
                fg={issue.type === 'error' ? '#FF4444' : '#FFA500'}
              >
                {indentStr}      {issue.type === 'error' ? '✗' : '⚠'} {msg.slice(0, 100)}{msg.length > 100 ? '...' : ''}
              </text>
            )
          })}
          {step.issues.length > 5 && (
            <text fg="#888888">{indentStr}      ... and {step.issues.length - 5} more</text>
          )}
        </box>
      )}
    </box>
  )
}

export function PipelinesView() {
  const {
    selectedRepo,
    pipelines,
    selectedPipeline,
    pipelineRuns,
    selectedPipelineRun,
    pipelinesLoading,
    pipelineRunsLoading,
    pipelineSteps,
    pipelineStepsLoading,
    isRunInProgress,
    selectPipeline,
    selectPipelineRun,
    focusedBox,
    // Step logs
    selectedStep,
    selectedStepIndex,
    stepLogs,
    stepLogsLoading,
    stepLogsScrollOffset
  } = useAppStore()

  const handleStepLogMouseScroll = (event: MouseEvent) => {
    const direction = event.scroll?.direction
    if (direction === 'up') {
      useAppStore.getState().scrollLogs('up')
      event.preventDefault()
      event.stopPropagation()
    }
    if (direction === 'down') {
      useAppStore.getState().scrollLogs('down')
      event.preventDefault()
      event.stopPropagation()
    }
  }

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

  // Show step logs if a step is selected
  if (selectedStep) {
    const { icon, color } = getStepStatusDisplay(selectedStep)
    const duration = formatDuration(selectedStep.startTime, selectedStep.finishTime)
    const visibleLogs = stepLogs.slice(stepLogsScrollOffset, stepLogsScrollOffset + 30)

    return (
      <box flexDirection="column" gap={1}>
        <box flexDirection="row" gap={2}>
          <text fg={color}>{icon}</text>
          <text attributes={TextAttributes.BOLD}>{String(selectedStep.name || '')}</text>
          {duration && <text fg="#888888">({duration})</text>}
          {selectedStep.state === 'inProgress' && (
            <text fg="#FFD700">[IN PROGRESS]</text>
          )}
        </box>

        {stepLogsLoading ? (
          <text fg="#888888">Loading logs...</text>
        ) : stepLogs.length === 0 ? (
          <text fg="#888888">No logs available</text>
        ) : (
          <box flexDirection="column" onMouseScroll={handleStepLogMouseScroll}>
            <text fg="#888888">
              Lines {stepLogsScrollOffset + 1}-{Math.min(stepLogsScrollOffset + 30, stepLogs.length)} of {stepLogs.length} (j/k to scroll, Esc to go back)
            </text>
            <box flexDirection="column" marginTop={1}>
              {visibleLogs.map((line, idx) => {
                const lineNum = stepLogsScrollOffset + idx + 1
                // Ensure line is a string
                const lineStr = String(line ?? '')
                // Color error lines red, warning lines yellow
                const isError = lineStr.toLowerCase().includes('error') || lineStr.includes('##[error]')
                const isWarning = lineStr.toLowerCase().includes('warning') || lineStr.includes('##[warning]')
                const lineColor = isError ? '#FF4444' : isWarning ? '#FFA500' : undefined
                // Clean up Azure DevOps formatting tags
                const cleanLine = lineStr.replace(/##\[(error|warning|section|command|debug)\]/g, '')
                return (
                  <text key={idx} fg={lineColor}>
                    <span fg="#666666">{String(lineNum).padStart(4, ' ')} </span>{cleanLine}
                  </text>
                )
              })}
            </box>
          </box>
        )}
      </box>
    )
  }

  // Show steps if a run is selected
  if (selectedPipelineRun) {
    // Organize steps by hierarchy (Stage -> Job -> Task)
    const stages = pipelineSteps.filter(s => s.type === 'Stage')
    const jobs = pipelineSteps.filter(s => s.type === 'Job')
    const tasks = pipelineSteps.filter(s => s.type === 'Task')
    const loggableSteps = getLoggableBuildSteps(pipelineSteps)
    
    // Build a map of parent IDs to check hierarchy
    const stageIds = new Set(stages.map(s => s.id))
    const jobIds = new Set(jobs.map(j => j.id))
    
    // Find orphan jobs (jobs without a stage parent or with invalid parent)
    const orphanJobs = jobs.filter(j => !j.parentId || !stageIds.has(j.parentId))
    
    // Find orphan tasks (tasks without a job parent or with invalid parent)
    const orphanTasks = tasks.filter(t => !t.parentId || !jobIds.has(t.parentId))
    
    // Other step types (Checkpoint, Phase, etc.)
    const otherSteps = pipelineSteps.filter(s => 
      s.type !== 'Stage' && s.type !== 'Job' && s.type !== 'Task'
    )

    return (
      <box flexDirection="column" gap={1}>
        <box flexDirection="row" gap={2}>
          <text attributes={TextAttributes.BOLD}>
            Build: {String(selectedPipelineRun.name || '').replace(/^\[(ok|fail|run|queue|warn|cancel)\]\s*/, '')}
          </text>
          {isRunInProgress && (
            <text fg="#FFD700" attributes={TextAttributes.BOLD}>
              [RUNNING]
            </text>
          )}
        </box>
        <text fg="#888888">Branch: {String(selectedPipelineRun.description || '')}</text>
        <text fg="#888888">Press Enter on any loggable step to view logs, j/k to navigate, o to open in browser</text>

        {pipelineStepsLoading && pipelineSteps.length === 0 ? (
          <text fg="#888888">Loading steps...</text>
        ) : pipelineSteps.length === 0 ? (
          <text fg="#888888">No steps found</text>
        ) : (
          <box flexDirection="column" marginTop={1}>
            <text fg="#888888" attributes={TextAttributes.UNDERLINE}>Build Steps:</text>
            {loggableSteps.length > 0 && (
              <text fg="#888888">Log views available for {loggableSteps.length} step{loggableSteps.length === 1 ? '' : 's'}</text>
            )}
            <box flexDirection="column" marginTop={0}>
              {(() => {
                // Track task index across all rendering paths
                let taskIndex = 0;
                const elements: React.ReactNode[] = [];

                if (stages.length > 0) {
                  // Show hierarchical view with stages
                  stages.forEach(stage => {
                    const stageJobs = jobs.filter(j => j.parentId === stage.id)
                    const showStageDetails = stage.result === 'failed' || stage.state === 'inProgress'
                    elements.push(
                      <box key={stage.id} flexDirection="column">
                        <StepRow step={stage} indent={0} showDetails={showStageDetails} />
                        {stageJobs.map(job => {
                          const jobTasks = tasks.filter(t => t.parentId === job.id)
                          const showJobDetails = job.result === 'failed' || job.state === 'inProgress'
                          return (
                            <box key={job.id} flexDirection="column">
                              <StepRow step={job} indent={1} showDetails={showJobDetails} />
                              {jobTasks.map(task => {
                                const currentTaskIndex = taskIndex++
                                const showTaskDetails = task.result === 'failed' || task.state === 'inProgress'
                                const isSelected = currentTaskIndex === selectedStepIndex
                                return (
                                  <StepRow key={task.id} step={task} indent={2} showDetails={showTaskDetails} isSelected={isSelected} />
                                )
                              })}
                            </box>
                          )
                        })}
                      </box>
                    )
                  })
                  
                  // Show orphan jobs (jobs not under any stage)
                  orphanJobs.forEach(job => {
                    const jobTasks = tasks.filter(t => t.parentId === job.id)
                    const showJobDetails = job.result === 'failed' || job.state === 'inProgress'
                    elements.push(
                      <box key={job.id} flexDirection="column">
                        <StepRow step={job} indent={0} showDetails={showJobDetails} />
                        {jobTasks.map(task => {
                          const currentTaskIndex = taskIndex++
                          const showTaskDetails = task.result === 'failed' || task.state === 'inProgress'
                          const isSelected = currentTaskIndex === selectedStepIndex
                          return (
                            <StepRow key={task.id} step={task} indent={1} showDetails={showTaskDetails} isSelected={isSelected} />
                          )
                        })}
                      </box>
                    )
                  })
                } else if (jobs.length > 0) {
                  // No stages, show jobs with their tasks
                  jobs.forEach(job => {
                    const jobTasks = tasks.filter(t => t.parentId === job.id)
                    const showJobDetails = job.result === 'failed' || job.state === 'inProgress'
                    elements.push(
                      <box key={job.id} flexDirection="column">
                        <StepRow step={job} indent={0} showDetails={showJobDetails} />
                        {jobTasks.map(task => {
                          const currentTaskIndex = taskIndex++
                          const showTaskDetails = task.result === 'failed' || task.state === 'inProgress'
                          const isSelected = currentTaskIndex === selectedStepIndex
                          return (
                            <StepRow key={task.id} step={task} indent={1} showDetails={showTaskDetails} isSelected={isSelected} />
                          )
                        })}
                      </box>
                    )
                  })
                }
                
                // Show orphan tasks (tasks not under any job)
                orphanTasks.forEach((task, idx) => {
                  const currentTaskIndex = taskIndex++
                  const showTaskDetails = task.result === 'failed' || task.state === 'inProgress'
                  const isSelected = currentTaskIndex === selectedStepIndex
                  elements.push(
                    <StepRow key={task.id} step={task} indent={0} showDetails={showTaskDetails} isSelected={isSelected} />
                  )
                })
                
                // Show other step types
                otherSteps.forEach(step => {
                  const showDetails = step.result === 'failed' || step.state === 'inProgress'
                  elements.push(
                    <StepRow key={step.id} step={step} indent={0} showDetails={showDetails} />
                  )
                })
                
                // If no structured elements, just show all tasks flat
                if (elements.length === 0 && tasks.length > 0) {
                  tasks.forEach((task, idx) => {
                    const showTaskDetails = task.result === 'failed' || task.state === 'inProgress'
                    const isSelected = idx === selectedStepIndex
                    elements.push(
                      <StepRow key={task.id} step={task} indent={0} showDetails={showTaskDetails} isSelected={isSelected} />
                    )
                  })
                }

                return elements
              })()}
            </box>
            {isRunInProgress && (
              <text fg="#888888" marginTop={1}>Auto-refreshing every 3s...</text>
            )}
          </box>
        )}
      </box>
    )
  }

  // Show pipeline runs if a pipeline is selected
  if (selectedPipeline) {
    return (
      <box flexDirection="column" gap={1}>
        <text attributes={TextAttributes.BOLD}>
          Pipeline: {String(selectedPipeline.name || '')}
        </text>

        {pipelineRunsLoading ? (
          <text fg="#888888">Loading runs...</text>
        ) : pipelineRuns.length === 0 ? (
          <text fg="#888888">No runs found for this pipeline</text>
        ) : (
          <box flexDirection="column">
            <text fg="#888888">Recent Runs (Enter to view steps):</text>
            <Select
              options={pipelineRuns}
              focused={isFocused}
              onSelect={handleRunSelect}
            />
          </box>
        )}
      </box>
    )
  }

  // Show pipeline list
  return (
    <box flexDirection="column" gap={1}>
      <text attributes={TextAttributes.BOLD}>
        Build Pipelines for: {String(selectedRepo?.name || '')}
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
