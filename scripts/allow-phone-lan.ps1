#Requires -RunAsAdministrator
param([string]$InterfaceAlias='WiFi')
$ErrorActionPreference='Stop'
$resultPath=Join-Path $PSScriptRoot '..\.phone-firewall-result.local'
try {
  $nodePath=(Get-Command node.exe -ErrorAction Stop).Source
  $ruleName='FigmaXR-Phone-Private-5173'
  $parameters=@{
    Name=$ruleName
    DisplayName='Figma XR phone testing (private WiFi)'
    Description='Allow Node Figma XR on TCP 5173 from the local subnet on private WiFi only.'
    Direction='Inbound';Action='Allow';Profile='Private';InterfaceAlias=$InterfaceAlias
    Protocol='TCP';LocalPort=5173;RemoteAddress='LocalSubnet';Program=$nodePath
    EdgeTraversalPolicy='Block';Enabled='True'
  }
  if(Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue){$parameters.Remove('DisplayName');Set-NetFirewallRule @parameters | Out-Null}
  else {New-NetFirewallRule @parameters | Out-Null}
  [pscustomobject]@{ok=$true;port=5173;profile='Private';interface=$InterfaceAlias} | ConvertTo-Json | Set-Content -Path $resultPath
  Write-Host 'Figma XR can now accept phone connections on the private WiFi subnet.'
} catch {
  [pscustomobject]@{ok=$false;error=$_.Exception.Message} | ConvertTo-Json | Set-Content -Path $resultPath
  throw
}
