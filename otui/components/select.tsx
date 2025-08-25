import type { SelectOption } from "@opentui/core"
import { useState } from "react"

export function Select({ options, focused, onSelect }: { options: SelectOption[], focused?: boolean, onSelect?: (value: string) => void }) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  return (
    <select
      style={{ height: 22, focusedBackgroundColor: "transparent", selectedBackgroundColor: "#007595" }}
      options={options}
      focused={focused}
      onChange={(index, option) => {
        setSelectedIndex(index)
        if (onSelect && option) {
          onSelect(option.value)
        }
      }}
    />
  )
}
