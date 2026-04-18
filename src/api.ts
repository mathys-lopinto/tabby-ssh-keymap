import * as os from 'os'
import * as path from 'path'

export interface KeymapEntry {
    name: string
    path: string
}

export interface KeymapFile {
    version: number
    keymap: KeymapEntry[]
}

export const KEYMAP_FILE_VERSION = 1
export const KEYMAP_FILE_NAME = 'ssh-keymap.json'
export const SSHKEY_SCHEME = 'sshkey://'

export function expandPath (p: string): string {
    if (!p) {
        return p
    }
    if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
        return path.join(os.homedir(), p.slice(1))
    }
    return p
}
