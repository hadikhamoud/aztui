import * as azdev from "azure-devops-node-api";
import * as coreA from "azure-devops-node-api/CoreApi";
import * as gitA from "azure-devops-node-api/GitApi";
import * as pipelineA from "azure-devops-node-api/PipelinesApi";
import * as buildA from "azure-devops-node-api/BuildApi";

let orgUrl = Bun.env.AZURE_ORG_URL || "";
let token: string = Bun.env.AZURE_PAT || "";

let connection: azdev.WebApi | null = null;
let core: coreA.ICoreApi | null = null;
let git: gitA.GitApi | null = null;

async function initializeConnection() {
  if (connection) return;

  let authHandler = azdev.getPersonalAccessTokenHandler(token);
  connection = new azdev.WebApi(orgUrl, authHandler);
  core = await connection.getCoreApi();
  git = await connection.getGitApi();
}

export async function getProjects() {
  await initializeConnection();
  if (!core) throw new Error("Failed to initialize core API");

  const pagedProjects = await core.getProjects();

  pagedProjects?.forEach(project => {
    console.log(`Project: ${project.name} (${project.id})`);
  });

  return pagedProjects;
}


export async function getRepos(projectId: string) {
  await initializeConnection();
  if (!git) throw new Error("Failed to initialize git API");

  const pagedRepos = await git.getRepositories(projectId);
  pagedRepos?.forEach(repo => {
    console.log(`Repo: ${repo.name} (${repo.id})`);
  });
  return pagedRepos;
}


export async function getPipelines(projectId: string) {
  await initializeConnection();
  if (!connection) throw new Error("Failed to initialize connection");
  
  const pipelinesApi = await connection.getPipelinesApi();
  const pipelines = await pipelinesApi.listPipelines(projectId);
  
  pipelines?.forEach(pipeline => {
    console.log(`Pipeline: ${pipeline.name} (${pipeline.id})`);
  });
  return pipelines;
}

export async function getPipelineRuns(projectId: string, pipelineId: number) {
  await initializeConnection();
  if (!connection) throw new Error("Failed to initialize connection");
  
  const pipelinesApi = await connection.getPipelinesApi();
  const runs = await pipelinesApi.listRuns(projectId, pipelineId);
  
  runs?.forEach(run => {
    console.log(`Run: ${run.name} (${run.id}) - ${run.state}`);
  });
  return runs;
}

export async function getBuildTimeline(projectId: string, buildId: number) {
  await initializeConnection();
  if (!connection) throw new Error("Failed to initialize connection");
  
  const buildApi = await connection.getBuildApi();
  const timeline = await buildApi.getBuildTimeline(projectId, buildId);
  
  return timeline;
}

