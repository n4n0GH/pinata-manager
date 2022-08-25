const core = require('@actions/core');
const fsPath = require('path')
const pinataSdk = require('@pinata/sdk')
const IPFSGatewayTools = require('@pinata/ipfs-gateway-tools/dist/node')
const axios = require('axios').default

const gatewayTools = new IPFSGatewayTools()

let pinataOptions = {
    pinataOptions: {
        cidVersion: 0,
        wrapWithDirectory: false,
    }
}

let cid = ''

const main = async () => {
  console.log(`
                  .o                 .oooo.   
                .d88                d8P'\`Y8b  
ooo. .oo.     .d'888   ooo. .oo.   888    888 
\`888P"Y88b  .d'  888   \`888P"Y88b  888    888 
 888   888  88ooo888oo  888   888  888    888 
 888   888       888    888   888  \`88b  d88' 
o888o o888o     o888o  o888o o888o  \`Y8bd8P'  

        --- touch grass, anon <3 ---
  `)
    try {
        // @dev retrieve action inputs
        let sourcePath = core.getInput('path', {required: true})
        const secret = core.getInput('secret', {required: true})
        const key = core.getInput('key', {required: true})
        const pinName = core.getInput('pinName', {required: true})
        const unpinOld = core.getInput('unpinOld', {required: false})
        const gatewayName = core.getInput('gatewayName', {required: true})
        const gatewayId = core.getInput('gatewayId', {required: true})

        // @dev sanity check
        if (!sourcePath) throw new Error("No source path specified")
        if (!secret) throw new Error("Pinata JWT is missing")
        if (!key) throw new Error("Pinata API key is missing")
        if (!pinName) throw new Error("Name for the target pin not specified")
        if (!gatewayName) throw new Error("Gateway name not specified")
        if (!gatewayId) throw new Error("Gateway Id not specified")
        if (!fsPath.isAbsolute(sourcePath)) {
            const dir = (process.env.GITHUB_WORKSPACE || process.cwd().toString())
            sourcePath = fsPath.join(dir, sourcePath)
        }

        // @pinata setup
        const pinata = pinataSdk(key, secret)

        pinataOptions = {
            ...pinataOptions,
            pinataMetadata: {
                name: pinName,
            }
        }

        // @dev pin the new file
        await pinata.pinFromFS(sourcePath, pinataOptions).then(async (result) => {
            cid = result.IpfsHash.toString()
            if (!!result.isDuplicate) {
              // @dev generate the gateway url
              const prefix = `https://${gatewayName}.mypinata.cloud`
              const newGateway = await gatewayTools.convertToDesiredGateway(
                `${prefix}/ipfs/${cid}`,
                prefix
              )
              console.log('ヾ(＾-＾)ノ Pinned file', {gateway: newGateway, cid})
              // @dev get file id for new pin
              const newPin = await pinata.pinList({
                hashContains: cid,
              })
              console.log(newPin.rows)
              const pinId = newPin.rows.filter((pin) => pin.ipfs_pin_hash === cid)[0].id
              console.log(pinId)
              // @dev use undocumented blackmagick to update gateway root
              await axios({
                method: 'post',
                url: `https://api.pinata.cloud/v2/gateways/${gatewayId}/pin/${pinId}`
              }).then(() => {
                console.log('(≧◡≦) Updated gateway root')
              }).catch((e) => {
                console.error('(,,#ﾟДﾟ) Gateway root was not updated...', e.message)
              })
              core.setOutput('gateway', newGateway)
              core.setOutput('duplicate', 'false')
            } else {
              core.setOutput('duplicate', 'true')
              console.info('Σ(； ･`д･´) No code was changed, duplicate hash generated. Skipping...')
            }
        })

        // @dev unpin old file if applicable
        if (unpinOld === 'true') {
            // @dev retrieve current pins with the same name
            const currentPins = await pinata.pinList({
              status: 'pinned',
              metadata: {
                name: pinName
              }
            })
            const pinList = currentPins.rows
            pinList.filter((pin) => pin.ipfs_pin_hash !== cid).forEach((pin) => {
              pinata.unpin(pin.ipfs_pin_hash).then(() => {
                console.log('(•̀o•́)ง Pin removed:', pin.ipfs_pin_hash)
              }).catch((e) => {
                console.error('(´；ω；`) Failed to remove pin', e.message)
              })
            })
        }

    } catch (e) {
        core.setFailed(e.message)
    }
}

main().then(() => {
  core.setOutput('cid', cid)
  console.log('✧*｡٩(ˊᗜˋ*)و✧*｡ All done!')
})
