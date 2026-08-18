
param location string = resourceGroup().location
param aksClusterName string = 'smartdeploy-aks'
param keyVaultName string = 'sd-kv-${uniqueString(resourceGroup().id)}'
param acrName string = 'smartdeployacr'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

module aks 'modules/aks.bicep' = {
  name: 'aks-deployment'
  params: {
    location: location
    clusterName: aksClusterName
    acrId: acr.id
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault-deployment'
  params: {
    location: location
    keyVaultName: keyVaultName
    aksKubeletIdentityObjectId: aks.outputs.kubeletIdentityObjectId
  }
}

output aksClusterName string = aksClusterName
output keyVaultName string = keyVault.outputs.keyVaultName
output aksKubeletIdentityObjectId string = aks.outputs.kubeletIdentityObjectId
