import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'

import { KeymapSettingsTabComponent } from '../components/keymapSettingsTab.component'

@Injectable()
export class SshKeymapSettingsTabProvider extends SettingsTabProvider {
    id = 'ssh-keymap'
    icon = 'address-book'
    title = 'SSH Keymap'

    getComponentType (): any {
        return KeymapSettingsTabComponent
    }
}
