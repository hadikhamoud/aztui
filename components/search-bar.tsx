import { useAppStore } from "../store/app-store"

export function SearchBar() {
  const {
    isSearchActive,
    searchQuery,
    searchTargetBox
  } = useAppStore()

  if (!isSearchActive) {
    return null
  }

  const targetLabel = searchTargetBox === 'projects' ? 'projects' 
    : searchTargetBox === 'repos' ? 'repos' 
    : searchTargetBox === 'workspace' ? 'workspace' 
    : ''

  return (
    <box width="100%" height={1}>
      <text>
        /{searchQuery} ({targetLabel})
      </text>
    </box>
  )
}
