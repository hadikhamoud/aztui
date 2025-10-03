import { useAppStore } from "../store/app-store"

export function SearchBar() {
  const { 
    isSearchActive, 
    searchQuery,
    focusedBox
  } = useAppStore()

  if (!isSearchActive) {
    return null
  }

  return (
    <group width="100%" height={1}>
      <text>
        /{searchQuery}
      </text>
    </group>
  )
}