import { lstat, realpath } from 'node:fs/promises'
import path from 'node:path'
import * as glob from '@actions/glob'

export interface UploadFile {
  absolutePath: string
  archivePath: string
}

function isHidden(file: string): boolean {
  return path
    .relative(process.cwd(), file)
    .split(path.sep)
    .some((part) => part.startsWith('.') && part !== '.' && part !== '..')
}

function commonAncestor(paths: string[]): string {
  const firstPath = paths[0]
  if (!firstPath) throw new Error('Cannot find a common ancestor for an empty path list')
  if (paths.length === 1) return path.dirname(firstPath)
  const parts = paths.map((item) => path.resolve(item).split(path.sep))
  const firstParts = parts[0]
  if (!firstParts) throw new Error('Cannot find a common ancestor for an empty path list')
  let length = 0
  while (parts.every((item) => item[length] === firstParts[length])) length++
  const root = firstParts.slice(0, length).join(path.sep)
  return root || path.parse(firstPath).root
}

export async function findFiles(patterns: string, includeHidden: boolean): Promise<UploadFile[]> {
  const matcher = await glob.create(patterns, {
    followSymbolicLinks: true,
    implicitDescendants: true,
    matchDirectories: false
  })
  const found: string[] = []
  for await (const candidate of matcher.globGenerator()) {
    const stat = await lstat(candidate)
    if (!stat.isFile() || (!includeHidden && isHidden(candidate))) continue
    found.push(await realpath(candidate))
  }
  const unique = [...new Set(found)].sort()
  if (unique.length === 0) return []
  const root = commonAncestor(unique)
  return unique.map((absolutePath) => ({
    absolutePath,
    archivePath: path.relative(root, absolutePath).split(path.sep).join('/')
  }))
}
