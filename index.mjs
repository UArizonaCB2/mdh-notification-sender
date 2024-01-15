import {main} from './main.js'

export const handler = async (event, context) => {

  console.log(new Date()+' - Send notification lambda function called.')

  return main(event)
};

// Only need this if it is running in non-production environment.
if (process.env.NODE_ENV !== 'production') {
  handler({
    pid: 'MDH-5416-0248'
  }, null)
}
