# tabby-ssh-keymap

A [Tabby](https://tabby.sh/) plugin that adds an indirection layer between your SSH profiles and the physical paths of your private keys. Keeps your synced Tabby config portable across machines.

## The problem

Tabby's SSH profiles store private keys as absolute local URIs:

```yaml
privateKeys:
  - file:///home/alice/.ssh/id_work
```

When you sync that config to a second machine with a different user or OS layout, the path breaks and every SSH profile using it fails.

## The fix

Profiles store a **logical reference** that is safe to sync:

```yaml
privateKeys:
  - sshkey://work
```

Each machine keeps a **local keymap file** (never synced) that resolves `work` to the actual path on that machine:

```json
{
  "keymap": [
    { "name": "work", "path": "/home/alice/.ssh/id_work" }
  ]
}
```

Rotating a key or moving a file is a one-line edit; the same synced Tabby config works everywhere.

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
