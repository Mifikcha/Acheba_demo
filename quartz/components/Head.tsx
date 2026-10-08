import { i18n } from "../i18n"
import { FullSlug, getFileExtension, joinSegments, pathToRoot } from "../util/path"
import { CSSResourceToStyleElement, JSResourceToScriptElement } from "../util/resources"
import { googleFontHref, googleFontSubsetHref } from "../util/theme"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { unescapeHTML } from "../util/escape"

export default (() => {
  const Head: QuartzComponent = ({
    cfg,
    fileData,
    externalResources,
    ctx,
  }: QuartzComponentProps) => {
    const titleSuffix = cfg.pageTitleSuffix ?? ""
    const title =
      (fileData.frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title) + titleSuffix
    const description =
      fileData.frontmatter?.socialDescription ??
      fileData.frontmatter?.description ??
      unescapeHTML(fileData.description?.trim() ?? i18n(cfg.locale).propertyDefaults.description)

    const { css, js, additionalHead } = externalResources

    const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
    const path = url.pathname as FullSlug
    const baseDir = fileData.slug === "404" ? path : pathToRoot(fileData.slug!)
    const iconPath = joinSegments(baseDir, "static/icon.png")

    // Url of current page
    const socialUrl =
      fileData.slug === "404" ? url.toString() : joinSegments(url.toString(), fileData.slug!)

    const usesCustomOgImage = ctx.cfg.plugins.emitters.some((e) => e.name === "CustomOgImages")
    const ogImageDefaultPath = `https://${cfg.baseUrl}/static/og-image.png`

    const coreStylesheet = css[0]?.content
    const coreScript = js.find(
      (r) => r.loadTime === "beforeDOMReady" && r.contentType === "external",
    )

    return (
      <head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        {coreStylesheet && <link rel="preload" href={coreStylesheet} as="style" />}
        {coreScript && coreScript.contentType === "external" && (
          <link rel="preload" href={coreScript.src} as="script" />
        )}
        {cfg.theme.cdnCaching && cfg.theme.fontOrigin === "googleFonts" && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" />
            <link rel="stylesheet" href={googleFontHref(cfg.theme)} />
            {cfg.theme.typography.title && (
              <link rel="stylesheet" href={googleFontSubsetHref(cfg.theme, cfg.pageTitle)} />
            )}
          </>
        )}
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <meta name="og:site_name" content={cfg.pageTitle}></meta>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta property="og:description" content={description} />
        <meta property="og:image:alt" content={description} />

        {!usesCustomOgImage && (
          <>
            <meta property="og:image" content={ogImageDefaultPath} />
            <meta property="og:image:url" content={ogImageDefaultPath} />
            <meta name="twitter:image" content={ogImageDefaultPath} />
            <meta
              property="og:image:type"
              content={`image/${getFileExtension(ogImageDefaultPath) ?? "png"}`}
            />
          </>
        )}

        {cfg.baseUrl && (
          <>
            <meta property="twitter:domain" content={cfg.baseUrl}></meta>
            <meta property="og:url" content={socialUrl}></meta>
            <meta property="twitter:url" content={socialUrl}></meta>
          </>
        )}

        <link rel="icon" href={iconPath} />
        <meta name="description" content={description} />
        <meta name="generator" content="Quartz" />

        {css.map((resource) => CSSResourceToStyleElement(resource, true))}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((res) => JSResourceToScriptElement(res, true))}
        {additionalHead.map((resource) => {
          if (typeof resource === "function") {
            return resource(fileData)
          } else {
            return resource
          }
        })}
        <style
          data-hopes-layout-fix
          dangerouslySetInnerHTML={{
            __html: `
@media (min-width: 1200px) {
  html body[data-slug] #quartz-root.page:not([data-frame="canvas"]):not([data-frame="excalidraw"]) {
    width: 100vw !important;
    max-width: none !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    transform: none !important;
  }

  html body[data-slug] #quartz-root.page > #quartz-body {
    width: 100vw !important;
    max-width: none !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    grid-template-columns: 320px minmax(0, 1fr) 320px !important;
    column-gap: 0.5rem !important;
  }

  html body[data-slug] #quartz-root.page > #quartz-body > .left.sidebar {
    margin-left: 0 !important;
    transform: none !important;
  }
}

html body[data-slug] #quartz-root.page[data-frame="excalidraw"] {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  max-width: none !important;
  height: 100dvh !important;
  min-height: 100dvh !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: var(--excalidraw-bg, var(--light)) !important;
}

html body[data-slug] #quartz-root.page[data-frame="coding-lesson"] {
  width: 100vw !important;
  max-width: none !important;
  min-height: 100dvh !important;
  margin: 0 !important;
  padding: 0 !important;
}

html body[data-slug] #quartz-root.page[data-frame="coding-lesson"] > #quartz-body {
  display: block !important;
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

html body[data-slug] #quartz-root.page[data-frame="excalidraw"] > #quartz-body {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) !important;
  grid-template-rows: minmax(0, 1fr) !important;
  grid-template-areas: "grid-center" !important;
  width: 100vw !important;
  height: 100dvh !important;
  min-height: 100dvh !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

html body[data-slug] #quartz-root.page[data-frame="excalidraw"] .center.excalidraw-frame,
html body[data-slug] #quartz-root.page[data-frame="excalidraw"] .excalidraw-stage,
html body[data-slug] #quartz-root.page[data-frame="excalidraw"] .excalidraw-page,
html body[data-slug] #quartz-root.page[data-frame="excalidraw"] .excalidraw-container {
  box-sizing: border-box !important;
  width: 100vw !important;
  max-width: none !important;
  height: 100dvh !important;
  min-height: 100dvh !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

html body[data-slug] #quartz-root.page[data-frame="excalidraw"] .excalidraw-container {
  background-color: var(--excalidraw-bg, #121212) !important;
}

html body[data-slug] #quartz-root.page[data-frame="excalidraw"] .excalidraw-container svg {
  width: 100vw !important;
  height: 100dvh !important;
  max-width: none !important;
  max-height: none !important;
}

html body[data-slug] #quartz-root.page[data-frame="excalidraw"] .excalidraw-controls {
  right: 1rem !important;
  bottom: 1rem !important;
}

html {
  --scrollbar-bg: var(--site-scrollbar-track) !important;
  --scrollbar-thumb-bg: var(--site-scrollbar-thumb) !important;
  --scrollbar-active-thumb-bg: var(--site-scrollbar-thumb-hover) !important;
  --scrollbar-width: var(--site-scrollbar-size) !important;
  --scrollbar-height: var(--site-scrollbar-size) !important;
  --scrollbar-border-width: 2px !important;
  --scrollbar-radius: var(--site-scrollbar-radius) !important;
  scrollbar-color: var(--site-scrollbar-thumb) var(--site-scrollbar-track) !important;
  scrollbar-width: thin !important;
}

html::-webkit-scrollbar,
body::-webkit-scrollbar,
*::-webkit-scrollbar {
  width: var(--site-scrollbar-size) !important;
  height: var(--site-scrollbar-size) !important;
}

html::-webkit-scrollbar-track,
body::-webkit-scrollbar-track,
*::-webkit-scrollbar-track {
  border-radius: var(--site-scrollbar-radius) !important;
  background: var(--site-scrollbar-track) !important;
  background-color: var(--site-scrollbar-track) !important;
}

html::-webkit-scrollbar-thumb,
body::-webkit-scrollbar-thumb,
*::-webkit-scrollbar-thumb {
  min-width: 2.5rem !important;
  min-height: 2.5rem !important;
  border: 2px solid var(--site-scrollbar-track) !important;
  border-radius: var(--site-scrollbar-radius) !important;
  background: var(--site-scrollbar-thumb) !important;
  background-color: var(--site-scrollbar-thumb) !important;
}

html::-webkit-scrollbar-thumb:hover,
body::-webkit-scrollbar-thumb:hover,
*::-webkit-scrollbar-thumb:hover {
  background: var(--site-scrollbar-thumb-hover) !important;
  background-color: var(--site-scrollbar-thumb-hover) !important;
}

html::-webkit-scrollbar-thumb:active,
body::-webkit-scrollbar-thumb:active,
*::-webkit-scrollbar-thumb:active {
  background: var(--site-scrollbar-thumb-active) !important;
  background-color: var(--site-scrollbar-thumb-active) !important;
}

html::-webkit-scrollbar-corner,
body::-webkit-scrollbar-corner,
*::-webkit-scrollbar-corner {
  background: var(--site-scrollbar-track) !important;
  background-color: var(--site-scrollbar-track) !important;
}

.python-checker {
  --scrollbar-bg: var(--python-scrollbar-track) !important;
  --scrollbar-thumb-bg: var(--python-scrollbar-thumb) !important;
  --scrollbar-active-thumb-bg: var(--python-scrollbar-thumb-hover) !important;
}

.python-checker-editor,
.python-checker-output {
  scrollbar-color: var(--python-scrollbar-thumb) var(--python-scrollbar-track) !important;
}

.python-checker-editor::-webkit-scrollbar-track,
.python-checker-output::-webkit-scrollbar-track {
  background: var(--python-scrollbar-track) !important;
  background-color: var(--python-scrollbar-track) !important;
}

.python-checker-editor::-webkit-scrollbar-thumb,
.python-checker-output::-webkit-scrollbar-thumb {
  border-color: var(--python-scrollbar-track) !important;
  background: var(--python-scrollbar-thumb) !important;
  background-color: var(--python-scrollbar-thumb) !important;
}

.python-checker-editor::-webkit-scrollbar-thumb:hover,
.python-checker-output::-webkit-scrollbar-thumb:hover {
  background: var(--python-scrollbar-thumb-hover) !important;
  background-color: var(--python-scrollbar-thumb-hover) !important;
}

.katex,
.katex .katex-html,
html body[data-slug] .katex-display > .katex,
html body[data-slug] .katex-display > .katex > .katex-html,
.katex .mrel,
.katex .mrel .mord,
.katex .mrel .inner {
  font-family: KaTeX_Main, "Times New Roman", serif !important;
}

.katex {
  overflow-wrap: normal !important;
  text-wrap: nowrap !important;
  word-break: normal !important;
}

html body[data-slug] .katex-display {
  display: block !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  padding-block: 0.55em !important;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

html body[data-slug] .katex-display::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
}

html body[data-slug] .search > .search-container.active {
  background: rgba(250, 246, 215, 0.48) !important;
  -webkit-backdrop-filter: blur(10px) saturate(1.05) !important;
  backdrop-filter: blur(10px) saturate(1.05) !important;
}

html[saved-theme="dark"] body[data-slug] .search > .search-container.active {
  background: rgba(17, 19, 32, 0.52) !important;
}

html body[data-slug] .search > .search-container.active > .search-space > input,
html body[data-slug] .search > .search-container.active > .search-space > .search-layout,
html body[data-slug] .search > .search-container.active > .search-space > .tag-suggestions {
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--site-panel-glass) 82%, var(--secondary)),
      color-mix(in srgb, var(--light) 68%, transparent) 135%
    ),
    color-mix(in srgb, var(--light) 74%, transparent) !important;
}

html body[data-slug] .callout.is-collapsed > .callout-content {
  display: none !important;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  html body[data-slug] .search > .search-container.active {
    background: rgba(250, 246, 215, 0.68) !important;
  }

  html[saved-theme="dark"] body[data-slug] .search > .search-container.active {
    background: rgba(17, 19, 32, 0.72) !important;
  }
}
`,
          }}
        />
      </head>
    )
  }

  return Head
}) satisfies QuartzComponentConstructor
