# DiffStream for Visual Studio

DiffStream for Visual Studio is a VSIX extension that adds a local file change timeline to Visual Studio 2022. It watches the current solution folder, keeps lightweight in-memory snapshots, and displays compact line-level diffs in a dedicated tool window.

## Features

- Tool window: **View > Other Windows > DiffStream Feed** after installation.
- Tools menu commands for opening the feed, starting/stopping watching, pausing/resuming, and clearing the feed.
- File creation, deletion, rename, and local change events.
- Compact added/removed/modified line summaries.
- Binary and large-file safeguards.
- Ignored folders for common build and dependency directories.

## Requirements

- Visual Studio 2022.
- Visual Studio extension development workload.
- .NET Framework 4.7.2 targeting pack.

## Build

Open `DiffStream.VisualStudio.slnx` in Visual Studio 2022 and build the `DiffStream.VisualStudio` project.

The generated `.vsix` can be installed into Visual Studio or launched in the Experimental Instance from Visual Studio.

From a Developer PowerShell, you can also package the extension with:

```powershell
MSBuild.exe .\DiffStream.VisualStudio\DiffStream.VisualStudio.csproj /p:Configuration=Release /t:PackageVsix
```

The packaged extension is written to:

```text
DiffStream.VisualStudio\bin\Release\DiffStream.VisualStudio.vsix
```

## Notes

This extension is separate from the VS Code version. The Visual Studio SDK uses a different extensibility model based on `AsyncPackage`, VSIX manifests, VSCT command tables, and WPF tool windows.
