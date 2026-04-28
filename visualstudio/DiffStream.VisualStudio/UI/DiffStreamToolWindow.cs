using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Shell;

namespace DiffStream.VisualStudio.UI
{
    [Guid(Guids.ToolWindowGuidString)]
    public sealed class DiffStreamToolWindow : ToolWindowPane
    {
        public DiffStreamToolWindow() : base(null)
        {
            Caption = "DiffStream Feed";
            Content = new DiffStreamToolWindowControl(DiffStreamPackage.Instance?.Controller);
        }
    }
}
