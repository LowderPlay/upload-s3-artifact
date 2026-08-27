import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import archiver from 'archiver'
import type { UploadFile } from './files.js'

export interface PreparedArtifact {
  file: string
  digest: string
  size: number
  temporary: boolean
}

async function digestFile(file: string): Promise<{ digest: string; size: number }> {
  const hash = createHash('sha256')
  let size = 0
  const source = createReadStream(file)
  source.on('data', (chunk) => {
    size += chunk.length
    hash.update(chunk)
  })
  await pipeline(source, async function* (stream) {
    for await (const chunk of stream) yield chunk
  })
  return { digest: hash.digest('hex'), size }
}

export async function prepareArtifact(
  files: UploadFile[],
  archive: boolean,
  compressionLevel: number
): Promise<PreparedArtifact> {
  if (!archive) {
    const file = files[0]
    if (files.length !== 1 || !file) {
      throw new Error(
        `When 'archive' is false, exactly one file is required; found ${files.length}`
      )
    }
    return {
      ...(await digestFile(file.absolutePath)),
      file: file.absolutePath,
      temporary: false
    }
  }

  const target = path.join(tmpdir(), `upload-s3-artifact-${randomUUID()}.zip`)
  const output = createWriteStream(target, { flags: 'wx' })
  const zip = archiver('zip', { zlib: { level: compressionLevel } })
  const completed = new Promise<void>((resolve, reject) => {
    output.on('close', resolve)
    output.on('error', reject)
    zip.on('warning', reject)
    zip.on('error', reject)
  })
  zip.pipe(output)
  for (const file of files) zip.file(file.absolutePath, { name: file.archivePath })
  await zip.finalize()
  await completed
  return { ...(await digestFile(target)), file: target, temporary: true }
}

export async function cleanupArtifact(artifact: PreparedArtifact | undefined): Promise<void> {
  if (artifact?.temporary) await rm(artifact.file, { force: true })
}
