param([string[]]$Assets)
$ProgressPreference = 'SilentlyContinue'
foreach ($asset in $Assets) {
    Write-Host "=== $asset ==="
    try {
        $r = Invoke-RestMethod -Uri "https://api.polyhaven.com/files/$asset" -TimeoutSec 60
        $g = $r.gltf.'1k'.gltf
        $dir = "assets\models\$asset"
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        $gltfName = Split-Path $g.url -Leaf
        if (-not (Test-Path "$dir\$gltfName")) {
            Invoke-WebRequest -Uri $g.url -OutFile "$dir\$gltfName" -UseBasicParsing
        }
        Write-Host "  gltf: $gltfName ($($g.size))"
        foreach ($p in $g.include.PSObject.Properties) {
            $rel = $p.Name -replace '/', '\'
            $dest = Join-Path $dir $rel
            $destDir = Split-Path $dest -Parent
            New-Item -ItemType Directory -Force -Path $destDir | Out-Null
            if (-not (Test-Path $dest) -or (Get-Item $dest).Length -ne $p.Value.size) {
                Invoke-WebRequest -Uri $p.Value.url -OutFile $dest -UseBasicParsing
            }
            Write-Host "  $rel ($($p.Value.size))"
        }
        Write-Host "  DONE"
    } catch {
        Write-Host "  FAIL: $($_.Exception.Message)"
    }
}
