package projects

import (
	"context"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/core"
)

func GetProjects(ctx context.Context, connection *azuredevops.Connection) (*[]core.TeamProjectReference, error) {
	coreClient, err := core.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	getProjectsArgs := core.GetProjectsArgs{}
	projects, err := coreClient.GetProjects(ctx, getProjectsArgs)
	if err != nil {
		return nil, err
	}
	return &projects.Value, nil
}
