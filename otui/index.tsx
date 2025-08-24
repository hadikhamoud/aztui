import { render } from "@opentui/react"
import { useKeyboard } from "@opentui/react"
import { Select } from "./components/select"
import { Logo } from "./components/logo"
import type { SelectOption } from "@opentui/core"
import { useState } from "react"
import { useTerminalDimensions } from "@opentui/react"

function App() {

  const [focused, setFocused] = useState(0)
  const [searchBarAvailable, setSearchBarAvailable] = useState(false)
  const { width, height } = useTerminalDimensions()

  useKeyboard((key) => {
    if (key.name === "tab") {
      setFocused((focused + 1) % 2)
    }
    if (key.name === "/") {
      setSearchBarAvailable(!searchBarAvailable)
    }
  })

  const projectOptions: SelectOption[] = Array.from({ length: 200 }, (_, i) => {
    const index = i + 1
    return {
      name: `Project${index}`,
      value: `Project${index}`,
      description: `Project${index} description`,
    }
  })
  const repoOptions: SelectOption[] = [

    { name: "Repo1", value: "Repo1", description: "Repo1 description" },
    { name: "Repo2", value: "Repo2", description: "Repo2 description" },
  ];

  return (
    <group width={width} height={height - 5} flexDirection="row" >

      <group flexDirection="column" width={width / 2} height={height}>
        <box title="projects" padding={0.5} borderStyle="rounded" height={height / 2} borderColor={focused === 0 ? "#007595" : "white"}>
          <Select options={projectOptions} focused={focused === 0} />
        </box>
        <box title="Repos" padding={0.5} borderStyle="rounded" height={height / 2} borderColor={focused === 1 ? "#007595" : "white"}>
          <Select options={repoOptions} focused={focused === 1} />
        </box>

      </group>

      <box title="workspace" padding={2} borderStyle="rounded" width={width / 2} height={height}>
        <Logo />
        <input focused={searchBarAvailable} placeholder="Search..." />

      </box>
    </group>
  )
}

render(<App />)
