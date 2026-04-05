import * as azdev from "azure-devops-node-api";
import * as coreA from "azure-devops-node-api/CoreApi";
import * as gitA from "azure-devops-node-api/GitApi";
import * as pipelineA from "azure-devops-node-api/PipelinesApi";
import * as buildA from "azure-devops-node-api/BuildApi";
import { execSync } from "child_process";
import { getCredentials } from "../config";

// Initialize from environment or config
let credentials = getCredentials();
let orgUrl = credentials?.orgUrl || "";
let token = credentials?.pat || "";

let connection: azdev.WebApi | null = null;
let coreApi: coreA.ICoreApi | null = null;
let gitApi: gitA.GitApi | null = null;
let buildApi: buildA.BuildApi | null = null;
let pipelineApi: pipelineA.PipelinesApi | null = null;
let connectionPromise: Promise<void> | null = null;

// Reinitialize connection with new credentials
export function reinitializeConnection(newOrgUrl: string, newPat: string): void {
  orgUrl = newOrgUrl;
  token = newPat;
  connection = null;
  coreApi = null;
  gitApi = null;
  buildApi = null;
  pipelineApi = null;
  connectionPromise = null;
}

// Extract org name from the configured org URL
function getOrgName(): string {
  // orgUrl format: https://dev.azure.com/{org}/ or https://{org}.visualstudio.com/
  const match = orgUrl.match(/dev\.azure\.com\/([^\/]+)/) || orgUrl.match(/([^\/]+)\.visualstudio\.com/);
  return match ? match[1] : '';
}

export interface DetectedRepo {
  org: string;
  project: string;
  repoName: string;
}

// Detect if current directory is inside an Azure DevOps git repo
export function detectCurrentRepo(): DetectedRepo | null {
  try {
    // Check if we're in a git repo
    execSync('git rev-parse --git-dir', { stdio: 'pipe' });
    
    // Get the remote URL (try origin first)
    let remoteUrl: string;
    try {
      remoteUrl = execSync('git remote get-url origin', { stdio: 'pipe' }).toString().trim();
    } catch {
      // Try to get any remote
      const remotes = execSync('git remote', { stdio: 'pipe' }).toString().trim().split('\n');
      if (remotes.length === 0 || !remotes[0]) return null;
      remoteUrl = execSync(`git remote get-url ${remotes[0]}`, { stdio: 'pipe' }).toString().trim();
    }
    
    // Parse Azure DevOps URL formats:
    // HTTPS: https://dev.azure.com/{org}/{project}/_git/{repo}
    // HTTPS alt: https://{org}.visualstudio.com/{project}/_git/{repo}
    // SSH: git@ssh.dev.azure.com:v3/{org}/{project}/{repo}
    
    let match: RegExpMatchArray | null = null;
    
    // Try HTTPS format: https://dev.azure.com/{org}/{project}/_git/{repo}
    match = remoteUrl.match(/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/([^\/\s]+)/);
    if (match) {
      return { org: match[1], project: match[2], repoName: match[3].replace(/\.git$/, '') };
    }
    
    // Try visualstudio.com format: https://{org}.visualstudio.com/{project}/_git/{repo}
    match = remoteUrl.match(/([^\/]+)\.visualstudio\.com\/([^\/]+)\/_git\/([^\/\s]+)/);
    if (match) {
      return { org: match[1], project: match[2], repoName: match[3].replace(/\.git$/, '') };
    }
    
    // Try SSH format: git@ssh.dev.azure.com:v3/{org}/{project}/{repo}
    match = remoteUrl.match(/ssh\.dev\.azure\.com:v3\/([^\/]+)\/([^\/]+)\/([^\/\s]+)/);
    if (match) {
      return { org: match[1], project: match[2], repoName: match[3].replace(/\.git$/, '') };
    }
    
    return null;
  } catch {
    // Not in a git repo or git not available
    return null;
  }
}

// Check if detected repo belongs to our configured org
export function isRepoInConfiguredOrg(detected: DetectedRepo): boolean {
  const configuredOrg = getOrgName().toLowerCase();
  return detected.org.toLowerCase() === configuredOrg;
}

async function initializeConnection() {
  // Return existing connection
  if (connection) return;
  
  // Return existing pending connection promise (prevent concurrent initialization)
  if (connectionPromise) return connectionPromise;
  
  if (!orgUrl || !token) {
    throw new Error(`Missing credentials: orgUrl=${orgUrl ? 'SET' : 'EMPTY'}, token=${token ? 'SET' : 'EMPTY'}`);
  }

  // Create and store the connection promise
  connectionPromise = (async () => {
    let authHandler = azdev.getPersonalAccessTokenHandler(token);
    connection = new azdev.WebApi(orgUrl, authHandler);
    coreApi = await connection.getCoreApi();
    gitApi = await connection.getGitApi();
    buildApi = await connection.getBuildApi();
    pipelineApi = await connection.getPipelinesApi();
  })();
  
  return connectionPromise;
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
    console.log(`Clone URL: ${repo.remoteUrl}`);
    console.log(`SSH URL: ${repo.sshUrl}`);
  });
  return pagedRepos;
}

export async function createRepository(
  projectId: string,
  repoName: string
): Promise<{ success: boolean; message: string; repo?: any }> {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  try {
    const repo = await gitApi.createRepository(
      { name: repoName },
      projectId
    );
    
    return {
      success: true,
      message: `Repository '${repoName}' created successfully`,
      repo
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create repository: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
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

export interface BuildStepIssue {
  type: 'error' | 'warning'
  message: string
  category?: string
}

export interface BuildStep {
  id: string
  name: string
  type: string // 'Stage' | 'Job' | 'Task'
  state: 'pending' | 'inProgress' | 'completed'
  result: 'succeeded' | 'failed' | 'canceled' | 'skipped' | 'unknown' | null
  startTime?: Date
  finishTime?: Date
  parentId?: string
  order: number
  percentComplete?: number
  errorCount?: number
  warningCount?: number
  currentOperation?: string  // What's currently happening (for in-progress steps)
  issues?: BuildStepIssue[] // Errors and warnings with messages
  logUrl?: string           // URL to fetch detailed logs
  logId?: number            // Log ID for fetching log content
}

export function getLoggableBuildSteps(steps: BuildStep[]): BuildStep[] {
  return steps.filter(step => step.logId)
}

export async function getBuildTimeline(projectId: string, buildId: number): Promise<BuildStep[]> {
  await initializeConnection();
  if (!buildApi) throw new Error("Failed to initialize build API");

  const timeline = await buildApi.getBuildTimeline(projectId, buildId);
  
  if (!timeline?.records) return [];
  
  // Map timeline records to our BuildStep interface
  // Include all record types to ensure we don't miss any steps
  const steps: BuildStep[] = timeline.records
    .filter(record => record.type && record.name) // Filter out records without type or name
    .map(record => {
      // State: 0 = pending, 1 = inProgress, 2 = completed
      let state: 'pending' | 'inProgress' | 'completed' = 'pending';
      if (record.state === 1) state = 'inProgress';
      else if (record.state === 2) state = 'completed';
      
      // Result: 0 = succeeded, 2 = failed, 3 = canceled, 4 = skipped
      let result: 'succeeded' | 'failed' | 'canceled' | 'skipped' | 'unknown' | null = null;
      if (record.result === 0) result = 'succeeded';
      else if (record.result === 2) result = 'failed';
      else if (record.result === 3) result = 'canceled';
      else if (record.result === 4) result = 'skipped';
      else if (record.result !== undefined && record.result !== null) result = 'unknown';
      
      // Parse issues (errors and warnings)
      const issues: BuildStepIssue[] = (record.issues || []).map((issue: any) => ({
        type: issue.type === 1 ? 'error' : 'warning',
        message: issue.message || '',
        category: issue.category
      }));
      
      return {
        id: record.id || '',
        name: record.name || 'Unknown',
        type: record.type || 'Task',
        state,
        result,
        startTime: record.startTime ? new Date(record.startTime) : undefined,
        finishTime: record.finishTime ? new Date(record.finishTime) : undefined,
        parentId: record.parentId,
        order: record.order || 0,
        percentComplete: record.percentComplete,
        errorCount: record.errorCount,
        warningCount: record.warningCount,
        currentOperation: (record as any).currentOperation,
        issues: issues.length > 0 ? issues : undefined,
        logUrl: record.log?.url,
        logId: record.log?.id
      };
    })
    .sort((a, b) => a.order - b.order);
  
  return steps;
}

// Fetch build log content for a specific step
export async function getBuildStepLogs(projectId: string, buildId: number, logId: number): Promise<string[]> {
  await initializeConnection();
  if (!buildApi) throw new Error("Failed to initialize build API");

  try {
    const logLines = await buildApi.getBuildLogLines(projectId, buildId, logId);
    return logLines || [];
  } catch (error) {
    console.error('Failed to fetch build logs:', error);
    return [];
  }
}

export async function getPullRequests(projectId: string, repositoryId: string, filter: 'active' | 'completed' = 'active') {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  // PullRequestStatus: 1 = Active, 2 = Abandoned, 3 = Completed
  const status = filter === 'active' ? 1 : 3;
  
  const pullRequests = await gitApi.getPullRequests(repositoryId, {
    status
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

  // Get in-progress/queued builds first (status: 1=InProgress, 32=NotStarted, 4=Cancelling)
  const inProgressBuilds = await buildApi.getBuilds(
    projectId,
    [definitionId], // definitions
    undefined, // queues
    undefined, // buildNumber
    undefined, // minTime
    undefined, // maxTime
    undefined, // requestedFor
    undefined, // reasonFilter
    1 | 4 | 32, // statusFilter - InProgress, Cancelling, NotStarted
    undefined, // resultFilter
    undefined, // tagFilters
    undefined, // properties
    10 // top
  );

  // Get completed builds
  const completedBuilds = await buildApi.getBuilds(
    projectId,
    [definitionId], // definitions
    undefined, // queues
    undefined, // buildNumber
    undefined, // minTime
    undefined, // maxTime
    undefined, // requestedFor
    undefined, // reasonFilter
    2, // statusFilter - Completed only
    undefined, // resultFilter
    undefined, // tagFilters
    undefined, // properties
    10 // top
  );

  // Merge: in-progress first, then completed (sorted by queueTime descending)
  const allBuilds = [
    ...(inProgressBuilds || []),
    ...(completedBuilds || [])
  ].sort((a, b) => {
    // Sort by queueTime descending (most recent first)
    const aTime = a.queueTime ? new Date(a.queueTime).getTime() : 0;
    const bTime = b.queueTime ? new Date(b.queueTime).getTime() : 0;
    return bTime - aTime;
  }).slice(0, 10); // Keep top 10

  allBuilds.forEach(build => {
    console.log(`Build: ${build.buildNumber} - status:${build.status} - result:${build.result} - queueTime:${build.queueTime}`);
  });

  return allBuilds;
}

export async function getPullRequestIterations(projectId: string, repositoryId: string, pullRequestId: number) {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  const iterations = await gitApi.getPullRequestIterations(repositoryId, pullRequestId, projectId, true);
  return iterations;
}

export async function getPullRequestIterationChanges(
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
  iterationId: number,
  top?: number,
  skip?: number
) {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  const changes = await gitApi.getPullRequestIterationChanges(
    repositoryId,
    pullRequestId,
    iterationId,
    projectId,
    top,
    skip
  );
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

// Merge strategy enum matching Azure DevOps API
export enum MergeStrategy {
  NoFastForward = 1,  // Merge commit (default)
  Squash = 2,         // Squash all commits
  Rebase = 3,         // Rebase and fast-forward
  RebaseMerge = 4     // Rebase and merge commit (semi-linear)
}

export async function completePullRequest(
  projectId: string, 
  repositoryId: string, 
  pullRequestId: number,
  mergeCommitMessage: string,
  deleteSourceBranch: boolean = false,
  mergeStrategy: MergeStrategy = MergeStrategy.NoFastForward
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
          mergeStrategy: mergeStrategy
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

export function getBuildRunUrl(projectName: string, buildId: number): string {
  // Azure DevOps Build URL format: https://dev.azure.com/{org}/{project}/_build/results?buildId={buildId}
  const org = orgUrl.replace('https://dev.azure.com/', '').replace(/\/$/, '');
  return `https://dev.azure.com/${org}/${encodeURIComponent(projectName)}/_build/results?buildId=${buildId}`;
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

// Get PR work items (linked work items)
export async function getPullRequestWorkItems(
  projectId: string, 
  repositoryId: string, 
  pullRequestId: number
): Promise<{ id: string; url: string }[]> {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  try {
    const workItemRefs = await gitApi.getPullRequestWorkItemRefs(repositoryId, pullRequestId, projectId);
    return (workItemRefs || []).map(ref => ({
      id: ref.id || '',
      url: ref.url || ''
    }));
  } catch (error) {
    console.error('Failed to get PR work items:', error);
    return [];
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

// Get branches for a repository
export async function getBranches(projectId: string, repositoryId: string) {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  const refs = await gitApi.getRefs(repositoryId, projectId, "heads/");
  return refs?.map(ref => ({
    name: ref.name?.replace('refs/heads/', '') || '',
    objectId: ref.objectId || ''
  })) || [];
}

// Create a new pull request
export async function createPullRequest(
  projectId: string,
  repositoryId: string,
  sourceBranch: string,
  targetBranch: string,
  title: string,
  description: string,
  reviewerIds: string[] = [],
  isDraft: boolean = false
): Promise<{ success: boolean; message: string; pullRequestId?: number }> {
  await initializeConnection();
  if (!gitApi) throw new Error("Failed to initialize git API");

  try {
    // Create the PR
    const pr = await gitApi.createPullRequest(
      {
        sourceRefName: `refs/heads/${sourceBranch}`,
        targetRefName: `refs/heads/${targetBranch}`,
        title,
        description,
        isDraft,
        reviewers: reviewerIds.map(id => ({ id }))
      },
      repositoryId,
      projectId
    );

    if (!pr || !pr.pullRequestId) {
      return { success: false, message: 'Failed to create pull request' };
    }

    return { 
      success: true, 
      message: `Pull request #${pr.pullRequestId} created successfully`,
      pullRequestId: pr.pullRequestId
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Failed to create PR: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

export async function cloneRepo(
  repoUrl: string,
  targetPath: string,
  onOutput?: (chunk: string) => void
): Promise<{ success: boolean; message: string; logs: string[] }> {
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
      const env = {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND
          ? `${process.env.GIT_SSH_COMMAND} -oBatchMode=yes`
          : 'ssh -oBatchMode=yes'
      }

      const gitClone = spawn('git', ['clone', repoUrl, expandedPath], {
        stdio: 'pipe',
        env
      });

      let output = '';
      let errorOutput = '';
      const logs: string[] = [];

      const appendOutput = (chunk: string) => {
        const normalized = chunk.replace(/\r/g, '');
        const lines = normalized.split('\n').filter(Boolean);
        if (lines.length > 0) {
          logs.push(...lines);
        }
        onOutput?.(chunk);
      }

      gitClone.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        output += chunk;
        appendOutput(chunk);
      });

      gitClone.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        errorOutput += chunk;
        appendOutput(chunk);
      });

      gitClone.on('close', (code: number) => {
        if (code === 0) {
          resolve({ 
            success: true, 
            message: `Repository successfully cloned to ${expandedPath}`,
            logs
          });
        } else {
          const combinedOutput = `${errorOutput}\n${output}`.trim();
          const requiresAuth = /could not read from remote repository|permission denied|terminal prompts disabled|batchmode=yes|could not read username|authentication failed|enter passphrase|password/i.test(combinedOutput)
          const message = requiresAuth
            ? 'Clone failed: SSH/HTTPS authentication requires an interactive prompt. Use an ssh-agent or loaded key for SSH, or ensure your PAT-backed HTTPS URL is valid.'
            : `Clone failed: ${combinedOutput || 'Unknown error'}`

          resolve({ 
            success: false, 
            message,
            logs
          });
        }
      });

      gitClone.on('error', (err: Error) => {
        resolve({ 
          success: false, 
          message: `Clone failed: ${err.message}`,
          logs
        });
      });
    });
  } catch (error) {
    return { 
      success: false, 
      message: `Clone failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      logs: []
    };
  }
}
