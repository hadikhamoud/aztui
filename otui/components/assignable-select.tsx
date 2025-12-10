import { SelectRenderable, type SelectRenderableOptions, type SelectOption } from "@opentui/core"
import { extend } from "@opentui/react"

interface ExtendedSelectRenderableOptions extends SelectRenderableOptions {
  value?: any
}

class ExtendedSelectRenderable extends SelectRenderable {
  private _value: any = undefined

  constructor(id: string, options: ExtendedSelectRenderableOptions) {
    super(id, options)

    if (options.value !== undefined) {
      this._value = options.value
      this.syncSelectedIndex()
    }
  }

  get value(): any {
    return this._value
  }

  set value(val: any) {
    this._value = val
    this.syncSelectedIndex()
  }

  // Override options setter to re-sync selected index when options change
  set options(opts: SelectOption[]) {
    super.options = opts
    this.syncSelectedIndex()
  }

  get options(): SelectOption[] {
    return super.options
  }

  private syncSelectedIndex() {
    if (this._value !== undefined) {
      const idx = this.options.findIndex(opt => opt.value === this._value)
      if (idx >= 0) {
        this.setSelectedIndex(idx)
      }
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
