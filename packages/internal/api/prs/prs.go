package prs

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

	PRStatus := git.PullRequestStatusValues.Active

	getPRsArgs := git.GetPullRequestsArgs{RepositoryId: &RepositoryId, Project: &ProjectName, SearchCriteria: &git.GitPullRequestSearchCriteria{Status: &PRStatus}}
	pullRequests, err := gitClient.GetPullRequests(ctx, getPRsArgs)

	if err != nil {
		return nil, err
	}
	return pullRequests, nil
}

func GetBranches(ctx context.Context, connection *azuredevops.Connection, ProjectName string, RepositoryId string) (*[]git.GitRef, error) {
	gitClient, err := git.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	getBranchesArgs := git.GetRefsArgs{
		RepositoryId: &RepositoryId,
		Project:      &ProjectName,
		Filter:       stringPtr("heads/"),
	}

	branches, err := gitClient.GetRefs(ctx, getBranchesArgs)
	if err != nil {
		return nil, err
	}

	if branches != nil && branches.Value != nil {
		return &branches.Value, nil
	}

	emptyBranches := []git.GitRef{}
	return &emptyBranches, nil
}

func CreatePR(ctx context.Context, connection *azuredevops.Connection, ProjectName string, RepositoryId string, req *git.GitPullRequest) (*git.GitPullRequest, error) {
	gitClient, err := git.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	createPRArgs := git.CreatePullRequestArgs{
		GitPullRequestToCreate: req,
		RepositoryId:           &RepositoryId,
		Project:                &ProjectName,
	}

	pr, err := gitClient.CreatePullRequest(ctx, createPRArgs)
	if err != nil {
		return nil, err
	}

	return pr, nil
}

func GetLatestBranch(ctx context.Context, connection *azuredevops.Connection, ProjectName string, RepositoryId string) (*git.GitRef, error) {
	gitClient, err := git.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	// Get commits to find the most recently updated branch
	getCommitsArgs := git.GetCommitsArgs{
		RepositoryId: &RepositoryId,
		Project:      &ProjectName,
		SearchCriteria: &git.GitQueryCommitsCriteria{
			Top: intPtr(50), // Get last 50 commits
		},
	}

	_, err = gitClient.GetCommits(ctx, getCommitsArgs)
	if err != nil {
		// Fallback to branch list if commits fail
		branches, err := GetBranches(ctx, connection, ProjectName, RepositoryId)
		if err != nil || branches == nil || len(*branches) == 0 {
			return nil, err
		}

		// Find the first non-main branch
		for _, branch := range *branches {
			if branch.Name != nil {
				branchName := *branch.Name
				if branchName != "refs/heads/main" && branchName != "refs/heads/master" {
					return &branch, nil
				}
			}
		}
		return nil, nil
	}

	// Find branches by recent commits
	branches, err := GetBranches(ctx, connection, ProjectName, RepositoryId)
	if err != nil || branches == nil {
		return nil, err
	}

	// Return the first non-main branch for now
	// In a production app, you'd check commit dates to find the most recent
	for _, branch := range *branches {
		if branch.Name != nil {
			branchName := *branch.Name
			if branchName != "refs/heads/main" && branchName != "refs/heads/master" {
				return &branch, nil
			}
		}
	}

	return nil, nil
}

func intPtr(i int) *int {
	return &i
}

func stringPtr(s string) *string {
	return &s
}
