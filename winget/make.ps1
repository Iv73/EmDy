# Génère les manifestes winget d'une version publiée sur GitHub.
#   powershell -File winget\make.ps1 0.1.4
# Résultat : winget\out\manifests\i\Iv73\EmDy\<version>\ (à valider avec `winget validate`,
# puis à proposer au dépôt microsoft/winget-pkgs).
param([Parameter(Mandatory)][string]$Version)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "https://github.com/Iv73/EmDy/releases/download/v$Version/EmDy-$Version-setup.exe"
$tmp = Join-Path $env:TEMP "EmDy-$Version-setup.exe"
Invoke-WebRequest $url -OutFile $tmp -UseBasicParsing
$sha = (Get-FileHash $tmp -Algorithm SHA256).Hash
Remove-Item $tmp
$date = (Get-Date).ToString('yyyy-MM-dd')
$out = Join-Path $here "out\manifests\i\Iv73\EmDy\$Version"
New-Item -ItemType Directory -Force $out | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
Get-ChildItem $here -Filter 'Iv73.EmDy*.yaml' | ForEach-Object {
  $t = [IO.File]::ReadAllText($_.FullName, $utf8)
  $t = $t.Replace('__VERSION__', $Version).Replace('__SHA256__', $sha).Replace('__DATE__', $date)
  [IO.File]::WriteAllText((Join-Path $out $_.Name), $t, $utf8)
}
Write-Host "Manifestes : $out"
Write-Host "SHA256    : $sha"
