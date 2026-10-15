param([string]$VcRedistDirectory)
$ErrorActionPreference = 'Stop'
$repository = Split-Path $PSScriptRoot -Parent
$catalog = Get-Content (Join-Path $repository 'config/local-ai-artifacts.json') -Raw | ConvertFrom-Json
$archive = Join-Path $repository "local-ai-data/runtime/$($catalog.runtime.tag)-windows-x64.zip"
if ((Get-Item -LiteralPath $archive).Length -ne $catalog.runtime.bytes -or
    (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $catalog.runtime.sha256) {
    throw 'Runtime archive validation failed. Run npm run local-ai:runtime.'
}
$expanded = Join-Path $repository "local-ai-data/runtime/staging-$([guid]::NewGuid())"
Expand-Archive -LiteralPath $archive -DestinationPath $expanded
$destination = Join-Path $repository 'src-tauri/resources/local-ai-runtime'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$server = @(Get-ChildItem -LiteralPath $expanded -Recurse -File -Filter 'llama-server.exe')
if ($server.Count -ne 1) { throw 'Expected exactly one llama-server.exe in pinned archive.' }
$runtimeDirectory = $server[0].Directory.FullName
Copy-Item -LiteralPath $server[0].FullName -Destination $destination
Get-ChildItem -LiteralPath $runtimeDirectory -File -Filter '*.dll' | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $destination
}
Copy-Item -LiteralPath (Join-Path $runtimeDirectory 'LICENSE-LLVM-OpenMP') -Destination $destination
Copy-Item -LiteralPath (Join-Path $repository 'docs/local-ai/licenses/LLAMA-LICENSE.txt') -Destination $destination
Copy-Item -LiteralPath (Join-Path $repository 'docs/local-ai/licenses/QWEN-LICENSE.txt') -Destination $destination
# App-local C++ runtime for the pinned CPU engine. Do not copy DLLs from System32.
if (-not $VcRedistDirectory) {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
    $vsRoots = @(& $vswhere -all -products '*' -property installationPath)
    $VcRedistDirectory = $vsRoots | ForEach-Object {
        Join-Path $_ 'VC/Redist/MSVC/14.44.35112/x64/Microsoft.VC143.CRT'
    } | Where-Object { Test-Path -LiteralPath $_ -PathType Container } | Select-Object -First 1
    if (-not $VcRedistDirectory) { throw 'Provide -VcRedistDirectory for Visual Studio C++ redist 14.44.35112 x64.' }
}
$crtFiles = @(Get-ChildItem -LiteralPath $VcRedistDirectory -Filter '*.dll' -File)
if ($crtFiles.Count -ne 10) { throw 'Expected the pinned MSVC x64 redistributable DLL set.' }
foreach ($crtFile in $crtFiles) { Copy-Item -LiteralPath $crtFile.FullName -Destination $destination }
[IO.File]::WriteAllText((Join-Path $destination 'MSVC-REDIST.txt'), "Distributable Code for Microsoft Visual Studio 2022 (Includes Utilities & BuildServer Files)`r`n`r`nFor the latest version of this Redist file, please visit https://aka.ms/vs/17/redist.txt.`r`n")
Write-Output "Staged pinned runtime and DLLs in $destination"
