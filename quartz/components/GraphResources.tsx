import { Graph as GraphConstructor } from "@quartz-community/graph"
import { QuartzComponent, QuartzComponentConstructor } from "./types"

const Graph = GraphConstructor({
  globalGraph: {
    drag: true,
    zoom: true,
    depth: -1,
    scale: 0.78,
    repelForce: 1.35,
    centerForce: 0.1,
    linkDistance: 118,
    linkStrength: 0.72,
    nodeScale: 0.5,
    lineWidth: 0.25,
    fontSize: 0.22,
    opacityScale: 1.2,
    removeTags: ["публичный-сайт"],
    showTags: true,
    focusOnHover: true,
    enableRadial: false,
  },
} as Parameters<typeof GraphConstructor>[0])

const GraphResources: QuartzComponent = () => null

GraphResources.css = Graph.css
GraphResources.afterDOMLoaded = Graph.afterDOMLoaded

export default (() => GraphResources) satisfies QuartzComponentConstructor
