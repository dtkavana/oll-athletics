/**
 * Write a ratings file, and leave the existing file alone when the only
 * difference is generatedAt. The daily job runs these scripts on every
 * scrape, and a new timestamp would otherwise commit an unchanged board.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const STAMP = /"generatedAt": "[^"]*"/

export async function writeRatings (out, file) {
  const next = JSON.stringify(file, null, 2) + '\n'
  let prev = ''
  try {
    prev = await readFile(out, 'utf8')
  } catch {
    prev = ''
  }
  if (prev && prev.replace(STAMP, '"generatedAt": ""') === next.replace(STAMP, '"generatedAt": ""')) {
    return false
  }
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, next)
  return true
}
