package internal

import (
	"context"
	"fmt"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/git"
)

func GetRepos(ctx context.Context, connection *azuredevops.Connection, ProjectName string) (*[]git.GitRepository, error) {
	gitClient, err := git.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	getReposArgs := git.GetRepositoriesArgs{Project: &ProjectName}
	repositories, err := gitClient.GetRepositories(ctx, getReposArgs)
	if err != nil {
		return nil, err
	}
	return repositories, nil
}

func GetPRs(ctx context.Context, connection *azuredevops.Connection, ProjectName string, RepositoryId string) (*[]git.GitPullRequest, error) {
	gitClient, err := git.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	PRStatus := git.PullRequestStatusValues.All

	getPRsArgs := git.GetPullRequestsArgs{RepositoryId: &RepositoryId, Project: &ProjectName, SearchCriteria: &git.GitPullRequestSearchCriteria{Status: &PRStatus}}
	pullRequests, err := gitClient.GetPullRequests(ctx, getPRsArgs)

	if err != nil {
		return nil, err
	}
	fmt.Println((*pullRequests)[0].Title)
	return pullRequests, nil
}
