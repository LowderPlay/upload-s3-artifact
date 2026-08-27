import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { findFiles } from '../src/files.js'

const temporary: string[] = []

afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'upload-s3-artifact-test-'))
  temporary.push(root)
  await mkdir(path.join(root, 'nested', '.private'), { recursive: true })
  await writeFile(path.join(root, 'visible.txt'), 'visible')
  await writeFile(path.join(root, '.secret'), 'secret')
  await writeFile(path.join(root, 'nested', 'keep.txt'), 'keep')
  await writeFile(path.join(root, 'nested', 'drop.log'), 'drop')
  await writeFile(path.join(root, 'nested', '.private', 'token'), 'token')
  return root
}

describe('findFiles', () => {
  it('supports multiline patterns and exclusions', async () => {
    const root = await fixture()
    const files = await findFiles(`${root}/**\n!${root}/**/*.log`, false)
    expect(files.map((file) => file.archivePath)).toEqual(['nested/keep.txt', 'visible.txt'])
  })

  it('includes dot files only when requested', async () => {
    const root = await fixture()
    const files = await findFiles(`${root}/**`, true)
    expect(files.map((file) => file.archivePath)).toEqual([
      '.secret',
      'nested/.private/token',
      'nested/drop.log',
      'nested/keep.txt',
      'visible.txt'
    ])
  })
})
