import type { SelectOption } from "@opentui/core"
import "./assignable-select"

export function Select({ options, focused, value, highlightedIndex, isSearchActive, isSelectMode, onSelect, onChange }: { options: SelectOption[], focused?: boolean, value?: any, highlightedIndex?: number, isSearchActive?: boolean, isSelectMode?: boolean, onSelect?: (value: string) => void, onChange?: (value: string) => void }) {
  // When search is active, use highlightedIndex; otherwise find index from value
  const selectedIndex = highlightedIndex !== undefined 
    ? highlightedIndex 
    : options.findIndex(o => o.value === value)
  
  return (
    <select
      selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
      style={{ height: 22, focusedBackgroundColor: "transparent", selectedBackgroundColor: "#007595" }}
      options={options}
      focused={focused && (!isSearchActive || isSelectMode)}
      onChange={(_, option) => {
        // Don't trigger onChange during search to prevent infinite loops
        if (onChange && option && !isSearchActive) {
          onChange(option.value)
        }
      }}
      onSelect={(_, option) => {
        if (onSelect && option) {
          onSelect(option.value)
        }
      }}
    />
  )
}
