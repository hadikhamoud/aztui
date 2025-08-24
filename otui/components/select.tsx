import type { SelectOption } from "@opentui/core"
import { useState } from "react"

export function Select({ options, focused }: { options: SelectOption[], focused?: boolean }) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  return (
    <box style={{ height: 24 }}>
      <select
        style={{ height: 22 }}
        options={options}
        focused={focused}
        onChange={(index, option) => {
          setSelectedIndex(index)
          console.log("Selected:", option)
        }}
      />
    </box>
  )
}
