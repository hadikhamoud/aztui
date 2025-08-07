package main

import (
	"context"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/git"
)

func getRepos(ctx context.Context, connection *azuredevops.Connection, ProjectName string) (*[]git.GitRepository, error) {
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

func getPRs(ctx context.Context, connection *azuredevops.Connection, ProjectName string, RepositoryId string) (*[]git.GitPullRequest, error) {
	gitClient, err := git.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	getPRsArgs := git.GetPullRequestsArgs{RepositoryId: &RepositoryId, Project: &ProjectName, SearchCriteria: &git.GitPullRequestSearchCriteria{}}
	pullRequests, err := gitClient.GetPullRequests(ctx, getPRsArgs)

	if err != nil {
		return nil, err
	}
	return pullRequests, nil
}
