using System;
using System.ComponentModel.Design;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using DiffStream.VisualStudio.Commands;
using DiffStream.VisualStudio.Core;
using DiffStream.VisualStudio.UI;
using EnvDTE;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Task = System.Threading.Tasks.Task;

namespace DiffStream.VisualStudio
{
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [InstalledProductRegistration("DiffStream", "A local file change timeline for Visual Studio solutions.", "0.1.0")]
    [ProvideMenuResource("Menus.ctmenu", 1)]
    [ProvideToolWindow(typeof(DiffStreamToolWindow), Style = VsDockStyle.Tabbed, Window = EnvDTE.Constants.vsWindowKindSolutionExplorer)]
    [ProvideAutoLoad(VSConstants.UICONTEXT.SolutionExists_string, PackageAutoLoadFlags.BackgroundLoad)]
    [Guid(Guids.PackageGuidString)]
    public sealed class DiffStreamPackage : AsyncPackage
    {
        public static DiffStreamPackage? Instance { get; private set; }

        public DiffStreamController Controller { get; private set; } = null!;

        protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            Instance = this;
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            var dte = await GetServiceAsync(typeof(DTE)) as DTE;
            Controller = new DiffStreamController(dte);

            await RegisterCommandsAsync(cancellationToken);
            Controller.Start();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                Controller?.Dispose();
            }

            base.Dispose(disposing);
        }

        private async Task RegisterCommandsAsync(CancellationToken cancellationToken)
        {
            var commandService = await GetServiceAsync(typeof(IMenuCommandService)) as OleMenuCommandService;
            if (commandService == null)
            {
                return;
            }

            AddCommand(commandService, CommandIds.OpenFeed, (_, _) => ShowToolWindow());
            AddCommand(commandService, CommandIds.StartWatching, (_, _) => Controller.Start());
            AddCommand(commandService, CommandIds.StopWatching, (_, _) => Controller.Stop());
            AddCommand(commandService, CommandIds.PauseFeed, (_, _) => Controller.Pause());
            AddCommand(commandService, CommandIds.ResumeFeed, (_, _) => Controller.Resume());
            AddCommand(commandService, CommandIds.ClearFeed, (_, _) => Controller.ClearFeed());
        }

        private void AddCommand(OleMenuCommandService commandService, int commandId, EventHandler handler)
        {
            var commandSet = new Guid(Guids.CommandSetGuidString);
            var menuCommandId = new CommandID(commandSet, commandId);
            commandService.AddCommand(new MenuCommand(handler, menuCommandId));
        }

        private void ShowToolWindow()
        {
            JoinableTaskFactory.RunAsync(async () =>
            {
                await JoinableTaskFactory.SwitchToMainThreadAsync();
                var window = await ShowToolWindowAsync(typeof(DiffStreamToolWindow), 0, true, DisposalToken);
                if (window?.Frame == null)
                {
                    throw new NotSupportedException("Cannot create DiffStream tool window.");
                }
            }).FileAndForget("DiffStream/OpenToolWindow");
        }
    }
}
