import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupArtifact, prepareArtifact } from '../src/artifact.js'

const temporary: string[] = []

afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('prepareArtifact', () => {
  it('uses a direct file and computes its SHA-256 digest', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'upload-s3-artifact-test-'))
    temporary.push(root)
    const file = path.join(root, 'hello.txt')
    await writeFile(file, 'hello')
    const artifact = await prepareArtifact(
      [{ absolutePath: file, archivePath: 'hello.txt' }],
      false,
      6
    )
    expect(artifact.digest).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
    expect(artifact.size).toBe(5)
    expect(artifact.temporary).toBe(false)
  })

  it('digests files larger than the stream high-water mark without stalling', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'upload-s3-artifact-test-'))
    temporary.push(root)
    const file = path.join(root, 'large.bin')
    const contents = Buffer.alloc(2 * 1024 * 1024, 42)
    await writeFile(file, contents)
    const artifact = await prepareArtifact(
      [{ absolutePath: file, archivePath: 'large.bin' }],
      false,
      6
    )
    expect(artifact.size).toBe(contents.length)
  })

  it('creates and cleans up a ZIP artifact', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'upload-s3-artifact-test-'))
    temporary.push(root)
    const file = path.join(root, 'hello.txt')
    await writeFile(file, 'hello')
    const artifact = await prepareArtifact(
      [{ absolutePath: file, archivePath: 'hello.txt' }],
      true,
      6
    )
    expect((await readFile(artifact.file)).subarray(0, 2).toString()).toBe('PK')
    await cleanupArtifact(artifact)
    await expect(readFile(artifact.file)).rejects.toThrow()
  })

  it('rejects multiple files in direct-upload mode', async () => {
    await expect(
      prepareArtifact(
        [
          { absolutePath: '/one', archivePath: 'one' },
          { absolutePath: '/two', archivePath: 'two' }
        ],
        false,
        6
      )
    ).rejects.toThrow("When 'archive' is false")
  })
})
