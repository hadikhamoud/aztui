import type { SelectOption } from "@opentui/core"
import { useState } from "react"
import { useKeyboard } from "@opentui/react"

export function Select({ options, focused, onSelect }: { options: SelectOption[], focused?: boolean, onSelect?: (value: string) => void }) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useKeyboard((key) => {
    if (focused && key.name === "return" && options[selectedIndex]) {
      onSelect?.(options[selectedIndex].value)
    }
  })

  return (
    <select
      style={{ height: 22, focusedBackgroundColor: "transparent", selectedBackgroundColor: "#007595" }}
      options={options}
      focused={focused}
      onChange={(index, option) => {
        setSelectedIndex(index)
      }}
    />
  )
}
