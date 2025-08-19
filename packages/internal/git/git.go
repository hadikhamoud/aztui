package git

import (
	"os/exec"
	"regexp"
	"strings"
)

type GitRemoteInfo struct {
	Organization string
	Project      string
	Repository   string
	RemoteURL    string
}

func GetRemoteInfo() (*GitRemoteInfo, error) {
	// Get the origin remote URL
	cmd := exec.Command("git", "remote", "get-url", "origin")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	remoteURL := strings.TrimSpace(string(output))
	return parseAzureDevOpsURL(remoteURL)
}

func parseAzureDevOpsURL(url string) (*GitRemoteInfo, error) {
	// Remove trailing .git if present
	url = strings.TrimSuffix(url, ".git")

	// Support multiple Azure DevOps URL formats:
	// https://dev.azure.com/organization/project/_git/repository
	// https://organization.visualstudio.com/project/_git/repository
	// git@ssh.dev.azure.com:v3/organization/project/repository

	patterns := []string{
		// HTTPS format: https://dev.azure.com/organization/project/_git/repository
		`https://dev\.azure\.com/([^/]+)/([^/]+)/_git/(.+)`,
		// Visual Studio format: https://organization.visualstudio.com/project/_git/repository
		`https://([^.]+)\.visualstudio\.com/([^/]+)/_git/(.+)`,
		// SSH format: git@ssh.dev.azure.com:v3/organization/project/repository
		`git@ssh\.dev\.azure\.com:v3/([^/]+)/([^/]+)/(.+)`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(url)
		if len(matches) == 4 {
			return &GitRemoteInfo{
				Organization: matches[1],
				Project:      matches[2],
				Repository:   matches[3],
				RemoteURL:    url,
			}, nil
		}
	}

	return nil, nil // No Azure DevOps URL found
}

func IsGitRepository() bool {
	cmd := exec.Command("git", "rev-parse", "--git-dir")
	err := cmd.Run()
	return err == nil
}
