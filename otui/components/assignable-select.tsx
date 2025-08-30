import { SelectRenderable, type SelectRenderableOptions } from "@opentui/core"
import { extend } from "@opentui/react"

interface ExtendedSelectRenderableOptions extends SelectRenderableOptions {
  value?: any
}

class ExtendedSelectRenderable extends SelectRenderable {
  constructor(id: string, options: ExtendedSelectRenderableOptions) {
    super(id, options)

    if (options.value !== undefined) {
      this.value = options.value
    }
  }

  get value(): any {
    const selected = this.getSelectedOption()
    return selected ? selected.value : undefined
  }

  set value(val: any) {
    const idx = this.options.findIndex(opt => opt.value === val)
    if (idx >= 0) {
      this.setSelectedIndex(idx)
    }
  }
}

declare module "@opentui/react" {
  interface OpenTUIComponents {
    select: typeof ExtendedSelectRenderable
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      select: any
    }
  }
}

extend({ select: ExtendedSelectRenderable })
