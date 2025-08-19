package main

import (
	"aztui/packages/internal/api/pipelines"
	"aztui/packages/internal/api/projects"
	"aztui/packages/internal/api/repos"
	"aztui/packages/internal/autodetect"
	"aztui/packages/internal/config"
	"context"
	"fmt"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/build"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/core"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/git"
	pipeline "github.com/microsoft/azure-devops-go-api/azuredevops/v7/pipelines"
	"log"
	"os"
	"strings"
	"time"
)

var baseBoxStyle = lipgloss.NewStyle().
	BorderStyle(lipgloss.RoundedBorder()).
	Padding(1)

var rightPanelStyle = lipgloss.NewStyle().
	BorderStyle(lipgloss.RoundedBorder()).
	BorderForeground(lipgloss.Color("240")).
	Padding(1)

var highlightStyle = lipgloss.NewStyle().
	Foreground(lipgloss.Color("0")).
	Background(lipgloss.Color("12"))

var fullWidthHighlightStyle = lipgloss.NewStyle().
	Foreground(lipgloss.Color("0")).
	Background(lipgloss.Color("12"))

var searchStyle = lipgloss.NewStyle().
	BorderStyle(lipgloss.RoundedBorder()).
	BorderForeground(lipgloss.Color("12")).
	Padding(0, 1)

type projectLoadedMsg struct {
	repos []git.GitRepository
}

type pipelinesLoadedMsg struct {
	pipelines []pipeline.Pipeline
}

type runsLoadedMsg struct {
	runs []pipeline.Run
}

type timelineLoadedMsg struct {
	timeline *build.Timeline
}

type refreshMsg struct{}

type autoRefreshMsg struct{}

type autoSelectInProgressMsg struct{}

type autoDetectCompleteMsg struct {
	result *autodetect.AutoDetectResult
}

type repoOption struct {
	name string
	desc string
}

type model struct {
	projects         []core.TeamProjectReference
	repos            []git.GitRepository
	pipelines        []pipeline.Pipeline
	runs             []pipeline.Run
	timeline         *build.Timeline
	showRepoOptions  bool
	showPipelines    bool
	showRuns         bool
	showRunDetails   bool
	focusedPanel     int
	width            int
	height           int
	cursor           int
	projectsScroll   int
	reposScroll      int
	pipelinesScroll  int
	runsScroll       int
	timelineScroll   int
	selectedProject  *core.TeamProjectReference
	selectedRepo     *git.GitRepository
	selectedPipeline *pipeline.Pipeline
	selectedRun      *pipeline.Run
	repoOptions      []repoOption
	searchMode       bool
	searchQuery      string
	filteredItems    []interface{}
	originalCursor   int
	loadingProjects  bool
	loadingRepos     bool
	loadingPipelines bool
	loadingRuns      bool
	loadingTimeline  bool
	autoRefresh      bool
	autoSelected     bool
	autoSelectRepo   *git.GitRepository
	lastRefresh      time.Time
	projectsSpinner  spinner.Model
	reposSpinner     spinner.Model
	pipelinesSpinner spinner.Model
	runsSpinner      spinner.Model
	timelineSpinner  spinner.Model
	config           *config.Config
	configModal      *config.ConfigModal
	showConfigModal  bool
}

func (m model) Init() tea.Cmd {
	if m.showConfigModal {
		return m.configModal.Init()
	}
	return tea.Batch(m.projectsSpinner.Tick, loadProjects(m.config), autoDetectProjectAndRepo(m.config))
}

func loadProjects(cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		connection := azuredevops.NewPatConnection(cfg.AzureOrgURL, cfg.AzurePAT)
		ctx := context.Background()

		projectsList, err := projects.GetProjects(ctx, connection)
		if err != nil {
			log.Fatal(err)
		}
		return *projectsList
	}
}

func autoDetectProjectAndRepo(cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		result, err := autodetect.DetectProjectAndRepo(ctx, cfg)
		if err != nil {
			// Don't fail on auto-detection errors, just return empty result
			return autoDetectCompleteMsg{result: &autodetect.AutoDetectResult{ShouldAutoLoad: false}}
		}
		return autoDetectCompleteMsg{result: result}
	}
}

func loadProjectRepos(projectName string, cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		connection := azuredevops.NewPatConnection(cfg.AzureOrgURL, cfg.AzurePAT)
		ctx := context.Background()

		reposList, err := repos.GetRepos(ctx, connection, projectName)
		if err != nil {
			log.Fatal(err)
		}
		return projectLoadedMsg{repos: *reposList}
	}
}

func loadRepoPipelines(projectName string, repoName string, cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		connection := azuredevops.NewPatConnection(cfg.AzureOrgURL, cfg.AzurePAT)
		ctx := context.Background()

		pipelinesList, err := pipelines.GetPipelinesForRepo(ctx, connection, projectName, repoName)
		if err != nil {
			log.Fatal(err)
		}
		return pipelinesLoadedMsg{pipelines: *pipelinesList}
	}
}

func loadPipelineRuns(projectName string, pipelineID int, cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		connection := azuredevops.NewPatConnection(cfg.AzureOrgURL, cfg.AzurePAT)
		ctx := context.Background()

		runsList, err := pipelines.GetRuns(ctx, connection, projectName, pipelineID)
		if err != nil {
			log.Fatal(err)
		}
		return runsLoadedMsg{runs: *runsList}
	}
}

func loadRunTimeline(projectName string, buildID int, cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		connection := azuredevops.NewPatConnection(cfg.AzureOrgURL, cfg.AzurePAT)
		ctx := context.Background()

		timeline, err := pipelines.GetRunTimeline(ctx, connection, projectName, buildID)
		if err != nil {
			log.Fatal(err)
		}
		return timelineLoadedMsg{timeline: timeline}
	}
}

func tick() tea.Cmd {
	return tea.Tick(time.Second*3, func(t time.Time) tea.Msg {
		return autoRefreshMsg{}
	})
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	var cmds []tea.Cmd

	// Handle config modal if shown
	if m.showConfigModal {
		switch msg := msg.(type) {
		case config.ConfigCompleteMsg:
			// Configuration is complete, switch to main app
			m.config = msg.Config
			m.showConfigModal = false
			m.configModal = nil
			m.loadingProjects = true
			return m, tea.Batch(m.projectsSpinner.Tick, loadProjects(m.config), autoDetectProjectAndRepo(m.config))
		case tea.WindowSizeMsg:
			m.width = msg.Width
			m.height = msg.Height
			m.configModal, cmd = m.configModal.Update(msg)
			return m, cmd
		default:
			m.configModal, cmd = m.configModal.Update(msg)
			if m.configModal.IsCompleted() {
				if m.config.IsComplete() {
					m.showConfigModal = false
					m.configModal = nil
					m.loadingProjects = true
					return m, tea.Batch(m.projectsSpinner.Tick, loadProjects(m.config), autoDetectProjectAndRepo(m.config))
				}
			}
			return m, cmd
		}
	}

	// Update spinners
	if m.loadingProjects {
		m.projectsSpinner, cmd = m.projectsSpinner.Update(msg)
		cmds = append(cmds, cmd)
	}
	if m.loadingRepos {
		m.reposSpinner, cmd = m.reposSpinner.Update(msg)
		cmds = append(cmds, cmd)
	}
	if m.loadingPipelines {
		m.pipelinesSpinner, cmd = m.pipelinesSpinner.Update(msg)
		cmds = append(cmds, cmd)
	}
	if m.loadingRuns {
		m.runsSpinner, cmd = m.runsSpinner.Update(msg)
		cmds = append(cmds, cmd)
	}
	if m.loadingTimeline {
		m.timelineSpinner, cmd = m.timelineSpinner.Update(msg)
		cmds = append(cmds, cmd)
	}

	switch msg := msg.(type) {
	case []core.TeamProjectReference:
		m.projects = msg
		m.loadingProjects = false
		return m, tea.Batch(cmds...)
	case autoDetectCompleteMsg:
		if msg.result.ShouldAutoLoad {
			// Find and select the matching project
			for i, project := range m.projects {
				if project.Id != nil && msg.result.Project != nil && msg.result.Project.Id != nil &&
					*project.Id == *msg.result.Project.Id {
					m.selectedProject = &m.projects[i]
					m.cursor = i
					m.loadingRepos = true
					m.repos = []git.GitRepository{}

					// Auto-select the repository when repos are loaded
					m.autoSelectRepo = msg.result.Repository

					cmds = append(cmds, m.reposSpinner.Tick, loadProjectRepos(*m.selectedProject.Name, m.config))
					break
				}
			}
		}
		return m, tea.Batch(cmds...)
	case projectLoadedMsg:
		m.repos = msg.repos
		m.loadingRepos = false

		// Auto-select repository if we have one from auto-detection
		if m.autoSelectRepo != nil {
			for i, repo := range m.repos {
				if repo.Id != nil && m.autoSelectRepo.Id != nil && *repo.Id == *m.autoSelectRepo.Id {
					m.selectedRepo = &m.repos[i]
					m.showRepoOptions = true
					m.cursor = 0           // Focus on "Pipelines" option
					m.autoSelectRepo = nil // Clear auto-selection
					break
				}
			}
		}

		return m, tea.Batch(cmds...)
	case pipelinesLoadedMsg:
		m.pipelines = msg.pipelines
		m.loadingPipelines = false
		return m, tea.Batch(cmds...)
	case runsLoadedMsg:
		m.runs = msg.runs
		m.loadingRuns = false

		// Check for in-progress runs and auto-select the first one
		for i, run := range m.runs {
			if run.State != nil && (*run.State == "inProgress" || *run.State == "notStarted") {
				m.selectedRun = &m.runs[i]
				m.showRuns = false
				m.showRunDetails = true
				m.loadingTimeline = true
				m.timeline = nil
				m.cursor = 0
				m.autoRefresh = true
				m.autoSelected = true

				if m.selectedProject != nil && m.selectedRun.Id != nil {
					cmds = append(cmds, m.timelineSpinner.Tick, loadRunTimeline(*m.selectedProject.Name, *m.selectedRun.Id, m.config), tick())
				}
				break
			}
		}

		return m, tea.Batch(cmds...)
	case timelineLoadedMsg:
		m.timeline = msg.timeline
		m.loadingTimeline = false
		m.lastRefresh = time.Now()
		return m, tea.Batch(cmds...)
	case autoRefreshMsg:
		if m.autoRefresh && m.showRunDetails && m.selectedProject != nil && m.selectedRun != nil && m.selectedRun.Id != nil {
			return m, tea.Batch(append(cmds, loadRunTimeline(*m.selectedProject.Name, *m.selectedRun.Id, m.config), tick())...)
		}
		return m, tea.Batch(cmds...)
	case refreshMsg:
		if m.showRunDetails && m.selectedProject != nil && m.selectedRun != nil && m.selectedRun.Id != nil {
			m.loadingTimeline = true
			return m, tea.Batch(append(cmds, m.timelineSpinner.Tick, loadRunTimeline(*m.selectedProject.Name, *m.selectedRun.Id, m.config))...)
		}
		return m, tea.Batch(cmds...)
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, tea.Batch(cmds...)
	case tea.KeyMsg:
		if m.searchMode {
			switch msg.String() {
			case "escape", "esc":
				m.searchMode = false
				m.searchQuery = ""
				m.filteredItems = nil
				m.cursor = m.originalCursor
				m.updateScroll()
				return m, tea.Batch(cmds...)
			case "enter":
				if len(m.filteredItems) > 0 && m.cursor < len(m.filteredItems) {
					selected := m.filteredItems[m.cursor]
					m.searchMode = false
					m.searchQuery = ""
					m.filteredItems = nil

					if m.focusedPanel == 0 {
						if project, ok := selected.(core.TeamProjectReference); ok {
							for i, p := range m.projects {
								if p.Id != nil && project.Id != nil && *p.Id == *project.Id {
									m.cursor = i
									m.selectedProject = &m.projects[i]
									m.loadingRepos = true
									m.repos = []git.GitRepository{}
									m.updateScroll()
									return m, tea.Batch(append(cmds, m.reposSpinner.Tick, loadProjectRepos(*m.selectedProject.Name, m.config))...)
								}
							}
						}
					} else if m.focusedPanel == 1 {
						if repo, ok := selected.(git.GitRepository); ok {
							for i, r := range m.repos {
								if r.Id != nil && repo.Id != nil && *r.Id == *repo.Id {
									m.cursor = i
									m.selectedRepo = &m.repos[i]
									m.showRepoOptions = true
									m.cursor = 0
									m.updateScroll()
									return m, tea.Batch(cmds...)
								}
							}
						}
					}
				}
				return m, tea.Batch(cmds...)
			case "backspace":
				if len(m.searchQuery) > 0 {
					m.searchQuery = m.searchQuery[:len(m.searchQuery)-1]
					m.filterItems()
					m.cursor = 0
				}
				return m, tea.Batch(cmds...)
			case "up", "k":
				if m.cursor > 0 {
					m.cursor--
				}
				return m, tea.Batch(cmds...)
			case "down", "j":
				if m.cursor < len(m.filteredItems)-1 {
					m.cursor++
				}
				return m, tea.Batch(cmds...)
			default:
				if len(msg.Runes) > 0 {
					m.searchQuery += string(msg.Runes)
					m.filterItems()
					m.cursor = 0
				}
				return m, tea.Batch(cmds...)
			}
		}

		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "r":
			if m.showRunDetails {
				return m, tea.Batch(append(cmds, func() tea.Msg { return refreshMsg{} })...)
			}
		case "/":
			if !m.showRepoOptions {
				m.searchMode = true
				m.searchQuery = ""
				m.originalCursor = m.cursor
				m.cursor = 0
				m.filterItems()
				return m, tea.Batch(cmds...)
			}
		case "escape", "esc", "backspace":
			if m.showRunDetails {
				m.showRunDetails = false
				m.showRuns = true
				m.autoRefresh = false
				m.autoSelected = false
				// Find the cursor position for the selected run
				foundRun := false
				for i, run := range m.runs {
					if m.selectedRun != nil && run.Id != nil && m.selectedRun.Id != nil && *run.Id == *m.selectedRun.Id {
						m.cursor = i
						foundRun = true
						break
					}
				}
				if !foundRun {
					m.cursor = 0
				}
				m.updateScroll()
				return m, tea.Batch(cmds...)
			} else if m.showRuns {
				m.showRuns = false
				m.showPipelines = true
				m.focusedPanel = 2
				// Find the cursor position for the selected pipeline
				foundPipeline := false
				for i, pipeline := range m.pipelines {
					if m.selectedPipeline != nil && pipeline.Id != nil && m.selectedPipeline.Id != nil && *pipeline.Id == *m.selectedPipeline.Id {
						m.cursor = i
						foundPipeline = true
						break
					}
				}
				if !foundPipeline {
					m.cursor = 0
				}
				m.updateScroll()
				return m, tea.Batch(cmds...)
			} else if m.showPipelines {
				m.showPipelines = false
				m.showRepoOptions = true
				m.cursor = 0 // Reset to "Pipelines" option
				return m, tea.Batch(cmds...)
			} else if m.showRepoOptions {
				m.showRepoOptions = false
				m.focusedPanel = 1
				// Find the cursor position for the selected repo
				foundRepo := false
				for i, repo := range m.repos {
					if m.selectedRepo != nil && repo.Id != nil && m.selectedRepo.Id != nil && *repo.Id == *m.selectedRepo.Id {
						m.cursor = i
						foundRepo = true
						break
					}
				}
				if !foundRepo {
					m.cursor = 0
				}
				m.updateScroll()
				return m, tea.Batch(cmds...)
			}
		case "up", "k":
			if !m.searchMode {
				if m.cursor > 0 {
					m.cursor--
					m.updateScroll()
				}
			}
		case "down", "j":
			if !m.searchMode {
				if !m.showRepoOptions && !m.showPipelines && !m.showRuns && !m.showRunDetails {
					if m.focusedPanel == 0 && m.cursor < len(m.projects)-1 {
						m.cursor++
						m.updateScroll()
					} else if m.focusedPanel == 1 && m.cursor < len(m.repos)-1 {
						m.cursor++
						m.updateScroll()
					}
				} else if m.showRepoOptions && m.cursor < len(m.repoOptions)-1 {
					m.cursor++
				} else if m.showPipelines && m.cursor < len(m.pipelines)-1 {
					m.cursor++
					m.updateScroll()
				} else if m.showRuns && m.cursor < len(m.runs)-1 {
					m.cursor++
					m.updateScroll()
				} else if m.showRunDetails && m.timeline != nil && m.timeline.Records != nil && m.cursor < len(*m.timeline.Records)-1 {
					m.cursor++
					m.updateScroll()
				}
			}
		case "left", "h":
			if !m.searchMode {
				if m.showRunDetails {
					m.showRunDetails = false
					m.showRuns = true
					m.autoRefresh = false
					// Find the cursor position for the selected run
					foundRun := false
					for i, run := range m.runs {
						if m.selectedRun != nil && run.Id != nil && m.selectedRun.Id != nil && *run.Id == *m.selectedRun.Id {
							m.cursor = i
							foundRun = true
							break
						}
					}
					if !foundRun {
						m.cursor = 0
					}
					m.updateScroll()
					return m, tea.Batch(cmds...)
				} else if m.showRuns {
					m.showRuns = false
					m.showPipelines = true
					m.focusedPanel = 2
					// Find the cursor position for the selected pipeline
					foundPipeline := false
					for i, pipeline := range m.pipelines {
						if m.selectedPipeline != nil && pipeline.Id != nil && m.selectedPipeline.Id != nil && *pipeline.Id == *m.selectedPipeline.Id {
							m.cursor = i
							foundPipeline = true
							break
						}
					}
					if !foundPipeline {
						m.cursor = 0
					}
					m.updateScroll()
					return m, tea.Batch(cmds...)
				} else if m.showPipelines {
					m.showPipelines = false
					m.showRepoOptions = true
					m.cursor = 0 // Reset to "Pipelines" option
					return m, tea.Batch(cmds...)
				} else if !m.showRepoOptions {
					m.focusedPanel = 0
					m.cursor = 0
				} else {
					// Also allow left arrow to go back from repo options
					m.showRepoOptions = false
					m.focusedPanel = 1
					// Find the cursor position for the selected repo
					foundRepo := false
					for i, repo := range m.repos {
						if m.selectedRepo != nil && repo.Id != nil && m.selectedRepo.Id != nil && *repo.Id == *m.selectedRepo.Id {
							m.cursor = i
							foundRepo = true
							break
						}
					}
					if !foundRepo {
						m.cursor = 0
					}
					m.updateScroll()
					return m, tea.Batch(cmds...)
				}
			}
		case "right", "l":
			if !m.searchMode && !m.showRepoOptions && !m.showPipelines && !m.showRuns {
				m.focusedPanel = 1
				m.cursor = 0
			}
		case "enter":
			if !m.searchMode {
				if m.showRunDetails {
					// Handle step selection if needed
					return m, tea.Batch(cmds...)
				} else if m.showRuns && m.cursor < len(m.runs) {
					m.selectedRun = &m.runs[m.cursor]
					m.showRuns = false
					m.showRunDetails = true
					m.loadingTimeline = true
					m.timeline = nil
					m.cursor = 0
					m.autoSelected = false // This is a manual selection

					// Start auto-refresh for running builds
					if m.selectedRun.State != nil && (*m.selectedRun.State == "inProgress" || *m.selectedRun.State == "notStarted") {
						m.autoRefresh = true
					}

					if m.selectedProject != nil && m.selectedRun.Id != nil {
						cmds = append(cmds, m.timelineSpinner.Tick, loadRunTimeline(*m.selectedProject.Name, *m.selectedRun.Id, m.config))
						if m.autoRefresh {
							cmds = append(cmds, tick())
						}
						return m, tea.Batch(cmds...)
					}
					return m, tea.Batch(cmds...)
				} else if m.showPipelines && m.cursor < len(m.pipelines) {
					m.selectedPipeline = &m.pipelines[m.cursor]
					m.showPipelines = false
					m.showRuns = true
					m.loadingRuns = true
					m.runs = []pipeline.Run{}
					m.cursor = 0
					if m.selectedProject != nil && m.selectedPipeline.Id != nil {
						return m, tea.Batch(append(cmds, m.runsSpinner.Tick, loadPipelineRuns(*m.selectedProject.Name, *m.selectedPipeline.Id, m.config))...)
					}
					return m, tea.Batch(cmds...)
				} else if m.showRepoOptions {
					if m.cursor == 0 { // "Pipelines" option
						m.showRepoOptions = false
						m.showPipelines = true
						m.focusedPanel = 2
						m.loadingPipelines = true
						m.pipelines = []pipeline.Pipeline{}
						m.cursor = 0
						if m.selectedProject != nil && m.selectedRepo != nil {
							return m, tea.Batch(append(cmds, m.pipelinesSpinner.Tick, loadRepoPipelines(*m.selectedProject.Name, *m.selectedRepo.Name, m.config))...)
						}
					}
					return m, tea.Batch(cmds...)
				} else if m.focusedPanel == 0 && m.cursor < len(m.projects) {
					m.selectedProject = &m.projects[m.cursor]
					m.loadingRepos = true
					m.repos = []git.GitRepository{}
					return m, tea.Batch(append(cmds, m.reposSpinner.Tick, loadProjectRepos(*m.selectedProject.Name, m.config))...)
				} else if m.focusedPanel == 1 && m.cursor < len(m.repos) {
					m.selectedRepo = &m.repos[m.cursor]
					m.showRepoOptions = true
					m.cursor = 0
					return m, tea.Batch(cmds...)
				}
			}
		case "tab":
			if !m.searchMode && !m.showRepoOptions {
				if m.focusedPanel == 0 {
					m.focusedPanel = 1
				} else {
					m.focusedPanel = 0
				}
				m.cursor = 0
			}
		}
	}
	return m, tea.Batch(cmds...)
}

func (m *model) updateScroll() {
	boxHeight := (m.height - 8) / 2
	visibleLines := boxHeight - 4

	if m.focusedPanel == 0 {
		if m.cursor < m.projectsScroll {
			m.projectsScroll = m.cursor
		} else if m.cursor >= m.projectsScroll+visibleLines {
			m.projectsScroll = m.cursor - visibleLines + 1
		}
	} else if m.focusedPanel == 1 {
		if m.cursor < m.reposScroll {
			m.reposScroll = m.cursor
		} else if m.cursor >= m.reposScroll+visibleLines {
			m.reposScroll = m.cursor - visibleLines + 1
		}
	} else if m.focusedPanel == 2 || m.showPipelines {
		if m.cursor < m.pipelinesScroll {
			m.pipelinesScroll = m.cursor
		} else if m.cursor >= m.pipelinesScroll+visibleLines {
			m.pipelinesScroll = m.cursor - visibleLines + 1
		}
	} else if m.showRuns {
		if m.cursor < m.runsScroll {
			m.runsScroll = m.cursor
		} else if m.cursor >= m.runsScroll+visibleLines {
			m.runsScroll = m.cursor - visibleLines + 1
		}
	} else if m.showRunDetails {
		if m.cursor < m.timelineScroll {
			m.timelineScroll = m.cursor
		} else if m.cursor >= m.timelineScroll+visibleLines {
			m.timelineScroll = m.cursor - visibleLines + 1
		}
	}
}

func (m model) renderLoadingAnimation(visibleLines int, message string, spinner spinner.Model) string {
	var content strings.Builder

	content.WriteString(fmt.Sprintf("  %s %s\n", spinner.View(), message))

	// Fill remaining space
	for i := 1; i < visibleLines; i++ {
		content.WriteString("\n")
	}

	return content.String()
}

func (m *model) filterItems() {
	m.filteredItems = nil

	if m.searchQuery == "" {
		if m.focusedPanel == 0 {
			for _, project := range m.projects {
				m.filteredItems = append(m.filteredItems, project)
			}
		} else if m.focusedPanel == 1 {
			for _, repo := range m.repos {
				m.filteredItems = append(m.filteredItems, repo)
			}
		}
		return
	}

	query := strings.ToLower(m.searchQuery)

	if m.focusedPanel == 0 {
		for _, project := range m.projects {
			if project.Name != nil && strings.Contains(strings.ToLower(*project.Name), query) {
				m.filteredItems = append(m.filteredItems, project)
			}
		}
	} else if m.focusedPanel == 1 {
		for _, repo := range m.repos {
			if repo.Name != nil && strings.Contains(strings.ToLower(*repo.Name), query) {
				m.filteredItems = append(m.filteredItems, repo)
			}
		}
	}
}

func (m model) View() string {
	// Show config modal if needed
	if m.showConfigModal {
		return m.configModal.View()
	}

	// Calculate responsive layout with proper margins
	instructionHeight := 2 // Reduced space for instructions
	searchHeight := 3      // Always reserve space for search bar
	totalAvailableHeight := m.height - instructionHeight - searchHeight

	// Ensure we have enough space to work with
	if totalAvailableHeight < 10 {
		totalAvailableHeight = 10
	}
	if m.width < 40 {
		// For very small terminals, just return a simple message
		return "Terminal too small. Please resize."
	}

	// Calculate exact dimensions - left takes half, right takes half
	leftWidth := m.width / 2
	rightWidth := m.width - leftWidth
	leftBoxHeight := totalAvailableHeight / 2 // Each left box gets exactly half
	rightBoxHeight := totalAvailableHeight    // Right panel takes full height

	// Ensure minimum dimensions
	if leftWidth < 20 {
		leftWidth = 20
		rightWidth = m.width - leftWidth
	}
	if rightWidth < 20 {
		rightWidth = 20
		leftWidth = m.width - rightWidth
	}
	if leftBoxHeight < 3 {
		leftBoxHeight = 3
	}
	if rightBoxHeight < 6 {
		rightBoxHeight = 6
	}

	// Calculate content area (subtract borders and padding)
	leftContentWidth := leftWidth - 4
	rightContentWidth := rightWidth - 4
	leftContentHeight := leftBoxHeight - 4
	rightContentHeight := rightBoxHeight - 4 // Right panel content height

	// Ensure content area is not negative and has reasonable minimums
	if leftContentWidth < 5 {
		leftContentWidth = 5
	}
	if rightContentWidth < 5 {
		rightContentWidth = 5
	}
	if leftContentHeight < 1 {
		leftContentHeight = 1
	}
	if rightContentHeight < 1 {
		rightContentHeight = 1
	}

	projectsContent := m.renderProjects(leftContentHeight - 1)
	reposContent := m.renderRepos(leftContentHeight - 1)

	// Create dynamic styles based on focus
	projectsStyle := baseBoxStyle.Copy()
	reposStyle := baseBoxStyle.Copy()

	if m.focusedPanel == 0 && !m.showRepoOptions {
		projectsStyle = projectsStyle.BorderForeground(lipgloss.Color("12")) // Blue highlight
	} else {
		projectsStyle = projectsStyle.BorderForeground(lipgloss.Color("240")) // Gray
	}

	if (m.focusedPanel == 1 && !m.showRepoOptions) || m.showRepoOptions {
		reposStyle = reposStyle.BorderForeground(lipgloss.Color("12")) // Blue highlight
	} else {
		reposStyle = reposStyle.BorderForeground(lipgloss.Color("240")) // Gray
	}

	// Create titles with border styling
	projectsTitle := "┤ Projects ├"
	reposTitle := "┤ Repositories ├"
	if m.showRepoOptions {
		reposTitle = "┤ Repository Options ├"
	}
	if m.selectedProject != nil && m.selectedProject.Name != nil {
		reposTitle = "┤ " + *m.selectedProject.Name + " ├"
	}

	// Create boxes with titles embedded in content
	projectsBox := projectsStyle.
		Width(leftContentWidth).
		Height(leftContentHeight).
		Render(projectsTitle + "\n" + projectsContent)

	reposBox := reposStyle.
		Width(leftContentWidth).
		Height(leftContentHeight).
		Render(reposTitle + "\n" + reposContent)

	// Create right panel content
	var rightPanelContent string
	var rightPanelTitle string

	if m.showRunDetails {
		rightPanelTitle = "┤ Run Details ├"
		if m.selectedRun != nil && m.selectedRun.Name != nil {
			rightPanelTitle = "┤ " + *m.selectedRun.Name + " ├"
		}
		rightPanelContent = m.renderRunDetails(rightContentHeight - 1)
	} else if m.showRuns {
		rightPanelTitle = "┤ Pipeline Runs ├"
		if m.selectedPipeline != nil && m.selectedPipeline.Name != nil {
			rightPanelTitle = "┤ " + *m.selectedPipeline.Name + " Runs ├"
		}
		rightPanelContent = m.renderRuns(rightContentHeight - 1)
	} else if m.showPipelines {
		rightPanelTitle = "┤ Build Pipelines ├"
		if m.selectedRepo != nil && m.selectedRepo.Name != nil {
			rightPanelTitle = "┤ " + *m.selectedRepo.Name + " Pipelines ├"
		}
		rightPanelContent = m.renderPipelines(rightContentHeight - 1)
	} else {
		// Show logo
		rightPanelTitle = ""
		rightPanelLogoText := `   ▄████████  ▄███████▄      ███     ███    █▄   ▄█ 
  ███    ███ ██▀     ▄██ ▀█████████▄ ███    ███ ███ 
  ███    ███       ▄███▀    ▀███▀▀██ ███    ███ ███▌
  ███    ███  ▀█▀▄███▀▄▄     ███   ▀ ███    ███ ███▌
▀███████████   ▄███▀   ▀     ███     ███    ███ ███▌
  ███    ███ ▄███▀           ███     ███    ███ ███ 
  ███    ███ ███▄     ▄█     ███     ███    ███ ███ 
  ███    █▀   ▀████████▀    ▄████▀   ████████▀  █▀`

		rightPanelLogoStyle := lipgloss.NewStyle().
			Foreground(lipgloss.Color("12")).
			Bold(true).
			Align(lipgloss.Center)

		// Fill the content to match the expected height
		logoLines := strings.Split(rightPanelLogoText, "\n")
		var paddedContent strings.Builder
		paddedContent.WriteString(rightPanelLogoStyle.Render(rightPanelLogoText))

		// Add empty lines to fill remaining space
		usedLines := len(logoLines)
		availableLines := rightContentHeight - 1 // -1 for title
		for i := usedLines; i < availableLines; i++ {
			paddedContent.WriteString("\n")
		}

		rightPanelContent = paddedContent.String()
	}

	// Update right panel style based on focus
	rightStyle := rightPanelStyle.Copy()
	if m.showPipelines || m.showRuns || m.showRunDetails {
		rightStyle = rightStyle.BorderForeground(lipgloss.Color("12"))
	} else {
		rightStyle = rightStyle.BorderForeground(lipgloss.Color("240"))
	}

	rightPanel := rightStyle.
		Width(rightContentWidth).
		Height(rightContentHeight).
		Render(rightPanelTitle + "\n" + rightPanelContent)

	// Create search bar at the top (always reserve space)
	var searchBar string
	if m.searchMode {
		searchQuery := m.searchQuery
		if searchQuery == "" {
			searchQuery = "Type to search..."
		}
		searchBar = searchStyle.
			Width(m.width - 4).
			Render("🔍 Search: " + searchQuery)
	} else {
		// Empty space to maintain layout consistency
		searchBar = lipgloss.NewStyle().
			Width(m.width - 4).
			Height(1).
			Render("")
	}

	// Create left column by stacking projects and repos vertically
	leftColumn := lipgloss.JoinVertical(lipgloss.Top, projectsBox, reposBox)

	// Create main layout - no margins between panels
	content := lipgloss.JoinHorizontal(lipgloss.Top, leftColumn, rightPanel)

	// Simple instructions at bottom
	instructions := m.getInstructions()
	instructionsStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("240")).
		Align(lipgloss.Center)

	return lipgloss.JoinVertical(lipgloss.Top,
		searchBar,
		content,
		instructionsStyle.Render(instructions),
	)
}

func (m model) renderProjects(visibleLines int) string {
	// Show loading animation if projects are loading
	if m.loadingProjects {
		return m.renderLoadingAnimation(visibleLines, "Loading projects", m.projectsSpinner)
	}

	var content strings.Builder
	linesUsed := 0

	// Calculate content width for full-width highlighting
	contentWidth := m.width/2 - 6 // Account for borders, padding, and margin

	if m.searchMode && m.focusedPanel == 0 {
		// Show filtered results
		for i, item := range m.filteredItems {
			if linesUsed >= visibleLines {
				break
			}

			if project, ok := item.(core.TeamProjectReference); ok {
				projectName := ""
				if project.Name != nil {
					projectName = *project.Name
				}

				// Truncate if too long
				maxLen := contentWidth - 4
				if maxLen < 1 {
					maxLen = 1
				}
				if len(projectName) > maxLen {
					projectName = projectName[:maxLen-3] + "..."
				}

				line := fmt.Sprintf("  %s", projectName)

				if m.cursor == i {
					// Create full-width highlight
					paddedLine := fmt.Sprintf("%-*s", contentWidth, line)
					line = fullWidthHighlightStyle.Render(paddedLine)
				}

				content.WriteString(line + "\n")
				linesUsed++
			}
		}
	} else {
		// Normal mode - show all projects
		start := m.projectsScroll
		end := start + visibleLines
		if end > len(m.projects) {
			end = len(m.projects)
		}

		for i := start; i < end; i++ {
			projectName := ""
			if m.projects[i].Name != nil {
				projectName = *m.projects[i].Name
			}

			// Truncate if too long
			maxLen := contentWidth - 4
			if maxLen < 1 {
				maxLen = 1
			}
			if len(projectName) > maxLen {
				projectName = projectName[:maxLen-3] + "..."
			}

			line := fmt.Sprintf("  %s", projectName)

			if m.focusedPanel == 0 && m.cursor == i && !m.showRepoOptions && !m.searchMode {
				// Create full-width highlight
				paddedLine := fmt.Sprintf("%-*s", contentWidth, line)
				line = fullWidthHighlightStyle.Render(paddedLine)
			}

			content.WriteString(line + "\n")
			linesUsed++
		}
	}

	// Fill remaining space with empty lines to maintain fixed height
	for linesUsed < visibleLines {
		content.WriteString("\n")
		linesUsed++
	}

	return content.String()
}

func (m model) renderRepos(visibleLines int) string {
	// Show loading animation if repos are loading
	if m.loadingRepos {
		return m.renderLoadingAnimation(visibleLines, "Loading repositories", m.reposSpinner)
	}

	var content strings.Builder
	linesUsed := 0

	// Calculate content width for full-width highlighting
	contentWidth := m.width/2 - 6 // Account for borders, padding, and margin

	if m.showRepoOptions {
		// Show repository options
		if m.selectedRepo != nil && m.selectedRepo.Name != nil {
			content.WriteString("Selected: " + *m.selectedRepo.Name + "\n\n")
			linesUsed += 2
		}

		for i, option := range m.repoOptions {
			line := fmt.Sprintf("  %s", option.name)

			if m.cursor == i {
				// Create full-width highlight
				paddedLine := fmt.Sprintf("%-*s", contentWidth, line)
				line = fullWidthHighlightStyle.Render(paddedLine)
			}

			content.WriteString(line + "\n")
			linesUsed++
		}
	} else if m.searchMode && m.focusedPanel == 1 {
		// Show filtered results
		for i, item := range m.filteredItems {
			if linesUsed >= visibleLines {
				break
			}

			if repo, ok := item.(git.GitRepository); ok {
				repoName := ""
				if repo.Name != nil {
					repoName = *repo.Name
				}

				// Truncate if too long
				maxLen := contentWidth - 4
				if maxLen < 1 {
					maxLen = 1
				}
				if len(repoName) > maxLen {
					repoName = repoName[:maxLen-3] + "..."
				}

				line := fmt.Sprintf("  %s", repoName)

				if m.cursor == i {
					// Create full-width highlight
					paddedLine := fmt.Sprintf("%-*s", contentWidth, line)
					line = fullWidthHighlightStyle.Render(paddedLine)
				}

				content.WriteString(line + "\n")
				linesUsed++
			}
		}
	} else {
		// Show repositories list
		start := m.reposScroll
		end := start + visibleLines
		if end > len(m.repos) {
			end = len(m.repos)
		}

		for i := start; i < end; i++ {
			repoName := *m.repos[i].Name

			// Truncate if too long
			maxLen := contentWidth - 4
			if maxLen < 1 {
				maxLen = 1
			}
			if len(repoName) > maxLen {
				repoName = repoName[:maxLen-3] + "..."
			}

			line := fmt.Sprintf("  %s", repoName)

			if m.focusedPanel == 1 && m.cursor == i && !m.showRepoOptions && !m.searchMode {
				// Create full-width highlight
				paddedLine := fmt.Sprintf("%-*s", contentWidth, line)
				line = fullWidthHighlightStyle.Render(paddedLine)
			}

			content.WriteString(line + "\n")
			linesUsed++
		}
	}

	// Fill remaining space with empty lines to maintain fixed height
	for linesUsed < visibleLines {
		content.WriteString("\n")
		linesUsed++
	}

	return content.String()
}

func (m model) renderPipelines(visibleLines int) string {
	// Show loading animation if pipelines are loading
	if m.loadingPipelines {
		return m.renderLoadingAnimation(visibleLines, "Loading pipelines", m.pipelinesSpinner)
	}

	var content strings.Builder
	linesUsed := 0

	// Calculate content width for full-width highlighting
	rightWidth := m.width - m.width/2
	contentWidth := rightWidth - 6 // Account for borders, padding, and margin

	// Show pipelines list
	start := m.pipelinesScroll
	end := start + visibleLines
	if end > len(m.pipelines) {
		end = len(m.pipelines)
	}

	for i := start; i < end; i++ {
		pipelineName := ""
		if m.pipelines[i].Name != nil {
			pipelineName = *m.pipelines[i].Name
		}

		// Truncate if too long
		maxLen := contentWidth - 4
		if maxLen < 1 {
			maxLen = 1
		}
		if len(pipelineName) > maxLen {
			pipelineName = pipelineName[:maxLen-3] + "..."
		}

		line := fmt.Sprintf("  %s", pipelineName)

		if m.cursor == i {
			// Create full-width highlight
			paddedLine := fmt.Sprintf("%-*s", contentWidth, line)
			line = fullWidthHighlightStyle.Render(paddedLine)
		}

		content.WriteString(line + "\n")
		linesUsed++
	}

	// Fill remaining space with empty lines to maintain fixed height
	for linesUsed < visibleLines {
		content.WriteString("\n")
		linesUsed++
	}

	return content.String()
}

func (m model) renderRuns(visibleLines int) string {
	// Show loading animation if runs are loading
	if m.loadingRuns {
		return m.renderLoadingAnimation(visibleLines, "Loading runs", m.runsSpinner)
	}

	var content strings.Builder
	linesUsed := 0

	// Calculate content width for full-width highlighting
	rightWidth := m.width - m.width/2
	contentWidth := rightWidth - 6 // Account for borders, padding, and margin

	// Show runs list
	start := m.runsScroll
	end := start + visibleLines
	if end > len(m.runs) {
		end = len(m.runs)
	}

	for i := start; i < end; i++ {
		runDisplay := ""
		if m.runs[i].Name != nil {
			runDisplay = *m.runs[i].Name
		} else if m.runs[i].Id != nil {
			runDisplay = fmt.Sprintf("Run #%d", *m.runs[i].Id)
		}

		// Add status if available
		if m.runs[i].State != nil {
			runDisplay = fmt.Sprintf("%s (%s)", runDisplay, string(*m.runs[i].State))
		}

		// Truncate if too long
		maxLen := contentWidth - 4
		if maxLen < 1 {
			maxLen = 1
		}
		if len(runDisplay) > maxLen {
			runDisplay = runDisplay[:maxLen-3] + "..."
		}

		line := fmt.Sprintf("  %s", runDisplay)

		if m.cursor == i {
			// Create full-width highlight
			paddedLine := fmt.Sprintf("%-*s", contentWidth, line)
			line = fullWidthHighlightStyle.Render(paddedLine)
		}

		content.WriteString(line + "\n")
		linesUsed++
	}

	// Fill remaining space with empty lines to maintain fixed height
	for linesUsed < visibleLines {
		content.WriteString("\n")
		linesUsed++
	}

	return content.String()
}

func (m model) renderRunDetails(visibleLines int) string {
	// Show loading animation if timeline is loading
	if m.loadingTimeline {
		return m.renderLoadingAnimation(visibleLines, "Loading timeline", m.timelineSpinner)
	}

	var content strings.Builder
	linesUsed := 0

	// Calculate content width for full-width highlighting
	rightWidth := m.width - m.width/2
	contentWidth := rightWidth - 6 // Account for borders, padding, and margin

	if m.timeline == nil || m.timeline.Records == nil {
		content.WriteString("  No timeline data available\n")
		linesUsed++
	} else {
		// Show run status and auto-selection info
		if m.autoSelected {
			content.WriteString("  🚀 Auto-selected in-progress run\n")
			linesUsed++
		}

		// Show refresh info
		if m.autoRefresh {
			refreshTime := "Never"
			if !m.lastRefresh.IsZero() {
				refreshTime = m.lastRefresh.Format("15:04:05")
			}
			content.WriteString(fmt.Sprintf("  🔄 Auto-refresh enabled (Last: %s)\n", refreshTime))
			linesUsed++
		}
		content.WriteString("  Press 'r' to refresh manually, Esc to go back\n\n")
		linesUsed += 2

		// Show timeline records (steps)
		records := *m.timeline.Records
		start := m.timelineScroll
		end := start + visibleLines - linesUsed
		if end > len(records) {
			end = len(records)
		}

		for i := start; i < end; i++ {
			record := records[i]

			// Format step display
			stepName := "Unknown Step"
			if record.Name != nil {
				stepName = *record.Name
			}

			status := "Unknown"
			statusColor := lipgloss.Color("240") // Gray
			if record.State != nil {
				status = string(*record.State)
				switch *record.State {
				case "completed":
					if record.Result != nil && *record.Result == "succeeded" {
						statusColor = lipgloss.Color("2") // Green
						status = "✓ Succeeded"
					} else {
						statusColor = lipgloss.Color("1") // Red
						status = "✗ Failed"
					}
				case "inProgress":
					statusColor = lipgloss.Color("3") // Yellow
					status = "⏳ Running"
				case "pending":
					statusColor = lipgloss.Color("240") // Gray
					status = "⏸ Pending"
				}
			}

			// Truncate step name if too long
			maxStepLen := contentWidth - 20 // Leave space for status
			if maxStepLen < 10 {
				maxStepLen = 10
			}
			if len(stepName) > maxStepLen {
				stepName = stepName[:maxStepLen-3] + "..."
			}

			line := fmt.Sprintf("  %-*s %s", maxStepLen, stepName, status)

			// Apply color to status
			statusStyle := lipgloss.NewStyle().Foreground(statusColor)
			coloredLine := fmt.Sprintf("  %-*s %s", maxStepLen, stepName, statusStyle.Render(status))

			if m.cursor == i {
				// Create full-width highlight
				paddedLine := fmt.Sprintf("%-*s", contentWidth, line)
				coloredLine = fullWidthHighlightStyle.Render(paddedLine)
			}

			content.WriteString(coloredLine + "\n")
			linesUsed++
		}
	}

	// Fill remaining space with empty lines to maintain fixed height
	for linesUsed < visibleLines {
		content.WriteString("\n")
		linesUsed++
	}

	return content.String()
}

func (m model) getInstructions() string {
	if m.searchMode {
		return "Type to search   •   ↑/↓ Navigate   •   Enter Select   •   Esc Cancel   •   q Quit"
	}
	if m.showRunDetails {
		refreshText := ""
		if m.autoRefresh {
			refreshText = " (Auto-refresh ON)"
		}
		return "↑/↓ Navigate   •   r Refresh" + refreshText + "   •   Esc/← Back   •   q Quit"
	}
	if m.showRuns {
		return "↑/↓ Navigate   •   Enter View Run   •   Esc/← Back   •   q Quit"
	}
	if m.showPipelines {
		return "↑/↓ Navigate   •   Enter View Runs   •   Esc/← Back   •   q Quit"
	}
	if m.showRepoOptions {
		return "↑/↓ Navigate   •   Enter Select   •   Esc/← Back   •   q Quit"
	}
	return "↑/↓ Navigate   •   ←/→ Switch Panels   •   Enter Select   •   / Search   •   Tab Focus   •   q Quit"
}

func main() {
	// Load configuration (don't use EnsureConfig as we want to handle empty values in the modal)
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatal("Error loading configuration:", err)
	}

	repoOptions := []repoOption{
		{name: "Pipelines", desc: "View and manage build/release pipelines"},
		{name: "Pull Requests", desc: "View and manage pull requests"},
		{name: "Release Tags", desc: "View and manage release tags"},
	}

	s1 := spinner.New()
	s1.Spinner = spinner.Dot
	s1.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	s2 := spinner.New()
	s2.Spinner = spinner.Dot
	s2.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	s3 := spinner.New()
	s3.Spinner = spinner.Dot
	s3.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	s4 := spinner.New()
	s4.Spinner = spinner.Dot
	s4.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	s5 := spinner.New()
	s5.Spinner = spinner.Dot
	s5.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	// Check if config is complete, if not show modal
	showModal := !cfg.IsComplete()
	var configModal *config.ConfigModal
	if showModal {
		configModal = config.NewConfigModal(cfg)
	}

	m := model{
		projects:         []core.TeamProjectReference{},
		repos:            []git.GitRepository{},
		pipelines:        []pipeline.Pipeline{},
		runs:             []pipeline.Run{},
		timeline:         nil,
		showRepoOptions:  false,
		showPipelines:    false,
		showRuns:         false,
		showRunDetails:   false,
		focusedPanel:     0,
		width:            80,
		height:           24,
		cursor:           0,
		projectsScroll:   0,
		reposScroll:      0,
		pipelinesScroll:  0,
		runsScroll:       0,
		timelineScroll:   0,
		selectedProject:  nil,
		selectedRepo:     nil,
		selectedPipeline: nil,
		selectedRun:      nil,
		repoOptions:      repoOptions,
		searchMode:       false,
		searchQuery:      "",
		filteredItems:    nil,
		originalCursor:   0,
		loadingProjects:  !showModal, // Only start loading if config is complete
		loadingRepos:     false,
		loadingPipelines: false,
		loadingRuns:      false,
		loadingTimeline:  false,
		autoRefresh:      false,
		autoSelected:     false,
		autoSelectRepo:   nil,
		lastRefresh:      time.Time{},
		projectsSpinner:  s1,
		reposSpinner:     s2,
		pipelinesSpinner: s3,
		runsSpinner:      s4,
		timelineSpinner:  s5,
		config:           cfg,
		configModal:      configModal,
		showConfigModal:  showModal,
	}

	if _, err := tea.NewProgram(m, tea.WithAltScreen()).Run(); err != nil {
		fmt.Println("Error running program:", err)
		os.Exit(1)
	}
}
