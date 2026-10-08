import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"

const config = await loadQuartzConfig()
const deploymentUrl = process.env.QUARTZ_BASE_URL ?? process.env.CF_PAGES_URL
if (deploymentUrl) {
  const { host, pathname } = new URL(deploymentUrl)
  config.configuration.baseUrl = `${host}${pathname}`.replace(/\/+$/, "")
}
export default config
export const layout = await loadQuartzLayout()
