import { IconSettings } from "@tabler/icons-react"
import { SettingsContent } from "@/components/SettingsModal"

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2.5 border-b border-unison-border pb-4">
        <IconSettings className="size-6 text-unison-text-secondary" />
        <div>
          <h1 className="text-xl font-bold text-unison-text">Client Settings</h1>
          <p className="text-xs text-unison-text-secondary">
            Customize your Unison client interface mode and visual preferences.
          </p>
        </div>
      </div>
      <SettingsContent />
    </div>
  )
}
