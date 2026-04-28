using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;

namespace DiffStream.VisualStudio.Core
{
    public sealed class BinaryFileDetector
    {
        public async Task<bool> IsBinaryAsync(string filePath)
        {
            var buffer = new byte[Math.Min(8192, new FileInfo(filePath).Length)];
            using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete, 4096, true))
            {
                await stream.ReadAsync(buffer, 0, buffer.Length).ConfigureAwait(false);
            }

            if (Array.IndexOf(buffer, (byte)0) >= 0)
            {
                return true;
            }

            var decoded = Encoding.UTF8.GetString(buffer);
            var replacementCount = 0;
            foreach (var ch in decoded)
            {
                if (ch == '\uFFFD')
                {
                    replacementCount++;
                }
            }

            return decoded.Length > 0 && replacementCount / (double)decoded.Length > 0.05;
        }
    }
}
