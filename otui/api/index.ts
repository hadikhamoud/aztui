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


