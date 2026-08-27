import { createReadStream } from 'node:fs'
import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  S3Client,
  type S3ClientConfig
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { PreparedArtifact } from './artifact.js'
import type { Inputs } from './inputs.js'

export function createS3Client(inputs: Inputs): S3Client {
  const config: S3ClientConfig = {
    region: inputs.region,
    endpoint: inputs.endpoint,
    forcePathStyle: inputs.forcePathStyle
  }
  if (inputs.accessKeyId && inputs.secretAccessKey) {
    config.credentials = {
      accessKeyId: inputs.accessKeyId,
      secretAccessKey: inputs.secretAccessKey,
      sessionToken: inputs.sessionToken
    }
  }
  return new S3Client(config)
}

export async function objectExists(
  client: S3Client,
  bucket: string,
  key: string
): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (error: unknown) {
    const status =
      typeof error === 'object' && error !== null
        ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined
    if (error instanceof NotFound || status === 404) return false
    throw error
  }
}

export async function uploadArtifact(
  client: S3Client,
  inputs: Inputs,
  key: string,
  artifact: PreparedArtifact
): Promise<void> {
  const metadata: Record<string, string> = {
    'sha256-digest': artifact.digest,
    'github-run-id': process.env.GITHUB_RUN_ID || ''
  }
  const upload = new Upload({
    client,
    params: {
      Bucket: inputs.bucket,
      Key: key,
      Body: createReadStream(artifact.file),
      ContentType: inputs.archive ? 'application/zip' : 'application/octet-stream',
      ContentLength: artifact.size,
      Metadata: metadata
    }
  })
  await upload.done()
}

export function downloadUrl(
  client: S3Client,
  bucket: string,
  key: string,
  expiresIn: number,
  filename: string
): Promise<string> {
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename.replaceAll('"', '')}"`
    }),
    { expiresIn }
  )
}
