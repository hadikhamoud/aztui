import { useMemo } from "react"
import { useAppStore } from "../store/app-store"
import { Select } from "./select"
import { TextAttributes, SyntaxStyle, parseColor } from "@opentui/core"
import * as Diff from "diff"

// Get file extension for syntax highlighting
function getFiletype(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const filetypeMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    xml: 'xml',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
  }
  return filetypeMap[ext] || 'text'
}

// GitHub Dark theme for diffs
const diffTheme = {
  addedBg: "#1a4d1a",
  removedBg: "#4d1a1a",
  contextBg: "transparent",
  addedSignColor: "#22c55e",
  removedSignColor: "#ef4444",
  lineNumberFg: "#6b7280",
  lineNumberBg: "#161b22",
  addedLineNumberBg: "#0d3a0d",
  removedLineNumberBg: "#3a0d0d",
  selectionBg: "#264F78",
  selectionFg: "#FFFFFF",
}

// Helper to get vote display
function getVoteDisplay(vote: number): { text: string; color: string } {
  switch (vote) {
    case 10: return { text: 'Approved', color: '#22c55e' }
    case 5: return { text: 'Approved with suggestions', color: '#84cc16' }
    case 0: return { text: 'No vote', color: '#888888' }
    case -5: return { text: 'Waiting for author', color: '#f59e0b' }
    case -10: return { text: 'Rejected', color: '#ef4444' }
    default: return { text: 'Unknown', color: '#888888' }
  }
}

// Helper to get status icon
function getStatusIcon(state: string): { icon: string; color: string } {
  switch (state) {
    case 'succeeded': return { icon: '✓', color: '#22c55e' }
    case 'failed': return { icon: '✗', color: '#ef4444' }
    case 'pending': return { icon: '○', color: '#f59e0b' }
    case 'error': return { icon: '!', color: '#ef4444' }
    default: return { icon: '?', color: '#888888' }
  }
}

export function PRsView() {
  const {
    selectedRepo,
    pullRequests,
    selectedPR,
    prsLoading,
    prFileChanges,
    prFileChangesLoading,
    selectedPRFile,
    selectedPRFileIndex,
    selectPR,
    focusedBox,
    prActionStatus,
    prActionLoading,
    isAddingComment,
    commentText,
    isCompletingPR,
    completionMessage,
    prIsDraft,
    prThreads,
    prReviewers,
    prStatuses,
    prConflicts,
    prDetailsLoading,
    isAddingReviewer,
    teamMembers,
    selectedReviewerIndex,
    reviewerIsRequired,
    selectedConflict,
    selectedConflictIndex,
    conflictContentLoading
  } = useAppStore()

  const isFocused = focusedBox === 'workspace'

  const syntaxStyle = useMemo(() => SyntaxStyle.fromStyles({
    keyword: { fg: parseColor("#FF7B72"), bold: true },
    string: { fg: parseColor("#A5D6FF") },
    comment: { fg: parseColor("#8B949E"), italic: true },
    number: { fg: parseColor("#79C0FF") },
    function: { fg: parseColor("#D2A8FF") },
    type: { fg: parseColor("#FFA657") },
    operator: { fg: parseColor("#FF7B72") },
    variable: { fg: parseColor("#E6EDF3") },
    property: { fg: parseColor("#79C0FF") },
    default: { fg: parseColor("#E6EDF3") },
  }), [])

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

  // Generate unified diff for selected file
  const unifiedDiff = useMemo(() => {
    if (!selectedPRFile) return ''
    return Diff.createPatch(
      selectedPRFile.path,
      selectedPRFile.originalContent,
      selectedPRFile.modifiedContent,
      'target',
      'source'
    )
  }, [selectedPRFile])

  // Generate unified diff for selected conflict
  const conflictDiff = useMemo(() => {
    if (!selectedConflict || !selectedConflict.sourceContent || !selectedConflict.targetContent) return ''
    return Diff.createPatch(
      selectedConflict.conflictPath,
      selectedConflict.targetContent, // target branch (what we're merging into)
      selectedConflict.sourceContent, // source branch (the PR branch)
      'target',
      'source'
    )
  }, [selectedConflict])

  // If we're viewing a conflict, show the conflict diff
  if (selectedPR && selectedConflict) {
    const filetype = getFiletype(selectedConflict.conflictPath)
    
    return (
      <box flexDirection="column" flexGrow={1}>
        <box flexDirection="row" gap={2} marginBottom={1}>
          <text attributes={TextAttributes.BOLD} fg="#ef4444">
            CONFLICT: {selectedConflict.conflictPath}
          </text>
          <text fg="#888888">
            ({selectedConflictIndex + 1}/{prConflicts.length})
          </text>
        </box>
        
        <text fg="#f59e0b" marginBottom={1}>
          Type: {selectedConflict.conflictType} | Resolve this conflict in Azure DevOps or locally
        </text>
        
        {conflictContentLoading ? (
          <text fg="#888888">Loading conflict content...</text>
        ) : !selectedConflict.sourceContent && !selectedConflict.targetContent ? (
          <text fg="#888888">Could not load conflict content (binary file or access denied)</text>
        ) : (
          <diff
            diff={conflictDiff}
            view="unified"
            filetype={filetype}
            syntaxStyle={syntaxStyle}
            showLineNumbers={true}
            wrapMode="none"
            addedBg={diffTheme.addedBg}
            removedBg={diffTheme.removedBg}
            contextBg={diffTheme.contextBg}
            addedSignColor={diffTheme.addedSignColor}
            removedSignColor={diffTheme.removedSignColor}
            lineNumberFg={diffTheme.lineNumberFg}
            lineNumberBg={diffTheme.lineNumberBg}
            addedLineNumberBg={diffTheme.addedLineNumberBg}
            removedLineNumberBg={diffTheme.removedLineNumberBg}
            selectionBg={diffTheme.selectionBg}
            selectionFg={diffTheme.selectionFg}
            style={{
              flexGrow: 1,
              flexShrink: 1,
            }}
          />
        )}
      </box>
    )
  }

  // If we have a selected file, show the diff
  if (selectedPR && selectedPRFile) {
    const filetype = getFiletype(selectedPRFile.path)
    
    return (
      <box flexDirection="column" flexGrow={1}>
        <box flexDirection="row" gap={2} marginBottom={1}>
          <text attributes={TextAttributes.BOLD} fg="#007595">
            {selectedPRFile.path}
          </text>
          <text fg={selectedPRFile.changeType === 'add' ? '#22c55e' : selectedPRFile.changeType === 'delete' ? '#ef4444' : '#fbbf24'}>
            [{selectedPRFile.changeType}]
          </text>
          <text fg="#888888">
            ({selectedPRFileIndex + 1}/{prFileChanges.length})
          </text>
        </box>
        
        <diff
          diff={unifiedDiff}
          view="unified"
          filetype={filetype}
          syntaxStyle={syntaxStyle}
          showLineNumbers={true}
          wrapMode="none"
          addedBg={diffTheme.addedBg}
          removedBg={diffTheme.removedBg}
          contextBg={diffTheme.contextBg}
          addedSignColor={diffTheme.addedSignColor}
          removedSignColor={diffTheme.removedSignColor}
          lineNumberFg={diffTheme.lineNumberFg}
          lineNumberBg={diffTheme.lineNumberBg}
          addedLineNumberBg={diffTheme.addedLineNumberBg}
          removedLineNumberBg={diffTheme.removedLineNumberBg}
          selectionBg={diffTheme.selectionBg}
          selectionFg={diffTheme.selectionFg}
          style={{
            flexGrow: 1,
            flexShrink: 1,
          }}
        />
      </box>
    )
  }

  // If we have a selected PR but no file selected yet, show file list
  if (selectedPR && prDetails) {
    // Show comment input modal
    if (isAddingComment) {
      return (
        <box flexDirection="column" gap={1}>
          <text attributes={TextAttributes.BOLD}>Add Comment to PR</text>
          <text fg="#888888">{selectedPR.name}</text>
          
          <box 
            borderStyle="rounded" 
            borderColor="#007595"
            padding={0.5}
            marginTop={1}
          >
            <text>
              {commentText || '(Type your comment...)'}
              <span fg="#007595">_</span>
            </text>
          </box>
          
          <text fg="#888888" marginTop={1}>
            Ctrl+Enter: Submit | Esc: Cancel
          </text>
          
          {prActionStatus && (
            <text fg={prActionStatus.isError ? 'red' : 'green'} marginTop={1}>
              {prActionStatus.message}
            </text>
          )}
        </box>
      )
    }
    
    // Show completion message input modal
    if (isCompletingPR) {
      return (
        <box flexDirection="column" gap={1}>
          <text attributes={TextAttributes.BOLD}>Complete PR (Merge)</text>
          <text fg="#888888">{selectedPR.name}</text>
          
          <text fg="#fbbf24" marginTop={1}>Merge Commit Message:</text>
          <box 
            borderStyle="rounded" 
            borderColor="#007595"
            padding={0.5}
          >
            <text>
              {completionMessage || '(Enter merge commit message...)'}
              <span fg="#007595">_</span>
            </text>
          </box>
          
          <text fg="#888888" marginTop={1}>
            Ctrl+Enter: Complete PR | Esc: Cancel
          </text>
          
          {prActionStatus && (
            <text fg={prActionStatus.isError ? 'red' : 'green'} marginTop={1}>
              {prActionStatus.message}
            </text>
          )}
        </box>
      )
    }
    
    // Show reviewer selection modal
    if (isAddingReviewer) {
      return (
        <box flexDirection="column" gap={1}>
          <text attributes={TextAttributes.BOLD}>Add Reviewer</text>
          <text fg="#888888">{selectedPR.name}</text>
          
          <box flexDirection="row" gap={2} marginTop={1}>
            <text>Required:</text>
            <text fg={reviewerIsRequired ? '#22c55e' : '#888888'}>
              [{reviewerIsRequired ? 'x' : ' '}] {reviewerIsRequired ? 'Yes' : 'No'}
            </text>
            <text fg="#888888">(R to toggle)</text>
          </box>
          
          {teamMembers.length === 0 ? (
            <text fg="#888888" marginTop={1}>Loading team members...</text>
          ) : (
            <box flexDirection="column" gap={0} marginTop={1}>
              <text fg="#888888">Select a reviewer:</text>
              {teamMembers.slice(0, 10).map((member, index) => (
                <text 
                  key={member.id}
                  fg={index === selectedReviewerIndex ? '#007595' : 'white'}
                  bg={index === selectedReviewerIndex ? '#1a3a4a' : undefined}
                >
                  {index === selectedReviewerIndex ? '▶ ' : '  '}{member.displayName}
                </text>
              ))}
            </box>
          )}
          
          <text fg="#888888" marginTop={1}>
            Enter: Add reviewer | R: Toggle required | Esc: Cancel
          </text>
          
          {prActionStatus && (
            <text fg={prActionStatus.isError ? 'red' : 'green'} marginTop={1}>
              {prActionStatus.message}
            </text>
          )}
        </box>
      )
    }
    
    return (
      <box flexDirection="column" gap={1}>
        {/* PR Title with draft indicator */}
        <box flexDirection="row" gap={2}>
          <text attributes={TextAttributes.BOLD}>
            {selectedPR.name}
          </text>
          {prIsDraft && (
            <text fg="#f59e0b" attributes={TextAttributes.BOLD}>[DRAFT]</text>
          )}
        </box>
        <text fg="#888888">
          {prDetails.sourceBranch?.replace('refs/heads/', '')} → {prDetails.targetBranch?.replace('refs/heads/', '')}
        </text>
        
        {/* Action status message */}
        {prActionStatus && (
          <box 
            borderStyle="rounded" 
            borderColor={prActionStatus.isError ? 'red' : 'green'}
            padding={0.5}
          >
            <text fg={prActionStatus.isError ? 'red' : 'green'}>
              {prActionLoading ? '⏳ ' : ''}{prActionStatus.message}
            </text>
          </box>
        )}
        
        {prDetailsLoading ? (
          <text fg="#888888">Loading PR details...</text>
        ) : (
          <>
            {/* Conflicts Warning - Press X to view */}
            {prConflicts.length > 0 && (
              <box flexDirection="column" marginTop={1}>
                <text fg="#ef4444" attributes={TextAttributes.BOLD}>
                  ⚠ {prConflicts.length} Conflict{prConflicts.length > 1 ? 's' : ''} (Press X to view):
                </text>
                {prConflicts.slice(0, 5).map((conflict, index) => (
                  <text 
                    key={conflict.conflictId} 
                    fg={index === selectedConflictIndex ? '#ffffff' : '#ef4444'}
                    bg={index === selectedConflictIndex ? '#4d1a1a' : undefined}
                  >
                    {index === selectedConflictIndex ? '▶ ' : '  '}{conflict.conflictPath} [{conflict.conflictType}]
                  </text>
                ))}
                {prConflicts.length > 5 && (
                  <text fg="#888888">  ...and {prConflicts.length - 5} more</text>
                )}
              </box>
            )}
            
            {/* Status Checks */}
            {prStatuses.length > 0 && (
              <box flexDirection="column" marginTop={1}>
                <text fg="#888888">Checks:</text>
                {prStatuses.map(status => {
                  const { icon, color } = getStatusIcon(status.state)
                  return (
                    <text key={status.id}>
                      {'  '}<span fg={color}>{icon}</span> {status.context}: {status.description || status.state}
                    </text>
                  )
                })}
              </box>
            )}
            
            {/* Reviewers */}
            {prReviewers.length > 0 && (
              <box flexDirection="column" marginTop={1}>
                <text fg="#888888">Reviewers:</text>
                {prReviewers.map(reviewer => {
                  const { text, color } = getVoteDisplay(reviewer.vote)
                  return (
                    <text key={reviewer.id}>
                      {'  '}{reviewer.displayName}
                      {reviewer.isRequired && <span fg="#f59e0b"> (required)</span>}
                      : <span fg={color}>{text}</span>
                    </text>
                  )
                })}
              </box>
            )}
            
            {/* Comments/Threads */}
            {prThreads.length > 0 && (
              <box flexDirection="column" marginTop={1}>
                <text fg="#888888">
                  Comments: {prThreads.filter(t => !t.isResolved).length} active, {prThreads.filter(t => t.isResolved).length} resolved
                </text>
                {prThreads.filter(t => !t.isResolved).slice(0, 3).map(thread => (
                  <box key={thread.id} flexDirection="column">
                    <text fg="#007595">
                      {'  '}{thread.comments[0]?.author}: 
                    </text>
                    <text fg="white">
                      {'    '}{thread.comments[0]?.content.slice(0, 60)}{thread.comments[0]?.content.length > 60 ? '...' : ''}
                    </text>
                  </box>
                ))}
              </box>
            )}
          </>
        )}
        
        {/* File Changes */}
        {prFileChangesLoading ? (
          <text fg="#888888">Loading file changes...</text>
        ) : prFileChanges.length === 0 ? (
          <text fg="#888888">No file changes found</text>
        ) : (
          <box flexDirection="column" gap={0} marginTop={1}>
            <text fg="#888888">Changed files ({prFileChanges.length}):</text>
            {prFileChanges.map((file, index) => (
              <text 
                key={file.path}
                fg={index === selectedPRFileIndex ? '#007595' : 'white'}
                bg={index === selectedPRFileIndex ? '#1a3a4a' : undefined}
              >
                {index === selectedPRFileIndex ? '▶ ' : '  '}
                <span fg={file.changeType === 'add' ? '#22c55e' : file.changeType === 'delete' ? '#ef4444' : '#fbbf24'}>
                  [{file.changeType[0].toUpperCase()}]
                </span>
                {' '}{file.path}
              </text>
            ))}
          </box>
        )}
      </box>
    )
  }

  // Show PR list
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
    </box>
  )
}
