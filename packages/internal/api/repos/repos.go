package repos

import (
	"context"
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
