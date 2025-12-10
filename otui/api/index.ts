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


