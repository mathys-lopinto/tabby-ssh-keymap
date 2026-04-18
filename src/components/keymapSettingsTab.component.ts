import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { Subscription } from 'rxjs'
import { ConfigService, NotificationsService, PlatformService, ProfilesService } from 'tabby-core'

import { SSHKEY_SCHEME, KeymapEntry } from '../api'
import { KeymapService } from '../services/keymap.service'
import { MigrationModalComponent } from './migrationModal.component'

interface EntryView extends KeymapEntry {
    exists: boolean
    editing: boolean
    editName: string
    editPath: string
    usedBy: string[]
}

@Component({
    templateUrl: './keymapSettingsTab.component.pug',
    styleUrls: ['./keymapSettingsTab.component.scss'],
})
export class KeymapSettingsTabComponent implements OnInit, OnDestroy {
    @HostBinding('class.content-box') contentBox = true

    views: EntryView[] = []
    newName = ''
    newPath = ''
    addError: string | null = null
    filter = ''

    private sub: Subscription | null = null

    constructor (
        private keymap: KeymapService,
        private notifications: NotificationsService,
        private profilesService: ProfilesService,
        private platform: PlatformService,
        private config: ConfigService,
        private ngbModal: NgbModal,
    ) {}

    async ngOnInit (): Promise<void> {
        this.sub = this.keymap.entries$.subscribe(entries => {
            void this.refreshViews(entries)
        })
        await this.keymap.list()
    }

    ngOnDestroy (): void {
        this.sub?.unsubscribe()
    }

    get filteredViews (): EntryView[] {
        if (!this.filter.trim()) {
            return this.views
        }
        const q = this.filter.trim().toLowerCase()
        return this.views.filter(v => v.name.toLowerCase().includes(q) || v.path.toLowerCase().includes(q))
    }

    private async refreshViews (entries: KeymapEntry[]): Promise<void> {
        const editingByName = new Map(this.views.filter(v => v.editing).map(v => [v.name, v]))
        const usageMap = await this.buildUsageMap()
        const views: EntryView[] = await Promise.all(entries.map(async e => {
            const prev = editingByName.get(e.name)
            return {
                ...e,
                exists: await this.keymap.exists(e),
                editing: prev?.editing ?? false,
                editName: prev?.editName ?? e.name,
                editPath: prev?.editPath ?? e.path,
                usedBy: usageMap.get(e.name) ?? [],
            }
        }))
        this.views = views
    }

    private async buildUsageMap (): Promise<Map<string, string[]>> {
        const map = new Map<string, string[]>()
        const profiles = (this.config.store.profiles ?? []) as any[]
        for (const profile of profiles) {
            const keys = profile?.options?.privateKeys as string[] | undefined
            if (!keys) {
                continue
            }
            for (const k of keys) {
                if (k.startsWith(SSHKEY_SCHEME)) {
                    const name = k.slice(SSHKEY_SCHEME.length)
                    const bucket = map.get(name) ?? []
                    bucket.push(profile.name ?? '(unnamed)')
                    map.set(name, bucket)
                }
            }
        }
        return map
    }

    async browseForNewPath (): Promise<void> {
        const picked = await this.pickFile('Select private key')
        if (picked) {
            this.newPath = picked
        }
    }

    async browseForEditPath (view: EntryView): Promise<void> {
        const picked = await this.pickFile(`Select private key for ${view.name}`)
        if (picked) {
            view.editPath = picked
        }
    }

    private async pickFile (buttonLabel: string): Promise<string | null> {
        try {
            const remote = require('@electron/remote')
            const result = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
                buttonLabel,
                properties: ['openFile', 'treatPackageAsDirectory', 'showHiddenFiles'],
            })
            if (result.canceled || !result.filePaths.length) {
                return null
            }
            return result.filePaths[0]
        } catch (err) {
            console.warn('ssh-keymap: file picker unavailable', err)
            return null
        }
    }

    async addEntry (): Promise<void> {
        this.addError = null
        try {
            await this.keymap.add({ name: this.newName, path: this.newPath })
            this.newName = ''
            this.newPath = ''
        } catch (err: any) {
            this.addError = err?.message ?? String(err)
        }
    }

    startEdit (view: EntryView): void {
        view.editing = true
        view.editName = view.name
        view.editPath = view.path
    }

    cancelEdit (view: EntryView): void {
        view.editing = false
        view.editName = view.name
        view.editPath = view.path
    }

    async saveEdit (view: EntryView): Promise<void> {
        const newName = view.editName.trim()
        const renaming = newName !== view.name
        if (renaming) {
            const refs = await this.findReferencingProfiles(view.name)
            if (refs.length > 0) {
                const result = await this.platform.showMessageBox({
                    type: 'warning',
                    message: `Rename "${view.name}" → "${newName}"?`,
                    detail: `${refs.length} SSH profile(s) currently reference this key and will be updated automatically. Other machines syncing this config will also see the new name and must have a matching keymap entry.`,
                    buttons: ['Rename and update profiles', 'Cancel'],
                    defaultId: 1,
                    cancelId: 1,
                })
                if (result.response !== 0) {
                    return
                }
            }
        }
        try {
            await this.keymap.rename(view.name, newName, view.editPath)
            if (renaming) {
                await this.cascadeRename(view.name, newName)
            }
            view.editing = false
        } catch (err: any) {
            this.notifications.error('Could not update key', err?.message ?? String(err))
        }
    }

    private async findReferencingProfiles (name: string): Promise<any[]> {
        const target = `${SSHKEY_SCHEME}${name}`
        const profiles = await (this.profilesService as any).getProfiles({ includeBuiltin: false })
        return profiles.filter((p: any) => {
            const keys = p?.options?.privateKeys as string[] | undefined
            return keys?.includes(target)
        })
    }

    private async cascadeRename (oldName: string, newName: string): Promise<void> {
        const oldUri = `${SSHKEY_SCHEME}${oldName}`
        const newUri = `${SSHKEY_SCHEME}${newName}`
        const storedProfiles = (this.config.store.profiles ?? []) as any[]
        let affected = 0
        for (const profile of storedProfiles) {
            const keys = profile?.options?.privateKeys as string[] | undefined
            if (keys?.includes(oldUri)) {
                profile.options.privateKeys = keys.map(k => k === oldUri ? newUri : k)
                affected++
            }
        }
        if (affected > 0) {
            await this.config.save()
            this.notifications.info(`Updated ${affected} SSH profile(s) to use sshkey://${newName}`)
        }
    }

    async deleteEntry (view: EntryView): Promise<void> {
        const refs = view.usedBy.length
        const detail = refs > 0
            ? `${refs} SSH profile(s) still reference this key and will fail to connect until updated: ${view.usedBy.join(', ')}`
            : undefined
        const result = await this.platform.showMessageBox({
            type: 'warning',
            message: `Delete "${view.name}"?`,
            detail,
            buttons: ['Delete', 'Cancel'],
            defaultId: 1,
            cancelId: 1,
        })
        if (result.response !== 0) {
            return
        }
        try {
            await this.keymap.remove(view.name)
        } catch (err: any) {
            this.notifications.error('Could not delete key', err?.message ?? String(err))
        }
    }

    async testKey (view: EntryView): Promise<void> {
        const res = await this.keymap.testKey(view)
        if (res.ok) {
            this.notifications.info(`"${view.name}" — ${res.message}`)
        } else {
            this.notifications.error(`"${view.name}" — not a valid SSH key`, res.message)
        }
    }

    openKeymapFile (): void {
        try {
            this.platform.showItemInFolder(this.keymap.filePath)
        } catch (err: any) {
            this.notifications.error('Could not open file location', err?.message ?? String(err))
        }
    }

    async openMigrationModal (): Promise<void> {
        this.ngbModal.open(MigrationModalComponent, { size: 'lg' })
    }
}
