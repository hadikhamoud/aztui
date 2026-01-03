import * as readline from "readline"
import { saveConfig, getConfigFilePath, loadConfig } from "../config"

function createPrompt(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer)
    })
  })
}

export async function runConfigCommand(): Promise<void> {
  const rl = createPrompt()

  console.log("\n  aztui configuration\n")
  console.log("  Configure your Azure DevOps credentials.\n")

  // Show current config if exists
  const currentConfig = loadConfig()
  if (currentConfig) {
    console.log("  Current configuration:")
    console.log(`    Org URL: ${currentConfig.orgUrl}`)
    console.log(`    PAT: ${"*".repeat(20)}`)
    console.log("")
  }

  try {
    const orgUrl = await question(
      rl,
      `  Azure DevOps Org URL${currentConfig ? ` (${currentConfig.orgUrl})` : ""}: `
    )
    const pat = await question(rl, "  Personal Access Token (PAT): ")

    rl.close()

    // Use existing values if user pressed enter without input
    const finalOrgUrl = orgUrl.trim() || currentConfig?.orgUrl || ""
    const finalPat = pat.trim() || currentConfig?.pat || ""

    if (!finalOrgUrl || !finalPat) {
      console.log("\n  Error: Both Org URL and PAT are required.\n")
      process.exit(1)
    }

    const success = saveConfig({ orgUrl: finalOrgUrl, pat: finalPat })

    if (success) {
      console.log(`\n  Configuration saved to ${getConfigFilePath()}\n`)
    } else {
      console.log("\n  Error: Failed to save configuration.\n")
      process.exit(1)
    }
  } catch (error) {
    rl.close()
    console.log("\n  Error: Configuration cancelled.\n")
    process.exit(1)
  }
}
