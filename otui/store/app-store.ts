import { create } from 'zustand'
import type { SelectOption } from '@opentui/core'
import { getProjects, getRepos, cloneRepo } from '../api'

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
  setSearchActive: (active: boolean) => {
    set({ isSearchActive: active, searchHighlightedIndex: 0, isSelectMode: false })
    if (!active) {
      set({ searchQuery: '' })
    }
  },
  setSelectMode: (active: boolean) => set({ isSelectMode: active }),
  setSearchQuery: (query: string) => {
    set({ searchQuery: query, searchHighlightedIndex: 0 })
  },
  setSearchHighlightedIndex: (index: number) => set({ searchHighlightedIndex: index }),
  clearSearch: () => set({ searchQuery: '', isSearchActive: false, isSelectMode: false, searchHighlightedIndex: 0 }),
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
    const filteredOptions = state.getFilteredOptions(state.focusedBox)
    
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
    const filteredOptions = state.getFilteredOptions(state.focusedBox)
    const highlightedOption = filteredOptions[state.searchHighlightedIndex]
    
    if (highlightedOption) {
      // Clear search first to prevent restoration conflicts
      set({ isSearchActive: false, isSelectMode: false, searchQuery: '', searchHighlightedIndex: 0 })
      
      if (state.focusedBox === 'projects') {
        const project = state.projects.find(p => p.value === highlightedOption.value)
        if (project) {
          const index = state.projects.findIndex(p => p.value === highlightedOption.value)
          state.selectProject(project, index)
          state.loadRepos(project.value)
          state.setFocusedBox('repos')
        }
      } else if (state.focusedBox === 'repos') {
        const repo = state.repos.find(r => r.value === highlightedOption.value)
        if (repo) {
          const index = state.repos.findIndex(r => r.value === highlightedOption.value)
          state.selectRepo(repo, index)
          state.enterWorkspace()
        }
      } else if (state.focusedBox === 'workspace') {
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
}))
