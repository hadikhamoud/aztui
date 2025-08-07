package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/git"
)

var baseStyle = lipgloss.NewStyle().
	BorderStyle(lipgloss.NormalBorder()).
	BorderForeground(lipgloss.Color("240"))

type model struct {
	table        table.Model
	prs          table.Model
	focusedTable int
}

func (m model) Init() tea.Cmd { return nil }

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "tab":
			if m.focusedTable == 0 {
				m.table.Blur()
				m.prs.Focus()
				m.focusedTable = 1
			} else {
				m.prs.Blur()
				m.table.Focus()
				m.focusedTable = 0
			}
		case "esc":
			if m.focusedTable == 0 {
				if m.table.Focused() {
					m.table.Blur()
				} else {
					m.table.Focus()
				}
			} else {
				if m.prs.Focused() {
					m.prs.Blur()
				} else {
					m.prs.Focus()
				}
			}
		case "q", "ctrl+c":
			return m, tea.Quit
		case "enter":
			if m.focusedTable == 0 {
				return m, tea.Batch(
					tea.Printf("Let's go to %s!", m.table.SelectedRow()[1]),
				)
			} else {
				return m, tea.Batch(
					tea.Printf("Let's go to %s!", m.prs.SelectedRow()[1]),
				)
			}
		}
	}

	if m.focusedTable == 0 {
		m.table, cmd = m.table.Update(msg)
	} else {
		m.prs, cmd = m.prs.Update(msg)
	}
	return m, cmd
}

func (m model) View() string {
	return baseStyle.Render(m.table.View()) + "\n" + baseStyle.Render(m.prs.View()) + "\n"
}

func getReposASMI() *[]git.GitRepository {
	organizationUrl := "https://dev.azure.com/AC-DU"
	personalAccessToken := "x"

	connection := azuredevops.NewPatConnection(organizationUrl, personalAccessToken)
	ctx := context.Background()

	ProjectName := "ArabicSocialMediaIndex"

	repos, err := getRepos(ctx, connection, ProjectName)
	if err != nil {
		log.Fatal(err)
	}
	return repos
}

func getPRsASMI() *[]git.GitPullRequest {
	organizationUrl := "https://dev.azure.com/AC-DU"
	personalAccessToken := "x"

	connection := azuredevops.NewPatConnection(organizationUrl, personalAccessToken)
	ctx := context.Background()

	ProjectName := "ArabicSocialMediaIndex"
	RepositoryId := "bf2b66f0-1896-4f0d-9baf-b44896e7663f"

	Prs, err := getPRs(ctx, connection, ProjectName, RepositoryId)
	if err != nil {
		log.Fatal(err)
	}
	return Prs
}

func main() {

	repos := getReposASMI()
	prs := getPRsASMI()

	columns := []table.Column{
		{Title: "Repo", Width: 40},
		{Title: "RepoLink", Width: 40},
		{Title: "Repo Id", Width: 40},
	}

	rows := make([]table.Row, len(*repos))
	for i, repo := range *repos {
		rows[i] = table.Row{*repo.Name, *repo.RemoteUrl, (*repo.Id).String()}
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithRows(rows),
		table.WithFocused(true),
		table.WithHeight(7),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("240")).
		BorderBottom(true).
		Bold(false)
	s.Selected = s.Selected.
		Foreground(lipgloss.Color("229")).
		Background(lipgloss.Color("57")).
		Bold(false)
	t.SetStyles(s)

	columnsPrs := []table.Column{
		{Title: "Repo", Width: 20},
		{Title: "RepoLink", Width: 40},
		{Title: "Repo Id", Width: 40},
	}

	rowsPrs := make([]table.Row, len(*prs))
	for i, pr := range *prs {
		rowsPrs[i] = table.Row{*pr.Title, *pr.SourceRefName, *pr.TargetRefName}
	}

	tt := table.New(
		table.WithColumns(columnsPrs),
		table.WithRows(rowsPrs),
		table.WithFocused(false),
		table.WithHeight(7),
	)
	tt.SetStyles(s)

	m := model{t, tt, 0}
	if _, err := tea.NewProgram(m).Run(); err != nil {
		fmt.Println("Error running program:", err)
		os.Exit(1)
	}
}
