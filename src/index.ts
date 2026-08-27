import path from 'node:path'
import * as core from '@actions/core'
import { cleanupArtifact, type PreparedArtifact, prepareArtifact } from './artifact.js'
import { findFiles } from './files.js'
import { getInputs, type Inputs } from './inputs.js'
import { createS3Client, downloadUrl, objectExists, uploadArtifact } from './s3.js'

function safeSegment(value: string): string {
  return value.replaceAll('\\', '-').replaceAll('/', '-').replace(/^\.+$/, '_')
}

export function expandPrefix(template: string): string {
  const [owner = '', repo = ''] = (process.env.GITHUB_REPOSITORY || '').split('/')
  const values: Record<string, string> = {
    owner,
    repo,
    run_id: process.env.GITHUB_RUN_ID || '',
    run_attempt: process.env.GITHUB_RUN_ATTEMPT || '',
    job: process.env.GITHUB_JOB || '',
    sha: process.env.GITHUB_SHA || ''
  }
  return template
    .replace(/\{(owner|repo|run_id|run_attempt|job|sha)\}/g, (_, name: string) =>
      safeSegment(values[name] || '')
    )
    .replace(/^\/+|\/+$/g, '')
}

export function objectKey(inputs: Inputs, directFile?: string): string {
  if (!inputs.archive && !directFile) throw new Error('A file path is required for direct upload')
  const filename = inputs.archive
    ? `${safeSegment(inputs.name)}.zip`
    : path.basename(directFile as string)
  const prefix = expandPrefix(inputs.keyPrefix)
  return prefix ? `${prefix}/${filename}` : filename
}

async function run(): Promise<void> {
  let prepared: PreparedArtifact | undefined
  try {
    const inputs = getInputs()
    const files = await findFiles(inputs.path, inputs.includeHiddenFiles)
    if (files.length === 0) {
      const message = `No files were found with the provided path: ${inputs.path}. No artifacts will be uploaded.`
      if (inputs.ifNoFilesFound === 'error') throw new Error(message)
      if (inputs.ifNoFilesFound === 'warn') core.warning(message)
      else core.info(message)
      return
    }
    const firstFile = files[0]
    if (!firstFile) throw new Error('File discovery returned an invalid empty result')

    core.info(
      `With the provided path, ${files.length} file${files.length === 1 ? '' : 's'} will be uploaded`
    )
    prepared = await prepareArtifact(files, inputs.archive, inputs.compressionLevel)
    const key = objectKey(inputs, firstFile.absolutePath)
    const client = createS3Client(inputs)

    if (!inputs.overwrite && (await objectExists(client, inputs.bucket, key))) {
      throw new Error(
        `Artifact 's3://${inputs.bucket}/${key}' already exists. Set overwrite: true to replace it.`
      )
    }

    await uploadArtifact(client, inputs, key, prepared)
    const url = inputs.presignedUrl
      ? await downloadUrl(
          client,
          inputs.bucket,
          key,
          inputs.presignedUrlExpiration,
          path.basename(key)
        )
      : ''

    core.setOutput('artifact-id', key)
    core.setOutput('artifact-key', key)
    core.setOutput('artifact-url', url)
    core.setOutput('artifact-digest', prepared.digest)
    core.info(`Artifact uploaded to s3://${inputs.bucket}/${key} (${prepared.size} bytes)`)

    if (inputs.includeInSummary) {
      const target = url || `s3://${inputs.bucket}/${key}`
      const artifactName = inputs.archive ? inputs.name : path.basename(firstFile.absolutePath)
      await core.summary
        .addHeading('Uploaded artifact', 3)
        .addLink(artifactName, target)
        .addRaw(` (${prepared.size} bytes, SHA-256: \`${prepared.digest}\`)`)
        .write()
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error))
  } finally {
    await cleanupArtifact(prepared)
  }
}

await run()
