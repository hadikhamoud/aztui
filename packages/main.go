package main

import (
	"aztui/packages/internal/api/projects"
	"aztui/packages/internal/api/repos"
	"context"
	"fmt"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/joho/godotenv"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/core"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/git"
	"log"
	"os"
	"strings"
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

type repoOption struct {
	name string
	desc string
}

type model struct {
	projects        []core.TeamProjectReference
	repos           []git.GitRepository
	showRepoOptions bool
	focusedPanel    int
	width           int
	height          int
	cursor          int
	projectsScroll  int
	reposScroll     int
	selectedProject *core.TeamProjectReference
	selectedRepo    *git.GitRepository
	repoOptions     []repoOption
	searchMode      bool
	searchQuery     string
	filteredItems   []interface{}
	originalCursor  int
	loadingProjects bool
	loadingRepos    bool
	projectsSpinner spinner.Model
	reposSpinner    spinner.Model
}

func (m model) Init() tea.Cmd {
	return tea.Batch(m.projectsSpinner.Tick, loadProjects())
}

func loadProjects() tea.Cmd {
	return func() tea.Msg {
		organizationUrl := os.Getenv("AZURE_ORG_URL")
		personalAccessToken := os.Getenv("AZURE_PAT")

		connection := azuredevops.NewPatConnection(organizationUrl, personalAccessToken)
		ctx := context.Background()

		projectsList, err := projects.GetProjects(ctx, connection)
		if err != nil {
			log.Fatal(err)
		}
		return *projectsList
	}
}

func loadProjectRepos(projectName string) tea.Cmd {
	return func() tea.Msg {
		organizationUrl := os.Getenv("AZURE_ORG_URL")
		personalAccessToken := os.Getenv("AZURE_PAT")

		connection := azuredevops.NewPatConnection(organizationUrl, personalAccessToken)
		ctx := context.Background()

		reposList, err := repos.GetRepos(ctx, connection, projectName)
		if err != nil {
			log.Fatal(err)
		}
		return projectLoadedMsg{repos: *reposList}
	}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	var cmds []tea.Cmd

	// Update spinners
	if m.loadingProjects {
		m.projectsSpinner, cmd = m.projectsSpinner.Update(msg)
		cmds = append(cmds, cmd)
	}
	if m.loadingRepos {
		m.reposSpinner, cmd = m.reposSpinner.Update(msg)
		cmds = append(cmds, cmd)
	}

	switch msg := msg.(type) {
	case []core.TeamProjectReference:
		m.projects = msg
		m.loadingProjects = false
		return m, tea.Batch(cmds...)
	case projectLoadedMsg:
		m.repos = msg.repos
		m.loadingRepos = false
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
									return m, tea.Batch(append(cmds, m.reposSpinner.Tick, loadProjectRepos(*m.selectedProject.Name))...)
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
			if m.showRepoOptions {
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
				if !m.showRepoOptions {
					if m.focusedPanel == 0 && m.cursor < len(m.projects)-1 {
						m.cursor++
						m.updateScroll()
					} else if m.focusedPanel == 1 && m.cursor < len(m.repos)-1 {
						m.cursor++
						m.updateScroll()
					}
				} else if m.showRepoOptions && m.cursor < len(m.repoOptions)-1 {
					m.cursor++
				}
			}
		case "left", "h":
			if !m.searchMode {
				if !m.showRepoOptions {
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
			if !m.searchMode && !m.showRepoOptions {
				m.focusedPanel = 1
				m.cursor = 0
			}
		case "enter":
			if !m.searchMode && !m.showRepoOptions {
				if m.focusedPanel == 0 && m.cursor < len(m.projects) {
					m.selectedProject = &m.projects[m.cursor]
					m.loadingRepos = true
					m.repos = []git.GitRepository{}
					return m, tea.Batch(append(cmds, m.reposSpinner.Tick, loadProjectRepos(*m.selectedProject.Name))...)
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

	// Calculate content area (subtract borders and padding)
	leftContentWidth := leftWidth - 4
	rightContentWidth := rightWidth - 4
	leftContentHeight := leftBoxHeight - 4
	rightContentHeight := (leftContentHeight+4)*2 - 4 // Right panel = total left column height minus borders

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
	if rightContentWidth < 1 {
		rightContentWidth = 1
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

	// Create right panel with logo
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

	rightPanelContent := rightPanelLogoStyle.Render(rightPanelLogoText)
	rightPanel := rightPanelStyle.
		Width(rightContentWidth).
		Height(rightContentHeight).
		Render(rightPanelContent)

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

func (m model) getInstructions() string {
	if m.searchMode {
		return "Type to search   •   ↑/↓ Navigate   •   Enter Select   •   Esc Cancel   •   q Quit"
	}
	if m.showRepoOptions {
		return "↑/↓ Navigate   •   Enter Select   •   Esc/← Back   •   q Quit"
	}
	return "↑/↓ Navigate   •   ←/→ Switch Panels   •   Enter Select   •   / Search   •   Tab Focus   •   q Quit"
}

func main() {
	err := godotenv.Load("../.env")
	if err != nil {
		log.Fatal("Error loading .env file")
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

	m := model{
		projects:        []core.TeamProjectReference{},
		repos:           []git.GitRepository{},
		showRepoOptions: false,
		focusedPanel:    0,
		width:           80,
		height:          24,
		cursor:          0,
		projectsScroll:  0,
		reposScroll:     0,
		selectedProject: nil,
		selectedRepo:    nil,
		repoOptions:     repoOptions,
		searchMode:      false,
		searchQuery:     "",
		filteredItems:   nil,
		originalCursor:  0,
		loadingProjects: true,
		loadingRepos:    false,
		projectsSpinner: s1,
		reposSpinner:    s2,
	}

	if _, err := tea.NewProgram(m, tea.WithAltScreen()).Run(); err != nil {
		fmt.Println("Error running program:", err)
		os.Exit(1)
	}
}
