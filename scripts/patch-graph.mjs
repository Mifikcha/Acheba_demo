import fs from "node:fs"
import path from "node:path"

const graphFiles = [
  path.join(process.cwd(), "node_modules", "@quartz-community", "graph", "dist", "index.js"),
  path.join(
    process.cwd(),
    "node_modules",
    "@quartz-community",
    "graph",
    "dist",
    "components",
    "index.js",
  ),
]

const pageTitleFiles = [
  path.join(process.cwd(), "node_modules", "@quartz-community", "page-title", "dist", "index.js"),
  path.join(
    process.cwd(),
    "node_modules",
    "@quartz-community",
    "page-title",
    "dist",
    "components",
    "index.js",
  ),
]

const themeCoreFile = path.join(
  process.cwd(),
  "node_modules",
  "@quartz-themes",
  "core",
  "dist",
  "index.js",
)

const excalidrawPluginFile = path.join(
  process.cwd(),
  ".quartz",
  "plugins",
  "obsidian-plugin-excalidraw",
  "dist",
  "index.js",
)

const replacements = [
  [
    'function Fu(u){let e=_t(ft(u,"index"),!0);return e.length===0?"/":e}',
    'function Fu(u){try{u=decodeURIComponent(u)}catch{}let e=_t(ft(u,"index"),!0);return e.length===0?"/":e}',
  ],
  ["return(3.2+Math.sqrt(l)*1.2)*(x.nodeScale||1)}", "return 2+Math.sqrt(l)}"],
  ["return 3.2+Math.sqrt(l)*1.2}", "return 2+Math.sqrt(l)}"],
  ["return(2+Math.sqrt(l))*(x.nodeScale||.77)}", "return 2+Math.sqrt(l)}"],
  ["return(2+Math.sqrt(l))*(x.nodeScale||.75)}", "return 2+Math.sqrt(l)}"],
  ["return 2+Math.sqrt(l)}", "return(2+Math.sqrt(l))*(x.nodeScale||.75)}"],
  ["l.color=l.active?ee:te", "l.color=l.active?Ie:ee"],
  ["var l=z[i],F=.38;_u!==null&&(F=l.active?1:.12)", "var l=z[i],F=1;_u!==null&&(F=l.active?1:.2)"],
  ["var l=z[i],F=.32;_u!==null&&(F=l.active?1:.09)", "var l=z[i],F=1;_u!==null&&(F=l.active?1:.2)"],
  ["var l=z[i],F=1;_u!==null&&(F=l.active?1:.2)", "var l=z[i],F=.32;_u!==null&&(F=l.active?1:.09)"],
  ["width:x.lineWidth||1.35,color:v.color", "width:1,color:v.color"],
  ["width:1.35,color:v.color", "width:1,color:v.color"],
  ["width:x.lineWidth||.55,color:v.color", "width:1,color:v.color"],
  ["width:1,color:v.color", "width:x.lineWidth||.55,color:v.color"],
  [
    '.force("link",a.forceLink(H).distance(Te).strength(x.linkStrength||1))',
    '.force("link",a.forceLink(H).distance(Te))',
  ],
  [
    '.force("link",a.forceLink(H).distance(Te).strength(x.linkStrength||.85))',
    '.force("link",a.forceLink(H).distance(Te))',
  ],
  [
    '.force("link",a.forceLink(H).distance(Te).strength(x.linkStrength||.65))',
    '.force("link",a.forceLink(H).distance(Te))',
  ],
  [
    '.force("link",a.forceLink(H).distance(Te))',
    '.force("link",a.forceLink(H).distance(Te).strength(x.linkStrength||.65))',
  ],
  ["alphaTarget(1).restart()", "alphaTarget(.025).restart()"],
  ["alphaTarget(0.18).restart()", "alphaTarget(.025).restart()"],
  ["alphaTarget(0.08).restart()", "alphaTarget(.025).restart()"],
  ["alphaTarget(.08).restart()", "alphaTarget(.025).restart()"],
  ["alphaTarget(0.03).restart()", "alphaTarget(.025).restart()"],
  [
    "oe=Date.now(),Eu=!0,_u=i.subject.id",
    "i.active||au.alphaTarget(.025).restart(),oe=Date.now(),Eu=!0,_u=i.subject.id",
  ],
  [
    "i.active||au.alphaTarget(.025).restart(),i.active||au.alphaTarget(.025).restart(),",
    "i.active||au.alphaTarget(.025).restart(),",
  ],
  [
    "i.active||au.alphaTarget(.025).restart(),i.subject.fx=l-i.subject.__dragOffset.x,i.subject.fy=F-i.subject.__dragOffset.y",
    "i.subject.fx=l-i.subject.__dragOffset.x,i.subject.fy=F-i.subject.__dragOffset.y",
  ],
  [
    "P=a.zoomIdentity;",
    "P=a.zoomIdentity.translate(R*(1-qu)/2,O*(1-qu)/2).scale(qu);ou.scale.set(P.k,P.k);ou.position.set(P.x,P.y);",
  ],
  ["a.select(Z.canvas).call(et)}", "a.select(Z.canvas).call(et).call(et.transform,P)}"],
  ["F=Math.min(Math.max((l-1.35)/1.65,0),1)", "F=Math.max((l-1)/3.75,0)"],
  ["F=Math.min(Math.max((l-1.6)/.9,0),.82)", "F=Math.max((l-1)/3.75,0)"],
  ["F=Math.max((l-1)/3.75,0)", "F=Math.min(Math.max((l-1.6)/.9,0),.82)"],
  ["F=Math.min(Math.max((l-.55)/1.15,0),1)", "F=Math.min(Math.max((l-1.6)/.9,0),.82)"],
  [",De&&U.stroke({width:2,color:ue})", ""],
  [
    "}});var ru=new Set;if(Vu>=0)",
    '}});Xu.has("/")&&Xu.forEach(function(i){i!=="/"&&!tu.some(function(l){return l.source==="/"&&l.target===i||l.source===i&&l.target==="/"})&&tu.push({source:"/",target:i})});var ru=new Set;if(Vu>=0)',
  ],
  [
    "var se=!1;function ce()",
    'var se=!1,bt=document.body.dataset.slug==="index"&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches;function ce()',
  ],
  [
    "l.gfx.position.set(F+R/2,A+O/2),l.label&&l.label.position.set(F+R/2,A+O/2)",
    "l.gfx.position.set(F+R/2,A+O/2),l.label&&l.label.position.set(F+R/2,A+O/2),l.gfx.alpha+=(l.alpha*(bt&&_u===null?.94+.06*Math.sin(performance.now()/1800+i*1.7):1)-l.gfx.alpha)*.18",
  ],
  [
    ",l.gfx.alpha+=(l.alpha*(bt&&_u===null?.94+.06*Math.sin(performance.now()/1800+i*1.7):1)-l.gfx.alpha)*.18,l.gfx.alpha+=(l.alpha*(bt&&_u===null?.94+.06*Math.sin(performance.now()/1800+i*1.7):1)-l.gfx.alpha)*.18",
    ",l.gfx.alpha+=(l.alpha*(bt&&_u===null?.94+.06*Math.sin(performance.now()/1800+i*1.7):1)-l.gfx.alpha)*.18",
  ],
  [
    "style:{fontSize:We*15,fill:ze,fontFamily:Ne}",
    'style:{fontSize:We*60,fill:ze,fontFamily:Ne,fontWeight:"600"},resolution:window.devicePixelRatio*4',
  ],
  [
    'style:{fontSize:We*15,fill:ze,fontFamily:Ne,fontWeight:"600"}',
    'style:{fontSize:We*60,fill:ze,fontFamily:Ne,fontWeight:"600"},resolution:window.devicePixelRatio*4',
  ],
  [
    'style:{fontSize:We*60,fill:ze,fontFamily:Ne,fontWeight:"600"}});',
    'style:{fontSize:We*60,fill:ze,fontFamily:Ne,fontWeight:"600"},resolution:window.devicePixelRatio*4});',
  ],
  ["lu.scale.set(1/qu)", "lu.scale.set(1/qu/4)"],
  [
    "A.label.alpha=1,A.label.scale.set(l)):A.label.scale.set(i)",
    "A.label.alpha=1,A.label.scale.set(l/4)):A.label.scale.set(i/4)",
  ],
  [
    '.scaleExtent([.25,4]).wheelDelta(function(i){return-i.deltaY*(i.deltaMode===1?.05:i.deltaMode?1:.002)/4}).wheelDelta(function(i){return-i.deltaY*(i.deltaMode===1?.05:i.deltaMode?1:.002)/4}).on("zoom",ut)',
    '.scaleExtent([.25,4]).wheelDelta(function(i){return-i.deltaY*(i.deltaMode===1?.05:i.deltaMode?1:.002)*.325}).on("zoom",ut)',
  ],
  [
    '.scaleExtent([.25,4]).wheelDelta(function(i){return-i.deltaY*(i.deltaMode===1?.05:i.deltaMode?1:.002)/4}).on("zoom",ut)',
    '.scaleExtent([.25,4]).wheelDelta(function(i){return-i.deltaY*(i.deltaMode===1?.05:i.deltaMode?1:.002)*.325}).on("zoom",ut)',
  ],
  [
    '.scaleExtent([.25,4]).on("zoom",ut)',
    '.scaleExtent([.25,4]).wheelDelta(function(i){return-i.deltaY*(i.deltaMode===1?.05:i.deltaMode?1:.002)*.325}).on("zoom",ut)',
  ],
  ["l.gfx.alpha=F}}", "l.alpha=F}}"],
  ["l.alpha=F,l.color=l.active?Ie:ee", "l.targetAlpha=F,l.color=l.active?Ie:ee"],
  [
    "N!=null&&K!=null&&gu!=null&&Fe!=null&&(v.gfx.clear()",
    "N!=null&&K!=null&&gu!=null&&Fe!=null&&(v.alpha+=((v.targetAlpha??v.alpha)-v.alpha)*.18,v.gfx.clear()",
  ],
]

const breathingFragment =
  ",bt&&_u===null&&(l.gfx.alpha=l.alpha*(.94+.06*Math.sin(performance.now()/1800+i*1.7)))"
const smoothAlphaFragment =
  "l.gfx.alpha+=(l.alpha*(bt&&_u===null?.94+.06*Math.sin(performance.now()/1800+i*1.7):1)-l.gfx.alpha)*.18"
let patched = 0

for (const graphFile of graphFiles) {
  if (!fs.existsSync(graphFile)) {
    continue
  }

  let source = fs.readFileSync(graphFile, "utf8")
  const original = source
  source = source.split(breathingFragment).join("")

  for (const [from, to] of replacements) {
    source = source.split(from).join(to)
  }

  while (source.includes(`${smoothAlphaFragment},${smoothAlphaFragment}`)) {
    source = source.split(`${smoothAlphaFragment},${smoothAlphaFragment}`).join(smoothAlphaFragment)
  }

  if (source !== original) {
    fs.writeFileSync(graphFile, source)
    patched += 1
  }
}

const graphInvariants = [
  ['Xu.has("/")', "каждая заметка связана с Hopes and Dreams"],
  ["(l-1.6)/.9", "подписи появляются только при позднем приближении"],
  ['bt=document.body.dataset.slug==="index"', "узлы на главной мягко дышат"],
  ["x.nodeScale||.75", "панель меняет размер узлов"],
  ["x.lineWidth||.55", "панель меняет толщину связей"],
  ["x.linkStrength||.65", "панель меняет силу связей"],
  ["alphaTarget(.025).restart()", "перетаскивание узла мягко прогревает физику графа"],
  ["F=.32;_u!==null&&(F=l.active?1:.09)", "обычные связи не забивают структуру графа"],
  [
    "wheelDelta(function(i){return-i.deltaY*(i.deltaMode===1?.05:i.deltaMode?1:.002)*.325})",
    "чувствительность колеса графа увеличена на 30%",
  ],
  ["l.gfx.alpha+=", "наведение на узлы плавно меняет прозрачность"],
  ["v.targetAlpha", "наведение на связи плавно меняет прозрачность"],
]

for (const graphFile of graphFiles.filter(fs.existsSync)) {
  const source = fs.readFileSync(graphFile, "utf8")
  for (const [marker, rule] of graphInvariants) {
    if (!source.includes(marker)) {
      throw new Error(`[patch-graph] Не применено правило: ${rule} (${graphFile})`)
    }
  }
  if (source.includes("De&&U.stroke")) {
    throw new Error(`[patch-graph] Не удалена обводка узлов (${graphFile})`)
  }
}

for (const pageTitleFile of pageTitleFiles) {
  if (!fs.existsSync(pageTitleFile)) {
    continue
  }

  const original = fs.readFileSync(pageTitleFile, "utf8")
  let source = original

  source = source.replace(
    "const baseDir = pathToRoot(fileData.slug);",
    'const baseDir = cfg?.baseUrl ? new URL(`https://${cfg.baseUrl}`).pathname.replace(/\\/?$/, "/") || "/" : pathToRoot(fileData.slug);',
  )

  if (source !== original) {
    fs.writeFileSync(pageTitleFile, source)
    patched += 1
  }
}

if (fs.existsSync(themeCoreFile)) {
  const original = fs.readFileSync(themeCoreFile, "utf8")
  let source = original

  source = source.replace(
    `  .page:not([data-frame="canvas"]):not([data-frame="excalidraw"]) {
    margin: 0;
    padding-left: calc((100% - min(1500px, 100dvw))/2);
    padding-right: calc((100% - min(1500px, 100dvw))/2);
  }`,
    `  .page:not([data-frame="canvas"]):not([data-frame="excalidraw"]) {
    margin: 0;
    padding-left: 0;
    padding-right: 0;
  }`,
  )

  if (source !== original) {
    fs.writeFileSync(themeCoreFile, source)
    patched += 1
  }
}

if (fs.existsSync(excalidrawPluginFile)) {
  const original = fs.readFileSync(excalidrawPluginFile, "utf8")
  let source = original

  const excalidrawReplacements = [
    ['frontmatter: { title: baseName, tags: ["excalidraw"] }', 'frontmatter: { title: baseName, tags: [] }'],
    ["let a=1,u=0,d=0,c=!1,m=0,M=0;", "let a=4,u=0,d=0,c=!1,m=0,M=0;"],
    ["let a=2.4,u=0,d=0,c=!1,m=0,M=0;", "let a=4,u=0,d=0,c=!1,m=0,M=0;"],
    [
      'function s(){v.style.transform="translate("+u+"px, "+d+"px) scale("+a+")",O()}function y',
      'function s(){v.style.transform="translate("+u+"px, "+d+"px) scale("+a+")",O()}s();function y',
    ],
    ["var o=e.deltaY>0?-.15:.15;", "var o=e.deltaY>0?-.5:.5;"],
    ["var o=e.deltaY>0?-.35:.35;", "var o=e.deltaY>0?-.5:.5;"],
    ["a=Math.max(.1,Math.min(5,a+o)),s()", "a=Math.max(.1,Math.min(16,a+o)),s()"],
    ["a=Math.max(.1,Math.min(12,a+o)),s()", "a=Math.max(.1,Math.min(16,a+o)),s()"],
    ["a=Math.min(5,a+.15),s()", "a=Math.min(16,a+.5),s()"],
    ["a=Math.min(12,a+.35),s()", "a=Math.min(16,a+.5),s()"],
    ["a=Math.max(.1,a-.15),s()", "a=Math.max(.1,a-.5),s()"],
    ["a=Math.max(.1,a-.35),s()", "a=Math.max(.1,a-.5),s()"],
    ["a=1,u=0,d=0,s()", "a=4,u=0,d=0,s()"],
    ["a=2.4,u=0,d=0,s()", "a=4,u=0,d=0,s()"],
    ["a=Math.max(.1,Math.min(5,a*g)),f=r,s()", "a=Math.max(.1,Math.min(16,a*g)),f=r,s()"],
    ["a=Math.max(.1,Math.min(12,a*g)),f=r,s()", "a=Math.max(.1,Math.min(16,a*g)),f=r,s()"],
  ]

  for (const [from, to] of excalidrawReplacements) {
    source = source.split(from).join(to)
  }

  const extraExcalidrawCss = `
.excalidraw-container {
  --excalidraw-grid-minor-size: 20px;
  --excalidraw-grid-major-size: 100px;
  --excalidraw-grid-minor-x: 0px;
  --excalidraw-grid-minor-y: 0px;
  --excalidraw-grid-major-x: 0px;
  --excalidraw-grid-major-y: 0px;
  --excalidraw-grid-minor-alpha: 0.028;
  --excalidraw-grid-major-alpha: 0.055;
  background-image:
    linear-gradient(rgba(0, 0, 0, var(--excalidraw-grid-major-alpha)) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, var(--excalidraw-grid-major-alpha)) 1px, transparent 1px),
    linear-gradient(rgba(0, 0, 0, var(--excalidraw-grid-minor-alpha)) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, var(--excalidraw-grid-minor-alpha)) 1px, transparent 1px);
  background-position:
    var(--excalidraw-grid-major-x) var(--excalidraw-grid-major-y),
    var(--excalidraw-grid-major-x) var(--excalidraw-grid-major-y),
    var(--excalidraw-grid-minor-x) var(--excalidraw-grid-minor-y),
    var(--excalidraw-grid-minor-x) var(--excalidraw-grid-minor-y);
  background-size:
    var(--excalidraw-grid-major-size) var(--excalidraw-grid-major-size),
    var(--excalidraw-grid-major-size) var(--excalidraw-grid-major-size),
    var(--excalidraw-grid-minor-size) var(--excalidraw-grid-minor-size),
    var(--excalidraw-grid-minor-size) var(--excalidraw-grid-minor-size);
}

:root[saved-theme=dark] .excalidraw-container {
  background-image:
    linear-gradient(rgba(255, 255, 255, var(--excalidraw-grid-major-alpha)) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, var(--excalidraw-grid-major-alpha)) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, var(--excalidraw-grid-minor-alpha)) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, var(--excalidraw-grid-minor-alpha)) 1px, transparent 1px);
}

.excalidraw-controls {
  align-items: center;
  padding: 0.25rem;
  border: 1px solid color-mix(in srgb, var(--lightgray) 82%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--light) 88%, transparent);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(10px);
}

.excalidraw-controls button {
  width: auto;
  min-width: 2rem;
  padding: 0 0.55rem;
}

.excalidraw-zoom-level {
  min-width: 3.25rem;
  color: var(--darkgray);
  font-family: var(--bodyFont, sans-serif);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
  user-select: none;
}

.page[data-frame=excalidraw] .excalidraw-frame {
  transition: none;
}
`

  if (!source.includes("--excalidraw-grid-minor-size")) {
    const escapedCss = extraExcalidrawCss
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
    source = source.replace(
      /(';[\r\n]+\/\/ src\/components\/scripts\/excalidraw\.inline\.ts)/,
      `${escapedCss}$1`,
    )
  }

  source = source
    .replace(/\\n  --excalidraw-grid-x: 0px;\\n  --excalidraw-grid-y: 0px;/g, "")
    .replace(
      /\\n  --excalidraw-grid-major-size: 100px;\\n(?!  --excalidraw-grid-minor-x: 0px;)/g,
      "\\n  --excalidraw-grid-major-size: 100px;\\n  --excalidraw-grid-minor-x: 0px;\\n  --excalidraw-grid-minor-y: 0px;\\n  --excalidraw-grid-major-x: 0px;\\n  --excalidraw-grid-major-y: 0px;\\n",
    )
    .replace(
      /\\n  background-position:\\n    var\(--excalidraw-grid-x\) var\(--excalidraw-grid-y\),\\n    var\(--excalidraw-grid-x\) var\(--excalidraw-grid-y\),\\n    var\(--excalidraw-grid-x\) var\(--excalidraw-grid-y\),\\n    var\(--excalidraw-grid-x\) var\(--excalidraw-grid-y\);/g,
      "\\n  background-position:\\n    var(--excalidraw-grid-major-x) var(--excalidraw-grid-major-y),\\n    var(--excalidraw-grid-major-x) var(--excalidraw-grid-major-y),\\n    var(--excalidraw-grid-minor-x) var(--excalidraw-grid-minor-y),\\n    var(--excalidraw-grid-minor-x) var(--excalidraw-grid-minor-y);",
    )
    .replace(
      /\\n  background-position: 0 0, 0 0, 0 0, 0 0;/g,
      "\\n  background-position:\\n    var(--excalidraw-grid-major-x) var(--excalidraw-grid-major-y),\\n    var(--excalidraw-grid-major-x) var(--excalidraw-grid-major-y),\\n    var(--excalidraw-grid-minor-x) var(--excalidraw-grid-minor-y),\\n    var(--excalidraw-grid-minor-x) var(--excalidraw-grid-minor-y);",
    )

  const excalidrawViewerScript = `const MIN_ZOOM=.1,MAX_ZOOM=30,ZOOM_STEP=.1,GRID_SIZE=20,GRID_STEP=5,MAX_WHEEL_STEP=ZOOM_STEP*100;function initExcalidraw(){const page=document.querySelector(".page[data-frame='excalidraw']");if(page){initSidebar(page);initPanZoom(page);return}for(const embedded of document.querySelectorAll(".excalidraw-page"))initPanZoom(embedded)}function initSidebar(page){const toggle=page.querySelector(".excalidraw-sidebar-toggle");if(!toggle||toggle.dataset.excalidrawSidebarReady==="true")return;toggle.dataset.excalidrawSidebarReady="true";const handleToggle=()=>page.classList.toggle("excalidraw-sidebar-open");toggle.addEventListener("click",handleToggle);window.addCleanup(()=>{toggle.dataset.excalidrawSidebarReady="false";toggle.removeEventListener("click",handleToggle);page.classList.remove("excalidraw-sidebar-open")})}function initPanZoom(page){if(page.dataset.excalidrawPanZoomReady==="true")return;const container=page.querySelector(".excalidraw-container");if(!container)return;const svg=container.querySelector("svg");if(!svg)return;page.dataset.excalidrawPanZoomReady="true";container.style.backgroundColor="var(--excalidraw-bg, var(--light))";const overlaysContainer=page.querySelector(".excalidraw-overlays"),zoomLevel=page.querySelector(".excalidraw-zoom-level");let zoom=1,scrollX=0,scrollY=0,isDragging=false,isSpaceDown=false,lastX=0,lastY=0,rafId=0,lastTouchDist=0,lastTouchCenter=null,initialTouchZoom=1;function normalizeZoom(value){return Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,Math.round(value*1e6)/1e6))}function px(value){return Math.round(value*1e3)/1e3+"px"}function mod(value,size){return ((value%size)+size)%size}function applyGrid(){const minor=GRID_SIZE*zoom,major=GRID_SIZE*GRID_STEP*zoom,screenX=scrollX*zoom,screenY=scrollY*zoom;container.style.setProperty("--excalidraw-grid-minor-size",px(minor));container.style.setProperty("--excalidraw-grid-major-size",px(major));container.style.setProperty("--excalidraw-grid-minor-x",px(mod(screenX,minor)));container.style.setProperty("--excalidraw-grid-minor-y",px(mod(screenY,minor)));container.style.setProperty("--excalidraw-grid-major-x",px(mod(screenX,major)));container.style.setProperty("--excalidraw-grid-major-y",px(mod(screenY,major)));container.style.setProperty("--excalidraw-grid-minor-alpha",minor<10?"0":"0.028");container.style.setProperty("--excalidraw-grid-major-alpha",major<10?"0.035":"0.055")}function updateControls(){if(zoomLevel)zoomLevel.textContent=Math.round(zoom*100)+"%"}function positionOverlays(){if(!overlaysContainer)return;const overlays=overlaysContainer.querySelectorAll(".excalidraw-overlay");if(overlays.length===0)return;const offX=parseFloat(overlaysContainer.getAttribute("data-offset-x"))||0,offY=parseFloat(overlaysContainer.getAttribute("data-offset-y"))||0,ctm=svg.getScreenCTM(),containerRect=container.getBoundingClientRect();if(!ctm)return;for(const el of overlays){const ex=parseFloat(el.getAttribute("data-x"))||0,ey=parseFloat(el.getAttribute("data-y"))||0,ew=parseFloat(el.getAttribute("data-w"))||0,eh=parseFloat(el.getAttribute("data-h"))||0,svgX=ex+offX,svgY=ey+offY;el.style.left=svgX*ctm.a+ctm.e-containerRect.left+"px";el.style.top=svgY*ctm.d+ctm.f-containerRect.top+"px";el.style.width=ew*ctm.a+"px";el.style.height=eh*ctm.d+"px";el.style.display="flex"}}function applyTransformNow(){rafId=0;svg.style.transform="translate("+(scrollX*zoom)+"px, "+(scrollY*zoom)+"px) scale("+zoom+")";applyGrid();updateControls();positionOverlays()}function applyTransform(){if(!rafId)rafId=requestAnimationFrame(applyTransformNow)}function zoomAt(clientX,clientY,nextZoom){const rect=container.getBoundingClientRect(),viewportX=clientX-rect.left,viewportY=clientY-rect.top,currentZoom=zoom;zoom=normalizeZoom(nextZoom);scrollX=scrollX-viewportX/currentZoom+viewportX/zoom;scrollY=scrollY-viewportY/currentZoom+viewportY/zoom;applyTransform()}function zoomAtCenter(nextZoom){const rect=container.getBoundingClientRect();zoomAt(rect.left+rect.width/2,rect.top+rect.height/2,nextZoom)}function fitToContent(){zoom=1;scrollX=0;scrollY=0;applyTransform()}function wheelDelta(event){let delta=event.deltaY;if(event.deltaMode===1)delta*=16;if(event.deltaMode===2)delta*=container.clientHeight;return delta}function wheelZoom(deltaY){const sign=Math.sign(deltaY);if(!sign)return zoom;const absDelta=Math.abs(deltaY),delta=Math.min(absDelta,MAX_WHEEL_STEP)*sign;let nextZoom=zoom-delta/100;nextZoom+=Math.log10(Math.max(1,zoom))*-sign*Math.min(1,absDelta/20);return normalizeZoom(nextZoom)}function handleWheel(event){event.preventDefault();zoomAt(event.clientX,event.clientY,wheelZoom(wheelDelta(event)))}function handleMouseDown(event){if(event.button!==0&&event.button!==1)return;if(event.button===0&&!isSpaceDown&&event.target.closest(".excalidraw-controls"))return;event.preventDefault();isDragging=true;lastX=event.clientX;lastY=event.clientY;container.style.cursor="grabbing";document.body.style.userSelect="none"}function handleMouseMove(event){if(!isDragging)return;const deltaX=lastX-event.clientX,deltaY=lastY-event.clientY;lastX=event.clientX;lastY=event.clientY;scrollX=scrollX-deltaX/zoom;scrollY=scrollY-deltaY/zoom;applyTransform()}function handleMouseUp(){if(!isDragging)return;isDragging=false;container.style.cursor="grab";document.body.style.userSelect=""}function touchCenter(touches){return{x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2}}function touchDistance(touches){const dx=touches[0].clientX-touches[1].clientX,dy=touches[0].clientY-touches[1].clientY;return Math.sqrt(dx*dx+dy*dy)}function handleTouchStart(event){if(event.touches.length===1){isDragging=true;lastX=event.touches[0].clientX;lastY=event.touches[0].clientY}else if(event.touches.length===2){isDragging=false;lastTouchDist=touchDistance(event.touches);lastTouchCenter=touchCenter(event.touches);initialTouchZoom=zoom}}function handleTouchMove(event){event.preventDefault();if(event.touches.length===1&&isDragging){const touch=event.touches[0],deltaX=lastX-touch.clientX,deltaY=lastY-touch.clientY;lastX=touch.clientX;lastY=touch.clientY;scrollX=scrollX-deltaX/zoom;scrollY=scrollY-deltaY/zoom;applyTransform()}else if(event.touches.length===2&&lastTouchDist>0&&lastTouchCenter){const dist=touchDistance(event.touches),center=touchCenter(event.touches),deltaX=center.x-lastTouchCenter.x,deltaY=center.y-lastTouchCenter.y;zoomAt(center.x,center.y,initialTouchZoom*(dist/lastTouchDist));scrollX=scrollX+(2*deltaX)/zoom;scrollY=scrollY+(2*deltaY)/zoom;lastTouchCenter=center;applyTransform()}}function handleTouchEnd(){isDragging=false;lastTouchDist=0;lastTouchCenter=null;document.body.style.userSelect=""}function handleKeyDown(event){const active=document.activeElement;if(active?.matches?.("input, textarea, select, [contenteditable='true']"))return;if(event.code==="Space"&&!event.repeat){isSpaceDown=true;container.style.cursor="grab"}}function handleKeyUp(event){if(event.code==="Space")isSpaceDown=false}const zoomInBtn=page.querySelector(".excalidraw-zoom-in"),zoomOutBtn=page.querySelector(".excalidraw-zoom-out"),resetBtn=page.querySelector(".excalidraw-reset"),handleZoomIn=()=>zoomAtCenter(zoom+ZOOM_STEP),handleZoomOut=()=>zoomAtCenter(zoom-ZOOM_STEP);if(zoomInBtn)zoomInBtn.addEventListener("click",handleZoomIn);if(zoomOutBtn)zoomOutBtn.addEventListener("click",handleZoomOut);if(resetBtn)resetBtn.addEventListener("click",fitToContent);container.addEventListener("wheel",handleWheel,{passive:false});container.addEventListener("mousedown",handleMouseDown);document.addEventListener("mousemove",handleMouseMove);document.addEventListener("mouseup",handleMouseUp);document.addEventListener("keydown",handleKeyDown);document.addEventListener("keyup",handleKeyUp);container.addEventListener("touchstart",handleTouchStart,{passive:true});container.addEventListener("touchmove",handleTouchMove,{passive:false});container.addEventListener("touchend",handleTouchEnd);window.addEventListener("resize",fitToContent);applyTransformNow();window.addCleanup(function(){page.dataset.excalidrawPanZoomReady="false";if(rafId)cancelAnimationFrame(rafId);if(zoomInBtn)zoomInBtn.removeEventListener("click",handleZoomIn);if(zoomOutBtn)zoomOutBtn.removeEventListener("click",handleZoomOut);if(resetBtn)resetBtn.removeEventListener("click",fitToContent);container.removeEventListener("wheel",handleWheel);container.removeEventListener("mousedown",handleMouseDown);document.removeEventListener("mousemove",handleMouseMove);document.removeEventListener("mouseup",handleMouseUp);document.removeEventListener("keydown",handleKeyDown);document.removeEventListener("keyup",handleKeyUp);container.removeEventListener("touchstart",handleTouchStart);container.removeEventListener("touchmove",handleTouchMove);container.removeEventListener("touchend",handleTouchEnd);window.removeEventListener("resize",fitToContent);document.body.style.userSelect=""})}document.addEventListener("nav",initExcalidraw);`

  source = source.replace(
    /var excalidraw_inline_default = `[\s\S]*?`;\r?\nvar l3;/,
    `var excalidraw_inline_default = \`${excalidrawViewerScript}\`;\nvar l3;`,
  )

  source = source.replace(
    `/* @__PURE__ */ u4("button", { class: "excalidraw-zoom-in", type: "button", "aria-label": "Zoom in", children: "+" }),
            /* @__PURE__ */ u4("button", { class: "excalidraw-zoom-out", type: "button", "aria-label": "Zoom out", children: "\\u2212" }),
            /* @__PURE__ */ u4("button", { class: "excalidraw-reset", type: "button", "aria-label": "Reset view", children: "\\u27F2" })`,
    `/* @__PURE__ */ u4("button", { class: "excalidraw-zoom-out", type: "button", "aria-label": "Zoom out", children: "-" }),
            /* @__PURE__ */ u4("output", { class: "excalidraw-zoom-level", "aria-live": "polite", children: "100%" }),
            /* @__PURE__ */ u4("button", { class: "excalidraw-zoom-in", type: "button", "aria-label": "Zoom in", children: "+" }),
            /* @__PURE__ */ u4("button", { class: "excalidraw-reset", type: "button", "aria-label": "Fit to content", children: "Fit" })`,
  )

  if (source !== original) {
    fs.writeFileSync(excalidrawPluginFile, source)
    patched += 1
  }
}

if (patched === 0) {
  console.log(
    "[patch-graph] Graph, theme, and Excalidraw patches already applied or upstream code changed.",
  )
} else {
  console.log(`[patch-graph] Graph/theme/Excalidraw patches applied in ${patched} file(s).`)
}
