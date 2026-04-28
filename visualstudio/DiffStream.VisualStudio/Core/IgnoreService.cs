using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace DiffStream.VisualStudio.Core
{
    public sealed class IgnoreService
    {
        private static readonly string[] DefaultIgnoredFolders =
        {
            "node_modules", ".git", "dist", "build", "out", "coverage", ".next", ".turbo", "vendor", "target", ".idea", ".vs", "bin", "obj"
        };

        private static readonly HashSet<string> DefaultIgnoredExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".dll", ".exe", ".pdb", ".cache", ".vsix"
        };

        public bool IsIgnored(string filePath)
        {
            var parts = filePath.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (parts.Any(part => DefaultIgnoredFolders.Contains(part, StringComparer.OrdinalIgnoreCase)))
            {
                return true;
            }

            return DefaultIgnoredExtensions.Contains(Path.GetExtension(filePath));
        }
    }
}
