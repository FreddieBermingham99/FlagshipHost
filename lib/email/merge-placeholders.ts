const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g

export type CampaignMergeVars = Record<string, string>

/** Replace `{{key}}` occurrences with values from `vars` (unknown keys become empty string). */
export function mergeCampaignPlaceholders(template: string, vars: CampaignMergeVars): string {
  return template.replace(PLACEHOLDER_RE, (_, key: string) => vars[key] ?? '')
}
