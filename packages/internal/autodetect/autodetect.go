package autodetect

import (
	"aztui/packages/internal/config"
	gitutil "aztui/packages/internal/git"
	"context"
	"fmt"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/core"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/git"
	"strings"
)

type AutoDetectResult struct {
	Organization   string
	Project        *core.TeamProjectReference
	Repository     *git.GitRepository
	ShouldAutoLoad bool
}

func DetectProjectAndRepo(ctx context.Context, cfg *config.Config) (*AutoDetectResult, error) {
	// Check if we're in a git repository
	if !gitutil.IsGitRepository() {
		return &AutoDetectResult{ShouldAutoLoad: false}, nil
	}

	// Get git remote information
	remoteInfo, err := gitutil.GetRemoteInfo()
	if err != nil || remoteInfo == nil {
		return &AutoDetectResult{ShouldAutoLoad: false}, nil
	}

	// Check if the organization matches the configured Azure DevOps URL
	if !organizationMatches(cfg.AzureOrgURL, remoteInfo.Organization) {
		return &AutoDetectResult{ShouldAutoLoad: false}, nil
	}

	// Create Azure DevOps connection
	connection := azuredevops.NewPatConnection(cfg.AzureOrgURL, cfg.AzurePAT)

	// Try to find the matching project
	project, err := findMatchingProject(ctx, connection, remoteInfo.Project)
	if err != nil || project == nil {
		return &AutoDetectResult{
			Organization:   remoteInfo.Organization,
			ShouldAutoLoad: false,
		}, nil
	}

	// Try to find the matching repository
	repository, err := findMatchingRepository(ctx, connection, *project.Name, remoteInfo.Repository)
	if err != nil || repository == nil {
		return &AutoDetectResult{
			Organization:   remoteInfo.Organization,
			Project:        project,
			ShouldAutoLoad: false,
		}, nil
	}

	return &AutoDetectResult{
		Organization:   remoteInfo.Organization,
		Project:        project,
		Repository:     repository,
		ShouldAutoLoad: true,
	}, nil
}

func organizationMatches(configURL, gitOrganization string) bool {
	// Extract organization from Azure DevOps URL
	// https://dev.azure.com/organization or https://organization.visualstudio.com
	configURL = strings.TrimSuffix(configURL, "/")

	if strings.Contains(configURL, "dev.azure.com") {
		// Format: https://dev.azure.com/organization
		parts := strings.Split(configURL, "/")
		if len(parts) >= 4 {
			configOrg := parts[len(parts)-1]
			return strings.EqualFold(configOrg, gitOrganization)
		}
	} else if strings.Contains(configURL, "visualstudio.com") {
		// Format: https://organization.visualstudio.com
		parts := strings.Split(configURL, ".")
		if len(parts) >= 3 {
			configOrg := strings.TrimPrefix(parts[0], "https://")
			return strings.EqualFold(configOrg, gitOrganization)
		}
	}

	return false
}

func findMatchingProject(ctx context.Context, connection *azuredevops.Connection, projectName string) (*core.TeamProjectReference, error) {
	coreClient, err := core.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	getProjectsArgs := core.GetProjectsArgs{}
	projects, err := coreClient.GetProjects(ctx, getProjectsArgs)
	if err != nil {
		return nil, err
	}

	// Look for exact match first, then case-insensitive match
	for _, project := range projects.Value {
		if project.Name != nil && *project.Name == projectName {
			return &project, nil
		}
	}

	for _, project := range projects.Value {
		if project.Name != nil && strings.EqualFold(*project.Name, projectName) {
			return &project, nil
		}
	}

	return nil, fmt.Errorf("project not found: %s", projectName)
}

func findMatchingRepository(ctx context.Context, connection *azuredevops.Connection, projectName, repoName string) (*git.GitRepository, error) {
	gitClient, err := git.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	getReposArgs := git.GetRepositoriesArgs{Project: &projectName}
	repositories, err := gitClient.GetRepositories(ctx, getReposArgs)
	if err != nil {
		return nil, err
	}

	// Look for exact match first, then case-insensitive match
	for _, repo := range *repositories {
		if repo.Name != nil && *repo.Name == repoName {
			return &repo, nil
		}
	}

	for _, repo := range *repositories {
		if repo.Name != nil && strings.EqualFold(*repo.Name, repoName) {
			return &repo, nil
		}
	}

	return nil, fmt.Errorf("repository not found: %s", repoName)
}
