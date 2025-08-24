import { render } from "@opentui/react"
import { useKeyboard } from "@opentui/react"
import { Select } from "./components/select"
import type { SelectOption } from "@opentui/core"
import { useState } from "react"

function App() {

  const [focused, setFocused] = useState(0)

  useKeyboard((key) => {
    if (key.name === "tab") {
      setFocused((focused + 1) % 2)
    }
  })

  const projectOptions: SelectOption[] = [
    { name: "Project1", value: "Project1", description: "Project1 description" },
    { name: "Project2", value: "Project2", description: "Project2 description" },
  ];

  const repoOptions: SelectOption[] = [

    { name: "Repo1", value: "Repo1", description: "Repo1 description" },
    { name: "Repo2", value: "Repo2", description: "Repo2 description" },
  ];

  return (
    <group>
      <box title="Projects" padding={2} borderStyle="rounded">
        <Select options={projectOptions} focused={focused === 0} />
      </box>
      <box title="Repos" padding={2} borderStyle="rounded">
        <Select options={repoOptions} focused={focused === 1} />
      </box>
    </group>
  )
}

render(<App />)
