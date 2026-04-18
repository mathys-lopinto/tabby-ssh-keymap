import { Component, ElementRef, HostListener, OnInit, QueryList, ViewChildren } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { KeymapEntry } from '../api'
import { KeymapService } from '../services/keymap.service'

@Component({
    templateUrl: './keyPickerModal.component.pug',
})
export class KeyPickerModalComponent implements OnInit {
    entries: KeymapEntry[] = []
    statuses = new Map<string, boolean>()
    selectedIndex = 0

    @ViewChildren('item') itemChildren: QueryList<ElementRef>

    constructor (
        private modal: NgbActiveModal,
        private keymap: KeymapService,
    ) {}

    async ngOnInit (): Promise<void> {
        this.entries = await this.keymap.list()
        await Promise.all(this.entries.map(async e => {
            this.statuses.set(e.name, await this.keymap.exists(e))
        }))
    }

    @HostListener('keydown', ['$event']) onKeyDown (event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault()
            this.cancel()
        } else if (this.entries.length > 0) {
            if (event.key === 'ArrowUp') {
                event.preventDefault()
                this.selectedIndex = (this.selectedIndex - 1 + this.entries.length) % this.entries.length
                this.scrollToSelected()
            } else if (event.key === 'ArrowDown') {
                event.preventDefault()
                this.selectedIndex = (this.selectedIndex + 1) % this.entries.length
                this.scrollToSelected()
            } else if (event.key === 'Enter') {
                event.preventDefault()
                this.pick(this.entries[this.selectedIndex])
            }
        }
    }

    private scrollToSelected (): void {
        Array.from(this.itemChildren)[this.selectedIndex]?.nativeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
        })
    }

    pick (entry: KeymapEntry): void {
        this.modal.close(entry.name)
    }

    cancel (): void {
        this.modal.dismiss()
    }
}
