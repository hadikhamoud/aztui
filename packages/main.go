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
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/graph"
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

type usersLoadedMsg struct {
	users graph.PagedGraphUsers
}
type model struct {
	table        table.Model
	prs          table.Model
	users        table.Model
	focusedTable int
	width        int
	height       int
}

func (m model) Init() tea.Cmd { return loadUsers() }

func loadPRs(repoId string) tea.Cmd {
	return func() tea.Msg {
		prs := getPRsASMI(repoId)
		return prsLoadedMsg{prs: *prs}
	}
}

func loadUsers() tea.Cmd {
	return func() tea.Msg {
		users := getUsersASMI()
		return usersLoadedMsg{users: *users}
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

		userCol1Width := tableWidth / 4
		userCol2Width := tableWidth / 4
		userCol3Width := tableWidth / 4
		userCol4Width := tableWidth - userCol1Width - userCol2Width - userCol3Width
		m.users.SetColumns([]table.Column{
			{Title: "User", Width: userCol1Width},
			{Title: "Display Name", Width: userCol2Width},
			{Title: "Email", Width: userCol3Width},
			{Title: "User Id", Width: userCol4Width},
		})

		tableHeight := (m.height - 9) / 3
		m.table.SetHeight(tableHeight)
		m.prs.SetHeight(tableHeight)
		m.users.SetHeight(tableHeight)

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
	case usersLoadedMsg:
		if msg.users.GraphUsers != nil {
			rows := make([]table.Row, len(*msg.users.GraphUsers))
			for i, user := range *msg.users.GraphUsers {
				displayName := ""
				if user.DisplayName != nil {
					displayName = *user.DisplayName
				}
				principalName := ""
				if user.PrincipalName != nil {
					principalName = *user.PrincipalName
				}
				mailAddress := ""
				if user.MailAddress != nil {
					mailAddress = *user.MailAddress
				}
				descriptor := ""
				if user.Descriptor != nil {
					descriptor = *user.Descriptor
				}
				rows[i] = table.Row{principalName, displayName, mailAddress, descriptor}
			}
			m.users.SetRows(rows)
		}
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "tab":
			if m.focusedTable == 0 {
				m.table.Blur()
				m.prs.Focus()
				m.focusedTable = 1
			} else if m.focusedTable == 1 {
				m.prs.Blur()
				m.users.Focus()
				m.focusedTable = 2
			} else {
				m.users.Blur()
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
			} else if m.focusedTable == 1 {
				if m.prs.Focused() {
					m.prs.Blur()
				} else {
					m.prs.Focus()
				}
			} else {
				if m.users.Focused() {
					m.users.Blur()
				} else {
					m.users.Focus()
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
	} else if m.focusedTable == 1 {
		m.prs, cmd = m.prs.Update(msg)
	} else {
		m.users, cmd = m.users.Update(msg)
	}
	return m, cmd
}

func (m model) View() string {
	return baseStyle.Render(m.table.View()) + "\n" + baseStyle.Render(m.prs.View()) + "\n" + baseStyle.Render(m.users.View()) + "\n"
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

func getUsersASMI() *graph.PagedGraphUsers {
	organizationUrl := os.Getenv("AZURE_ORG_URL")
	personalAccessToken := os.Getenv("AZURE_PAT")

	connection := azuredevops.NewPatConnection(organizationUrl, personalAccessToken)
	ctx := context.Background()

	Users, err := internal.GetUsers(ctx, connection)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("DEBUG: Retrieved %d users", len(*Users.GraphUsers))
	return Users

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

	usersColumns := []table.Column{
		{Title: "User", Width: 40},
		{Title: "Display Name", Width: 40},
		{Title: "Email", Width: 40},
		{Title: "User Id", Width: 40},
	}

	usersTable := table.New(
		table.WithColumns(usersColumns),
		table.WithRows([]table.Row{}),
		table.WithFocused(false),
		table.WithHeight(7),
	)
	usersTable.SetStyles(s)

	m := model{t, prTable, usersTable, 0, 0, 0}
	if _, err := tea.NewProgram(m, tea.WithAltScreen()).Run(); err != nil {
		fmt.Println("Error running program:", err)
		os.Exit(1)
	}
}
