import { create } from 'zustand'
import type { SelectOption } from '@opentui/core'
import { getProjects, getRepos, cloneRepo, getPullRequests, getBuildDefinitions, getBuildRuns } from '../api'

type FocusedBox = 'projects' | 'repos' | 'workspace'

interface AppStore {
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
  enterPipelinesView: () => void
  exitPipelinesView: () => void
  loadPipelines: () => Promise<void>
  selectPipeline: (pipeline: SelectOption) => void
  loadPipelineRuns: (pipelineId: number) => Promise<void>
  selectPipelineRun: (run: SelectOption) => void
  goBackFromRuns: () => void

  // Pull Requests functionality
  isInPRsView: boolean
  pullRequests: SelectOption[]
  selectedPR: SelectOption | null
  prsLoading: boolean
  enterPRsView: () => void
  exitPRsView: () => void
  loadPullRequests: () => Promise<void>
  selectPR: (pr: SelectOption) => void
}

const focusOrder: FocusedBox[] = ['projects', 'repos', 'workspace']

export const useAppStore = create<AppStore>((set, get) => ({
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
          httpsUrl: r.cloneUrl,
          sshUrl: r.sshUrl || `git@ssh.dev.azure.com:v3/${selectedProject?.name}/${selectedProject?.name}/${r.name}`
        }),
      })) || []
      set({ repos: options })
    } catch (error) {
      console.error('Failed to load repos:', error)
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
  enterPipelinesView: () => {
    const state = get()
    set({ 
      isInPipelinesView: true, 
      pipelines: [],
      selectedPipeline: null,
      pipelineRuns: [],
      selectedPipelineRun: null
    })
    state.loadPipelines()
  },
  exitPipelinesView: () => {
    set({ 
      isInPipelinesView: false,
      pipelines: [],
      selectedPipeline: null,
      pipelineRuns: [],
      selectedPipelineRun: null
    })
  },
  loadPipelines: async () => {
    const state = get()
    if (!state.selectedProject || !state.selectedRepo) return
    
    set({ pipelinesLoading: true })
    try {
      const definitions = await getBuildDefinitions(state.selectedProject.value, state.selectedRepo.value)
      const options = definitions?.map(def => ({
        name: `${def.name}`,
        value: `${def.id}`,
        description: def.path || ''
      })) || []
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
        const statusIcon = build.result === 2 ? 'ok' : build.result === 8 ? 'fail' : 'run'
        const statusText = build.result === 2 ? 'succeeded' : build.result === 8 ? 'failed' : build.status === 1 ? 'in progress' : 'unknown'
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
    set({ selectedPipelineRun: run })
  },
  goBackFromRuns: () => {
    set({ selectedPipeline: null, pipelineRuns: [], selectedPipelineRun: null })
  },

  // Pull Requests functionality
  isInPRsView: false,
  pullRequests: [],
  selectedPR: null,
  prsLoading: false,
  enterPRsView: () => {
    const state = get()
    set({ 
      isInPRsView: true, 
      pullRequests: [],
      selectedPR: null
    })
    state.loadPullRequests()
  },
  exitPRsView: () => {
    set({ 
      isInPRsView: false,
      pullRequests: [],
      selectedPR: null
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
          sourceBranch: pr.sourceRefName?.replace('refs/heads/', '') || '',
          targetBranch: pr.targetRefName?.replace('refs/heads/', '') || '',
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
    set({ selectedPR: pr })
  },
}))
