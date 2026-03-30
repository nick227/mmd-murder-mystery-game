import fs from 'node:fs/promises'
import path from 'node:path'

export interface StoryFileListItem {
  file: string
  createdAt: string
}

export function storyJsonDir() {
  return path.resolve(process.cwd(), 'json')
}

export async function listStoryFiles(): Promise<StoryFileListItem[]> {
  const dir = storyJsonDir()
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = entries.filter(e => e.isFile() && e.name.toLowerCase().endsWith('.json')).map(e => e.name)
  const items: StoryFileListItem[] = []
  for (const file of files) {
    const stat = await fs.stat(path.join(dir, file))
    items.push({ file, createdAt: stat.mtime.toISOString() })
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return items
}

export async function loadStoryJson(storyFile: string): Promise<unknown> {
  const dir = storyJsonDir()
  const filePath = path.resolve(dir, storyFile)
  if (!filePath.startsWith(dir + path.sep)) {
    throw new Error('Invalid storyFile path')
  }
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw) as unknown
}

