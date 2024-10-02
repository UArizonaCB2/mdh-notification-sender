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
  const surveyName = args.sid

  // If we are in production system then MDH configuration will get loaded from the secrets manager.
  if (process.env.NODE_ENV === 'production') {
    let secret = await secretManager.getSecret(secretName)
    secret = JSON.parse(secret)
    rksProjectId = secret['RKS_PROJECT_ID']
    notificationId = args.nid
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
      notificationId = args.nid
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

  /* Need to check the kill switch aka the custom field named - "stopEMA.
   * If the value in this field is "yes" then we stop this, and don't do anything after.*/
  const participantInfo = await mdh.getParticipant(token, rksProjectId, args.pid)
  const stopEMA = getCustomField(participantInfo, 'stopEMA')
  if (stopEMA === "yes") {
    console.log("Warning : Kill switch activated for participant "+args.pid+" for EMA surveys")
    console.log("Warning : Cowardly refusing to do any further processing")

    return true
  }

  /* We need to close any surveys mentioned in env.SURVEY_CLOSE (except the current one)
   * before creating new tasks or sending them out.
   * Note - We only look at those surveys in the EMA category to limit the response size. */
  const surveyParams = {
    participantIdentifier: args.pid,
    status: 'incomplete',
    surveyCategory: process.env.EMA_CATEGORY,
  }

  const incompleteSurveys = await mdh.getSurveyTasks(token, rksProjectId, surveyParams)

  for (const surveyTask of incompleteSurveys.surveyTasks) {
    if (surveyTask.surveyName !== args.sid) {
      await mdh.closeTask(token, rksProjectId, surveyTask.id)
      console.log("Automatic non-timeout closing of task "+surveyTask.surveyName)
    }
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

  // Create a pending task in MDH for the user.
  const taskResults = await mdh.createTask(token, rksProjectId, taskParams);
  // Send out the notification to the user.
  const results = await sendNotification(token, rksProjectId, args.pid, notificationId)
  // Update the participant custom field with the notification number.
  const payload = {
    'participantIdentifier' : args.pid,
    'customFields' : {
      'notificationNumber': args.number
    }
  }
  const updateResult = await mdh.updateParticipant(token, rksProjectId, payload)

  /* TODO: Unless we do a read after write check, there is no real good way to figure out if this worked. */
  return true
}

/*
 * Get the specified custom field from the participant.
 * @param {object} participant - MDH participant object.
 * @param {string} fieldName - Name of the custom field.
 * @returns {string} value of the custom field if found, null otherwise.
 */
function getCustomField(participant, fieldName) {
  if (fieldName in participant.customFields) {
    return participant.customFields[fieldName]
  }

  return null
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
