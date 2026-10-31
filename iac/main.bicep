
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
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault-deployment'
  params: {
    location: location
    keyVaultName: keyVaultName
  }
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, resourceId('Microsoft.ContainerService/managedClusters', aksClusterName), 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalId: aks.outputs.kubeletIdentityObjectId
    principalType: 'ServicePrincipal'
  }
}

output aksClusterName string = aksClusterName
output keyVaultName string = keyVault.outputs.keyVaultName
output aksKubeletIdentityObjectId string = aks.outputs.kubeletIdentityObjectId
