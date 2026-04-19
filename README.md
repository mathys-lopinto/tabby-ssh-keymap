# tabby-ssh-keymap

A [Tabby](https://tabby.sh/) plugin that lets your SSH profiles reference private keys **by name** instead of by absolute file path — so the same synced Tabby config works on every machine, and moving a key is a one-line edit.

## Why

Tabby's SSH profiles store private keys as absolute local URIs:

```yaml
privateKeys:
  - file:///home/alice/.ssh/id_work
```

This creates two problems:

- **Sync across machines breaks.** `/home/alice/.ssh/id_work` doesn't exist on your macOS laptop or your Windows desktop. Every profile referencing that path fails when you sync the config.
- **No single source of truth locally.** Rotating a key, renaming a file, or reorganizing `~/.ssh/` means editing every profile that points to it.

## How it works

Profiles store a **logical name** that is safe to sync:

```yaml
privateKeys:
  - sshkey://work
```

Each machine keeps its own **local keymap file** (never synced) that resolves `work` to the actual path on that machine:

```json
// Linux
{ "keymap": [{ "name": "work", "path": "/home/alice/.ssh/id_work" }] }
```

```json
// Windows
{ "keymap": [{ "name": "work", "path": "C:\\Users\\Alice\\.ssh\\id_work" }] }
```

Same `sshkey://work` in the synced config; each machine maps it to its own layout. Rotate a key or move a file? Edit one line in the keymap — every profile referencing that name follows automatically.

## Install

From Tabby: **Settings → Plugins → Available**, search `ssh-keymap`, click **Get**, restart Tabby.

Or manually:

```
cd ~/.config/tabby/plugins   # %APPDATA%\tabby\plugins on Windows
npm install tabby-ssh-keymap
```

## Use

1. Open **Settings → SSH Keymap**
2. Add an entry: logical name + path to the private key (paths starting with `~/` are expanded)
3. Edit an SSH profile, click **Add a private key**, pick **SSH Keymap** in the selector, pick your entry
4. Your profile now references `sshkey://<name>` and will resolve it locally at connection time

### Key features

- **Scan profiles**: one-click migration of all existing `file://` entries in your current SSH profiles to `sshkey://`
- **Cascade rename**: rename a key; all referencing profiles are updated automatically
- **Key validation**: test button that parses each key with russh to verify its format
- **Home expansion**: paths like `~/.ssh/id_work` expand to `$HOME/.ssh/id_work` at resolution time
- **Search & usage count**: filter entries and see how many profiles reference each key
- **Backward compatible**: existing `file://` paths in profiles keep working unchanged

### Storage

The keymap is stored as `ssh-keymap.json` alongside Tabby's `config.yaml`:

- Linux/macOS: `~/.config/tabby/ssh-keymap.json`
- Windows: `%APPDATA%\tabby\ssh-keymap.json`

When Tabby's config sync is enabled, this file is **never** included in the sync.

## Development

```
git clone https://github.com/mathys-lopinto/tabby-ssh-keymap.git
cd tabby-ssh-keymap
yarn install
yarn watch
```

In a second terminal, with your Tabby source checkout:

```
TABBY_PLUGINS=/path/to/tabby-ssh-keymap yarn start
```

## License

MIT © Mathys Lopinto
