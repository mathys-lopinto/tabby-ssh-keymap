import { Injectable, Injector } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { FileProvider, FileProvidersService, NotificationsService } from 'tabby-core'

import { SSHKEY_SCHEME, expandPath } from '../api'
import { KeymapService } from './keymap.service'
import { KeyPickerModalComponent } from '../components/keyPickerModal.component'

@Injectable()
export class SshKeymapFileProvider extends FileProvider {
    name = 'SSH Keymap'
    private notifiedMissing = new Set<string>()

    constructor (
        private keymap: KeymapService,
        private ngbModal: NgbModal,
        private injector: Injector,
        private notifications: NotificationsService,
    ) {
        super()
        this.keymap.entries$.subscribe(() => this.notifiedMissing.clear())
    }

    async isAvailable (): Promise<boolean> {
        return (await this.keymap.list()).length > 0
    }

    async retrieveFile (key: string): Promise<Buffer> {
        if (!key.startsWith(SSHKEY_SCHEME)) {
            throw new Error('Not an sshkey:// URI')
        }
        const name = key.slice(SSHKEY_SCHEME.length)

        const isPubRequest = name.endsWith('.pub')
        let entry = await this.keymap.get(name)
        let candidates: string[] = entry ? [entry.path] : []

        if (!entry && isPubRequest) {
            const baseName = name.slice(0, -'.pub'.length)
            const baseEntry = await this.keymap.get(baseName)
            if (baseEntry) {
                entry = baseEntry
                candidates = [baseEntry.path + '.pub']
                if (baseEntry.path.endsWith('.pem')) {
                    candidates.push(baseEntry.path.slice(0, -'.pem'.length) + '.pub')
                }
            }
        }

        if (!entry || candidates.length === 0) {
            if (!isPubRequest) {
                this.notifications.error(
                    `SSH key "${name}" is not in the keymap`,
                    'Open the SSH Keymap tab to add it.',
                )
            }
            throw new Error(`SSH keymap has no entry named "${name}"`)
        }

        const fileProviders = this.injector.get(FileProvidersService)
        let lastErr: any = null
        for (const candidate of candidates) {
            try {
                return await fileProviders.retrieveFile(`file://${expandPath(candidate)}`)
            } catch (err) {
                lastErr = err
            }
        }

        const attempted = candidates.join(', ')
        if (!isPubRequest && !this.notifiedMissing.has(attempted)) {
            this.notifiedMissing.add(attempted)
            this.notifications.error(
                `SSH key "${name}" points to a missing file`,
                attempted,
            )
        }
        throw new Error(`could not read ${attempted} (${lastErr?.message ?? lastErr})`)
    }

    async selectAndStoreFile (_description: string): Promise<string> {
        await new Promise(resolve => setTimeout(resolve, 0))
        const modal = this.ngbModal.open(KeyPickerModalComponent)
        const picked: string = await modal.result
        return `${SSHKEY_SCHEME}${picked}`
    }
}
