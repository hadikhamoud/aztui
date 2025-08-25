import { render } from "@opentui/react"
import { useKeyboard } from "@opentui/react"
import { Select } from "./components/select"
import { Logo } from "./components/logo"
import type { SelectOption } from "@opentui/core"
import { useState } from "react"
import { useTerminalDimensions } from "@opentui/react"
import { getProjects, getRepos } from "./api"

const projects = await getProjects()

function App() {

  const [focused, setFocused] = useState(0)
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0)
  const [selectedProjectName, setSelectedProjectName] = useState<string>("")
  const [repoOptions, setRepoOptions] = useState<SelectOption[]>([])
  const { width, height } = useTerminalDimensions()

  useKeyboard((key) => {
    if (key.name === "tab") {
      setFocused((focused + 1) % 2)
    }
     if (key.name === "return") {
       if (focused === 0 && projectOptions[selectedProjectIndex]) {
         const selectedProject = projectOptions[selectedProjectIndex]
         setSelectedProjectName(selectedProject.name)
         handleProjectSelect(selectedProject.value)
       }
      if (focused === 1) {
        console.log("repo selected")
      }
    }
  })

  const handleProjectSelect = async (projectId: string) => {
    const repos = await getRepos(projectId)
    const options = repos?.map(r => ({
      name: `${r.name}`,
      value: `${r.id}`,
      description: `${r.id}`,
    })) || []
    setRepoOptions(options)
  }

  const projectOptions: SelectOption[] = projects?.map(p => ({
    name: `${p.name}`,
    value: `${p.id}`,
    description: `${p.id}`,
  })) || []

  return (
    <group width={width} height={height} flexDirection="row" >

      <group flexDirection="column" width={width / 2} height={height}>
        <box title="projects" padding={0.5} borderStyle="rounded" height={height / 2} borderColor={focused === 0 ? "#007595" : "white"}>
          <Select options={projectOptions} focused={focused === 0} onSelect={(value) => setSelectedProjectIndex(projectOptions.findIndex(p => p.value === value))} />
        </box>
        <box title={selectedProjectName ? `repos - ${selectedProjectName}` : "repos"} padding={0.5} borderStyle="rounded" height={height / 2} borderColor={focused === 1 ? "#007595" : "white"}>
          <Select options={repoOptions} focused={focused === 1} />
        </box>

      </group>

      <box title="workspace" padding={2} borderStyle="rounded" width={width / 2} height={height}>
        <Logo />
      </box>
    </group>
  )
}

render(<App />)
