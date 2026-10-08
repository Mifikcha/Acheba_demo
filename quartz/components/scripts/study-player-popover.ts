export type PlayerPopoverElement = {
  hidden: boolean
  matches(selector: string): boolean
  showPopover?: () => void
  hidePopover?: () => void
}

const supportsTopLayer = (
  popover: PlayerPopoverElement,
): popover is PlayerPopoverElement &
  Required<Pick<PlayerPopoverElement, "showPopover" | "hidePopover">> =>
  typeof popover.showPopover === "function" && typeof popover.hidePopover === "function"

export const isPlayerPopoverOpen = (popover: PlayerPopoverElement): boolean =>
  supportsTopLayer(popover) ? popover.matches(":popover-open") : !popover.hidden

export function showPlayerPopover(popover: PlayerPopoverElement): void {
  popover.hidden = false
  if (supportsTopLayer(popover)) popover.showPopover()
}

export function hidePlayerPopover(popover: PlayerPopoverElement): void {
  if (supportsTopLayer(popover) && popover.matches(":popover-open")) popover.hidePopover()
  popover.hidden = true
}
