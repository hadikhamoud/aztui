package main

import (
	"aztui/packages/internal/api/identity"
	"aztui/packages/internal/api/pipelines"
	"aztui/packages/internal/api/projects"
	"aztui/packages/internal/api/prs"
	"aztui/packages/internal/api/repos"
	"aztui/packages/internal/autodetect"
	"aztui/packages/internal/config"
	"context"
	"fmt"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/build"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/core"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/git"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/graph"
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

type prsLoadedMsg struct {
	prs []git.GitPullRequest
}

type branchesLoadedMsg struct {
	branches []git.GitRef
}

type usersLoadedMsg struct {
	users []graph.GraphUser
}

type prCreatedMsg struct {
	pr *git.GitPullRequest
}

type prDetailsLoadedMsg struct {
	pr *git.GitPullRequest
}

type prCommentsLoadedMsg struct {
	comments []git.GitPullRequestCommentThread
}

type prActionCompleteMsg struct {
	action  string
	success bool
	message string
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
	prs              []git.GitPullRequest
	branches         []git.GitRef
	users            []graph.GraphUser
	showRepoOptions  bool
	showPipelines    bool
	showRuns         bool
	showRunDetails   bool
	showPRs          bool
	showPRCreate     bool
	focusedPanel     int
	width            int
	height           int
	cursor           int
	projectsScroll   int
	reposScroll      int
	pipelinesScroll  int
	runsScroll       int
	timelineScroll   int
	prsScroll        int
	selectedProject  *core.TeamProjectReference
	selectedRepo     *git.GitRepository
	selectedPipeline *pipeline.Pipeline
	selectedRun      *pipeline.Run
	selectedPR       *git.GitPullRequest
	repoOptions      []repoOption
	searchMode       bool
	searchQuery      string
	filteredItems    []interface{}
	originalCursor   int
	initialLoading   bool
	loadingProjects  bool
	loadingRepos     bool
	loadingPipelines bool
	loadingRuns      bool
	loadingTimeline  bool
	loadingPRs       bool
	loadingBranches  bool
	loadingUsers     bool
	autoRefresh      bool
	autoSelected     bool
	autoSelectRepo   *git.GitRepository
	autoDetectDone   bool
	autoDetectResult *autodetect.AutoDetectResult
	lastRefresh      time.Time
	projectsSpinner  spinner.Model
	reposSpinner     spinner.Model
	pipelinesSpinner spinner.Model
	runsSpinner      spinner.Model
	timelineSpinner  spinner.Model
	prsSpinner       spinner.Model
	config           *config.Config
	configModal      *config.ConfigModal
	showConfigModal  bool
	// PR Creation Modal fields
	prCreateMode      bool
	prTitleInput      textinput.Model
	prDescInput       textinput.Model
	prSourceBranch    *git.GitRef
	prTargetBranch    *git.GitRef
	prReviewers       []graph.GraphUser
	prCreateStep      int
	reviewerSearch    string
	filteredReviewers []graph.GraphUser
	// PR Details fields
	showPRDetails     bool
	prDetails         *git.GitPullRequest
	prComments        []git.GitPullRequestCommentThread
	loadingPRDetails  bool
	loadingPRComments bool
	prDetailsSpinner  spinner.Model
	// PR Review fields
	showPRReview    bool
	prReviewMode    bool
	prReviewAction  string // "approve", "decline", "override"
	prOverrideInput textinput.Model
	prCommentInput  textinput.Model
	prOverrideMode  bool
	prActionMessage string
	prActionTime    time.Time
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

func loadRepoPRs(projectName string, repoID string, cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		connection := azuredevops.NewPatConnection(cfg.AzureOrgURL, cfg.AzurePAT)
		ctx := context.Background()

		prsList, err := prs.GetPRs(ctx, connection, projectName, repoID)
		if err != nil {
			log.Fatal(err)
		}
		return prsLoadedMsg{prs: *prsList}
	}
}

func loadRepoBranches(projectName string, repoID string, cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		connection := azuredevops.NewPatConnection(cfg.AzureOrgURL, cfg.AzurePAT)
		ctx := context.Background()

		branchesList, err := prs.GetBranches(ctx, connection, projectName, repoID)
		if err != nil {
			log.Fatal(err)
		}
		return branchesLoadedMsg{branches: *branchesList}
	}
}

func loadOrgUsers(cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		connection := azuredevops.NewPatConnection(cfg.AzureOrgURL, cfg.AzurePAT)
		ctx := context.Background()

		usersList, err := identity.GetUsers(ctx, connection)
		if err != nil {
			log.Fatal(err)
		}
		if usersList.GraphUsers != nil {
			return usersLoadedMsg{users: *usersList.GraphUsers}
		}
		return usersLoadedMsg{users: []graph.GraphUser{}}
	}
}

func loadLatestBranch(projectName string, repoID string, cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		connection := azuredevops.NewPatConnection(cfg.AzureOrgURL, cfg.AzurePAT)
		ctx := context.Background()

		branch, err := prs.GetLatestBranch(ctx, connection, projectName, repoID)
		if err != nil {
			log.Printf("Error getting latest branch: %v", err)
			return nil
		}

		if branch != nil {
			return branchesLoadedMsg{branches: []git.GitRef{*branch}}
		}

		return nil
	}
}

func loadPRDetails(projectName string, repoID string, prID int, cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		connection := azuredevops.NewPatConnection(cfg.AzureOrgURL, cfg.AzurePAT)
		ctx := context.Background()

		pr, err := prs.GetPRDetails(ctx, connection, projectName, repoID, prID)
		if err != nil {
			log.Printf("Error getting PR details: %v", err)
			return nil
		}

		return prDetailsLoadedMsg{pr: pr}
	}
}

func loadPRComments(projectName string, repoID string, prID int, cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		connection := azuredevops.NewPatConnection(cfg.AzureOrgURL, cfg.AzurePAT)
		ctx := context.Background()

		comments, err := prs.GetPRComments(ctx, connection, projectName, repoID, prID)
		if err != nil {
			log.Printf("Error getting PR comments: %v", err)
			return prCommentsLoadedMsg{comments: []git.GitPullRequestCommentThread{}}
		}

		if comments != nil {
			return prCommentsLoadedMsg{comments: *comments}
		}

		return prCommentsLoadedMsg{comments: []git.GitPullRequestCommentThread{}}
	}
}

func (m model) approvePR(vote int, comment string) tea.Cmd {
	return func() tea.Msg {
		if m.selectedProject == nil || m.selectedRepo == nil || m.selectedPR == nil ||
			m.selectedRepo.Id == nil || m.selectedPR.PullRequestId == nil {
			return prActionCompleteMsg{action: "approve", success: false}
		}

		connection := azuredevops.NewPatConnection(m.config.AzureOrgURL, m.config.AzurePAT)
		ctx := context.Background()

		repoID := m.selectedRepo.Id.String()
		prID := *m.selectedPR.PullRequestId

		err := prs.ApprovePR(ctx, connection, *m.selectedProject.Name, repoID, prID, vote, comment)
		if err != nil {
			log.Printf("Error approving PR: %v", err)
			return prActionCompleteMsg{action: "approve", success: false, message: fmt.Sprintf("Failed to approve PR: %v", err)}
		}

		var actionText string
		if vote == 10 {
			actionText = "Your approval vote submitted successfully"
		} else if vote == -10 {
			actionText = "Your rejection vote submitted successfully"
		} else {
			actionText = "Your vote submitted successfully"
		}
		return prActionCompleteMsg{action: "approve", success: true, message: actionText}
	}
}

func (m model) completePR() tea.Cmd {
	return func() tea.Msg {
		if m.selectedProject == nil || m.selectedRepo == nil || m.selectedPR == nil ||
			m.selectedRepo.Id == nil || m.selectedPR.PullRequestId == nil {
			return prActionCompleteMsg{action: "complete", success: false, message: "Failed to complete PR: missing project, repo, or PR details"}
		}

		connection := azuredevops.NewPatConnection(m.config.AzureOrgURL, m.config.AzurePAT)
		ctx := context.Background()

		repoID := m.selectedRepo.Id.String()
		prID := *m.selectedPR.PullRequestId

		// Set default completion options
		mergeMessage := "Merge pull request #" + fmt.Sprintf("%d", prID)
		deleteSourceBranch := true
		completionOptions := &git.GitPullRequestCompletionOptions{
			MergeCommitMessage: &mergeMessage,
			DeleteSourceBranch: &deleteSourceBranch,
			MergeStrategy:      &git.GitPullRequestMergeStrategyValues.Squash, // Default to squash merge
		}

		_, err := prs.CompletePR(ctx, connection, *m.selectedProject.Name, repoID, prID, completionOptions)
		if err != nil {
			log.Printf("Error completing PR: %v", err)
			return prActionCompleteMsg{action: "complete", success: false, message: fmt.Sprintf("Failed to complete PR: %v", err)}
		}

		return prActionCompleteMsg{action: "complete", success: true, message: "PR completed successfully"}
	}
}

func (m model) overridePR(overrideMessage string) tea.Cmd {
	return func() tea.Msg {
		if m.selectedProject == nil || m.selectedRepo == nil || m.selectedPR == nil ||
			m.selectedRepo.Id == nil || m.selectedPR.PullRequestId == nil {
			return prActionCompleteMsg{action: "override", success: false}
		}

		connection := azuredevops.NewPatConnection(m.config.AzureOrgURL, m.config.AzurePAT)
		ctx := context.Background()

		repoID := m.selectedRepo.Id.String()
		prID := *m.selectedPR.PullRequestId

		// Create completion options with override
		deleteBranch := false
		completionOptions := &git.GitPullRequestCompletionOptions{
			DeleteSourceBranch: &deleteBranch, // Don't delete source branch by default
		}

		// Complete the PR with override
		_, err := prs.CompletePR(ctx, connection, *m.selectedProject.Name, repoID, prID, completionOptions)
		if err != nil {
			log.Printf("Error overriding PR: %v", err)
			return prActionCompleteMsg{action: "override", success: false, message: fmt.Sprintf("Failed to override PR: %v", err)}
		}

		return prActionCompleteMsg{action: "override", success: true, message: "PR completed with override"}
	}
}

func (m model) createPR() tea.Cmd {
	return func() tea.Msg {
		if m.selectedProject == nil || m.selectedRepo == nil || m.selectedRepo.Id == nil ||
			m.prSourceBranch == nil || m.prTargetBranch == nil {
			return nil
		}

		connection := azuredevops.NewPatConnection(m.config.AzureOrgURL, m.config.AzurePAT)
		ctx := context.Background()

		// Create the PR request
		title := m.prTitleInput.Value()
		description := m.prDescInput.Value()
		prRequest := &git.GitPullRequest{
			Title:         &title,
			Description:   &description,
			SourceRefName: m.prSourceBranch.Name,
			TargetRefName: m.prTargetBranch.Name,
		}

		// Add reviewers if any
		if len(m.prReviewers) > 0 {
			var reviewers []git.IdentityRefWithVote
			for _, reviewer := range m.prReviewers {
				if reviewer.Descriptor != nil {
					reviewers = append(reviewers, git.IdentityRefWithVote{
						Id: reviewer.Descriptor,
					})
				}
			}
			prRequest.Reviewers = &reviewers
		}

		repoID := m.selectedRepo.Id.String()
		pr, err := prs.CreatePR(ctx, connection, *m.selectedProject.Name, repoID, prRequest)
		if err != nil {
			log.Printf("Error creating PR: %v", err)
			return nil
		}

		return prCreatedMsg{pr: pr}
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
		// Update text inputs if in PR create mode
		if m.prCreateMode {
			var textCmd tea.Cmd
			m.prTitleInput, textCmd = m.prTitleInput.Update(msg)
			cmds = append(cmds, textCmd)

			m.prDescInput, textCmd = m.prDescInput.Update(msg)
			cmds = append(cmds, textCmd)
		}

		// Update text inputs if in override mode
		if m.prOverrideMode {
			var textCmd tea.Cmd
			m.prOverrideInput, textCmd = m.prOverrideInput.Update(msg)
			cmds = append(cmds, textCmd)
		}

		switch msg := msg.(type) {
		case config.ConfigCompleteMsg:
			// Configuration is complete, switch to main app
			m.config = msg.Config
			m.showConfigModal = false
			m.configModal = nil
			m.initialLoading = true
			m.loadingProjects = true
			m.autoDetectDone = false
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
					m.initialLoading = true
					m.loadingProjects = true
					m.autoDetectDone = false
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
	if m.loadingPRs {
		m.prsSpinner, cmd = m.prsSpinner.Update(msg)
		cmds = append(cmds, cmd)
	}
	if m.loadingPRDetails {
		m.prDetailsSpinner, cmd = m.prDetailsSpinner.Update(msg)
		cmds = append(cmds, cmd)
	}

	switch msg := msg.(type) {
	case []core.TeamProjectReference:
		m.projects = msg
		m.loadingProjects = false

		// Check if we can complete initial loading
		if m.autoDetectDone {
			m.initialLoading = false
		}
		return m, tea.Batch(cmds...)
	case autoDetectCompleteMsg:
		m.autoDetectDone = true
		m.autoDetectResult = msg.result

		// Check if we can complete initial loading
		if !m.loadingProjects {
			m.initialLoading = false
		}

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
					// Instead of showing repo options, directly navigate to pipelines
					m.showPipelines = true
					m.focusedPanel = 2
					m.loadingPipelines = true
					m.pipelines = []pipeline.Pipeline{}
					m.cursor = 0
					m.autoSelectRepo = nil // Clear auto-selection

					if m.selectedProject != nil && m.selectedRepo != nil {
						cmds = append(cmds, m.pipelinesSpinner.Tick, loadRepoPipelines(*m.selectedProject.Name, *m.selectedRepo.Name, m.config))
					}
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
	case prsLoadedMsg:
		m.prs = msg.prs
		m.loadingPRs = false
		return m, tea.Batch(cmds...)
	case branchesLoadedMsg:
		m.branches = msg.branches
		m.loadingBranches = false

		// Set default branches if in PR create mode
		if m.prCreateMode {
			// Set target branch to main/master by default
			for _, branch := range m.branches {
				if branch.Name != nil {
					branchName := *branch.Name
					if branchName == "refs/heads/main" || branchName == "refs/heads/master" {
						m.prTargetBranch = &branch
						break
					}
				}
			}

			// Auto-select the latest non-main branch as source
			if m.prSourceBranch == nil {
				for _, branch := range m.branches {
					if branch.Name != nil {
						branchName := *branch.Name
						if branchName != "refs/heads/main" && branchName != "refs/heads/master" {
							m.prSourceBranch = &branch
							break
						}
					}
				}
			}
		}
		return m, tea.Batch(cmds...)
	case usersLoadedMsg:
		m.users = msg.users
		m.loadingUsers = false

		// Initialize filtered reviewers if in PR create mode
		if m.prCreateMode {
			m.filteredReviewers = m.users
		}
		return m, tea.Batch(cmds...)
	case prCreatedMsg:
		// PR created successfully, refresh the PR list
		if m.selectedProject != nil && m.selectedRepo != nil && m.selectedRepo.Id != nil {
			m.showPRCreate = false
			m.prCreateMode = false
			m.loadingPRs = true
			repoID := m.selectedRepo.Id.String()
			return m, tea.Batch(append(cmds, m.prsSpinner.Tick, loadRepoPRs(*m.selectedProject.Name, repoID, m.config))...)
		}
		return m, tea.Batch(cmds...)
	case prDetailsLoadedMsg:
		m.prDetails = msg.pr
		m.loadingPRDetails = false
		return m, tea.Batch(cmds...)
	case prCommentsLoadedMsg:
		m.prComments = msg.comments
		m.loadingPRComments = false
		return m, tea.Batch(cmds...)
	case prActionCompleteMsg:
		// Store action message and timestamp
		m.prActionMessage = msg.message
		m.prActionTime = time.Now()

		// PR action completed, refresh PR details and list
		if msg.success && m.selectedProject != nil && m.selectedRepo != nil && m.selectedRepo.Id != nil {
			m.showPRReview = false
			m.prReviewMode = false
			m.prOverrideMode = false
			repoID := m.selectedRepo.Id.String()

			// Refresh both PR details and PR list
			if m.selectedPR != nil && m.selectedPR.PullRequestId != nil {
				return m, tea.Batch(append(cmds,
					loadPRDetails(*m.selectedProject.Name, repoID, *m.selectedPR.PullRequestId, m.config),
					loadRepoPRs(*m.selectedProject.Name, repoID, m.config))...)
			}
		}
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
		// Handle character input for reviewer search
		if m.prCreateMode && m.prCreateStep == 4 && !m.searchMode {
			key := msg.String()
			if key == "backspace" {
				if len(m.reviewerSearch) > 0 {
					m.reviewerSearch = m.reviewerSearch[:len(m.reviewerSearch)-1]
					m.filterReviewers()
					m.cursor = 0
				}
				return m, tea.Batch(cmds...)
			} else if len(msg.Runes) > 0 && key != "up" && key != "down" && key != "enter" &&
				key != "tab" && key != "escape" && key != "esc" && key != "q" && key != "ctrl+c" {
				m.reviewerSearch += string(msg.Runes)
				m.filterReviewers()
				m.cursor = 0
				return m, tea.Batch(cmds...)
			}
		}

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
			if m.prOverrideMode {
				// Exit override mode
				m.showPRReview = false
				m.prOverrideMode = false
				return m, tea.Batch(cmds...)
			} else if m.prCreateMode {
				// Exit PR creation mode
				m.showPRCreate = false
				m.prCreateMode = false
				m.prCreateStep = 0
				m.cursor = 0
				return m, tea.Batch(cmds...)
			} else if m.showRunDetails {
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
			} else if m.showPRDetails {
				m.showPRDetails = false
				m.showPRs = true
				// Find the cursor position for the selected PR
				foundPR := false
				for i, pr := range m.prs {
					if m.selectedPR != nil && pr.PullRequestId != nil && m.selectedPR.PullRequestId != nil && *pr.PullRequestId == *m.selectedPR.PullRequestId {
						m.cursor = i
						foundPR = true
						break
					}
				}
				if !foundPR {
					m.cursor = 0
				}
				m.updateScroll()
				return m, tea.Batch(cmds...)
			} else if m.showPRs {
				m.showPRs = false
				m.showRepoOptions = true
				m.cursor = 1 // Reset to "Pull Requests" option
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
			if m.prCreateMode && m.prCreateStep == 4 {
				// Navigate through filtered reviewers
				if m.cursor > 0 {
					m.cursor--
				}
				return m, tea.Batch(cmds...)
			} else if m.prCreateMode && (m.prCreateStep == 2 || m.prCreateStep == 3) {
				// Navigate through branches
				if m.prCreateStep == 2 { // Source branch selection
					currentIndex := -1
					for i, branch := range m.branches {
						if m.prSourceBranch != nil && branch.Name != nil && m.prSourceBranch.Name != nil &&
							*branch.Name == *m.prSourceBranch.Name {
							currentIndex = i
							break
						}
					}
					if currentIndex > 0 {
						m.prSourceBranch = &m.branches[currentIndex-1]
					}
				} else if m.prCreateStep == 3 { // Target branch selection
					currentIndex := -1
					for i, branch := range m.branches {
						if m.prTargetBranch != nil && branch.Name != nil && m.prTargetBranch.Name != nil &&
							*branch.Name == *m.prTargetBranch.Name {
							currentIndex = i
							break
						}
					}
					if currentIndex > 0 {
						m.prTargetBranch = &m.branches[currentIndex-1]
					}
				}
				return m, tea.Batch(cmds...)
			} else if !m.searchMode && !m.prCreateMode {
				if m.cursor > 0 {
					m.cursor--
					m.updateScroll()
				}
			}
		case "down", "j":
			if m.prCreateMode && m.prCreateStep == 4 {
				// Navigate through filtered reviewers
				if m.cursor < len(m.filteredReviewers)-1 {
					m.cursor++
				}
				return m, tea.Batch(cmds...)
			} else if m.prCreateMode && (m.prCreateStep == 2 || m.prCreateStep == 3) {
				// Navigate through branches
				if m.prCreateStep == 2 { // Source branch selection
					currentIndex := -1
					for i, branch := range m.branches {
						if m.prSourceBranch != nil && branch.Name != nil && m.prSourceBranch.Name != nil &&
							*branch.Name == *m.prSourceBranch.Name {
							currentIndex = i
							break
						}
					}
					if currentIndex < len(m.branches)-1 {
						m.prSourceBranch = &m.branches[currentIndex+1]
					}
				} else if m.prCreateStep == 3 { // Target branch selection
					currentIndex := -1
					for i, branch := range m.branches {
						if m.prTargetBranch != nil && branch.Name != nil && m.prTargetBranch.Name != nil &&
							*branch.Name == *m.prTargetBranch.Name {
							currentIndex = i
							break
						}
					}
					if currentIndex < len(m.branches)-1 {
						m.prTargetBranch = &m.branches[currentIndex+1]
					}
				}
				return m, tea.Batch(cmds...)
			} else if !m.searchMode && !m.prCreateMode {
				if !m.showRepoOptions && !m.showPipelines && !m.showRuns && !m.showRunDetails && !m.showPRs {
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
				} else if m.showPRs && m.cursor < len(m.prs)-1 {
					m.cursor++
					m.updateScroll()
				} else if m.showRunDetails && m.timeline != nil && m.timeline.Records != nil && m.cursor < len(*m.timeline.Records)-1 {
					m.cursor++
					m.updateScroll()
				}
			}
		case "left", "h":
			if !m.searchMode && !m.prCreateMode {
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
				} else if m.showPRs {
					m.showPRs = false
					m.showRepoOptions = true
					m.cursor = 1 // Reset to "Pull Requests" option
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
			if !m.searchMode && !m.showRepoOptions && !m.showPipelines && !m.showRuns && !m.showPRs && !m.prCreateMode {
				m.focusedPanel = 1
				m.cursor = 0
			}
		case "enter":
			if m.prOverrideMode {
				// Submit override with message
				if m.prOverrideInput.Value() != "" {
					return m, tea.Batch(append(cmds, m.overridePR(m.prOverrideInput.Value()))...)
				}
				return m, tea.Batch(cmds...)
			} else if m.prCreateMode {
				if m.prCreateStep == 4 && m.cursor < len(m.filteredReviewers) {
					// Add reviewer
					selectedUser := m.filteredReviewers[m.cursor]

					// Check if already added
					alreadyAdded := false
					for _, reviewer := range m.prReviewers {
						if reviewer.Descriptor != nil && selectedUser.Descriptor != nil &&
							*reviewer.Descriptor == *selectedUser.Descriptor {
							alreadyAdded = true
							break
						}
					}

					if !alreadyAdded {
						m.prReviewers = append(m.prReviewers, selectedUser)
					}
					return m, tea.Batch(cmds...)
				} else if m.prTitleInput.Value() != "" && m.prSourceBranch != nil && m.prTargetBranch != nil {
					// Submit PR creation
					return m, tea.Batch(append(cmds, m.createPR())...)
				}
				return m, tea.Batch(cmds...)
			} else if !m.searchMode {
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
				} else if m.showPRs && m.cursor < len(m.prs) {
					// View PR details
					m.selectedPR = &m.prs[m.cursor]
					m.showPRs = false
					m.showPRDetails = true
					m.loadingPRDetails = true
					m.prDetails = nil
					m.cursor = 0

					if m.selectedProject != nil && m.selectedRepo != nil && m.selectedRepo.Id != nil && m.selectedPR.PullRequestId != nil {
						repoID := m.selectedRepo.Id.String()
						return m, tea.Batch(append(cmds,
							m.prDetailsSpinner.Tick,
							loadPRDetails(*m.selectedProject.Name, repoID, *m.selectedPR.PullRequestId, m.config),
							loadPRComments(*m.selectedProject.Name, repoID, *m.selectedPR.PullRequestId, m.config))...)
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
					} else if m.cursor == 1 { // "Pull Requests" option
						m.showRepoOptions = false
						m.showPRs = true
						m.focusedPanel = 2
						m.loadingPRs = true
						m.prs = []git.GitPullRequest{}
						m.cursor = 0
						if m.selectedProject != nil && m.selectedRepo != nil && m.selectedRepo.Id != nil {
							repoID := m.selectedRepo.Id.String()
							return m, tea.Batch(append(cmds, m.prsSpinner.Tick, loadRepoPRs(*m.selectedProject.Name, repoID, m.config))...)
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
			if m.prCreateMode {
				// Navigate between PR form fields
				m.prCreateStep = (m.prCreateStep + 1) % 5 // 0: title, 1: desc, 2: source branch, 3: target branch, 4: reviewers

				// Focus appropriate input
				if m.prCreateStep == 0 {
					m.prTitleInput.Focus()
					m.prDescInput.Blur()
				} else if m.prCreateStep == 1 {
					m.prTitleInput.Blur()
					m.prDescInput.Focus()
				} else {
					m.prTitleInput.Blur()
					m.prDescInput.Blur()
				}
				return m, tea.Batch(cmds...)
			} else if !m.searchMode && !m.showRepoOptions {
				if m.focusedPanel == 0 {
					m.focusedPanel = 1
				} else {
					m.focusedPanel = 0
				}
				m.cursor = 0
			}
		case "n":
			if m.showPRs && !m.prCreateMode {
				// Start PR creation process
				m.showPRCreate = true
				m.prCreateMode = true
				m.prCreateStep = 0
				m.cursor = 0
				m.reviewerSearch = ""

				// Initialize text inputs
				m.prTitleInput = textinput.New()
				m.prTitleInput.Placeholder = "Enter PR title..."
				m.prTitleInput.Focus()
				m.prTitleInput.Width = 50

				m.prDescInput = textinput.New()
				m.prDescInput.Placeholder = "Enter PR description..."
				m.prDescInput.Width = 50

				// Clear previous selections
				m.prReviewers = []graph.GraphUser{}
				m.prSourceBranch = nil
				m.prTargetBranch = nil

				// Load branches and users
				if m.selectedProject != nil && m.selectedRepo != nil && m.selectedRepo.Id != nil {
					repoID := m.selectedRepo.Id.String()
					m.loadingBranches = true
					m.loadingUsers = true
					return m, tea.Batch(append(cmds,
						loadRepoBranches(*m.selectedProject.Name, repoID, m.config),
						loadOrgUsers(m.config))...)
				}
				return m, tea.Batch(cmds...)
			}
		case "x":
			if m.prCreateMode && m.prCreateStep == 4 && len(m.prReviewers) > 0 {
				// Remove the last added reviewer
				if len(m.prReviewers) > 0 {
					m.prReviewers = m.prReviewers[:len(m.prReviewers)-1]
				}
				return m, tea.Batch(cmds...)
			}
		case "a":
			if m.showPRDetails && m.prDetails != nil && m.prDetails.Status != nil &&
				*m.prDetails.Status == git.PullRequestStatusValues.Active {
				// Approve PR
				return m, tea.Batch(append(cmds, m.approvePR(10, "Approved via AZTUI"))...)
			}
		case "d":
			if m.showPRDetails && m.prDetails != nil && m.prDetails.Status != nil &&
				*m.prDetails.Status == git.PullRequestStatusValues.Active {
				// Decline PR
				return m, tea.Batch(append(cmds, m.approvePR(-10, "Declined via AZTUI"))...)
			}
		case "c":
			if m.showPRDetails && m.prDetails != nil && m.prDetails.Status != nil &&
				*m.prDetails.Status == git.PullRequestStatusValues.Active {
				// Complete PR
				return m, tea.Batch(append(cmds, m.completePR())...)
			}
		case "o":
			if m.showPRDetails && m.prDetails != nil && m.prDetails.Status != nil &&
				*m.prDetails.Status == git.PullRequestStatusValues.Active {
				// Start override process
				m.showPRReview = true
				m.prOverrideMode = true
				m.prOverrideInput = textinput.New()
				m.prOverrideInput.Placeholder = "Enter override reason..."
				m.prOverrideInput.Focus()
				m.prOverrideInput.Width = 50
				return m, tea.Batch(cmds...)
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
	} else if m.showPRs {
		if m.cursor < m.prsScroll {
			m.prsScroll = m.cursor
		} else if m.cursor >= m.prsScroll+visibleLines {
			m.prsScroll = m.cursor - visibleLines + 1
		}
	} else if m.showPRDetails {
		// No scrolling needed for PR details view
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

func (m model) renderInitialLoadingScreen() string {
	logoText := `   ▄████████  ▄███████▄      ███     ███    █▄   ▄█ 
   ███    ███ ██▀     ▄██ ▀█████████▄ ███    ███ ███ 
   ███    ███       ▄███▀    ▀███▀▀██ ███    ███ ███▌
   ███    ███  ▀█▀▄███▀▄▄     ███   ▀ ███    ███ ███▌
 ▀███████████   ▄███▀   ▀     ███     ███    ███ ███▌
   ███    ███ ▄███▀           ███     ███    ███ ███ 
   ███    ███ ███▄     ▄█     ███     ███    ███ ███ 
   ███    █▀   ▀████████▀    ▄████▀   ████████▀  █▀`

	logoStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("12")).
		Bold(true).
		Align(lipgloss.Center)

	loadingText := ""
	if m.loadingProjects && !m.autoDetectDone {
		loadingText = fmt.Sprintf("\n\n%s Loading projects and detecting current repository...", m.projectsSpinner.View())
	} else if m.loadingProjects {
		loadingText = fmt.Sprintf("\n\n%s Loading projects...", m.projectsSpinner.View())
	} else if !m.autoDetectDone {
		loadingText = fmt.Sprintf("\n\n%s Detecting current repository...", m.projectsSpinner.View())
	}

	loadingStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("240")).
		Align(lipgloss.Center)

	// Center everything vertically
	contentHeight := 8 + 3 // Logo height + loading text
	paddingTop := (m.height - contentHeight) / 2
	if paddingTop < 0 {
		paddingTop = 0
	}

	var content strings.Builder

	// Add top padding
	for i := 0; i < paddingTop; i++ {
		content.WriteString("\n")
	}

	// Add logo
	content.WriteString(logoStyle.Width(m.width).Render(logoText))

	// Add loading text
	content.WriteString(loadingStyle.Width(m.width).Render(loadingText))

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

func (m *model) filterReviewers() {
	m.filteredReviewers = nil

	if m.reviewerSearch == "" {
		m.filteredReviewers = m.users
		return
	}

	query := strings.ToLower(m.reviewerSearch)

	for _, user := range m.users {
		if user.DisplayName != nil && strings.Contains(strings.ToLower(*user.DisplayName), query) {
			m.filteredReviewers = append(m.filteredReviewers, user)
		} else if user.MailAddress != nil && strings.Contains(strings.ToLower(*user.MailAddress), query) {
			m.filteredReviewers = append(m.filteredReviewers, user)
		}
	}
}

func (m model) View() string {
	// Show config modal if needed
	if m.showConfigModal {
		return m.configModal.View()
	}

	// Show initial loading screen with logo
	if m.initialLoading {
		return m.renderInitialLoadingScreen()
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
	rightBoxHeight := totalAvailableHeight    // Right panel height matches total available height

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
	rightContentHeight := rightBoxHeight - 4 // Right panel content height matches total available height

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

	if m.showPRCreate {
		rightPanelTitle = "┤ Create Pull Request ├"
		rightPanelContent = m.renderPRCreate(rightContentHeight - 1)
	} else if m.showPRDetails {
		if m.prOverrideMode {
			rightPanelTitle = "┤ Override PR ├"
			rightPanelContent = m.renderPROverride(rightContentHeight - 1)
		} else {
			rightPanelTitle = "┤ PR Details ├"
			if m.selectedPR != nil && m.selectedPR.Title != nil {
				rightPanelTitle = "┤ " + *m.selectedPR.Title + " ├"
			}
			rightPanelContent = m.renderPRDetails(rightContentHeight - 1)
		}
	} else if m.showRunDetails {
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
	} else if m.showPRs {
		rightPanelTitle = "┤ Pull Requests ├"
		if m.selectedRepo != nil && m.selectedRepo.Name != nil {
			rightPanelTitle = "┤ " + *m.selectedRepo.Name + " PRs ├"
		}
		rightPanelContent = m.renderPRs(rightContentHeight - 1)
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
	if m.showPipelines || m.showRuns || m.showRunDetails || m.showPRs || m.showPRCreate || m.showPRDetails {
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
		// Empty space to maintain layout consistency - match search bar height
		// Create a properly sized empty search bar with padding to match the active search bar
		emptyContent := "\n\n" // Two newlines to match the content height of active search bar
		searchBar = searchStyle.
			Width(m.width - 4).
			Render(emptyContent)
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

	// Show auto-detection success message if applicable
	if m.autoDetectResult != nil && m.autoDetectResult.ShouldAutoLoad && m.selectedProject != nil && m.selectedRepo != nil {
		successStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("2")) // Green
		content.WriteString(successStyle.Render("  🚀 Auto-detected current repository"))
		content.WriteString("\n\n")
		linesUsed += 2
	}

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

func (m model) renderPRs(visibleLines int) string {
	// Show loading animation if PRs are loading
	if m.loadingPRs {
		return m.renderLoadingAnimation(visibleLines, "Loading pull requests", m.prsSpinner)
	}

	var content strings.Builder
	linesUsed := 0

	// Calculate content width for full-width highlighting
	rightWidth := m.width - m.width/2
	contentWidth := rightWidth - 6 // Account for borders, padding, and margin

	// Show PRs list
	start := m.prsScroll
	end := start + visibleLines
	if end > len(m.prs) {
		end = len(m.prs)
	}

	for i := start; i < end; i++ {
		pr := m.prs[i]
		prDisplay := ""

		if pr.Title != nil {
			prDisplay = *pr.Title
		} else if pr.PullRequestId != nil {
			prDisplay = fmt.Sprintf("PR #%d", *pr.PullRequestId)
		}

		// Add status if available
		if pr.Status != nil {
			statusText := string(*pr.Status)
			prDisplay = fmt.Sprintf("%s (%s)", prDisplay, statusText)
		}

		// Truncate if too long
		maxLen := contentWidth - 4
		if maxLen < 1 {
			maxLen = 1
		}
		if len(prDisplay) > maxLen {
			prDisplay = prDisplay[:maxLen-3] + "..."
		}

		line := fmt.Sprintf("  %s", prDisplay)

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

func (m model) renderPRCreate(visibleLines int) string {
	var content strings.Builder
	linesUsed := 0

	if m.prCreateMode {
		content.WriteString("  Create New Pull Request\n\n")
		linesUsed += 2

		// Show form fields with highlighting for current step
		titleStyle := ""
		if m.prCreateStep == 0 {
			titleStyle = highlightStyle.Render("→ Title:")
		} else {
			titleStyle = "  Title:"
		}
		content.WriteString(titleStyle + "\n")
		content.WriteString("  " + m.prTitleInput.View() + "\n\n")
		linesUsed += 3

		descStyle := ""
		if m.prCreateStep == 1 {
			descStyle = highlightStyle.Render("→ Description:")
		} else {
			descStyle = "  Description:"
		}
		content.WriteString(descStyle + "\n")
		content.WriteString("  " + m.prDescInput.View() + "\n\n")
		linesUsed += 3

		// Show branch selection with highlighting
		sourceStyle := ""
		if m.prCreateStep == 2 {
			sourceStyle = highlightStyle.Render("→ Source Branch:")
		} else {
			sourceStyle = "  Source Branch:"
		}
		content.WriteString(sourceStyle + " ")
		if m.prSourceBranch != nil && m.prSourceBranch.Name != nil {
			branchName := strings.TrimPrefix(*m.prSourceBranch.Name, "refs/heads/")
			content.WriteString(branchName)
		} else {
			content.WriteString("(Select branch)")
		}
		if m.prCreateStep == 2 {
			content.WriteString(" ↑/↓ to change")
		}
		content.WriteString("\n")
		linesUsed++

		targetStyle := ""
		if m.prCreateStep == 3 {
			targetStyle = highlightStyle.Render("→ Target Branch:")
		} else {
			targetStyle = "  Target Branch:"
		}
		content.WriteString(targetStyle + " ")
		if m.prTargetBranch != nil && m.prTargetBranch.Name != nil {
			branchName := strings.TrimPrefix(*m.prTargetBranch.Name, "refs/heads/")
			content.WriteString(branchName)
		} else {
			content.WriteString("main")
		}
		if m.prCreateStep == 3 {
			content.WriteString(" ↑/↓ to change")
		}
		content.WriteString("\n\n")
		linesUsed += 2

		reviewerStyle := ""
		if m.prCreateStep == 4 {
			reviewerStyle = highlightStyle.Render("→ Reviewers:")
		} else {
			reviewerStyle = "  Reviewers:"
		}
		content.WriteString(reviewerStyle + " ")
		if len(m.prReviewers) > 0 {
			for i, reviewer := range m.prReviewers {
				if i > 0 {
					content.WriteString(", ")
				}
				if reviewer.DisplayName != nil {
					content.WriteString(*reviewer.DisplayName)
				}
			}
		} else {
			content.WriteString("(None selected)")
		}
		content.WriteString("\n")
		linesUsed++

		// Show reviewer search if step 4
		if m.prCreateStep == 4 {
			content.WriteString("  Search: " + m.reviewerSearch + "\n")
			linesUsed++

			// Show filtered reviewers
			if len(m.filteredReviewers) > 0 {
				content.WriteString("  Available reviewers:\n")
				linesUsed++
				for i, user := range m.filteredReviewers {
					if i >= 5 { // Limit to 5 reviewers
						break
					}
					prefix := "    "
					if i == m.cursor {
						prefix = "  → "
					}
					displayName := "Unknown User"
					if user.DisplayName != nil {
						displayName = *user.DisplayName
					}
					content.WriteString(prefix + displayName + "\n")
					linesUsed++
				}
			}
		}
		content.WriteString("\n")
		linesUsed++

		// Show current step instructions
		var instructions string
		switch m.prCreateStep {
		case 0, 1:
			instructions = "  Type to edit   •   Tab: Next   •   Enter: Submit   •   Esc: Cancel"
		case 2, 3:
			instructions = "  ↑/↓: Select branch   •   Tab: Next   •   Enter: Submit   •   Esc: Cancel"
		case 4:
			instructions = "  Type to search   •   ↑/↓: Navigate   •   Enter: Add reviewer   •   x: Remove last   •   Tab: Next   •   Esc: Cancel"
		}
		content.WriteString(instructions + "\n")
		linesUsed++
	}

	// Fill remaining space with empty lines to maintain fixed height
	for linesUsed < visibleLines {
		content.WriteString("\n")
		linesUsed++
	}

	return content.String()
}

func (m model) renderPRDetails(visibleLines int) string {
	// Show loading animation if PR details are loading
	if m.loadingPRDetails {
		return m.renderLoadingAnimation(visibleLines, "Loading PR details", m.prDetailsSpinner)
	}

	var content strings.Builder
	linesUsed := 0

	if m.prDetails == nil {
		content.WriteString("  No PR details available\n")
		linesUsed++
	} else {
		pr := m.prDetails

		// Show PR basic info
		if pr.Title != nil {
			content.WriteString("  Title: " + *pr.Title + "\n")
			linesUsed++
		}

		if pr.CreatedBy != nil && pr.CreatedBy.DisplayName != nil {
			content.WriteString("  Author: " + *pr.CreatedBy.DisplayName + "\n")
			linesUsed++
		}

		if pr.Status != nil {
			statusColor := lipgloss.Color("240")
			statusText := string(*pr.Status)
			switch *pr.Status {
			case git.PullRequestStatusValues.Active:
				statusColor = lipgloss.Color("3") // Yellow
				statusText = "🟡 Active"
			case git.PullRequestStatusValues.Completed:
				statusColor = lipgloss.Color("2") // Green
				statusText = "✅ Completed"
			case git.PullRequestStatusValues.Abandoned:
				statusColor = lipgloss.Color("1") // Red
				statusText = "❌ Abandoned"
			}
			statusStyle := lipgloss.NewStyle().Foreground(statusColor)
			content.WriteString("  Status: " + statusStyle.Render(statusText) + "\n")
			linesUsed++
		}

		// Show branch info
		if pr.SourceRefName != nil && pr.TargetRefName != nil {
			sourceBranch := strings.TrimPrefix(*pr.SourceRefName, "refs/heads/")
			targetBranch := strings.TrimPrefix(*pr.TargetRefName, "refs/heads/")
			content.WriteString(fmt.Sprintf("  Branches: %s → %s\n", sourceBranch, targetBranch))
			linesUsed++
		}

		content.WriteString("\n")
		linesUsed++

		// Show description if available
		if pr.Description != nil && *pr.Description != "" {
			content.WriteString("  Description:\n")
			content.WriteString("  " + *pr.Description + "\n\n")
			linesUsed += 3
		}

		// Show reviewers
		if pr.Reviewers != nil && len(*pr.Reviewers) > 0 {
			content.WriteString("  Reviewers:\n")
			linesUsed++
			for _, reviewer := range *pr.Reviewers {
				reviewerName := "Unknown"
				if reviewer.DisplayName != nil {
					reviewerName = *reviewer.DisplayName
				}

				voteText := "⏳ Pending"
				voteColor := lipgloss.Color("240")
				if reviewer.Vote != nil {
					switch *reviewer.Vote {
					case 10: // Approved
						voteText = "✅ Approved"
						voteColor = lipgloss.Color("2")
					case -10: // Rejected
						voteText = "❌ Rejected"
						voteColor = lipgloss.Color("1")
					case -5: // Waiting for author
						voteText = "⏸ Waiting"
						voteColor = lipgloss.Color("3")
					case 5: // Approved with suggestions
						voteText = "✅ Approved*"
						voteColor = lipgloss.Color("2")
					}
				}

				voteStyle := lipgloss.NewStyle().Foreground(voteColor)
				content.WriteString(fmt.Sprintf("    %s: %s\n", reviewerName, voteStyle.Render(voteText)))
				linesUsed++
			}
			content.WriteString("\n")
			linesUsed++
		}

		// Show recent action message if available
		if m.prActionMessage != "" && time.Since(m.prActionTime) < 10*time.Second {
			messageColor := lipgloss.Color("2") // Green for success
			if strings.Contains(m.prActionMessage, "Failed") {
				messageColor = lipgloss.Color("1") // Red for error
			}
			messageStyle := lipgloss.NewStyle().Foreground(messageColor)
			content.WriteString("  " + messageStyle.Render(m.prActionMessage) + "\n\n")
			linesUsed += 2
		}

		// Show action buttons if PR is active
		if pr.Status != nil && *pr.Status == git.PullRequestStatusValues.Active {
			content.WriteString("  Actions:\n")
			content.WriteString("  a: Approve   •   d: Decline   •   o: Override & Complete\n")
			linesUsed += 2
		}

		content.WriteString("\n  Press Esc to go back\n")
		linesUsed += 2
	}

	// Fill remaining space with empty lines to maintain fixed height
	for linesUsed < visibleLines {
		content.WriteString("\n")
		linesUsed++
	}

	return content.String()
}

func (m model) renderPROverride(visibleLines int) string {
	var content strings.Builder
	linesUsed := 0

	content.WriteString("  Override PR Completion\n\n")
	linesUsed += 2

	content.WriteString("  This action will complete the PR even if all\n")
	content.WriteString("  required reviews are not met.\n\n")
	linesUsed += 3

	content.WriteString("  Override Reason:\n")
	content.WriteString("  " + m.prOverrideInput.View() + "\n\n")
	linesUsed += 3

	content.WriteString("  ⚠️  WARNING: This bypasses branch policies!\n\n")
	linesUsed += 2

	content.WriteString("  Press Enter to confirm override\n")
	content.WriteString("  Press Esc to cancel\n")
	linesUsed += 2

	// Fill remaining space with empty lines to maintain fixed height
	for linesUsed < visibleLines {
		content.WriteString("\n")
		linesUsed++
	}

	return content.String()
}

func (m model) getInstructions() string {
	if m.prOverrideMode {
		return "Type override reason   •   Enter Confirm   •   Esc Cancel   •   q Quit"
	}
	if m.prCreateMode {
		return "Tab Navigate   •   Enter Submit   •   Esc Cancel   •   q Quit"
	}
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
	if m.showPRDetails {
		return "a Approve   •   d Decline   •   c Complete   •   o Override   •   Esc/← Back   •   q Quit"
	}
	if m.showPRs {
		return "↑/↓ Navigate   •   Enter View PR   •   n New PR   •   Esc/← Back   •   q Quit"
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

	s6 := spinner.New()
	s6.Spinner = spinner.Dot
	s6.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	// Check if config is complete, if not show modal
	showModal := !cfg.IsComplete()
	var configModal *config.ConfigModal
	if showModal {
		configModal = config.NewConfigModal(cfg)
	}

	m := model{
		projects:          []core.TeamProjectReference{},
		repos:             []git.GitRepository{},
		pipelines:         []pipeline.Pipeline{},
		runs:              []pipeline.Run{},
		timeline:          nil,
		prs:               []git.GitPullRequest{},
		branches:          []git.GitRef{},
		users:             []graph.GraphUser{},
		showRepoOptions:   false,
		showPipelines:     false,
		showRuns:          false,
		showRunDetails:    false,
		showPRs:           false,
		showPRCreate:      false,
		focusedPanel:      0,
		width:             80,
		height:            24,
		cursor:            0,
		projectsScroll:    0,
		reposScroll:       0,
		pipelinesScroll:   0,
		runsScroll:        0,
		timelineScroll:    0,
		prsScroll:         0,
		selectedProject:   nil,
		selectedRepo:      nil,
		selectedPipeline:  nil,
		selectedRun:       nil,
		selectedPR:        nil,
		repoOptions:       repoOptions,
		searchMode:        false,
		searchQuery:       "",
		filteredItems:     nil,
		originalCursor:    0,
		initialLoading:    !showModal, // Show initial loading if config is complete
		loadingProjects:   !showModal, // Only start loading if config is complete
		loadingRepos:      false,
		loadingPipelines:  false,
		loadingRuns:       false,
		loadingTimeline:   false,
		loadingPRs:        false,
		loadingBranches:   false,
		loadingUsers:      false,
		autoRefresh:       false,
		autoSelected:      false,
		autoSelectRepo:    nil,
		autoDetectDone:    false,
		autoDetectResult:  nil,
		lastRefresh:       time.Time{},
		projectsSpinner:   s1,
		reposSpinner:      s2,
		pipelinesSpinner:  s3,
		runsSpinner:       s4,
		timelineSpinner:   s5,
		prsSpinner:        s6,
		config:            cfg,
		configModal:       configModal,
		showConfigModal:   showModal,
		prCreateMode:      false,
		prTitleInput:      textinput.New(),
		prDescInput:       textinput.New(),
		prSourceBranch:    nil,
		prTargetBranch:    nil,
		prReviewers:       []graph.GraphUser{},
		prCreateStep:      0,
		reviewerSearch:    "",
		filteredReviewers: []graph.GraphUser{},
		// PR Details fields
		showPRDetails:     false,
		prDetails:         nil,
		prComments:        []git.GitPullRequestCommentThread{},
		loadingPRDetails:  false,
		loadingPRComments: false,
		prDetailsSpinner:  s1, // Reuse existing spinner
		// PR Review fields
		showPRReview:    false,
		prReviewMode:    false,
		prReviewAction:  "",
		prOverrideInput: textinput.New(),
		prCommentInput:  textinput.New(),
		prOverrideMode:  false,
		prActionMessage: "",
		prActionTime:    time.Time{},
	}

	if _, err := tea.NewProgram(m, tea.WithAltScreen()).Run(); err != nil {
		fmt.Println("Error running program:", err)
		os.Exit(1)
	}
}
