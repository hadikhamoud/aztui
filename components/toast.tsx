import { useEffect, useState } from "react"
import { useTerminalDimensions } from "@opentui/react"
import { TextAttributes } from "@opentui/core"

interface ToastProps {
  message: string | null
  isError?: boolean
  duration?: number
  onDismiss?: () => void
}

export function Toast({ message, isError = false, duration = 3000, onDismiss }: ToastProps) {
  const dimensions = useTerminalDimensions()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        onDismiss?.()
      }, duration)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [message, duration, onDismiss])

  if (!visible || !message) {
    return null
  }

  const borderColor = isError ? "#ef4444" : "#22c55e"
  const textColor = isError ? "#ef4444" : "#22c55e"

  return (
    <box
      position="absolute"
      justifyContent="center"
      alignItems="flex-start"
      top={2}
      right={2}
      maxWidth={Math.min(60, dimensions.width - 6)}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      border={["left", "right", "top", "bottom"]}
      borderColor={borderColor}
      backgroundColor="#000000"
    >
      <text attributes={TextAttributes.BOLD} fg={textColor} wrapMode="word" width="100%">
        {message}
      </text>
    </box>
  )
}
