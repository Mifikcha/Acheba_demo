export declare global {
  interface Document {
    addEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void,
    ): void
    removeEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void,
    ): void
    dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K] | UIEvent): void
  }
  interface Window {
    spaNavigate(url: URL, isBack: boolean = false)
    addCleanup(fn: (...args: any[]) => void)
    hopesSystem?: {
      player?: {
        snapshot(): {
          title: string
          state: "playing" | "paused"
          volume: number
          error?: string | null
        }
        play(): Promise<void>
        pause(): void
        previous(): void
        next(): void
        setVolume(value: number): void
      }
      focus?: {
        snapshot(): "on" | "off"
        set(enabled: boolean): void
      }
    }
  }
}
