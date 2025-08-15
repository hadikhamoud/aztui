package main

import (
	"aztui/packages/internal/api/projects"
	"aztui/packages/internal/api/repos"
	"context"
	"fmt"
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

var projectsBoxStyle = lipgloss.NewStyle().
	BorderStyle(lipgloss.RoundedBorder()).
	BorderForeground(lipgloss.Color("240")).
	Padding(1).
	Margin(1)

var reposBoxStyle = lipgloss.NewStyle().
	BorderStyle(lipgloss.RoundedBorder()).
	BorderForeground(lipgloss.Color("240")).
	Padding(1).
	Margin(1)

var rightPanelStyle = lipgloss.NewStyle().
	BorderStyle(lipgloss.RoundedBorder()).
	BorderForeground(lipgloss.Color("240")).
	Padding(1).
	Margin(1)

type projectLoadedMsg struct {
	repos []git.GitRepository
}

type model struct {
	projects        []core.TeamProjectReference
	repos           []git.GitRepository
	focusedPanel    int
	width           int
	height          int
	cursor          int
	projectsScroll  int
	reposScroll     int
	selectedProject *core.TeamProjectReference
}

func (m model) Init() tea.Cmd {
	return loadProjects()
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
	switch msg := msg.(type) {
	case []core.TeamProjectReference:
		m.projects = msg
		return m, nil
	case projectLoadedMsg:
		m.repos = msg.repos
		return m, nil
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
				m.updateScroll()
			}
		case "down", "j":
			if m.focusedPanel == 0 && m.cursor < len(m.projects)-1 {
				m.cursor++
				m.updateScroll()
			} else if m.focusedPanel == 1 && m.cursor < len(m.repos)-1 {
				m.cursor++
				m.updateScroll()
			}
		case "left", "h":
			m.focusedPanel = 0
			m.cursor = 0
		case "right", "l":
			m.focusedPanel = 1
			m.cursor = 0
		case "enter":
			if m.focusedPanel == 0 && m.cursor < len(m.projects) {
				m.selectedProject = &m.projects[m.cursor]
				return m, loadProjectRepos(*m.selectedProject.Name)
			}
		case "tab":
			if m.focusedPanel == 0 {
				m.focusedPanel = 1
			} else {
				m.focusedPanel = 0
			}
			m.cursor = 0
		}
	}
	return m, nil
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

func (m model) View() string {
	leftWidth := m.width / 2
	rightWidth := m.width - leftWidth
	boxHeight := (m.height - 8) / 2

	projectsContent := m.renderProjects(boxHeight - 4)
	reposContent := m.renderRepos(boxHeight - 4)

	projectsTitle := "Projects"
	if m.focusedPanel == 0 {
		projectsTitle = "Projects [FOCUSED]"
	}

	reposTitle := "Repositories"
	if m.focusedPanel == 1 {
		reposTitle = "Repositories [FOCUSED]"
	}
	if m.selectedProject != nil && m.selectedProject.Name != nil {
		reposTitle += " (" + *m.selectedProject.Name + ")"
	}

	projectsBox := projectsBoxStyle.
		Width(leftWidth - 4).
		Height(boxHeight).
		Render(projectsTitle + "\n" + projectsContent)

	reposBox := reposBoxStyle.
		Width(leftWidth - 4).
		Height(boxHeight).
		Render(reposTitle + "\n" + reposContent)

	instructions := "Controls:\n• ↑/↓: Navigate\n• ←/→: Switch panels\n• Enter: Select project\n• Tab: Switch focus\n• q: Quit"
	rightPanel := rightPanelStyle.
		Width(rightWidth - 4).
		Height(m.height - 8).
		Render(instructions)

	leftColumn := lipgloss.JoinVertical(lipgloss.Top, projectsBox, reposBox)

	return lipgloss.JoinHorizontal(lipgloss.Top, leftColumn, rightPanel)
}

func (m model) renderProjects(visibleLines int) string {
	var content strings.Builder
	start := m.projectsScroll
	end := start + visibleLines
	if end > len(m.projects) {
		end = len(m.projects)
	}

	for i := start; i < end; i++ {
		cursor := " "
		if m.focusedPanel == 0 && m.cursor == i {
			cursor = ">"
		}
		projectName := ""
		if m.projects[i].Name != nil {
			projectName = *m.projects[i].Name
		}
		content.WriteString(fmt.Sprintf("%s %s\n", cursor, projectName))
	}
	return content.String()
}

func (m model) renderRepos(visibleLines int) string {
	var content strings.Builder
	start := m.reposScroll
	end := start + visibleLines
	if end > len(m.repos) {
		end = len(m.repos)
	}

	for i := start; i < end; i++ {
		cursor := " "
		if m.focusedPanel == 1 && m.cursor == i {
			cursor = ">"
		}
		content.WriteString(fmt.Sprintf("%s %s\n", cursor, *m.repos[i].Name))
	}
	return content.String()
}

func main() {
	err := godotenv.Load("../.env")
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	m := model{
		projects:        []core.TeamProjectReference{},
		repos:           []git.GitRepository{},
		focusedPanel:    0,
		width:           80,
		height:          24,
		cursor:          0,
		projectsScroll:  0,
		reposScroll:     0,
		selectedProject: nil,
	}

	if _, err := tea.NewProgram(m, tea.WithAltScreen()).Run(); err != nil {
		fmt.Println("Error running program:", err)
		os.Exit(1)
	}
}
