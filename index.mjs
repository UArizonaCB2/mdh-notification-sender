import {main} from './main.js'

export const handler = async (event, context) => {

  console.log(new Date()+' - Send notification lambda function called for '+event.pid)

  return main(event)
};

// Only need this if it is running in non-production environment.
if (process.env.NODE_ENV !== 'production') {
  handler({
    pid: 'MDH-2299-9973',
    nid: 'ymap_ema_morning',
    sid: 'YMAP - Block1/Morning',
  }, null)
}
