import { create } from 'zustand'
import type { SelectOption } from '@opentui/core'
import { getProjects, getRepos } from '../api'

type FocusedBox = 'projects' | 'repos' | 'workspace'

interface AppStore {
  focusedBox: FocusedBox
  setFocusedBox: (box: FocusedBox) => void
  cycleFocus: () => void

  projects: SelectOption[]
  selectedProject: SelectOption | null
  selectedProjectIndex: number
  setProjects: (projects: SelectOption[]) => void
  selectProject: (project: SelectOption, index: number) => void
  loadProjects: () => Promise<void>

  repos: SelectOption[]
  selectedRepo: SelectOption | null
  selectedRepoIndex: number
  setRepos: (repos: SelectOption[]) => void
  selectRepo: (repo: SelectOption, index: number) => void
  loadRepos: (projectId: string) => Promise<void>
}

const focusOrder: FocusedBox[] = ['projects', 'repos']

export const useAppStore = create<AppStore>((set, get) => ({
  focusedBox: 'projects',
  setFocusedBox: (box: FocusedBox) => set({ focusedBox: box }),
  cycleFocus: () => {
    const current = get().focusedBox
    const currentIndex = focusOrder.indexOf(current)
    const nextIndex = (currentIndex + 1) % focusOrder.length
    set({ focusedBox: focusOrder[nextIndex] })
  },

  projects: [],
  selectedProject: null,
  selectedProjectIndex: 0,
  setProjects: (projects: SelectOption[]) => set({ projects }),
  selectProject: (project: SelectOption, index: number) => {
    set({
      selectedProject: project,
      selectedProjectIndex: index,
      repos: [],
      selectedRepo: null,
      selectedRepoIndex: 0
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
  setRepos: (repos: SelectOption[]) => set({ repos }),
  selectRepo: (repo: SelectOption, index: number) => {
    set({ selectedRepo: repo, selectedRepoIndex: index })
  },
  loadRepos: async (projectId: string) => {
    try {
      const repos = await getRepos(projectId)
      const options = repos?.map(r => ({
        name: `${r.name}`,
        value: `${r.id}`,
        description: `${r.id}`,
      })) || []
      set({ repos: options })
    } catch (error) {
      console.error('Failed to load repos:', error)
    }
  },
}))
