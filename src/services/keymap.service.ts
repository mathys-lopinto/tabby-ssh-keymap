import { promises as fs } from 'fs'
import * as path from 'path'
import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { NotificationsService, PlatformService } from 'tabby-core'

import { KEYMAP_FILE_NAME, KEYMAP_FILE_VERSION, KeymapEntry, KeymapFile, expandPath } from '../api'

@Injectable({ providedIn: 'root' })
export class KeymapService {
    readonly entries$ = new BehaviorSubject<KeymapEntry[]>([])
    private loaded = false
    private loadPromise: Promise<void> | null = null

    constructor (
        private platform: PlatformService,
        private notifications: NotificationsService,
    ) {}

    get filePath (): string {
        const configPath = this.platform.getConfigPath()
        if (!configPath) {
            throw new Error('Tabby config path unavailable — cannot locate ssh-keymap.json')
        }
        return path.join(path.dirname(configPath), KEYMAP_FILE_NAME)
    }

    private async ensureLoaded (): Promise<void> {
        if (this.loaded) {
            return
        }
        if (!this.loadPromise) {
            this.loadPromise = this.load()
        }
        await this.loadPromise
    }

    private async load (): Promise<void> {
        let raw: string
        try {
            raw = await fs.readFile(this.filePath, 'utf8')
        } catch (err: any) {
            if (err?.code === 'ENOENT') {
                this.entries$.next([])
                this.loaded = true
                return
            }
            console.warn('ssh-keymap: failed to read keymap file', err)
            this.notifications.error('Could not read ssh-keymap.json', err?.message ?? String(err))
            this.entries$.next([])
            this.loaded = true
            return
        }

        try {
            const parsed = JSON.parse(raw) as Partial<KeymapFile>
            const keymap = Array.isArray(parsed.keymap) ? parsed.keymap : []
            const valid = keymap.filter(e => e && typeof e.name === 'string' && typeof e.path === 'string')
            this.entries$.next(valid)
        } catch (err: any) {
            console.warn('ssh-keymap: corrupt keymap file, backing up and starting empty', err)
            try {
                await fs.rename(this.filePath, this.filePath + '.corrupt')
            } catch { /* best-effort backup */ }
            this.notifications.error(
                'ssh-keymap.json was corrupt and has been backed up as ssh-keymap.json.corrupt',
                err?.message ?? String(err),
            )
            this.entries$.next([])
        }
        this.loaded = true
    }

    private async persist (entries: KeymapEntry[]): Promise<void> {
        const data: KeymapFile = { version: KEYMAP_FILE_VERSION, keymap: entries }
        const tmp = this.filePath + '.tmp'
        await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
        await fs.rename(tmp, this.filePath)
        this.entries$.next(entries)
    }

    async list (): Promise<KeymapEntry[]> {
        await this.ensureLoaded()
        return [...this.entries$.value]
    }

    async get (name: string): Promise<KeymapEntry | null> {
        const all = await this.list()
        return all.find(e => e.name === name) ?? null
    }

    async add (entry: KeymapEntry): Promise<void> {
        const trimmed: KeymapEntry = { name: entry.name.trim(), path: entry.path.trim() }
        if (!trimmed.name) {
            throw new Error('Name is required')
        }
        if (!/^[A-Za-z0-9_.\-]+$/.test(trimmed.name)) {
            throw new Error('Name must match [A-Za-z0-9_.-]+')
        }
        if (!trimmed.path) {
            throw new Error('Path is required')
        }
        const entries = await this.list()
        if (entries.some(e => e.name === trimmed.name)) {
            throw new Error(`Key "${trimmed.name}" already exists`)
        }
        await this.persist([...entries, trimmed])
    }

    async update (name: string, newPath: string): Promise<void> {
        const entries = await this.list()
        const idx = entries.findIndex(e => e.name === name)
        if (idx === -1) {
            throw new Error(`Key "${name}" not found`)
        }
        const next = [...entries]
        next[idx] = { name, path: newPath.trim() }
        await this.persist(next)
    }

    async rename (oldName: string, newName: string, newPath: string): Promise<void> {
        const trimmedNew = newName.trim()
        if (!trimmedNew) {
            throw new Error('Name is required')
        }
        if (!/^[A-Za-z0-9_.\-]+$/.test(trimmedNew)) {
            throw new Error('Name must match [A-Za-z0-9_.-]+')
        }
        const entries = await this.list()
        const idx = entries.findIndex(e => e.name === oldName)
        if (idx === -1) {
            throw new Error(`Key "${oldName}" not found`)
        }
        if (trimmedNew !== oldName && entries.some(e => e.name === trimmedNew)) {
            throw new Error(`Key "${trimmedNew}" already exists`)
        }
        const next = [...entries]
        next[idx] = { name: trimmedNew, path: newPath.trim() }
        await this.persist(next)
    }

    async remove (name: string): Promise<void> {
        const entries = await this.list()
        await this.persist(entries.filter(e => e.name !== name))
    }

    async exists (entry: KeymapEntry): Promise<boolean> {
        try {
            await fs.access(expandPath(entry.path))
            return true
        } catch {
            return false
        }
    }

    async testKey (entry: KeymapEntry): Promise<{ ok: boolean; message: string }> {
        let contents: Buffer
        try {
            contents = await fs.readFile(expandPath(entry.path))
        } catch (err: any) {
            return { ok: false, message: err?.message ?? String(err) }
        }
        let russh: any
        try {
            russh = require('russh')
        } catch {
            return { ok: true, message: 'File readable (russh unavailable — could not parse)' }
        }
        try {
            await russh.KeyPair.parse(contents.toString('utf-8'))
            return { ok: true, message: 'Valid SSH private key' }
        } catch (err: any) {
            const msg = err?.message ?? String(err)
            if (/passphrase|encrypt/i.test(msg)) {
                return { ok: true, message: 'Valid SSH private key (passphrase-protected)' }
            }
            return { ok: false, message: `Parse error: ${msg}` }
        }
    }
}
