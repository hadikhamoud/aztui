import type { SelectOption } from "@opentui/core"
import "./assignable-select"

export function Select({ options, focused, value, highlightedIndex, isSearchActive, isSelectMode, onSelect }: { options: SelectOption[], focused?: boolean, value?: any, highlightedIndex?: number, isSearchActive?: boolean, isSelectMode?: boolean, onSelect?: (value: string) => void }) {
  return (
    <select
      value={value}
      {...(highlightedIndex !== undefined && { highlightedIndex })}
      style={{ height: 22, focusedBackgroundColor: "transparent", selectedBackgroundColor: "#007595" }}
      options={options}
      focused={focused && (!isSearchActive || isSelectMode)}
      onChange={(_, option) => {
        if (onSelect && option) {
          onSelect(option.value)
        }
      }}
    />
  )
}
