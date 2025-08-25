import * as azdev from "azure-devops-node-api";
import * as coreA from "azure-devops-node-api/CoreApi";
import * as gitA from "azure-devops-node-api/GitApi";

let orgUrl = Bun.env.AZURE_ORG_URL || "";

let token: string = Bun.env.AZURE_PAT || "";
let authHandler = azdev.getPersonalAccessTokenHandler(token);
let connection = new azdev.WebApi(orgUrl, authHandler);
let core: coreA.ICoreApi = await connection.getCoreApi();
let git: gitA.GitApi = await connection.getGitApi();

export async function getProjects() {
  const pagedProjects = await core.getProjects();

  pagedProjects?.forEach(project => {
    console.log(`Project: ${project.name} (${project.id})`);
  });

  return pagedProjects;
}


export async function getRepos(projectId: string) {
  const pagedRepos = await git.getRepositories(projectId);
  pagedRepos?.forEach(repo => {
    console.log(`Repo: ${repo.name} (${repo.id})`);
  });
  return pagedRepos;
}



