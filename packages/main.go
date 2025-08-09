package main

import (
	"aztui/packages/internal/api"
	"context"
	"fmt"
	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/joho/godotenv"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/git"
	"log"
	"os"
)

var baseStyle = lipgloss.NewStyle().
	BorderStyle(lipgloss.NormalBorder()).
	BorderForeground(lipgloss.Color("240"))

type repoSelectedMsg struct {
	repoId string
}

type prsLoadedMsg struct {
	prs []git.GitPullRequest
}

type model struct {
	table        table.Model
	prs          table.Model
	focusedTable int
	width        int
	height       int
}

func (m model) Init() tea.Cmd { return nil }

func loadPRs(repoId string) tea.Cmd {
	return func() tea.Msg {
		prs := getPRsASMI(repoId)
		return prsLoadedMsg{prs: *prs}
	}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

		tableWidth := m.width - 4
		col1Width := tableWidth / 3
		col2Width := tableWidth / 3
		col3Width := tableWidth - col1Width - col2Width

		m.table.SetColumns([]table.Column{
			{Title: "Repo", Width: col1Width},
			{Title: "RepoLink", Width: col2Width},
			{Title: "Repo Id", Width: col3Width},
		})

		prCol1Width := tableWidth / 4
		prCol2Width := tableWidth / 4
		prCol3Width := tableWidth / 4
		prCol4Width := tableWidth - prCol1Width - prCol2Width - prCol3Width
		m.prs.SetColumns([]table.Column{
			{Title: "Title", Width: prCol1Width},
			{Title: "Source Branch", Width: prCol2Width},
			{Title: "Target Branch", Width: prCol3Width},
			{Title: "Status", Width: prCol4Width},
		})

		tableHeight := (m.height - 6) / 2
		m.table.SetHeight(tableHeight)
		m.prs.SetHeight(tableHeight)

		return m, nil
	case repoSelectedMsg:
		return m, loadPRs(msg.repoId)
	case prsLoadedMsg:
		rows := make([]table.Row, len(msg.prs))
		for i, pr := range msg.prs {
			rows[i] = table.Row{*pr.Title, *pr.SourceRefName, *pr.TargetRefName, string(*pr.Status)}
		}
		m.prs.SetRows(rows)
		return m, nil
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
				selectedRow := m.table.SelectedRow()
				if len(selectedRow) > 2 {
					repoId := selectedRow[2]
					return m, func() tea.Msg {
						return repoSelectedMsg{repoId: repoId}
					}
				}
			} else {
				return m, tea.Batch(
					tea.Printf("Let's go to %s!", m.prs.SelectedRow()[0]),
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
	organizationUrl := os.Getenv("AZURE_ORG_URL")
	personalAccessToken := os.Getenv("AZURE_PAT")

	connection := azuredevops.NewPatConnection(organizationUrl, personalAccessToken)
	ctx := context.Background()

	ProjectName := "ArabicSocialMediaIndex"

	repos, err := internal.GetRepos(ctx, connection, ProjectName)
	if err != nil {
		log.Fatal(err)
	}
	return repos
}

func getPRsASMI(RepositoryId string) *[]git.GitPullRequest {

	organizationUrl := os.Getenv("AZURE_ORG_URL")
	personalAccessToken := os.Getenv("AZURE_PAT")

	connection := azuredevops.NewPatConnection(organizationUrl, personalAccessToken)
	ctx := context.Background()

	ProjectName := "ArabicSocialMediaIndex"

	Prs, err := internal.GetPRs(ctx, connection, ProjectName, RepositoryId)
	if err != nil {
		log.Fatal(err)
	}
	return Prs
}

func main() {
	err := godotenv.Load("../.env")
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	repos := getReposASMI()

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

	prColumns := []table.Column{
		{Title: "Title", Width: 40},
		{Title: "Source Branch", Width: 30},
		{Title: "Target Branch", Width: 30},
		{Title: "Status", Width: 15},
	}

	prTable := table.New(
		table.WithColumns(prColumns),
		table.WithRows([]table.Row{}),
		table.WithFocused(false),
		table.WithHeight(7),
	)
	prTable.SetStyles(s)

	m := model{t, prTable, 0, 0, 0}
	if _, err := tea.NewProgram(m, tea.WithAltScreen()).Run(); err != nil {
		fmt.Println("Error running program:", err)
		os.Exit(1)
	}
}
