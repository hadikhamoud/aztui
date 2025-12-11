import * as azdev from "azure-devops-node-api";
import * as coreA from "azure-devops-node-api/CoreApi";
import * as gitA from "azure-devops-node-api/GitApi";
import * as pipelineA from "azure-devops-node-api/PipelinesApi";
import * as buildA from "azure-devops-node-api/BuildApi";

let orgUrl = Bun.env.AZURE_ORG_URL || "";
let token: string = Bun.env.AZURE_PAT || "";

let connection: azdev.WebApi | null = null;
let coreApi: coreA.ICoreApi | null = null;
let gitApi: gitA.GitApi | null = null;
let buildApi: buildA.BuildApi | null = null;
let pipelineApi: pipelineA.PipelinesApi | null = null;


async function initializeConnection() {
  if (connection) return;

  let authHandler = azdev.getPersonalAccessTokenHandler(token);
  connection = new azdev.WebApi(orgUrl, authHandler);
  coreApi = await connection.getCoreApi();
  gitApi = await connection.getGitApi();
  buildApi = await connection.getBuildApi();
  pipelineApi = await connection.getPipelinesApi();
}

export async function getProjects() {
  await initializeConnection();
  if (!coreApi) throw new Error("Failed to initialize core API");

  const pagedProjects = await coreApi.getProjects();

  pagedProjects?.forEach(project => {
    console.log(`Project: ${project.name} (${project.id})`);
  });

  return pagedProjects;
}


export async function getRepos(projectId: string) {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  const pagedRepos = await gitApi.getRepositories(projectId);
  pagedRepos?.forEach(repo => {
    console.log(`Repo: ${repo.name} (${repo.id})`);
    console.log(`Clone URL: ${repo.cloneUrl}`);
    console.log(`SSH URL: ${repo.sshUrl}`);
  });
  return pagedRepos;
}


export async function getPipelines(projectId: string) {
  await initializeConnection();

  if (!pipelineApi) throw new Error("Failed to initialize git API");
  const pipelines = await pipelineApi.listPipelines(projectId);

  pipelines?.forEach(pipeline => {
    console.log(`Pipeline: ${pipeline.name} (${pipeline.id})`);
  });
  return pipelines;
}

export async function getPipelineRuns(projectId: string, pipelineId: number) {
  await initializeConnection();

  if (!pipelineApi) throw new Error("Failed to initialize git API");
  const runs = await pipelineApi.listRuns(projectId, pipelineId);

  runs?.forEach(run => {
    console.log(`Run: ${run.name} (${run.id}) - ${run.state}`);
  });
  return runs;
}

export async function getBuildTimeline(projectId: string, buildId: number) {
  await initializeConnection();
  if (!buildApi) throw new Error("Failed to initialize git API");

  const timeline = await buildApi.getBuildTimeline(projectId, buildId);

  return timeline;
}

export async function getPullRequests(projectId: string, repositoryId: string) {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  const pullRequests = await gitApi.getPullRequests(repositoryId, {
    status: 1 // Active PRs (PullRequestStatus.Active = 1)
  }, projectId);

  pullRequests?.forEach(pr => {
    console.log(`PR: ${pr.title} (#${pr.pullRequestId}) - ${pr.status}`);
  });

  return pullRequests;
}

export async function getBuildDefinitions(projectId: string, repositoryId?: string) {
  await initializeConnection();
  if (!buildApi) throw new Error("Failed to initialize build API");

  const definitions = await buildApi.getDefinitions(
    projectId,
    undefined, // name
    repositoryId, // repositoryId
    undefined, // repositoryType
    undefined, // queryOrder
    undefined, // top
    undefined, // continuationToken
    undefined, // minMetricsTime
    undefined, // definitionIds
    undefined, // path
    undefined, // builtAfter
    undefined  // notBuiltAfter
  );

  definitions?.forEach(def => {
    console.log(`Build Definition: ${def.name} (${def.id})`);
  });

  return definitions;
}

export async function getBuildRuns(projectId: string, definitionId: number) {
  await initializeConnection();
  if (!buildApi) throw new Error("Failed to initialize build API");

  const builds = await buildApi.getBuilds(
    projectId,
    [definitionId], // definitions
    undefined, // queues
    undefined, // buildNumber
    undefined, // minTime
    undefined, // maxTime
    undefined, // requestedFor
    undefined, // reasonFilter
    undefined, // statusFilter
    undefined, // resultFilter
    undefined, // tagFilters
    undefined, // properties
    10 // top - get last 10 builds
  );

  builds?.forEach(build => {
    console.log(`Build: ${build.buildNumber} - ${build.status} - ${build.result}`);
  });

  return builds;
}

export async function getPullRequestIterations(projectId: string, repositoryId: string, pullRequestId: number) {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  const iterations = await gitApi.getPullRequestIterations(repositoryId, pullRequestId, projectId, true);
  return iterations;
}

export async function getPullRequestIterationChanges(projectId: string, repositoryId: string, pullRequestId: number, iterationId: number) {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  const changes = await gitApi.getPullRequestIterationChanges(repositoryId, pullRequestId, iterationId, projectId);
  return changes;
}

export async function getItemContent(projectId: string, repositoryId: string, path: string, versionDescriptor?: { version: string; versionType: number }) {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  try {
    const content = await gitApi.getItemContent(repositoryId, path, projectId, undefined, undefined, undefined, undefined, undefined, versionDescriptor as any);
    // Convert readable stream to string
    let result = '';
    for await (const chunk of content) {
      if (typeof chunk === 'string') {
        result += chunk;
      } else if (Buffer.isBuffer(chunk)) {
        result += chunk.toString('utf-8');
      } else {
        result += new TextDecoder().decode(chunk as any);
      }
    }
    return result;
  } catch (error) {
    return null;
  }
}

export async function getPullRequestFileDiff(
  projectId: string, 
  repositoryId: string, 
  pullRequestId: number,
  filePath: string,
  sourceBranch: string,
  targetBranch: string
): Promise<{ originalContent: string; modifiedContent: string } | null> {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  try {
    // Get target (base) version - what the PR is merging into
    const originalContent = await getItemContent(projectId, repositoryId, filePath, {
      version: targetBranch.replace('refs/heads/', ''),
      versionType: 0 // branch
    });

    // Get source version - the PR branch
    const modifiedContent = await getItemContent(projectId, repositoryId, filePath, {
      version: sourceBranch.replace('refs/heads/', ''),
      versionType: 0 // branch
    });

    return {
      originalContent: originalContent || '',
      modifiedContent: modifiedContent || ''
    };
  } catch (error) {
    console.error('Failed to get file diff:', error);
    return null;
  }
}

export async function approvePullRequest(projectId: string, repositoryId: string, pullRequestId: number): Promise<{ success: boolean; message: string }> {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");
  if (!connection) throw new Error("Failed to initialize connection");

  try {
    // Get current user identity
    const locationApi = await connection.getLocationsApi();
    const connectionData = await locationApi.getConnectionData();
    const currentUserId = connectionData.authenticatedUser?.id;
    
    if (!currentUserId) {
      return { success: false, message: 'Could not determine current user' };
    }

    // Vote 10 = Approved
    await gitApi.createPullRequestReviewer(
      { vote: 10 } as any,
      repositoryId,
      pullRequestId,
      currentUserId,
      projectId
    );

    return { success: true, message: 'Pull request approved successfully' };
  } catch (error) {
    return { 
      success: false, 
      message: `Failed to approve PR: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

export async function addPullRequestComment(
  projectId: string, 
  repositoryId: string, 
  pullRequestId: number, 
  comment: string
): Promise<{ success: boolean; message: string }> {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  try {
    await gitApi.createThread(
      {
        comments: [
          {
            content: comment,
            commentType: 1 // Text comment
          }
        ],
        status: 1 // Active
      },
      repositoryId,
      pullRequestId,
      projectId
    );

    return { success: true, message: 'Comment added successfully' };
  } catch (error) {
    return { 
      success: false, 
      message: `Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

export async function completePullRequest(
  projectId: string, 
  repositoryId: string, 
  pullRequestId: number,
  mergeCommitMessage: string,
  deleteSourceBranch: boolean = false
): Promise<{ success: boolean; message: string }> {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");
  if (!connection) throw new Error("Failed to initialize connection");

  try {
    // Get current user identity for the merge
    const locationApi = await connection.getLocationsApi();
    const connectionData = await locationApi.getConnectionData();
    const currentUserId = connectionData.authenticatedUser?.id;

    // Get the current PR to get the last merge source commit
    const pr = await gitApi.getPullRequest(repositoryId, pullRequestId, projectId);
    
    if (!pr.lastMergeSourceCommit?.commitId) {
      return { success: false, message: 'Could not determine merge source commit' };
    }

    // Complete the PR
    await gitApi.updatePullRequest(
      {
        status: 3, // Completed
        lastMergeSourceCommit: pr.lastMergeSourceCommit,
        completionOptions: {
          mergeCommitMessage: mergeCommitMessage,
          deleteSourceBranch: deleteSourceBranch,
          mergeStrategy: 1 // NoFastForward (squash = 3, rebase = 2)
        }
      } as any,
      repositoryId,
      pullRequestId,
      projectId
    );

    return { success: true, message: 'Pull request completed successfully' };
  } catch (error) {
    return { 
      success: false, 
      message: `Failed to complete PR: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

export function getPullRequestUrl(projectName: string, repositoryName: string, pullRequestId: number): string {
  // Azure DevOps PR URL format: https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{prId}
  const org = orgUrl.replace('https://dev.azure.com/', '').replace(/\/$/, '');
  return `https://dev.azure.com/${org}/${encodeURIComponent(projectName)}/_git/${encodeURIComponent(repositoryName)}/pullrequest/${pullRequestId}`;
}

// Get detailed PR info including isDraft
export async function getPullRequestDetails(projectId: string, repositoryId: string, pullRequestId: number) {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  const pr = await gitApi.getPullRequest(repositoryId, pullRequestId, projectId);
  return pr;
}

// Get PR comment threads
export async function getPullRequestThreads(projectId: string, repositoryId: string, pullRequestId: number) {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  const threads = await gitApi.getThreads(repositoryId, pullRequestId, projectId);
  return threads;
}

// Get PR reviewers with their votes
export async function getPullRequestReviewers(projectId: string, repositoryId: string, pullRequestId: number) {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  const reviewers = await gitApi.getPullRequestReviewers(repositoryId, pullRequestId, projectId);
  return reviewers;
}

// Get PR status checks (policy evaluations/builds)
export async function getPullRequestStatuses(projectId: string, repositoryId: string, pullRequestId: number) {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  const statuses = await gitApi.getPullRequestStatuses(repositoryId, pullRequestId, projectId);
  return statuses;
}

// Get PR conflicts
export async function getPullRequestConflicts(projectId: string, repositoryId: string, pullRequestId: number) {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  const conflicts = await gitApi.getPullRequestConflicts(repositoryId, pullRequestId, projectId, undefined, undefined, false, false);
  return conflicts;
}

// Get blob content by SHA
export async function getBlobContent(projectId: string, repositoryId: string, sha: string): Promise<string | null> {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  try {
    const stream = await gitApi.getBlobContent(repositoryId, sha, projectId);
    let result = '';
    for await (const chunk of stream) {
      if (typeof chunk === 'string') {
        result += chunk;
      } else if (Buffer.isBuffer(chunk)) {
        result += chunk.toString('utf-8');
      } else {
        result += new TextDecoder().decode(chunk as any);
      }
    }
    return result;
  } catch (error) {
    console.error('Failed to get blob content:', error);
    return null;
  }
}

// Get conflict details with content
export async function getConflictDetails(
  projectId: string, 
  repositoryId: string, 
  conflict: any
): Promise<{ sourceContent: string; targetContent: string; baseContent: string } | null> {
  try {
    const [sourceContent, targetContent, baseContent] = await Promise.all([
      conflict.sourceBlob?.objectId ? getBlobContent(projectId, repositoryId, conflict.sourceBlob.objectId) : Promise.resolve(''),
      conflict.targetBlob?.objectId ? getBlobContent(projectId, repositoryId, conflict.targetBlob.objectId) : Promise.resolve(''),
      conflict.baseBlob?.objectId ? getBlobContent(projectId, repositoryId, conflict.baseBlob.objectId) : Promise.resolve('')
    ]);

    return {
      sourceContent: sourceContent || '',
      targetContent: targetContent || '',
      baseContent: baseContent || ''
    };
  } catch (error) {
    console.error('Failed to get conflict details:', error);
    return null;
  }
}

// Toggle PR draft status
export async function togglePullRequestDraft(
  projectId: string, 
  repositoryId: string, 
  pullRequestId: number,
  isDraft: boolean
): Promise<{ success: boolean; message: string }> {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  try {
    await gitApi.updatePullRequest(
      { isDraft } as any,
      repositoryId,
      pullRequestId,
      projectId
    );

    return { 
      success: true, 
      message: isDraft ? 'PR marked as draft' : 'PR published (no longer draft)' 
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Failed to update draft status: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

// Add a reviewer to the PR
export async function addPullRequestReviewer(
  projectId: string, 
  repositoryId: string, 
  pullRequestId: number,
  reviewerId: string,
  isRequired: boolean = false
): Promise<{ success: boolean; message: string }> {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  try {
    await gitApi.createPullRequestReviewer(
      { 
        vote: 0, // No vote yet
        isRequired: isRequired
      } as any,
      repositoryId,
      pullRequestId,
      reviewerId,
      projectId
    );

    return { success: true, message: 'Reviewer added successfully' };
  } catch (error) {
    return { 
      success: false, 
      message: `Failed to add reviewer: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

// Remove a reviewer from the PR
export async function removePullRequestReviewer(
  projectId: string, 
  repositoryId: string, 
  pullRequestId: number,
  reviewerId: string
): Promise<{ success: boolean; message: string }> {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  try {
    await gitApi.deletePullRequestReviewer(repositoryId, pullRequestId, reviewerId, projectId);
    return { success: true, message: 'Reviewer removed successfully' };
  } catch (error) {
    return { 
      success: false, 
      message: `Failed to remove reviewer: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

// Get team members for adding as reviewers
export async function getTeamMembers(projectId: string) {
  await initializeConnection();
  if (!coreApi) throw new Error("Failed to initialize core API");

  try {
    // Get the default team for the project
    const teams = await coreApi.getTeams(projectId);
    if (!teams || teams.length === 0) return [];

    const defaultTeam = teams[0];
    const members = await coreApi.getTeamMembersWithExtendedProperties(projectId, defaultTeam.id!);
    return members;
  } catch (error) {
    console.error('Failed to get team members:', error);
    return [];
  }
}

export async function cloneRepo(repoUrl: string, targetPath: string): Promise<{ success: boolean; message: string }> {
  try {
    const { spawn } = require('child_process');
    const os = require('os');
    const path = require('path');
    
    // Expand ~ to home directory
    let expandedPath = targetPath;
    if (expandedPath.startsWith('~/')) {
      expandedPath = path.join(os.homedir(), expandedPath.slice(2));
    } else if (expandedPath === '~') {
      expandedPath = os.homedir();
    }
    
    return new Promise((resolve) => {
      const gitClone = spawn('git', ['clone', repoUrl, expandedPath], {
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      gitClone.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      gitClone.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      gitClone.on('close', (code: number) => {
        if (code === 0) {
          resolve({ 
            success: true, 
            message: `Repository successfully cloned to ${expandedPath}` 
          });
        } else {
          resolve({ 
            success: false, 
            message: `Clone failed: ${errorOutput || 'Unknown error'}` 
          });
        }
      });

      gitClone.on('error', (err: Error) => {
        resolve({ 
          success: false, 
          message: `Clone failed: ${err.message}` 
        });
      });
    });
  } catch (error) {
    return { 
      success: false, 
      message: `Clone failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}


