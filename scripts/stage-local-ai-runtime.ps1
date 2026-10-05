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
Write-Output "Staged pinned runtime and DLLs in $destination"
