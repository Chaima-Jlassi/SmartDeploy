$ErrorActionPreference = 'Stop'

Get-Command kubectl -ErrorAction Stop | Out-Null

& kubectl get namespace monitoring --output=name | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'The monitoring namespace is unavailable in the current Kubernetes context.'
}

$secureUrl = Read-Host 'Paste the newly regenerated Logic App callback URL' -AsSecureString
$urlPointer = [IntPtr]::Zero
$url = $null
$manifest = $null

try {
    if ($secureUrl.Length -eq 0) {
        throw 'The Logic App callback URL cannot be empty.'
    }

    $urlPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
    $url = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($urlPointer)

    if ($url -notmatch '^https://') {
        throw 'The Logic App callback URL must use HTTPS.'
    }

    $manifest = [ordered]@{
        apiVersion = 'v1'
        kind = 'Secret'
        metadata = @{
            name = 'logicapp-webhook'
            namespace = 'monitoring'
        }
        type = 'Opaque'
        stringData = @{
            url = $url
        }
    } | ConvertTo-Json -Depth 5 -Compress

    $manifest | & kubectl apply --filename -
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not apply the Logic App webhook Secret.'
    }
}
finally {
    if ($urlPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($urlPointer)
    }
    $secureUrl.Dispose()
    Remove-Variable url, manifest -ErrorAction SilentlyContinue
}
