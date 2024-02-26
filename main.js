const mdh = require('./mdh')
const secretManager = require('./SecretsManager')
require('dotenv').config()

async function main(args) {

  // **NOTE!** In a real production app you would want these to be sourced from secrets manager. The .env file is just
  // a convenience for development.
  let rksProjectId = null
  let notificationId = null
  let rksServiceAccount = null
  let privateKey = null

  const secretName = process.env.AWS_SECRET_NAME
  const surveyName = process.env.SURVEY_NAME

  // If we are in production system then MDH configuration will get loaded from the secrets manager.
  if (process.env.NODE_ENV === 'production') {
    let secret = await secretManager.getSecret(secretName)
    secret = JSON.parse(secret)
    rksProjectId = secret['RKS_PROJECT_ID']
    notificationId = secret['NOTIFICATION_ID']
    rksServiceAccount = secret['RKS_SERVICE_ACCOUNT']
    privateKey = secret['RKS_PRIVATE_KEY']
  }
  else {
    // Local / Non-production environment.
    // If We have passed the service account and private key path in the environment use that.
    if (process.env.RKS_SERVICE_ACCOUNT && process.env.RKS_PRIVATE_KEY) {
      console.log('Using MDH credentials from environment variables')
      rksServiceAccount = process.env.RKS_SERVICE_ACCOUNT
      rksProjectId = process.env.RKS_PROJECT_ID
      notificationId = process.env.NOTIFICATION_ID
      privateKey = process.env.RKS_PRIVATE_KEY
    }
    else {
      console.log('Fatal Error: RKS service account and RKS private key must be set in env variables.')
      return null
    }
  }

  // Needed when passing and storing the keys in \n escaped single lines.
  privateKey = privateKey.replace(/\\n/g, '\n')

  const token = await mdh.getAccessToken(rksServiceAccount, privateKey)
  if(token == null) {
    return null
  }

  // Create a new pending task for the user before sending out the notification.
  const taskParams = [
    {
      'participantIdentifier': args.pid,
      'surveyName': surveyName,
      'dueAfterIntervalAmount': 0,
      'dueAfterIntervalType': 'Days'
    }
  ]

  let taskResults = await mdh.createTask(token, rksProjectId, taskParams);

  let results = await sendNotification(token, rksProjectId, args.pid, notificationId)

  return results
}


// Method which sends a simple notification.
async function sendNotification(token, projectId, pid, nid) {
  const resourceUrl = '/api/v1/administration/projects/'+projectId+'/notifications'
  let params = [
    {
    'participantIdentifier': pid,
    'notificationIdentifier' : nid,
    'notificationFields' : {}
    }
  ]

  return await mdh.postToApi(token, resourceUrl, params)
}

exports.main = main
