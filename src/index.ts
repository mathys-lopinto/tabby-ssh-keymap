/* eslint-disable @typescript-eslint/no-extraneous-class */
import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import { ToastrModule } from 'ngx-toastr'

import TabbyCorePlugin, { FileProvider } from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'

import { KeymapService } from './services/keymap.service'
import { SshKeymapFileProvider } from './services/sshKeymapFileProvider'
import { KeymapSettingsTabComponent } from './components/keymapSettingsTab.component'
import { KeyPickerModalComponent } from './components/keyPickerModal.component'
import { MigrationModalComponent } from './components/migrationModal.component'
import { SshKeymapSettingsTabProvider } from './providers/settingsTabProvider'

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        NgbModule,
        ToastrModule,
        TabbyCorePlugin,
    ],
    providers: [
        KeymapService,
        { provide: FileProvider, useClass: SshKeymapFileProvider, multi: true },
        { provide: SettingsTabProvider, useClass: SshKeymapSettingsTabProvider, multi: true },
    ],
    declarations: [
        KeymapSettingsTabComponent,
        KeyPickerModalComponent,
        MigrationModalComponent,
    ],
})
export default class SshKeymapModule {}

export * from './api'
export { KeymapService }
