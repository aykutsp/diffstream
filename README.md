# DiffStream

DiffStream is a Visual Studio Code extension that shows a local timeline of file changes in your workspace. It turns recent edits into compact line-level diffs so you can review what changed without leaving the editor.

![DiffStream Feed](media/diffstream-feed.png)

## Why DiffStream

Modern development often touches many files quickly. A file may change because you saved it, a formatter ran, generated code was updated, or a project task modified local files. Git can show the final result later; DiffStream helps you review the local change timeline as it happens.

Use DiffStream when you want to:

- Review workspace changes without waiting for commits.
- See file creations, deletions, saves, and local updates in one place.
- Review compact line-level diffs while tools are modifying the project.
- Copy a clean change summary for handoff, review, or context sharing.

## Features

- Live local workspace timeline across multiple workspace folders.
- Line-level diffs for added, removed, modified, saved, created, deleted, renamed, and locally changed files.
- Compact event cards with timestamps, relative paths, line ranges, and change counts.
- Sidebar feed with search, type filters, pause/resume, clear, open file, and copy diff actions.
- Best-effort rename detection for rapid delete/create operations with identical content.
- Configurable ignored folders, ignored extensions, debounce delay, feed size, and max file size.
- Binary and large-file safeguards to keep the extension responsive in large repositories.
- Recent feed persistence through VS Code workspace state.
- Theme-aware UI using VS Code color variables.

## Getting Started

Install dependencies and compile the extension:

```bash
npm install
npm run compile
```

Run it in an Extension Development Host:

```bash
code --new-window --extensionDevelopmentPath=.
```

In the development window, open the Command Palette and run:

```text
DiffStream: Open Feed
```

DiffStream starts automatically when a workspace opens, provided `diffstream.enabled` and `diffstream.autoStart` are enabled.

## Commands

| Command | Description |
| --- | --- |
| `DiffStream: Open Feed` | Opens the live change feed. |
| `DiffStream: Start Watching` | Starts workspace monitoring. |
| `DiffStream: Stop Watching` | Stops workspace monitoring. |
| `DiffStream: Pause Feed` | Pauses new feed entries while keeping the watcher available. |
| `DiffStream: Resume Feed` | Resumes feed updates. |
| `DiffStream: Clear Feed` | Removes all current feed entries. |

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `diffstream.enabled` | `true` | Enables DiffStream. |
| `diffstream.maxFeedItems` | `300` | Maximum number of feed events kept in memory. |
| `diffstream.debounceMs` | `300` | Per-file debounce delay in milliseconds. |
| `diffstream.maxFileSizeBytes` | `1048576` | Maximum text file size to diff. |
| `diffstream.ignoredGlobs` | Common heavy folders | Glob patterns ignored by the watcher. |
| `diffstream.showInitialFileContentOnCreate` | `true` | Shows initial added lines for created files. |
| `diffstream.showRemovedContentOnDelete` | `false` | Shows removed lines for deleted files. |
| `diffstream.autoStart` | `true` | Starts watching automatically when a workspace opens. |
| `diffstream.ignoredExtensions` | `[]` | File extensions to ignore, such as `.png` or `.lock`. |

## Architecture

```text
VS Code FileSystemWatcher
        |
        v
FileWatcherService -> SnapshotStore -> DiffService
        |                              |
        v                              v
DiffStreamController -----------> FeedStore
        |                              |
        v                              v
StatusBarController             FeedWebviewProvider
```

## Development

Compile:

```bash
npm run compile
```

Run tests:

```bash
npm test
```

Run linting:

```bash
npm run lint
```

Create a local VSIX package:

```bash
npm run package
```

## Roadmap

- Export feed to a Markdown file.
- Group related rapid changes by file and time window.
- Add optional workspace decorations for recent changes.
- Improve rename detection with similarity scoring.
- Add a compact tree view grouped by file.

## Contributing

Issues and pull requests are welcome. Please keep changes focused, typed, and covered by tests when behavior changes.

## License

MIT
