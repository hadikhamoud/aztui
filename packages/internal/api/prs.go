package internal

import (
	"context"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/git"
)

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
	return pullRequests, nil
}
