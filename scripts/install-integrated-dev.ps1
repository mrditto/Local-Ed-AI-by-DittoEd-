param([Parameter(Mandatory)][string]$PackagePath, [Parameter(Mandatory)][string]$CertificatePath, [Parameter(Mandatory)][string]$ExpectedHash, [Parameter(Mandatory)][string]$ResultPath)
$ErrorActionPreference = 'Stop'
try {
    if ((Get-FileHash -LiteralPath $PackagePath -Algorithm SHA256).Hash -ne $ExpectedHash) { throw 'Development package hash mismatch.' }
    $publicCert = [Security.Cryptography.X509Certificates.X509Certificate2]::new($CertificatePath)
    if ($publicCert.Subject -ne 'CN=DittoEd Integrated Development') { throw 'Unexpected development certificate.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $packageZip = [IO.Compression.ZipFile]::OpenRead($PackagePath)
    try {
        $manifestReader = [IO.StreamReader]::new($packageZip.GetEntry('AppxManifest.xml').Open())
        [xml]$packageManifest = $manifestReader.ReadToEnd()
        $manifestReader.Dispose()
        if ($packageManifest.Package.Identity.Name -ne 'DittoED.LocalEdAI.Integrated.Dev' -or $packageManifest.Package.Identity.Publisher -ne $publicCert.Subject) { throw 'This helper only installs the isolated development package.' }
    } finally { $packageZip.Dispose() }
    Import-Certificate -FilePath $CertificatePath -CertStoreLocation 'Cert:\LocalMachine\TrustedPeople' | Out-Null
    Add-AppxPackage -Path $PackagePath
    $installed = Get-AppxPackage 'DittoED.LocalEdAI.Integrated.Dev'
    if (-not $installed) { throw 'Package registration was not found after installation.' }
    @{ ok=$true; packageFullName=$installed.PackageFullName; packageFamilyName=$installed.PackageFamilyName; installLocation=$installed.InstallLocation; certificateThumbprint=$publicCert.Thumbprint } | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath $ResultPath
} catch {
    @{ ok=$false; error=$_.Exception.Message } | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath $ResultPath
    exit 1
}
