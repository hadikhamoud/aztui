package pipelines

import (
	"context"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/pipelines"
)

func GetPipelines(ctx context.Context, connection *azuredevops.Connection) (*[]pipelines.Pipeline, error) {
	PipelineClient := pipelines.NewClient(ctx, connection)
	pipelinesListArgs := pipelines.ListPipelinesArgs{}

	pipelinesList, err := PipelineClient.ListPipelines(ctx, pipelinesListArgs)

	if err != nil {
		return nil, err
	}
	return pipelinesList, nil
}

func GetRuns(ctx context.Context, connection *azuredevops.Connection, pipelineID int) (*[]pipelines.Run, error) {
	PipelineClient := pipelines.NewClient(ctx, connection)
	runsListArgs := pipelines.ListRunsArgs{
		PipelineId: &pipelineID,
	}

	runsList, err := PipelineClient.ListRuns(ctx, runsListArgs)

	if err != nil {
		return nil, err
	}
	return runsList, nil
}
