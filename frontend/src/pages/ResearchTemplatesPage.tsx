import { ResearchTemplatesTab } from './SettingsPage'

export default function ResearchTemplatesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Research Templates</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload document templates and assign them to submission categories for researchers to download.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <ResearchTemplatesTab />
      </div>
    </div>
  )
}
