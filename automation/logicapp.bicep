param location string = resourceGroup().location
param logicAppName string
@secure()
param githubToken string

var workflowDefinition = loadJsonContent('logicapp-definition.json').definition

resource rollbackWorkflow 'Microsoft.Logic/workflows@2019-05-01' = {
  name: logicAppName
  location: location
  properties: {
    state: 'Enabled'
    definition: workflowDefinition
    parameters: {
      githubToken: {
        value: githubToken
      }
    }
  }
}

output workflowName string = rollbackWorkflow.name
