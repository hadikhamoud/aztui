import { bold, fg, t, RGBA } from "@opentui/core"


export function Logo() {
  const fgColor = new RGBA(new Float32Array([0 / 255, 117 / 255, 149 / 255, 1]))
  return (
    <ascii-font text={"AZTUI"} font={"block"} fg={fgColor} />
  )
}
