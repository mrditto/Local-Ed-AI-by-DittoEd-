param([Parameter(Mandatory)][string]$PackagePath, [string]$ExpectedExecutableHash)
$ErrorActionPreference = 'Stop'
$repository = Split-Path $PSScriptRoot -Parent
$config = Get-Content (Join-Path $repository 'src-tauri/gen/windows/bundle.config.json') -Raw | ConvertFrom-Json
if (-not $ExpectedExecutableHash) {
    $receipt = Get-Content (Join-Path $repository 'local-ai-data/integrated-build.json') -Raw | ConvertFrom-Json
    if ($receipt.identifier -ne 'com.educatorllm.app') { throw 'Expected a production build receipt.' }
    $ExpectedExecutableHash = $receipt.sha256
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $PackagePath).Path)
function Assert-PackedFile([string]$name, [long]$bytes, [string]$hash) {
    $entry = $archive.GetEntry($name)
    if (-not $entry -or ($bytes -ge 0 -and $entry.Length -ne $bytes)) { throw "Missing file or wrong length: $name" }
    $stream = $entry.Open()
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { $actual = [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $algorithm.Dispose() }
    if ($actual -ne $hash.ToLowerInvariant()) { throw "Packed hash mismatch: $name" }
}
try {
    $entry = $archive.GetEntry('AppxManifest.xml')
    if (-not $entry) { throw 'Manifest missing.' }
    $reader = [IO.StreamReader]::new($entry.Open())
    try { $raw = $reader.ReadToEnd() } finally { $reader.Dispose() }
    [xml]$manifest = $raw
    $identities = @($manifest.SelectNodes("//*[local-name()='Identity']"))
    if ($identities.Count -ne 1) { throw 'Expected one package identity.' }
    $identity = $identities[0]
    if ($identity.Name -ne 'DittoED.LocalEdAI' -or $identity.Publisher -ne 'CN=1E8CAC31-13E1-436C-A5ED-F5F454796ADD' -or $identity.Version -ne $config.version -or $identity.ProcessorArchitecture -ne 'x64' -or $raw -match '\{\{') { throw 'Invalid production identity, version, architecture or placeholders.' }
    $applications = @($manifest.SelectNodes("//*[local-name()='Application']"))
    if ($applications.Count -ne 1 -or $applications[0].Executable -ne 'educatorllm.exe' -or $applications[0].EntryPoint -ne 'Windows.FullTrustApplication') { throw 'Invalid full-trust executable definition.' }
    if (@($manifest.SelectNodes("//*[local-name()='Capability' and @Name='runFullTrust']")).Count -ne 1) { throw 'Expected exactly one full-trust capability.' }
    $assets = @($manifest.SelectNodes('//@Square150x150Logo | //@Square44x44Logo | //@Wide310x150Logo | //@Square310x310Logo | //@Square71x71Logo'))
    foreach ($asset in $assets) { if (-not $archive.GetEntry($asset.Value.Replace('\','/'))) { throw "Missing asset: $($asset.Value)" } }
    $logo = [string]$manifest.Package.Properties.Logo
    if (-not $archive.GetEntry($logo.Replace('\','/'))) { throw 'Missing Store logo.' }
    Assert-PackedFile 'educatorllm.exe' -1 $ExpectedExecutableHash
    foreach ($file in (Import-Csv (Join-Path $repository 'docs/local-ai/RUNTIME-FILES.csv'))) { Assert-PackedFile ('local-ai-runtime/'+$file.File) ([long]$file.Bytes) $file.SHA256 }
    $catalog = Get-Content (Join-Path $repository 'config/local-ai-artifacts.json') -Raw | ConvertFrom-Json
    $model = $catalog.models | Where-Object id -eq 'qwen3.5-4b-q4-k-m'
    Assert-PackedFile ('local-ai-models/'+$model.filename) ([long]$model.bytes) $model.sha256
    Write-Output "PASS: production archive identity, assets, executable, runtime inventory and bundled model: $PackagePath"
} finally { $archive.Dispose() }
