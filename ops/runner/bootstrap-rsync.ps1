# Optional Git Bash prerequisite. Downloads only public MSYS2 packages locally.
$ErrorActionPreference = 'Stop'
$destination = Join-Path $PSScriptRoot '.runtime'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
foreach ($package in @('rsync-3.5.0-1', 'popt-1.19-1', 'libxxhash-0.8.4-1')) {
    $archive = Join-Path $destination "$package.tar.zst"
    Invoke-WebRequest -UseBasicParsing "https://repo.msys2.org/msys/x86_64/$package-x86_64.pkg.tar.zst" -OutFile $archive
    & "$env:SystemRoot/System32/tar.exe" -xf $archive -C $destination
    if ($LASTEXITCODE -ne 0) { throw "Extraction failed: $package" }
}
Write-Output 'rsync installed under ops/runner/.runtime; run remote_run.sh from Git Bash.'
