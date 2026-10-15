param([string]$OutputDirectory = 'local-ai-data/msix', [switch]$Unsigned, [switch]$Production)
$ErrorActionPreference = 'Stop'
$repository = Split-Path $PSScriptRoot -Parent
if (-not [IO.Path]::IsPathRooted($OutputDirectory)) { $OutputDirectory = Join-Path $repository $OutputDirectory }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$exe = Join-Path $repository 'src-tauri/target/release/educatorllm.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build the integrated release executable first.' }
$receiptPath = Join-Path $repository 'local-ai-data/integrated-build.json'
if (-not (Test-Path -LiteralPath $receiptPath)) { throw 'Run npm run tauri:integrated:build before packaging.' }
$expectedIdentifier = if ($Production) { 'com.educatorllm.app' } else { 'com.dittoed.localai.integrated.dev' }
$receipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
if ((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $receipt.sha256 -or $receipt.identifier -ne $expectedIdentifier) { throw 'Integrated build receipt does not match the executable.' }
$sdk = 'C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64'
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$embeddedManifest = Join-Path $OutputDirectory 'executable-manifest.xml'
& (Join-Path $sdk 'mt.exe') "-inputresource:$exe;#1" "-out:$embeddedManifest"
if ($LASTEXITCODE -ne 0) { throw 'Could not read executable manifest.' }
[xml]$embeddedXml = Get-Content -LiteralPath $embeddedManifest -Raw
$dpi = $embeddedXml.SelectSingleNode("//*[local-name()='dpiAwareness' and namespace-uri()='http://schemas.microsoft.com/SMI/2016/WindowsSettings']")
if (-not $dpi -or $dpi.InnerText.Trim() -ne 'PerMonitorV2, PerMonitor') { throw 'Executable is missing the reviewed per-monitor DPI declaration.' }
& node (Join-Path $PSScriptRoot 'verify-store-assets.mjs') (Join-Path $repository 'src-tauri/gen/windows/Assets')
if ($LASTEXITCODE -ne 0) { throw 'Store tile verification failed.' }
$runtimeFolder = Join-Path $repository 'src-tauri/resources/local-ai-runtime'
$runtimeInventory = Import-Csv (Join-Path $repository 'docs/local-ai/RUNTIME-FILES.csv')
if (@(Get-ChildItem -LiteralPath $runtimeFolder -File).Count -ne @($runtimeInventory).Count) { throw 'Runtime inventory differs from reviewed staging.' }
foreach ($runtimeFile in $runtimeInventory) {
    if ([IO.Path]::GetFileName($runtimeFile.File) -ne $runtimeFile.File) { throw 'Invalid runtime inventory filename.' }
    $runtimePath = Join-Path $runtimeFolder $runtimeFile.File
    if ((Get-Item -LiteralPath $runtimePath).Length -ne [long]$runtimeFile.Bytes -or (Get-FileHash -LiteralPath $runtimePath).Hash.ToLowerInvariant() -ne $runtimeFile.SHA256) { throw "Runtime integrity check failed: $($runtimeFile.File)" }
}
$staging = Join-Path $OutputDirectory ('content-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $staging -Force | Out-Null
Copy-Item -LiteralPath $exe -Destination $staging
Copy-Item -LiteralPath (Join-Path $repository 'src-tauri/resources/local-ai-runtime') -Destination $staging -Recurse
Copy-Item -LiteralPath (Join-Path $repository 'src-tauri/gen/windows/Assets') -Destination $staging -Recurse
$catalog = Get-Content (Join-Path $repository 'config/local-ai-artifacts.json') -Raw | ConvertFrom-Json
$defaultModel = $catalog.models | Where-Object id -eq 'qwen3.5-4b-q4-k-m'
$modelSource = Join-Path $repository ('local-ai-data/models/' + $defaultModel.filename)
if ((Get-Item -LiteralPath $modelSource).Length -ne $defaultModel.bytes -or (Get-FileHash -LiteralPath $modelSource).Hash.ToLowerInvariant() -ne $defaultModel.sha256) { throw 'Bundled model integrity check failed.' }
$modelDestination = Join-Path $staging 'local-ai-models'
New-Item -ItemType Directory -Path $modelDestination -Force | Out-Null
Copy-Item -LiteralPath $modelSource -Destination $modelDestination
$storeConfig = Get-Content (Join-Path $repository 'src-tauri/gen/windows/bundle.config.json') -Raw | ConvertFrom-Json
$packageVersion = if ($Production) { [string]$storeConfig.version } else { '0.5.5.4' }
if ($packageVersion -notmatch '^\d+\.\d+\.\d+\.\d+$') { throw 'Package version must have four numeric components.' }
$versionParts = @($packageVersion.Split('.') | ForEach-Object { [uint32]::Parse($_) })
if (@($versionParts | Where-Object { $_ -gt 65535 }).Count -or $versionParts[0] -eq 0 -or ($Production -and $versionParts[3] -ne 0)) { throw 'Invalid Store package version.' }
$publisherDisplay = if ($Production) { 'Ditto ED' } else { 'DittoEd Development' }
$publisher = if ($Production) { 'CN=1E8CAC31-13E1-436C-A5ED-F5F454796ADD' } else { 'CN=DittoEd Integrated Development' }
if ($Unsigned -and -not $Production) { $publisher += ', OID.2.25.311729368913984317654407730594956997722=1' }
$manifest = Get-Content (Join-Path $repository 'src-tauri/gen/windows/AppxManifest.xml.template') -Raw
if (-not $Production) { $manifest = $manifest.Replace('DittoED.LocalEdAI','DittoED.LocalEdAI.Integrated.Dev').Replace('Local Ed AI','Local Ed AI Integrated Dev') }
$manifest = $manifest.Replace('{{PUBLISHER}}',$publisher).Replace('{{VERSION}}',$packageVersion).Replace('{{ARCH}}','x64').Replace('{{PUBLISHER_DISPLAY_NAME}}',$publisherDisplay).Replace('{{MIN_VERSION}}','10.0.19041.0').Replace('{{EXECUTABLE}}','educatorllm.exe').Replace('{{EXTENSIONS}}','').Replace('{{CAPABILITIES}}','    <rescap:Capability Name="runFullTrust" />')
$manifest | Set-Content -Encoding utf8 (Join-Path $staging 'AppxManifest.xml')
$packageName = if ($Production) { "Local Ed AI_${packageVersion}_x64.msix" } else { "LocalEdAI.Integrated.Dev_${packageVersion}_x64.msix" }
$package = Join-Path $OutputDirectory $packageName
& (Join-Path $sdk 'makeappx.exe') pack /d $staging /p $package /o
if ($LASTEXITCODE -ne 0) { throw 'MSIX packing failed.' }
if (-not $Unsigned -and -not $Production) {
    $cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -eq $publisher -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date).AddDays(7) } | Select-Object -First 1
    if (-not $cert) {
        $cert = New-SelfSignedCertificate -Type Custom -Subject $publisher -KeyUsage DigitalSignature -CertStoreLocation 'Cert:\CurrentUser\My' -FriendlyName 'Local Ed AI integrated development only' -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3','2.5.29.19={text}') -NotAfter (Get-Date).AddMonths(3)
    }
    Export-Certificate -Cert $cert -FilePath (Join-Path $OutputDirectory 'LocalEdAI.Integrated.Dev.cer') | Out-Null
    & (Join-Path $sdk 'signtool.exe') sign /fd SHA256 /sha1 $cert.Thumbprint /s My $package
    if ($LASTEXITCODE -ne 0) { throw 'MSIX signing failed.' }
}
Get-FileHash -LiteralPath $package -Algorithm SHA256 | Format-List
Write-Output "Package content: $staging"
Write-Output "Development MSIX: $package"
