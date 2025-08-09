package internal

import (
	"context"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/graph"
	"github.com/microsoft/azure-devops-go-api/azuredevops/v7/memberentitlementmanagement"
)

func GetUsers(ctx context.Context, connection *azuredevops.Connection) (*graph.PagedGraphUsers, error) {
	entitlementClient, err := memberentitlementmanagement.NewClient(ctx, connection)
	if err != nil {
		return nil, err
	}

	filter := "(licenseId eq 'Account-Express' or licenseId eq 'Account-TestManager')"
	searchArgs := memberentitlementmanagement.SearchUserEntitlementsArgs{
		Filter: &filter,
	}

	entitlements, err := entitlementClient.SearchUserEntitlements(ctx, searchArgs)
	if err != nil {
		return nil, err
	}

	var filteredUsers []graph.GraphUser
	if entitlements.Members != nil {
		for _, member := range *entitlements.Members {
			if member.User != nil && member.User.MailAddress != nil && *member.User.MailAddress != "" {
				filteredUsers = append(filteredUsers, *member.User)
			}
		}
	}

	return &graph.PagedGraphUsers{
		GraphUsers: &filteredUsers,
	}, nil
}
