package prs

import (
	"context"
	"fmt"
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

func ApprovePR(ctx context.Context, connection *azuredevops.Connection, ProjectName string, RepositoryId string, pullRequestId int, vote int, comment string) error {
	gitClient, err := git.NewClient(ctx, connection)
	if err != nil {
		return err
	}

	// Step 1: Always add a comment first - this ensures the user becomes a reviewer
	actualComment := comment
	if actualComment == "" {
		// Add a default comment if none provided
		if vote == 10 {
			actualComment = "Approved"
		} else if vote == -10 {
			actualComment = "Declined"
		} else {
			actualComment = "Reviewed"
		}
	}

	threadArgs := git.CreateThreadArgs{
		RepositoryId:  &RepositoryId,
		PullRequestId: &pullRequestId,
		Project:       &ProjectName,
		CommentThread: &git.GitPullRequestCommentThread{
			Comments: &[]git.Comment{
				{
					Content: &actualComment,
				},
			},
		},
	}

	_, err = gitClient.CreateThread(ctx, threadArgs)
	if err != nil {
		return fmt.Errorf("failed to add comment: %v", err)
	}

	// Step 2: Get the PR to find all reviewers including the current user
	getPRArgs := git.GetPullRequestArgs{
		RepositoryId:  &RepositoryId,
		PullRequestId: &pullRequestId,
		Project:       &ProjectName,
	}

	pr, err := gitClient.GetPullRequest(ctx, getPRArgs)
	if err != nil {
		return fmt.Errorf("failed to get PR details: %v", err)
	}

	// Step 3: Find and update the current user's reviewer vote
	if pr.Reviewers == nil || len(*pr.Reviewers) == 0 {
		return fmt.Errorf("no reviewers found on PR")
	}

	// Set appropriate flags based on vote value
	isRequired := false
	isFlagged := false
	hasDeclined := false

	switch vote {
	case -10: // Rejected
		hasDeclined = true
	case -5: // Waiting for author
		isFlagged = true
	}

	// Try to update each reviewer until one succeeds (the current user should be among them)
	var lastError error
	for _, reviewer := range *pr.Reviewers {
		if reviewer.Id != nil {
			updateArgs := git.UpdatePullRequestReviewerArgs{
				RepositoryId:  &RepositoryId,
				PullRequestId: &pullRequestId,
				Project:       &ProjectName,
				ReviewerId:    reviewer.Id,
				Reviewer: &git.IdentityRefWithVote{
					Vote:        &vote,
					IsRequired:  &isRequired,
					IsFlagged:   &isFlagged,
					HasDeclined: &hasDeclined,
				},
			}

			_, err = gitClient.UpdatePullRequestReviewer(ctx, updateArgs)
			if err == nil {
				// Successfully updated - we found the right reviewer
				return nil
			}
			lastError = err
			// Continue to try next reviewer
		}
	}

	if lastError != nil {
		return fmt.Errorf("failed to update reviewer vote: %v", lastError)
	}

	return fmt.Errorf("no valid reviewers found to update")
}

func CompletePR(ctx context.Context, connection *azuredevops.Connection, ProjectName string, RepositoryId string, pullRequestId int, completionOptions *git.GitPullRequestCompletionOptions) (*git.GitPullRequest, error) {
	gitClient, err := git.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	// Update PR to completed status
	prUpdate := &git.GitPullRequest{
		Status:            &git.PullRequestStatusValues.Completed,
		CompletionOptions: completionOptions,
	}

	updateArgs := git.UpdatePullRequestArgs{
		RepositoryId:           &RepositoryId,
		PullRequestId:          &pullRequestId,
		Project:                &ProjectName,
		GitPullRequestToUpdate: prUpdate,
	}

	pr, err := gitClient.UpdatePullRequest(ctx, updateArgs)
	if err != nil {
		return nil, err
	}

	return pr, nil
}

func GetPRDetails(ctx context.Context, connection *azuredevops.Connection, ProjectName string, RepositoryId string, pullRequestId int) (*git.GitPullRequest, error) {
	gitClient, err := git.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	getPRArgs := git.GetPullRequestArgs{
		RepositoryId:  &RepositoryId,
		PullRequestId: &pullRequestId,
		Project:       &ProjectName,
	}

	pr, err := gitClient.GetPullRequest(ctx, getPRArgs)
	if err != nil {
		return nil, err
	}

	return pr, nil
}

func GetPRComments(ctx context.Context, connection *azuredevops.Connection, ProjectName string, RepositoryId string, pullRequestId int) (*[]git.GitPullRequestCommentThread, error) {
	gitClient, err := git.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	getThreadsArgs := git.GetThreadsArgs{
		RepositoryId:  &RepositoryId,
		PullRequestId: &pullRequestId,
		Project:       &ProjectName,
	}

	threads, err := gitClient.GetThreads(ctx, getThreadsArgs)
	if err != nil {
		return nil, err
	}

	return threads, nil
}

func stringPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}
