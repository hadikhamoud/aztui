import { create } from 'zustand'
import type { SelectOption } from '@opentui/core'
import { getProjects, getRepos, cloneRepo, getPullRequests, getBuildDefinitions, getBuildRuns, getBuildTimeline, getBuildStepLogs, getPullRequestIterations, getPullRequestIterationChanges, getPullRequestFileDiff, approvePullRequest, addPullRequestComment, completePullRequest, getPullRequestUrl, getPullRequestDetails, getPullRequestThreads, getPullRequestReviewers, getPullRequestStatuses, getPullRequestConflicts, togglePullRequestDraft, addPullRequestReviewer, removePullRequestReviewer, getTeamMembers, getConflictDetails, detectCurrentRepo, isRepoInConfiguredOrg, reinitializeConnection, getBranches, createPullRequest, type BuildStep, type DetectedRepo } from '../api'
import { hasCredentials, saveConfig, getCredentials } from '../config'

export interface PRFileChange {
  path: string
  changeType: string
  originalContent: string
  modifiedContent: string
}

export interface PRThread {
  id: number
  status: string
  comments: { author: string; content: string; date: string }[]
  isResolved: boolean
}

export interface PRReviewer {
  id: string
  displayName: string
  vote: number // -10 = rejected, -5 = waiting, 0 = no vote, 5 = approved with suggestions, 10 = approved
  isRequired: boolean
  imageUrl?: string
}

export interface PRStatus {
  id: number
  state: string // pending, succeeded, failed, error
  description: string
  context: string
  targetUrl?: string
}

export interface PRConflict {
  conflictId: number
  conflictType: string
  conflictPath: string
  sourceContent?: string
  targetContent?: string
  baseContent?: string
  rawConflict?: any
}

type FocusedBox = 'projects' | 'repos' | 'workspace'

interface AppStore {
  // Setup state (shown when credentials are missing)
  needsSetup: boolean
  setupOrgUrl: string
  setupPat: string
  setupFocusedField: 'orgUrl' | 'pat'
  setupError: string | null
  setupSaving: boolean
  checkCredentials: () => void
  setSetupOrgUrl: (url: string) => void
  setSetupPat: (pat: string) => void
  setSetupFocusedField: (field: 'orgUrl' | 'pat') => void
  toggleSetupField: () => void
  submitSetup: () => Promise<void>

  focusedBox: FocusedBox
  setFocusedBox: (box: FocusedBox) => void
  cycleFocus: () => void

  projects: SelectOption[]
  selectedProject: SelectOption | null
  selectedProjectIndex: number
  lastSelectedProjectIndex: number
  setProjects: (projects: SelectOption[]) => void
  selectProject: (project: SelectOption, index: number) => void
  loadProjects: () => Promise<void>

  repos: SelectOption[]
  selectedRepo: SelectOption | null
  selectedRepoIndex: number
  lastSelectedRepoIndex: number
  setRepos: (repos: SelectOption[]) => void
  selectRepo: (repo: SelectOption, index: number) => void
  loadRepos: (projectId: string) => Promise<void>

  // Auto-detect from cwd
  detectedRepo: DetectedRepo | null
  isInitializingFromCwd: boolean
  initializeFromCwd: () => Promise<void>

  workspaceOptions: SelectOption[]
  selectedWorkspaceOption: SelectOption | null
  lastSelectedWorkspaceIndex: number
  isInWorkspace: boolean
  selectWorkspaceOption: (option: SelectOption) => void
  enterWorkspace: () => void
  exitWorkspace: () => void

  // Search functionality
  isSearchActive: boolean
  isSelectMode: boolean
  searchQuery: string
  searchHighlightedIndex: number
  searchTargetBox: FocusedBox | null  // The box that search applies to (locked when search starts)
  setSearchActive: (active: boolean) => void
  setSelectMode: (active: boolean) => void
  setSearchQuery: (query: string) => void
  setSearchHighlightedIndex: (index: number) => void
  clearSearch: () => void
  enterSelectMode: () => void
  exitSelectMode: () => void
  getFilteredOptions: (box: FocusedBox) => SelectOption[]
  moveSearchHighlight: (direction: 'up' | 'down') => void
  selectHighlightedOption: () => void
  restoreLastSelectedPosition: (box: FocusedBox) => void
  getHighlightedIndexForLastSelected: (box: FocusedBox) => number

  // Clone functionality
  isInCloneView: boolean
  cloneLocation: string
  cloneMethod: 'https' | 'ssh'
  cloneStatus: { message: string; isError: boolean } | null
  cloneFocusedField: 'method' | 'path'
  enterCloneView: () => void
  exitCloneView: () => void
  setCloneLocation: (location: string) => void
  setCloneMethod: (method: 'https' | 'ssh') => void
  toggleCloneMethod: () => void
  setCloneFocusedField: (field: 'method' | 'path') => void
  executeClone: () => Promise<void>
  clearCloneStatus: () => void

  // Pipelines functionality
  isInPipelinesView: boolean
  pipelines: SelectOption[]
  selectedPipeline: SelectOption | null
  pipelineRuns: SelectOption[]
  selectedPipelineRun: SelectOption | null
  pipelinesLoading: boolean
  pipelineRunsLoading: boolean
  pipelineSteps: BuildStep[]
  pipelineStepsLoading: boolean
  pipelineStepsRefreshInterval: ReturnType<typeof setInterval> | null
  isRunInProgress: boolean
  // Step logs
  selectedStepIndex: number
  selectedStep: BuildStep | null
  stepLogs: string[]
  stepLogsLoading: boolean
  stepLogsScrollOffset: number
  enterPipelinesView: () => void
  exitPipelinesView: () => void
  loadPipelines: () => Promise<void>
  selectPipeline: (pipeline: SelectOption) => void
  loadPipelineRuns: (pipelineId: number) => Promise<void>
  selectPipelineRun: (run: SelectOption) => void
  loadPipelineSteps: (buildId: number) => Promise<void>
  startStepsRefresh: (buildId: number) => void
  stopStepsRefresh: () => void
  goBackFromRuns: () => void
  goBackFromSteps: () => void
  // Step navigation and logs
  navigateStep: (direction: 'up' | 'down') => void
  selectStep: (step: BuildStep, index: number) => void
  loadStepLogs: (step: BuildStep) => Promise<void>
  scrollLogs: (direction: 'up' | 'down' | 'pageup' | 'pagedown') => void
  exitStepLogs: () => void

  // Pull Requests functionality
  isInPRsView: boolean
  pullRequests: SelectOption[]
  selectedPR: SelectOption | null
  prsLoading: boolean
  prFileChanges: PRFileChange[]
  prFileChangesLoading: boolean
  selectedPRFile: PRFileChange | null
  selectedPRFileIndex: number
  prActionStatus: { message: string; isError: boolean } | null
  prActionLoading: boolean
  isAddingComment: boolean
  commentText: string
  isCompletingPR: boolean
  completionMessage: string
  
  // PR Details
  prIsDraft: boolean
  prThreads: PRThread[]
  prReviewers: PRReviewer[]
  prStatuses: PRStatus[]
  prConflicts: PRConflict[]
  prDetailsLoading: boolean
  
  // Conflict viewing
  selectedConflict: PRConflict | null
  selectedConflictIndex: number
  conflictContentLoading: boolean
  
  // Reviewer management
  isAddingReviewer: boolean
  teamMembers: { id: string; displayName: string }[]
  selectedReviewerIndex: number
  reviewerIsRequired: boolean
  
  // Create PR functionality
  isCreatingPR: boolean
  createPRStep: 'source' | 'target' | 'title' | 'description' | 'reviewers' | 'confirm'
  branches: { name: string; objectId: string }[]
  branchesLoading: boolean
  createPRSourceBranch: string
  createPRTargetBranch: string
  createPRTitle: string
  createPRDescription: string
  createPRReviewerIds: string[]
  createPRIsDraft: boolean
  selectedBranchIndex: number
  createPRSearchQuery: string
  
  enterPRsView: () => void
  exitPRsView: () => void
  loadPullRequests: () => Promise<void>
  selectPR: (pr: SelectOption) => void
  loadPRFileChanges: (prId: number) => Promise<void>
  loadPRDetails: (prId: number) => Promise<void>
  selectPRFile: (file: PRFileChange, index: number) => void
  navigatePRFile: (direction: 'up' | 'down') => void
  goBackFromPRFiles: () => void
  openPRInBrowser: () => void
  copyPRLinkToClipboard: () => void
  approvePR: () => Promise<void>
  startAddingComment: () => void
  cancelAddingComment: () => void
  setCommentText: (text: string) => void
  submitComment: () => Promise<void>
  startCompletingPR: () => void
  cancelCompletingPR: () => void
  setCompletionMessage: (message: string) => void
  submitCompletion: () => Promise<void>
  clearPRActionStatus: () => void
  toggleDraft: () => Promise<void>
  startAddingReviewer: () => void
  cancelAddingReviewer: () => void
  navigateReviewer: (direction: 'up' | 'down') => void
  toggleReviewerRequired: () => void
  submitReviewer: () => Promise<void>
  removeReviewer: (reviewerId: string) => Promise<void>
  selectConflict: (index: number) => Promise<void>
  navigateConflict: (direction: 'up' | 'down') => void
  exitConflictView: () => void
  
  // Create PR actions
  startCreatingPR: () => Promise<void>
  cancelCreatingPR: () => void
  setCreatePRSourceBranch: (branch: string) => void
  setCreatePRTargetBranch: (branch: string) => void
  setCreatePRTitle: (title: string) => void
  setCreatePRDescription: (desc: string) => void
  toggleCreatePRReviewer: (reviewerId: string) => void
  toggleCreatePRDraft: () => void
  nextCreatePRStep: () => void
  prevCreatePRStep: () => void
  navigateBranch: (direction: 'up' | 'down') => void
  selectCurrentBranch: () => void
  submitCreatePR: () => Promise<void>
  setCreatePRSearchQuery: (query: string) => void
  getFilteredBranches: () => { name: string; objectId: string }[]
  getFilteredReviewers: () => { id: string; displayName: string }[]
}

const focusOrder: FocusedBox[] = ['projects', 'repos', 'workspace']

export const useAppStore = create<AppStore>((set, get) => ({
  // Setup state
  needsSetup: !hasCredentials(),
  setupOrgUrl: '',
  setupPat: '',
  setupFocusedField: 'orgUrl',
  setupError: null,
  setupSaving: false,
  checkCredentials: () => {
    set({ needsSetup: !hasCredentials() })
  },
  setSetupOrgUrl: (url: string) => {
    set({ setupOrgUrl: url, setupError: null })
  },
  setSetupPat: (pat: string) => {
    set({ setupPat: pat, setupError: null })
  },
  setSetupFocusedField: (field: 'orgUrl' | 'pat') => {
    set({ setupFocusedField: field })
  },
  toggleSetupField: () => {
    const state = get()
    set({ setupFocusedField: state.setupFocusedField === 'orgUrl' ? 'pat' : 'orgUrl' })
  },
  submitSetup: async () => {
    const state = get()
    const { setupOrgUrl, setupPat } = state
    
    // Validate
    if (!setupOrgUrl.trim()) {
      set({ setupError: 'Organization URL is required' })
      return
    }
    if (!setupPat.trim()) {
      set({ setupError: 'Personal Access Token is required' })
      return
    }
    
    // Validate URL format
    if (!setupOrgUrl.includes('dev.azure.com') && !setupOrgUrl.includes('visualstudio.com')) {
      set({ setupError: 'Invalid URL. Should be https://dev.azure.com/org or https://org.visualstudio.com' })
      return
    }
    
    set({ setupSaving: true, setupError: null })
    
    try {
      // Save to config
      const saved = saveConfig({ orgUrl: setupOrgUrl.trim(), pat: setupPat.trim() })
      if (!saved) {
        set({ setupError: 'Failed to save configuration', setupSaving: false })
        return
      }
      
      // Reinitialize the API connection
      reinitializeConnection(setupOrgUrl.trim(), setupPat.trim())
      
      // Test the connection by loading projects
      const projects = await getProjects()
      if (!projects || projects.length === 0) {
        set({ setupError: 'Connected but no projects found. Check your permissions.', setupSaving: false })
        return
      }
      
      // Success! Clear setup state and proceed
      // Note: initializeFromCwd will be called by the useEffect in App when needsSetup becomes false
      set({ 
        needsSetup: false, 
        setupSaving: false,
        setupOrgUrl: '',
        setupPat: '',
        setupError: null
      })
      
    } catch (error) {
      set({ 
        setupError: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        setupSaving: false 
      })
    }
  },

  focusedBox: 'projects',
  setFocusedBox: (box: FocusedBox) => {
    const state = get()
    set({ focusedBox: box })
    if (!state.isSearchActive && !state.isSelectMode) {
      state.restoreLastSelectedPosition(box)
    }
  },
  cycleFocus: () => {
    const current = get().focusedBox
    const currentIndex = focusOrder.indexOf(current)
    const nextIndex = (currentIndex + 1) % focusOrder.length
    const state = get()
    set({ focusedBox: focusOrder[nextIndex] })
    if (!state.isSearchActive && !state.isSelectMode) {
      state.restoreLastSelectedPosition(focusOrder[nextIndex])
    }
  },

  projects: [],
  selectedProject: null,
  selectedProjectIndex: 0,
  lastSelectedProjectIndex: 0,
  setProjects: (projects: SelectOption[]) => set({ projects }),
  selectProject: (project: SelectOption, index: number) => {
    set({
      selectedProject: project,
      selectedProjectIndex: index,
      lastSelectedProjectIndex: index,
      repos: [],
      selectedRepo: null,
      selectedRepoIndex: 0,
      lastSelectedRepoIndex: 0
    })
  },
  loadProjects: async () => {
    // Skip if we're initializing from CWD (it will load projects itself)
    const isInitializing = get().isInitializingFromCwd
    if (isInitializing) {
      return
    }
    
    try {
      const projects = await getProjects()
      const options = projects?.map(p => ({
        name: `${p.name}`,
        value: `${p.id}`,
        description: `${p.id}`,
      })) || []
      set({ projects: options })
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  },

  repos: [],
  selectedRepo: null,
  selectedRepoIndex: 0,
  lastSelectedRepoIndex: 0,
  setRepos: (repos: SelectOption[]) => set({ repos }),
  selectRepo: (repo: SelectOption, index: number) => {
    set({ selectedRepo: repo, selectedRepoIndex: index, lastSelectedRepoIndex: index })
  },
  loadRepos: async (projectId: string) => {
    try {
      const repos = await getRepos(projectId)
      const selectedProject = get().selectedProject
      const options = repos?.map(r => ({
        name: `${r.name}`,
        value: `${r.id}`,
        description: JSON.stringify({
          httpsUrl: (r as any).cloneUrl || r.webUrl,
          sshUrl: (r as any).sshUrl || `git@ssh.dev.azure.com:v3/${selectedProject?.name}/${selectedProject?.name}/${r.name}`
        }),
      })) || []
      set({ repos: options })
    } catch (error) {
      console.error('Failed to load repos:', error)
    }
  },

  // Auto-detect from cwd
  detectedRepo: null,
  isInitializingFromCwd: false,
  initializeFromCwd: async () => {
    // Set flag immediately to prevent race with loadProjects
    set({ isInitializingFromCwd: true })
    
    const detected = detectCurrentRepo()
    if (!detected) {
      // Not in a git repo or not an Azure DevOps repo
      set({ detectedRepo: null, isInitializingFromCwd: false })
      return
    }
    
    if (!isRepoInConfiguredOrg(detected)) {
      // Repo belongs to a different org
      set({ detectedRepo: null, isInitializingFromCwd: false })
      return
    }
    
    set({ detectedRepo: detected })
    
    // Load projects first
    try {
      const projects = await getProjects()
      const projectOptions = projects?.map(p => ({
        name: `${p.name}`,
        value: `${p.id}`,
        description: `${p.id}`,
      })) || []
      set({ projects: projectOptions })
      
      // Find the matching project (case-insensitive)
      const matchingProject = projectOptions.find(
        p => p.name.toLowerCase() === detected.project.toLowerCase()
      )
      
      if (!matchingProject) {
        set({ isInitializingFromCwd: false })
        return
      }
      
      // Select the project
      const projectIndex = projectOptions.findIndex(p => p.value === matchingProject.value)
      set({ 
        selectedProject: matchingProject, 
        selectedProjectIndex: projectIndex,
        lastSelectedProjectIndex: projectIndex
      })
      
      // Load repos for this project
      const repos = await getRepos(matchingProject.value)
      const repoOptions = repos?.map(r => ({
        name: `${r.name}`,
        value: `${r.id}`,
        description: JSON.stringify({
          httpsUrl: (r as any).cloneUrl || r.webUrl,
          sshUrl: (r as any).sshUrl || `git@ssh.dev.azure.com:v3/${matchingProject.name}/${matchingProject.name}/${r.name}`
        }),
      })) || []
      set({ repos: repoOptions })
      
      // Find the matching repo (case-insensitive)
      const matchingRepo = repoOptions.find(
        r => r.name.toLowerCase() === detected.repoName.toLowerCase()
      )
      
      if (!matchingRepo) {
        set({ isInitializingFromCwd: false })
        return
      }
      
      // Select the repo
      const repoIndex = repoOptions.findIndex(r => r.value === matchingRepo.value)
      set({ 
        selectedRepo: matchingRepo, 
        selectedRepoIndex: repoIndex,
        lastSelectedRepoIndex: repoIndex
      })
      
      // Enter workspace
      set({ isInWorkspace: true, focusedBox: 'workspace', isInitializingFromCwd: false })
      
    } catch (error) {
      // Silently fail - user can still manually select project/repo
      set({ isInitializingFromCwd: false })
    }
  },

  // Workspace functionality
  workspaceOptions: [
    { name: "clone repo", value: "clone", description: "" },
    { name: "build pipelines", value: "pipelines", description: "" },
    { name: "pull requests", value: "prs", description: "" }
  ],
  selectedWorkspaceOption: null,
  lastSelectedWorkspaceIndex: 0,
  isInWorkspace: false,
  selectWorkspaceOption: (option: SelectOption) => {
    const index = get().workspaceOptions.findIndex(w => w.value === option.value)
    set({ selectedWorkspaceOption: option, lastSelectedWorkspaceIndex: index >= 0 ? index : 0 })
  },
  enterWorkspace: () => {
    set({ isInWorkspace: true, focusedBox: 'workspace' })
  },
  exitWorkspace: () => {
    set({ isInWorkspace: false, focusedBox: 'repos', selectedWorkspaceOption: null })
  },

  // Search functionality
  isSearchActive: false,
  isSelectMode: false,
  searchQuery: '',
  searchHighlightedIndex: 0,
  searchTargetBox: null,
  setSearchActive: (active: boolean) => {
    const state = get()
    if (active) {
      // Lock search to the currently focused box
      set({ 
        isSearchActive: true, 
        searchHighlightedIndex: 0, 
        isSelectMode: false,
        searchTargetBox: state.focusedBox 
      })
    } else {
      set({ 
        isSearchActive: false, 
        searchQuery: '', 
        searchHighlightedIndex: 0,
        searchTargetBox: null 
      })
    }
  },
  setSelectMode: (active: boolean) => set({ isSelectMode: active }),
  setSearchQuery: (query: string) => {
    set({ searchQuery: query, searchHighlightedIndex: 0 })
  },
  setSearchHighlightedIndex: (index: number) => set({ searchHighlightedIndex: index }),
  clearSearch: () => set({ searchQuery: '', isSearchActive: false, isSelectMode: false, searchHighlightedIndex: 0, searchTargetBox: null }),
  enterSelectMode: () => {
    const state = get()
    const highlightedIndex = state.getHighlightedIndexForLastSelected(state.focusedBox)
    set({ isSelectMode: true, searchHighlightedIndex: highlightedIndex })
  },
  exitSelectMode: () => {
    set({ isSelectMode: false })
  },
  getFilteredOptions: (box: FocusedBox) => {
    const state = get()
    const query = state.searchQuery.toLowerCase()
    
    if (!query) {
      switch (box) {
        case 'projects': return state.projects
        case 'repos': return state.repos
        case 'workspace': return state.workspaceOptions
        default: return []
      }
    }
    
    switch (box) {
      case 'projects':
        return state.projects.filter(p => 
          p.name.toLowerCase().includes(query) || 
          p.description?.toLowerCase().includes(query)
        )
      case 'repos':
        return state.repos.filter(r => 
          r.name.toLowerCase().includes(query) || 
          r.description?.toLowerCase().includes(query)
        )
      case 'workspace':
        return state.workspaceOptions.filter(w => 
          w.name.toLowerCase().includes(query) || 
          w.description?.toLowerCase().includes(query)
        )
      default:
        return []
    }
  },
  moveSearchHighlight: (direction: 'up' | 'down') => {
    const state = get()
    const targetBox = state.searchTargetBox || state.focusedBox
    const filteredOptions = state.getFilteredOptions(targetBox)
    
    if (filteredOptions.length === 0) return
    
    const currentIndex = state.searchHighlightedIndex
    
    let newIndex = currentIndex
    if (direction === 'down') {
      newIndex = Math.min(currentIndex + 1, filteredOptions.length - 1)
    } else {
      newIndex = Math.max(currentIndex - 1, 0)
    }
    
    set({ searchHighlightedIndex: newIndex })
  },
  selectHighlightedOption: () => {
    const state = get()
    const targetBox = state.searchTargetBox || state.focusedBox
    const filteredOptions = state.getFilteredOptions(targetBox)
    const highlightedOption = filteredOptions[state.searchHighlightedIndex]
    
    if (highlightedOption) {
      // Clear search first to prevent restoration conflicts
      set({ isSearchActive: false, isSelectMode: false, searchQuery: '', searchHighlightedIndex: 0, searchTargetBox: null })
      
      if (targetBox === 'projects') {
        const project = state.projects.find(p => p.value === highlightedOption.value)
        if (project) {
          const index = state.projects.findIndex(p => p.value === highlightedOption.value)
          state.selectProject(project, index)
          state.loadRepos(project.value)
          state.setFocusedBox('repos')
        }
      } else if (targetBox === 'repos') {
        const repo = state.repos.find(r => r.value === highlightedOption.value)
        if (repo) {
          const index = state.repos.findIndex(r => r.value === highlightedOption.value)
          state.selectRepo(repo, index)
          state.enterWorkspace()
        }
      } else if (targetBox === 'workspace') {
        state.selectWorkspaceOption(highlightedOption)
      }
    } else {
      state.clearSearch()
    }
  },
  restoreLastSelectedPosition: (box: FocusedBox) => {
    const state = get()
    
    switch (box) {
      case 'projects':
        if (state.projects.length > 0 && state.lastSelectedProjectIndex < state.projects.length) {
          const lastSelected = state.projects[state.lastSelectedProjectIndex]
          if (lastSelected) {
            state.selectProject(lastSelected, state.lastSelectedProjectIndex)
          }
        }
        break
      case 'repos':
        if (state.repos.length > 0 && state.lastSelectedRepoIndex < state.repos.length) {
          const lastSelected = state.repos[state.lastSelectedRepoIndex]
          if (lastSelected) {
            state.selectRepo(lastSelected, state.lastSelectedRepoIndex)
          }
        }
        break
      case 'workspace':
        if (state.workspaceOptions.length > 0 && state.lastSelectedWorkspaceIndex < state.workspaceOptions.length) {
          const lastSelected = state.workspaceOptions[state.lastSelectedWorkspaceIndex]
          if (lastSelected) {
            state.selectWorkspaceOption(lastSelected)
          }
        }
        break
    }
  },
  getHighlightedIndexForLastSelected: (box: FocusedBox) => {
    const state = get()
    const filteredOptions = state.getFilteredOptions(box)
    
    if (filteredOptions.length === 0) return 0
    
    switch (box) {
      case 'projects':
        if (state.selectedProject) {
          const index = filteredOptions.findIndex(p => p.value === state.selectedProject?.value)
          return index >= 0 ? index : 0
        }
        break
      case 'repos':
        if (state.selectedRepo) {
          const index = filteredOptions.findIndex(r => r.value === state.selectedRepo?.value)
          return index >= 0 ? index : 0
        }
        break
      case 'workspace':
        if (state.selectedWorkspaceOption) {
          const index = filteredOptions.findIndex(w => w.value === state.selectedWorkspaceOption?.value)
          return index >= 0 ? index : 0
        }
        break
    }
    return 0
  },

  // Clone functionality
  isInCloneView: false,
  cloneLocation: '',
  cloneMethod: 'https',
  cloneStatus: null,
  cloneFocusedField: 'method',
  enterCloneView: () => {
    set({ 
      isInCloneView: true, 
      cloneLocation: '', 
      cloneStatus: null,
      cloneFocusedField: 'method'
    })
  },
  exitCloneView: () => {
    set({ 
      isInCloneView: false, 
      cloneLocation: '', 
      cloneStatus: null,
      cloneFocusedField: 'method'
    })
  },
  setCloneLocation: (location: string) => {
    set({ cloneLocation: location })
  },
  setCloneMethod: (method: 'https' | 'ssh') => {
    set({ cloneMethod: method })
  },
  toggleCloneMethod: () => {
    const state = get()
    set({ cloneMethod: state.cloneMethod === 'https' ? 'ssh' : 'https' })
  },
  setCloneFocusedField: (field: 'method' | 'path') => {
    set({ cloneFocusedField: field })
  },
  executeClone: async () => {
    const state = get()
    if (!state.selectedRepo || !state.cloneLocation.trim()) {
      set({ 
        cloneStatus: { 
          message: 'Please specify a valid location', 
          isError: true 
        } 
      })
      return
    }

    set({ 
      cloneStatus: { 
        message: `Cloning repository via ${state.cloneMethod.toUpperCase()}...`, 
        isError: false 
      } 
    })

    try {
      let repoUrl: string
      try {
        const urlData = JSON.parse(state.selectedRepo.description)
        repoUrl = state.cloneMethod === 'ssh' ? urlData.sshUrl : urlData.httpsUrl
      } catch {
        // Fallback to description as URL if parsing fails
        repoUrl = state.selectedRepo.description
      }
      
      const result = await cloneRepo(repoUrl, state.cloneLocation.trim())
      
      set({ 
        cloneStatus: { 
          message: result.message, 
          isError: !result.success 
        } 
      })

      if (result.success) {
        setTimeout(() => {
          const currentState = get()
          currentState.exitCloneView()
        }, 3000)
      }
    } catch (error) {
      set({ 
        cloneStatus: { 
          message: `Clone failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          isError: true 
        } 
      })
    }
  },
  clearCloneStatus: () => {
    set({ cloneStatus: null })
  },

  // Pipelines functionality
  isInPipelinesView: false,
  pipelines: [],
  selectedPipeline: null,
  pipelineRuns: [],
  selectedPipelineRun: null,
  pipelinesLoading: false,
  pipelineRunsLoading: false,
  pipelineSteps: [],
  pipelineStepsLoading: false,
  pipelineStepsRefreshInterval: null,
  isRunInProgress: false,
  // Step logs
  selectedStepIndex: 0,
  selectedStep: null,
  stepLogs: [],
  stepLogsLoading: false,
  stepLogsScrollOffset: 0,
  enterPipelinesView: () => {
    const state = get()
    set({ 
      isInPipelinesView: true, 
      pipelines: [],
      selectedPipeline: null,
      pipelineRuns: [],
      selectedPipelineRun: null,
      pipelineSteps: [],
      pipelineStepsLoading: false,
      isRunInProgress: false,
      selectedStep: null,
      selectedStepIndex: 0,
      stepLogs: [],
      stepLogsLoading: false,
      stepLogsScrollOffset: 0
    })
    state.loadPipelines()
  },
  exitPipelinesView: () => {
    const state = get()
    state.stopStepsRefresh()
    set({ 
      isInPipelinesView: false,
      pipelines: [],
      selectedPipeline: null,
      pipelineRuns: [],
      selectedPipelineRun: null,
      pipelineSteps: [],
      pipelineStepsLoading: false,
      isRunInProgress: false,
      selectedStep: null,
      selectedStepIndex: 0,
      stepLogs: [],
      stepLogsLoading: false,
      stepLogsScrollOffset: 0
    })
  },
  loadPipelines: async () => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo) return
    
    set({ pipelinesLoading: true })
    try {
      // Get all build definitions for the project
      const definitions = await getBuildDefinitions(state.selectedProject.value)
      
      // Filter pipelines by matching repo name in the pipeline name
      const repoName = state.selectedRepo.name.toLowerCase()
      const filteredDefinitions = definitions?.filter(def => 
        def.name?.toLowerCase().includes(repoName)
      ) || []
      
      const options = filteredDefinitions.map(def => ({
        name: `${def.name}`,
        value: `${def.id}`,
        description: def.path || ''
      }))
      
      set({ pipelines: options, pipelinesLoading: false })
    } catch (error) {
      console.error('Failed to load pipelines:', error)
      set({ pipelinesLoading: false })
    }
  },
  selectPipeline: (pipeline: SelectOption) => {
    const state = get()
    set({ selectedPipeline: pipeline, pipelineRuns: [], selectedPipelineRun: null })
    state.loadPipelineRuns(parseInt(pipeline.value))
  },
  loadPipelineRuns: async (pipelineId: number) => {
    const state = get()
    if (!state.selectedProject) return
    
    set({ pipelineRunsLoading: true })
    try {
      const builds = await getBuildRuns(state.selectedProject.value, pipelineId)
      const options = builds?.map(build => {
        // Build Status: 1 = InProgress, 2 = Completed, 4 = Cancelling, 32 = NotStarted
        // Build Result (when completed): 2 = Succeeded, 4 = PartiallySucceeded, 8 = Failed, 32 = Canceled
        let statusIcon = '?'
        let statusText = 'unknown'
        
        if (build.status === 1) {
          // In Progress
          statusIcon = 'run'
          statusText = 'in progress'
        } else if (build.status === 32) {
          // Not Started (queued)
          statusIcon = 'queue'
          statusText = 'queued'
        } else if (build.status === 4) {
          // Cancelling
          statusIcon = 'cancel'
          statusText = 'cancelling'
        } else if (build.status === 2) {
          // Completed - check result
          if (build.result === 2) {
            statusIcon = 'ok'
            statusText = 'succeeded'
          } else if (build.result === 4) {
            statusIcon = 'warn'
            statusText = 'partially succeeded'
          } else if (build.result === 8) {
            statusIcon = 'fail'
            statusText = 'failed'
          } else if (build.result === 32) {
            statusIcon = 'cancel'
            statusText = 'canceled'
          }
        }
        
        return {
          name: `[${statusIcon}] #${build.buildNumber} - ${statusText}`,
          value: `${build.id}`,
          description: build.sourceBranch || ''
        }
      }) || []
      set({ pipelineRuns: options, pipelineRunsLoading: false })
    } catch (error) {
      console.error('Failed to load pipeline runs:', error)
      set({ pipelineRunsLoading: false })
    }
  },
  selectPipelineRun: (run: SelectOption) => {
    const state = get()
    // Check if run is in progress based on the name format we created
    const isInProgress = run.name.includes('[run]') || run.name.includes('in progress') || run.name.includes('[queue]') || run.name.includes('queued')
    set({ selectedPipelineRun: run, pipelineSteps: [], isRunInProgress: isInProgress })
    
    // Load steps for this run
    const buildId = parseInt(run.value)
    state.loadPipelineSteps(buildId)
    
    // If in progress, start auto-refresh
    if (isInProgress) {
      state.startStepsRefresh(buildId)
    }
  },
  loadPipelineSteps: async (buildId: number) => {
    const state = get()
    if (!state.selectedProject) return
    
    set({ pipelineStepsLoading: true })
    try {
      const steps = await getBuildTimeline(state.selectedProject.value, buildId)
      
      // Check if any step is still in progress
      const isInProgress = steps.some(s => s.state === 'inProgress')
      
      set({ 
        pipelineSteps: steps, 
        pipelineStepsLoading: false,
        isRunInProgress: isInProgress
      })
      
      // If no longer in progress, stop refreshing
      if (!isInProgress) {
        state.stopStepsRefresh()
      }
    } catch (error) {
      console.error('Failed to load pipeline steps:', error)
      set({ pipelineStepsLoading: false })
    }
  },
  startStepsRefresh: (buildId: number) => {
    const state = get()
    // Clear any existing interval
    state.stopStepsRefresh()
    
    // Refresh every 3 seconds
    const interval = setInterval(() => {
      const currentState = get()
      if (currentState.selectedPipelineRun && currentState.isRunInProgress) {
        currentState.loadPipelineSteps(buildId)
      } else {
        currentState.stopStepsRefresh()
      }
    }, 3000)
    
    set({ pipelineStepsRefreshInterval: interval })
  },
  stopStepsRefresh: () => {
    const state = get()
    if (state.pipelineStepsRefreshInterval) {
      clearInterval(state.pipelineStepsRefreshInterval)
      set({ pipelineStepsRefreshInterval: null })
    }
  },
  goBackFromRuns: () => {
    const state = get()
    state.stopStepsRefresh()
    set({ selectedPipeline: null, pipelineRuns: [], selectedPipelineRun: null, pipelineSteps: [], isRunInProgress: false, selectedStep: null, stepLogs: [], selectedStepIndex: 0 })
  },
  goBackFromSteps: () => {
    const state = get()
    state.stopStepsRefresh()
    set({ selectedPipelineRun: null, pipelineSteps: [], isRunInProgress: false, selectedStep: null, stepLogs: [], selectedStepIndex: 0 })
  },
  
  // Step navigation and logs
  navigateStep: (direction: 'up' | 'down') => {
    const state = get()
    // Get only Task type steps (the actual executable steps)
    const taskSteps = state.pipelineSteps.filter(s => s.type === 'Task')
    if (taskSteps.length === 0) return
    
    let newIndex = state.selectedStepIndex
    if (direction === 'down') {
      newIndex = Math.min(state.selectedStepIndex + 1, taskSteps.length - 1)
    } else {
      newIndex = Math.max(state.selectedStepIndex - 1, 0)
    }
    
    if (newIndex !== state.selectedStepIndex) {
      const step = taskSteps[newIndex]
      set({ selectedStepIndex: newIndex, selectedStep: step, stepLogs: [], stepLogsScrollOffset: 0 })
      // Auto-load logs for the new step
      if (step?.logId) {
        state.loadStepLogs(step)
      }
    }
  },
  selectStep: (step: BuildStep, index: number) => {
    const state = get()
    set({ selectedStep: step, selectedStepIndex: index, stepLogs: [], stepLogsScrollOffset: 0 })
    if (step.logId) {
      state.loadStepLogs(step)
    }
  },
  loadStepLogs: async (step: BuildStep) => {
    const state = get()
    if (!state.selectedProject || !state.selectedPipelineRun || !step.logId) return
    
    set({ stepLogsLoading: true })
    try {
      const buildId = parseInt(state.selectedPipelineRun.value)
      const logs = await getBuildStepLogs(state.selectedProject.value, buildId, step.logId)
      set({ stepLogs: logs, stepLogsLoading: false })
    } catch (error) {
      console.error('Failed to load step logs:', error)
      set({ stepLogsLoading: false })
    }
  },
  scrollLogs: (direction: 'up' | 'down' | 'pageup' | 'pagedown') => {
    const state = get()
    const step = direction === 'up' ? -1 : direction === 'down' ? 1 : direction === 'pageup' ? -10 : 10
    const newOffset = Math.max(0, Math.min(state.stepLogsScrollOffset + step, Math.max(0, state.stepLogs.length - 20)))
    set({ stepLogsScrollOffset: newOffset })
  },
  exitStepLogs: () => {
    set({ selectedStep: null, stepLogs: [], stepLogsScrollOffset: 0, selectedStepIndex: 0 })
  },

  // Pull Requests functionality
  isInPRsView: false,
  pullRequests: [],
  selectedPR: null,
  prsLoading: false,
  prFileChanges: [],
  prFileChangesLoading: false,
  selectedPRFile: null,
  selectedPRFileIndex: 0,
  
  // PR Details
  prIsDraft: false,
  prThreads: [],
  prReviewers: [],
  prStatuses: [],
  prConflicts: [],
  prDetailsLoading: false,
  
  // Conflict viewing
  selectedConflict: null,
  selectedConflictIndex: 0,
  conflictContentLoading: false,
  
  // Reviewer management
  isAddingReviewer: false,
  teamMembers: [],
  selectedReviewerIndex: 0,
  reviewerIsRequired: false,
  
  enterPRsView: () => {
    const state = get()
    set({ 
      isInPRsView: true, 
      pullRequests: [],
      selectedPR: null,
      prFileChanges: [],
      selectedPRFile: null,
      selectedPRFileIndex: 0,
      prIsDraft: false,
      prThreads: [],
      prReviewers: [],
      prStatuses: [],
      prConflicts: [],
      prDetailsLoading: false,
      selectedConflict: null,
      selectedConflictIndex: 0,
      conflictContentLoading: false
    })
    state.loadPullRequests()
  },
  exitPRsView: () => {
    set({ 
      isInPRsView: false,
      pullRequests: [],
      selectedPR: null,
      prFileChanges: [],
      selectedPRFile: null,
      selectedPRFileIndex: 0,
      prIsDraft: false,
      prThreads: [],
      prReviewers: [],
      prStatuses: [],
      prConflicts: [],
      prDetailsLoading: false,
      isAddingReviewer: false,
      teamMembers: [],
      selectedReviewerIndex: 0,
      selectedConflict: null,
      selectedConflictIndex: 0,
      conflictContentLoading: false
    })
  },
  loadPullRequests: async () => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo) return
    
    set({ prsLoading: true })
    try {
      const prs = await getPullRequests(state.selectedProject.value, state.selectedRepo.value)
      const options = prs?.map(pr => ({
        name: `#${pr.pullRequestId} - ${pr.title}`,
        value: `${pr.pullRequestId}`,
        description: JSON.stringify({
          author: pr.createdBy?.displayName || 'Unknown',
          sourceBranch: pr.sourceRefName || '',
          targetBranch: pr.targetRefName || '',
          status: pr.status === 1 ? 'active' : pr.status === 2 ? 'abandoned' : pr.status === 3 ? 'completed' : 'unknown'
        })
      })) || []
      set({ pullRequests: options, prsLoading: false })
    } catch (error) {
      console.error('Failed to load pull requests:', error)
      set({ prsLoading: false })
    }
  },
  selectPR: (pr: SelectOption) => {
    const state = get()
    set({ 
      selectedPR: pr, 
      prFileChanges: [], 
      selectedPRFile: null, 
      selectedPRFileIndex: 0,
      prIsDraft: false,
      prThreads: [],
      prReviewers: [],
      prStatuses: [],
      prConflicts: [],
      prDetailsLoading: true
    })
    // Load file changes and PR details in parallel
    state.loadPRFileChanges(parseInt(pr.value))
    state.loadPRDetails(parseInt(pr.value))
  },
  
  loadPRDetails: async (prId: number) => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo) return
    
    set({ prDetailsLoading: true })
    try {
      // Load all PR details in parallel
      const [prDetails, threads, reviewers, statuses, conflicts] = await Promise.all([
        getPullRequestDetails(state.selectedProject.value, state.selectedRepo.value, prId),
        getPullRequestThreads(state.selectedProject.value, state.selectedRepo.value, prId),
        getPullRequestReviewers(state.selectedProject.value, state.selectedRepo.value, prId),
        getPullRequestStatuses(state.selectedProject.value, state.selectedRepo.value, prId),
        getPullRequestConflicts(state.selectedProject.value, state.selectedRepo.value, prId)
      ])
      
      // Process threads
      const prThreads: PRThread[] = threads?.map(thread => ({
        id: thread.id!,
        status: thread.status === 1 ? 'active' : thread.status === 2 ? 'fixed' : thread.status === 3 ? 'wontFix' : thread.status === 4 ? 'closed' : 'unknown',
        isResolved: thread.status !== 1,
        comments: thread.comments?.map(c => ({
          author: c.author?.displayName || 'Unknown',
          content: c.content || '',
          date: c.publishedDate ? new Date(c.publishedDate).toLocaleDateString() : ''
        })) || []
      })).filter(t => t.comments.length > 0) || []
      
      // Process reviewers
      const prReviewers: PRReviewer[] = reviewers?.map(r => ({
        id: r.id || '',
        displayName: r.displayName || 'Unknown',
        vote: r.vote || 0,
        isRequired: (r as any).isRequired || false,
        imageUrl: r.imageUrl
      })) || []
      
      // Process statuses
      const prStatuses: PRStatus[] = statuses?.map(s => ({
        id: s.id!,
        state: s.state === 1 ? 'pending' : s.state === 2 ? 'succeeded' : s.state === 3 ? 'failed' : s.state === 4 ? 'error' : 'unknown',
        description: s.description || '',
        context: (s.context as any)?.name || s.context?.genre || 'Check',
        targetUrl: s.targetUrl
      })) || []
      
      // Process conflicts
      const prConflicts: PRConflict[] = conflicts?.map(c => ({
        conflictId: c.conflictId!,
        conflictType: c.conflictType === 1 ? 'rename' : c.conflictType === 2 ? 'edit' : c.conflictType === 3 ? 'delete' : 'unknown',
        conflictPath: (c as any).sourceFilePath || (c as any).targetFilePath || (c as any).conflictPath || 'Unknown path',
        rawConflict: c // Store raw conflict for getting blob content later
      })) || []
      
      set({ 
        prIsDraft: prDetails?.isDraft || false,
        prThreads,
        prReviewers,
        prStatuses,
        prConflicts,
        prDetailsLoading: false
      })
    } catch (error) {
      console.error('Failed to load PR details:', error)
      set({ prDetailsLoading: false })
    }
  },
  loadPRFileChanges: async (prId: number) => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo || !state.selectedPR) return
    
    set({ prFileChangesLoading: true })
    try {
      // Get the PR details from description
      const prDetails = JSON.parse(state.selectedPR.description)
      const sourceBranch = prDetails.sourceBranch
      const targetBranch = prDetails.targetBranch
      
      // Get iterations to find the latest one
      const iterations = await getPullRequestIterations(
        state.selectedProject.value, 
        state.selectedRepo.value, 
        prId
      )
      
      if (!iterations || iterations.length === 0) {
        set({ prFileChanges: [], prFileChangesLoading: false })
        return
      }
      
      // Get the latest iteration
      const latestIteration = iterations[iterations.length - 1]
      
      // Get changes for the latest iteration
      const changes = await getPullRequestIterationChanges(
        state.selectedProject.value,
        state.selectedRepo.value,
        prId,
        latestIteration.id!
      )
      
      if (!changes?.changeEntries) {
        set({ prFileChanges: [], prFileChangesLoading: false })
        return
      }
      
      // Get file contents for each change
      const fileChanges: PRFileChange[] = []
      for (const change of changes.changeEntries.slice(0, 10)) { // Limit to 10 files for performance
        const path = change.item?.path
        if (!path) continue
        
        const changeType = change.changeType === 1 ? 'add' : 
                          change.changeType === 2 ? 'edit' : 
                          change.changeType === 16 ? 'delete' : 'unknown'
        
        const diffResult = await getPullRequestFileDiff(
          state.selectedProject.value,
          state.selectedRepo.value,
          prId,
          path,
          sourceBranch,
          targetBranch
        )
        
        fileChanges.push({
          path,
          changeType,
          originalContent: diffResult?.originalContent || '',
          modifiedContent: diffResult?.modifiedContent || ''
        })
      }
      
      set({ prFileChanges: fileChanges, prFileChangesLoading: false })
    } catch (error) {
      console.error('Failed to load PR file changes:', error)
      set({ prFileChanges: [], prFileChangesLoading: false })
    }
  },
  selectPRFile: (file: PRFileChange, index: number) => {
    set({ selectedPRFile: file, selectedPRFileIndex: index })
  },
  navigatePRFile: (direction: 'up' | 'down') => {
    const state = get()
    if (state.prFileChanges.length === 0) return
    
    let newIndex = state.selectedPRFileIndex
    if (direction === 'down') {
      newIndex = Math.min(state.selectedPRFileIndex + 1, state.prFileChanges.length - 1)
    } else {
      newIndex = Math.max(state.selectedPRFileIndex - 1, 0)
    }
    
    const file = state.prFileChanges[newIndex]
    if (file) {
      set({ selectedPRFile: file, selectedPRFileIndex: newIndex })
    }
  },
  goBackFromPRFiles: () => {
    set({ selectedPR: null, prFileChanges: [], selectedPRFile: null, selectedPRFileIndex: 0 })
  },
  
  // PR Actions
  prActionStatus: null,
  prActionLoading: false,
  isAddingComment: false,
  commentText: '',
  isCompletingPR: false,
  completionMessage: '',
  
  openPRInBrowser: () => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo || !state.selectedPR) return
    
    const url = getPullRequestUrl(
      state.selectedProject.name,
      state.selectedRepo.name,
      parseInt(state.selectedPR.value)
    )
    
    // Open URL in default browser
    const { exec } = require('child_process')
    const platform = process.platform
    const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open'
    exec(`${command} "${url}"`)
    
    set({ prActionStatus: { message: 'Opening PR in browser...', isError: false } })
    setTimeout(() => set({ prActionStatus: null }), 2000)
  },
  
  copyPRLinkToClipboard: () => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo || !state.selectedPR) return
    
    const url = getPullRequestUrl(
      state.selectedProject.name,
      state.selectedRepo.name,
      parseInt(state.selectedPR.value)
    )
    
    // Copy to clipboard using platform-specific command
    const { exec } = require('child_process')
    const platform = process.platform
    
    let command: string
    if (platform === 'darwin') {
      command = `echo "${url}" | pbcopy`
    } else if (platform === 'win32') {
      command = `echo ${url} | clip`
    } else {
      // Linux - try xclip first, then xsel
      command = `echo "${url}" | xclip -selection clipboard 2>/dev/null || echo "${url}" | xsel --clipboard`
    }
    
    exec(command, (error: Error | null) => {
      if (error) {
        set({ prActionStatus: { message: 'Failed to copy to clipboard', isError: true } })
      } else {
        set({ prActionStatus: { message: 'PR link copied to clipboard!', isError: false } })
      }
      setTimeout(() => set({ prActionStatus: null }), 2000)
    })
  },
  
  approvePR: async () => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo || !state.selectedPR) return
    
    set({ prActionLoading: true, prActionStatus: { message: 'Approving PR...', isError: false } })
    
    try {
      const result = await approvePullRequest(
        state.selectedProject.value,
        state.selectedRepo.value,
        parseInt(state.selectedPR.value)
      )
      
      set({ 
        prActionLoading: false, 
        prActionStatus: { message: result.message, isError: !result.success } 
      })
      
      // Auto-clear success message
      if (result.success) {
        setTimeout(() => set({ prActionStatus: null }), 3000)
      }
    } catch (error) {
      set({ 
        prActionLoading: false, 
        prActionStatus: { message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true } 
      })
    }
  },
  
  startAddingComment: () => {
    set({ isAddingComment: true, commentText: '' })
  },
  
  cancelAddingComment: () => {
    set({ isAddingComment: false, commentText: '' })
  },
  
  setCommentText: (text: string) => {
    set({ commentText: text })
  },
  
  submitComment: async () => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo || !state.selectedPR || !state.commentText.trim()) return
    
    set({ prActionLoading: true, prActionStatus: { message: 'Adding comment...', isError: false } })
    
    try {
      const result = await addPullRequestComment(
        state.selectedProject.value,
        state.selectedRepo.value,
        parseInt(state.selectedPR.value),
        state.commentText.trim()
      )
      
      set({ 
        prActionLoading: false, 
        isAddingComment: false,
        commentText: '',
        prActionStatus: { message: result.message, isError: !result.success } 
      })
      
      if (result.success) {
        setTimeout(() => set({ prActionStatus: null }), 3000)
      }
    } catch (error) {
      set({ 
        prActionLoading: false, 
        prActionStatus: { message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true } 
      })
    }
  },
  
  startCompletingPR: () => {
    const state = get()
    // Pre-fill with PR title as default commit message
    const defaultMessage = state.selectedPR?.name || 'Merge pull request'
    set({ isCompletingPR: true, completionMessage: defaultMessage })
  },
  
  cancelCompletingPR: () => {
    set({ isCompletingPR: false, completionMessage: '' })
  },
  
  setCompletionMessage: (message: string) => {
    set({ completionMessage: message })
  },
  
  submitCompletion: async () => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo || !state.selectedPR || !state.completionMessage.trim()) return
    
    set({ prActionLoading: true, prActionStatus: { message: 'Completing PR...', isError: false } })
    
    try {
      const result = await completePullRequest(
        state.selectedProject.value,
        state.selectedRepo.value,
        parseInt(state.selectedPR.value),
        state.completionMessage.trim(),
        false // deleteSourceBranch
      )
      
      set({ 
        prActionLoading: false, 
        isCompletingPR: false,
        completionMessage: '',
        prActionStatus: { message: result.message, isError: !result.success } 
      })
      
      if (result.success) {
        // Refresh PRs list after completion
        setTimeout(() => {
          const currentState = get()
          currentState.goBackFromPRFiles()
          currentState.loadPullRequests()
          set({ prActionStatus: null })
        }, 2000)
      }
    } catch (error) {
      set({ 
        prActionLoading: false, 
        prActionStatus: { message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true } 
      })
    }
  },
  
  clearPRActionStatus: () => {
    set({ prActionStatus: null })
  },
  
  toggleDraft: async () => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo || !state.selectedPR) return
    
    const newDraftStatus = !state.prIsDraft
    set({ prActionLoading: true, prActionStatus: { message: newDraftStatus ? 'Marking as draft...' : 'Publishing PR...', isError: false } })
    
    try {
      const result = await togglePullRequestDraft(
        state.selectedProject.value,
        state.selectedRepo.value,
        parseInt(state.selectedPR.value),
        newDraftStatus
      )
      
      if (result.success) {
        set({ prIsDraft: newDraftStatus })
      }
      
      set({ 
        prActionLoading: false, 
        prActionStatus: { message: result.message, isError: !result.success } 
      })
      
      if (result.success) {
        setTimeout(() => set({ prActionStatus: null }), 3000)
      }
    } catch (error) {
      set({ 
        prActionLoading: false, 
        prActionStatus: { message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true } 
      })
    }
  },
  
  startAddingReviewer: async () => {
    const state = get()
    if (!state.selectedProject) return
    
    set({ isAddingReviewer: true, selectedReviewerIndex: 0, reviewerIsRequired: false })
    
    // Load team members
    try {
      const members = await getTeamMembers(state.selectedProject.value)
      const teamMembers = members?.map(m => ({
        id: (m.identity as any)?.id || '',
        displayName: (m.identity as any)?.displayName || 'Unknown'
      })).filter(m => m.id) || []
      set({ teamMembers })
    } catch (error) {
      console.error('Failed to load team members:', error)
      set({ teamMembers: [] })
    }
  },
  
  cancelAddingReviewer: () => {
    set({ isAddingReviewer: false, teamMembers: [], selectedReviewerIndex: 0, reviewerIsRequired: false })
  },
  
  navigateReviewer: (direction: 'up' | 'down') => {
    const state = get()
    if (state.teamMembers.length === 0) return
    
    let newIndex = state.selectedReviewerIndex
    if (direction === 'down') {
      newIndex = Math.min(state.selectedReviewerIndex + 1, state.teamMembers.length - 1)
    } else {
      newIndex = Math.max(state.selectedReviewerIndex - 1, 0)
    }
    set({ selectedReviewerIndex: newIndex })
  },
  
  toggleReviewerRequired: () => {
    const state = get()
    set({ reviewerIsRequired: !state.reviewerIsRequired })
  },
  
  submitReviewer: async () => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo || !state.selectedPR || state.teamMembers.length === 0) return
    
    const selectedMember = state.teamMembers[state.selectedReviewerIndex]
    if (!selectedMember) return
    
    set({ prActionLoading: true, prActionStatus: { message: 'Adding reviewer...', isError: false } })
    
    try {
      const result = await addPullRequestReviewer(
        state.selectedProject.value,
        state.selectedRepo.value,
        parseInt(state.selectedPR.value),
        selectedMember.id,
        state.reviewerIsRequired
      )
      
      set({ 
        prActionLoading: false, 
        isAddingReviewer: false,
        teamMembers: [],
        selectedReviewerIndex: 0,
        reviewerIsRequired: false,
        prActionStatus: { message: result.message, isError: !result.success } 
      })
      
      if (result.success) {
        // Refresh PR details
        state.loadPRDetails(parseInt(state.selectedPR.value))
        setTimeout(() => set({ prActionStatus: null }), 3000)
      }
    } catch (error) {
      set({ 
        prActionLoading: false, 
        prActionStatus: { message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true } 
      })
    }
  },
  
  removeReviewer: async (reviewerId: string) => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo || !state.selectedPR) return
    
    set({ prActionLoading: true, prActionStatus: { message: 'Removing reviewer...', isError: false } })
    
    try {
      const result = await removePullRequestReviewer(
        state.selectedProject.value,
        state.selectedRepo.value,
        parseInt(state.selectedPR.value),
        reviewerId
      )
      
      set({ 
        prActionLoading: false, 
        prActionStatus: { message: result.message, isError: !result.success } 
      })
      
      if (result.success) {
        // Refresh PR details
        state.loadPRDetails(parseInt(state.selectedPR.value))
        setTimeout(() => set({ prActionStatus: null }), 3000)
      }
    } catch (error) {
      set({ 
        prActionLoading: false, 
        prActionStatus: { message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true } 
      })
    }
  },
  
  selectConflict: async (index: number) => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo || !state.prConflicts[index]) return
    
    const conflict = state.prConflicts[index]
    set({ 
      selectedConflictIndex: index, 
      conflictContentLoading: true,
      selectedConflict: conflict
    })
    
    try {
      const details = await getConflictDetails(
        state.selectedProject.value,
        state.selectedRepo.value,
        conflict.rawConflict
      )
      
      if (details) {
        const updatedConflict: PRConflict = {
          ...conflict,
          sourceContent: details.sourceContent,
          targetContent: details.targetContent,
          baseContent: details.baseContent
        }
        set({ 
          selectedConflict: updatedConflict,
          conflictContentLoading: false
        })
      } else {
        set({ conflictContentLoading: false })
      }
    } catch (error) {
      console.error('Failed to load conflict details:', error)
      set({ conflictContentLoading: false })
    }
  },
  
  navigateConflict: (direction: 'up' | 'down') => {
    const state = get()
    if (state.prConflicts.length === 0) return
    
    let newIndex = state.selectedConflictIndex
    if (direction === 'down') {
      newIndex = Math.min(state.selectedConflictIndex + 1, state.prConflicts.length - 1)
    } else {
      newIndex = Math.max(state.selectedConflictIndex - 1, 0)
    }
    
    if (newIndex !== state.selectedConflictIndex) {
      set({ selectedConflictIndex: newIndex })
      // Load the new conflict content
      state.selectConflict(newIndex)
    }
  },
  
  exitConflictView: () => {
    set({ 
      selectedConflict: null, 
      selectedConflictIndex: 0,
      conflictContentLoading: false
    })
  },
  
  // Create PR functionality
  isCreatingPR: false,
  createPRStep: 'source' as const,
  branches: [],
  branchesLoading: false,
  createPRSourceBranch: '',
  createPRTargetBranch: '',
  createPRTitle: '',
  createPRDescription: '',
  createPRReviewerIds: [],
  createPRIsDraft: false,
  selectedBranchIndex: 0,
  createPRSearchQuery: '',
  
  setCreatePRSearchQuery: (query: string) => {
    set({ createPRSearchQuery: query, selectedBranchIndex: 0 })
  },
  
  getFilteredBranches: () => {
    const state = get()
    const query = state.createPRSearchQuery.toLowerCase()
    let filtered = state.branches
    
    // For target step, exclude source branch
    if (state.createPRStep === 'target') {
      filtered = filtered.filter(b => b.name !== state.createPRSourceBranch)
    }
    
    if (!query) return filtered
    return filtered.filter(b => b.name.toLowerCase().includes(query))
  },
  
  getFilteredReviewers: () => {
    const state = get()
    const query = state.createPRSearchQuery.toLowerCase()
    if (!query) return state.teamMembers
    return state.teamMembers.filter(m => m.displayName.toLowerCase().includes(query))
  },
  
  startCreatingPR: async () => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo) return
    
    set({ 
      isCreatingPR: true, 
      createPRStep: 'source',
      branchesLoading: true,
      createPRSourceBranch: '',
      createPRTargetBranch: '',
      createPRTitle: '',
      createPRDescription: '',
      createPRReviewerIds: [],
      createPRIsDraft: false,
      selectedBranchIndex: 0,
      createPRSearchQuery: ''
    })
    
    try {
      // Load branches
      const branches = await getBranches(state.selectedProject.value, state.selectedRepo.value)
      
      // Also load team members for reviewer selection
      const members = await getTeamMembers(state.selectedProject.value)
      const teamMembers = members?.map(m => ({
        id: (m.identity as any)?.id || '',
        displayName: (m.identity as any)?.displayName || 'Unknown'
      })).filter(m => m.id) || []
      
      // Try to detect current branch and set defaults
      let defaultTarget = 'main'
      const mainBranch = branches.find(b => b.name === 'main' || b.name === 'master')
      if (mainBranch) {
        defaultTarget = mainBranch.name
      }
      
      set({ 
        branches, 
        branchesLoading: false,
        teamMembers,
        createPRTargetBranch: defaultTarget
      })
    } catch (error) {
      console.error('Failed to load branches:', error)
      set({ branchesLoading: false })
    }
  },
  
  cancelCreatingPR: () => {
    set({ 
      isCreatingPR: false,
      createPRStep: 'source',
      branches: [],
      createPRSourceBranch: '',
      createPRTargetBranch: '',
      createPRTitle: '',
      createPRDescription: '',
      createPRReviewerIds: [],
      createPRIsDraft: false,
      selectedBranchIndex: 0,
      createPRSearchQuery: ''
    })
  },
  
  setCreatePRSourceBranch: (branch: string) => {
    set({ createPRSourceBranch: branch })
  },
  
  setCreatePRTargetBranch: (branch: string) => {
    set({ createPRTargetBranch: branch })
  },
  
  setCreatePRTitle: (title: string) => {
    set({ createPRTitle: title })
  },
  
  setCreatePRDescription: (desc: string) => {
    set({ createPRDescription: desc })
  },
  
  toggleCreatePRReviewer: (reviewerId: string) => {
    const state = get()
    const currentIds = state.createPRReviewerIds
    if (currentIds.includes(reviewerId)) {
      set({ createPRReviewerIds: currentIds.filter(id => id !== reviewerId) })
    } else {
      set({ createPRReviewerIds: [...currentIds, reviewerId] })
    }
  },
  
  toggleCreatePRDraft: () => {
    const state = get()
    set({ createPRIsDraft: !state.createPRIsDraft })
  },
  
  nextCreatePRStep: () => {
    const state = get()
    const steps: Array<'source' | 'target' | 'title' | 'description' | 'reviewers' | 'confirm'> = 
      ['source', 'target', 'title', 'description', 'reviewers', 'confirm']
    const currentIndex = steps.indexOf(state.createPRStep)
    
    // Validate current step before moving
    if (state.createPRStep === 'source' && !state.createPRSourceBranch) {
      set({ prActionStatus: { message: 'Please select a source branch', isError: true } })
      setTimeout(() => set({ prActionStatus: null }), 2000)
      return
    }
    if (state.createPRStep === 'target' && !state.createPRTargetBranch) {
      set({ prActionStatus: { message: 'Please select a target branch', isError: true } })
      setTimeout(() => set({ prActionStatus: null }), 2000)
      return
    }
    if (state.createPRStep === 'title' && !state.createPRTitle.trim()) {
      set({ prActionStatus: { message: 'Please enter a title', isError: true } })
      setTimeout(() => set({ prActionStatus: null }), 2000)
      return
    }
    
    if (currentIndex < steps.length - 1) {
      set({ createPRStep: steps[currentIndex + 1], selectedBranchIndex: 0, createPRSearchQuery: '' })
    }
  },
  
  prevCreatePRStep: () => {
    const state = get()
    const steps: Array<'source' | 'target' | 'title' | 'description' | 'reviewers' | 'confirm'> = 
      ['source', 'target', 'title', 'description', 'reviewers', 'confirm']
    const currentIndex = steps.indexOf(state.createPRStep)
    if (currentIndex > 0) {
      set({ createPRStep: steps[currentIndex - 1], selectedBranchIndex: 0, createPRSearchQuery: '' })
    }
  },
  
  navigateBranch: (direction: 'up' | 'down') => {
    const state = get()
    // Use filtered list length for navigation
    const filteredLength = state.createPRStep === 'reviewers' 
      ? state.getFilteredReviewers().length 
      : state.getFilteredBranches().length
    if (filteredLength === 0) return
    
    let newIndex = state.selectedBranchIndex
    if (direction === 'down') {
      newIndex = Math.min(state.selectedBranchIndex + 1, filteredLength - 1)
    } else {
      newIndex = Math.max(state.selectedBranchIndex - 1, 0)
    }
    set({ selectedBranchIndex: newIndex })
  },
  
  selectCurrentBranch: () => {
    const state = get()
    const filteredBranches = state.getFilteredBranches()
    const branch = filteredBranches[state.selectedBranchIndex]
    if (!branch) return
    
    if (state.createPRStep === 'source') {
      set({ createPRSourceBranch: branch.name, createPRSearchQuery: '' })
      state.nextCreatePRStep()
    } else if (state.createPRStep === 'target') {
      set({ createPRTargetBranch: branch.name, createPRSearchQuery: '' })
      state.nextCreatePRStep()
    }
  },
  
  submitCreatePR: async () => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo) return
    
    const { createPRSourceBranch, createPRTargetBranch, createPRTitle, createPRDescription, createPRReviewerIds, createPRIsDraft } = state
    
    if (!createPRSourceBranch || !createPRTargetBranch || !createPRTitle.trim()) {
      set({ prActionStatus: { message: 'Please fill in all required fields', isError: true } })
      setTimeout(() => set({ prActionStatus: null }), 2000)
      return
    }
    
    set({ prActionLoading: true, prActionStatus: { message: 'Creating pull request...', isError: false } })
    
    try {
      const result = await createPullRequest(
        state.selectedProject.value,
        state.selectedRepo.value,
        createPRSourceBranch,
        createPRTargetBranch,
        createPRTitle.trim(),
        createPRDescription.trim(),
        createPRReviewerIds,
        createPRIsDraft
      )
      
      set({ 
        prActionLoading: false, 
        prActionStatus: { message: result.message, isError: !result.success } 
      })
      
      if (result.success) {
        // Reset create PR state and refresh PR list
        setTimeout(() => {
          const currentState = get()
          currentState.cancelCreatingPR()
          currentState.loadPullRequests()
          set({ prActionStatus: null })
        }, 2000)
      }
    } catch (error) {
      set({ 
        prActionLoading: false, 
        prActionStatus: { message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true } 
      })
    }
  },
}))

// Auto-initialize from CWD when the store is created (before React renders)
// This runs synchronously during module load
if (hasCredentials()) {
  // Set the flag synchronously first
  useAppStore.setState({ isInitializingFromCwd: true })
  // Then run the async initialization
  useAppStore.getState().initializeFromCwd()
}
