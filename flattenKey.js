require('dotenv').config()

function flatten() {
  privateKey = process.env.RKS_PRIVATE_KEY
  privateKey = privateKey.replace(/\n/g, '\\n')
  console.log(privateKey)
}

flatten()
