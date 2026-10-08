import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createShellIdentity,
  formatExamCountdown,
  shouldFocusPromptFromSurface,
} from "./system-console.presentation"

describe("system console presentation", () => {
  it("builds the guest prompt from profile mode", () => {
    assert.deepEqual(createShellIdentity("guest", null), {
      user: "guest",
      prompt: "hnd:\\guest>",
      profile: "none",
    })
  })

  it("uses the connected profile id in the shell path", () => {
    assert.deepEqual(createShellIdentity("student", { id: "sergey", displayName: "Сергей" }), {
      user: "sergey",
      prompt: "hnd:\\sergey>",
      profile: "connected",
    })
  })

  it("returns focus to the prompt for a plain desktop surface click", () => {
    assert.equal(
      shouldFocusPromptFromSurface({
        button: 0,
        pointerType: "mouse",
        hasSelection: false,
        clickedInteractive: false,
        clickedScrollbar: false,
      }),
      true,
    )
  })

  it("preserves selection, controls, scrollbars, touch and non-primary clicks", () => {
    const interaction = {
      button: 0,
      pointerType: "mouse",
      hasSelection: false,
      clickedInteractive: false,
      clickedScrollbar: false,
    }

    assert.equal(shouldFocusPromptFromSurface({ ...interaction, hasSelection: true }), false)
    assert.equal(shouldFocusPromptFromSurface({ ...interaction, clickedInteractive: true }), false)
    assert.equal(shouldFocusPromptFromSurface({ ...interaction, clickedScrollbar: true }), false)
    assert.equal(shouldFocusPromptFromSurface({ ...interaction, pointerType: "touch" }), false)
    assert.equal(shouldFocusPromptFromSurface({ ...interaction, button: 1 }), false)
  })

  it("formats the remaining time until June 1", () => {
    assert.equal(formatExamCountdown(new Date(2026, 4, 30, 23, 58, 55)), "01:00:01:05")
  })

  it("pads every countdown field to at least two digits", () => {
    assert.equal(formatExamCountdown(new Date(2026, 4, 31, 23, 59, 55)), "00:00:00:05")
  })

  it("counts down to next year once June 1 begins", () => {
    assert.equal(formatExamCountdown(new Date(2026, 5, 1, 0, 0, 0)), "365:00:00:00")
  })
})
