using System;
using System.Diagnostics;
using System.IO;

// Thin executable wrapper: all startup logic stays in the shared repository launcher.
internal static class AseLovableLauncher
{
    private static int Main(string[] args)
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string batch = Path.Combine(root, "ASE_Lovable.cmd");
        if (!File.Exists(batch))
        {
            Console.Error.WriteLine("ASE_Lovable.cmd no encontrado junto al ejecutable.");
            return 1;
        }
        string argument = args.Length == 1 && args[0] == "--no-browser" ? " --no-browser" : "";
        var start = new ProcessStartInfo(Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe");
        start.Arguments = "/d /s /c \"\"" + batch + "\"" + argument + "\"";
        start.WorkingDirectory = root;
        start.UseShellExecute = false;
        using (var child = Process.Start(start))
        {
            if (child == null) return 1;
            child.WaitForExit();
            return child.ExitCode;
        }
    }
}