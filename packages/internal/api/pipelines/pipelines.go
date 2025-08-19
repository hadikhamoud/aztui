package pipelines

import (
	"context"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/build"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/pipelines"
)

func GetPipelines(ctx context.Context, connection *azuredevops.Connection, projectName string) (*[]pipelines.Pipeline, error) {
	PipelineClient := pipelines.NewClient(ctx, connection)
	pipelinesListArgs := pipelines.ListPipelinesArgs{
		Project: &projectName,
	}

	pipelinesList, err := PipelineClient.ListPipelines(ctx, pipelinesListArgs)

	if err != nil {
		return nil, err
	}
	return pipelinesList, nil
}

func GetPipelinesForRepo(ctx context.Context, connection *azuredevops.Connection, projectName string, repoName string) (*[]pipelines.Pipeline, error) {
	allPipelines, err := GetPipelines(ctx, connection, projectName)
	if err != nil {
		return nil, err
	}

	var filteredPipelines []pipelines.Pipeline
	for _, pipeline := range *allPipelines {
		if pipeline.Name != nil && *pipeline.Name == repoName {
			filteredPipelines = append(filteredPipelines, pipeline)
		}
	}

	return &filteredPipelines, nil
}

func GetRuns(ctx context.Context, connection *azuredevops.Connection, projectName string, pipelineID int) (*[]pipelines.Run, error) {
	PipelineClient := pipelines.NewClient(ctx, connection)
	runsListArgs := pipelines.ListRunsArgs{
		Project:    &projectName,
		PipelineId: &pipelineID,
	}

	runsList, err := PipelineClient.ListRuns(ctx, runsListArgs)

	if err != nil {
		return nil, err
	}
	return runsList, nil
}

func GetRunTimeline(ctx context.Context, connection *azuredevops.Connection, projectName string, buildID int) (*build.Timeline, error) {
	buildClient, err := build.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	timelineArgs := build.GetBuildTimelineArgs{
		Project: &projectName,
		BuildId: &buildID,
	}

	timeline, err := buildClient.GetBuildTimeline(ctx, timelineArgs)

	if err != nil {
		return nil, err
	}
	return timeline, nil
}
