import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hidePlayerPopover, isPlayerPopoverOpen, showPlayerPopover } from "./study-player-popover"

describe("study player popover", () => {
  it("uses the browser top layer when the Popover API is available", () => {
    let topLayerOpen = false
    const popover = {
      hidden: true,
      matches: (selector: string) => selector === ":popover-open" && topLayerOpen,
      showPopover: () => {
        topLayerOpen = true
      },
      hidePopover: () => {
        topLayerOpen = false
      },
    }

    showPlayerPopover(popover)

    assert.equal(popover.hidden, false)
    assert.equal(isPlayerPopoverOpen(popover), true)

    hidePlayerPopover(popover)

    assert.equal(isPlayerPopoverOpen(popover), false)
    assert.equal(popover.hidden, true)
  })

  it("falls back to the hidden attribute without native popovers", () => {
    const popover = {
      hidden: true,
      matches: () => false,
    }

    showPlayerPopover(popover)
    assert.equal(isPlayerPopoverOpen(popover), true)

    hidePlayerPopover(popover)
    assert.equal(isPlayerPopoverOpen(popover), false)
  })
})
