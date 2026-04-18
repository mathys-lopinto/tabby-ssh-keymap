import * as path from 'path'
import { Component, OnInit } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { ConfigService, NotificationsService } from 'tabby-core'

import { SSHKEY_SCHEME } from '../api'
import { KeymapService } from '../services/keymap.service'

interface Candidate {
    selected: boolean
    fileUri: string
    name: string
    profileNames: string[]
    collides: boolean
}

@Component({
    templateUrl: './migrationModal.component.pug',
})
export class MigrationModalComponent implements OnInit {
    candidates: Candidate[] = []
    loading = true
    error: string | null = null

    constructor (
        private modal: NgbActiveModal,
        private config: ConfigService,
        private keymap: KeymapService,
        private notifications: NotificationsService,
    ) {}

    async ngOnInit (): Promise<void> {
        try {
            await this.scan()
        } catch (err: any) {
            this.error = err?.message ?? String(err)
        } finally {
            this.loading = false
        }
    }

    private async scan (): Promise<void> {
        const existing = await this.keymap.list()
        const existingNames = new Set(existing.map(e => e.name))
        const profiles = (this.config.store.profiles ?? []) as any[]

        const byUri = new Map<string, Candidate>()
        for (const profile of profiles) {
            const keys = profile?.options?.privateKeys as string[] | undefined
            if (!keys) {
                continue
            }
            for (const k of keys) {
                if (!k.startsWith('file://')) {
                    continue
                }
                const fileUri = k
                if (!byUri.has(fileUri)) {
                    const suggested = this.suggestName(fileUri, byUri, existingNames)
                    byUri.set(fileUri, {
                        selected: true,
                        fileUri,
                        name: suggested,
                        profileNames: [],
                        collides: existingNames.has(suggested),
                    })
                }
                byUri.get(fileUri)!.profileNames.push(profile.name ?? '(unnamed)')
            }
        }
        this.candidates = [...byUri.values()]
    }

    private suggestName (fileUri: string, already: Map<string, Candidate>, reserved: Set<string>): string {
        const raw = fileUri.slice('file://'.length)
        let base = path.basename(raw)
        base = base.replace(/^id[_-]/i, '')
        base = base.replace(/\.(pem|key|ppk)$/i, '')
        base = base.replace(/[^A-Za-z0-9_.\-]/g, '-') || 'key'
        let name = base
        let i = 2
        const used = new Set<string>([...reserved, ...[...already.values()].map(c => c.name)])
        while (used.has(name)) {
            name = `${base}-${i}`
            i++
        }
        return name
    }

    onNameChange (c: Candidate): void {
        c.collides = /^[A-Za-z0-9_.\-]+$/.test(c.name)
            ? this.candidates.some(o => o !== c && o.name === c.name)
            : true
    }

    canApply (): boolean {
        return this.candidates.filter(c => c.selected).length > 0
            && !this.candidates.some(c => c.selected && c.collides)
            && !this.candidates.some(c => c.selected && !/^[A-Za-z0-9_.\-]+$/.test(c.name))
    }

    async apply (): Promise<void> {
        const toApply = this.candidates.filter(c => c.selected)
        try {
            for (const c of toApply) {
                const filePath = c.fileUri.slice('file://'.length)
                await this.keymap.add({ name: c.name, path: filePath })
            }
            const byUri = new Map(toApply.map(c => [c.fileUri, c.name]))
            const profiles = (this.config.store.profiles ?? []) as any[]
            let updated = 0
            for (const profile of profiles) {
                const keys = profile?.options?.privateKeys as string[] | undefined
                if (!keys) {
                    continue
                }
                let changed = false
                profile.options.privateKeys = keys.map(k => {
                    const newName = byUri.get(k)
                    if (newName) {
                        changed = true
                        return `${SSHKEY_SCHEME}${newName}`
                    }
                    return k
                })
                if (changed) {
                    updated++
                }
            }
            if (updated > 0) {
                await this.config.save()
            }
            this.notifications.info(`Migrated ${toApply.length} key(s), updated ${updated} profile(s)`)
            this.modal.close(true)
        } catch (err: any) {
            this.notifications.error('Migration failed', err?.message ?? String(err))
        }
    }

    cancel (): void {
        this.modal.dismiss()
    }
}
