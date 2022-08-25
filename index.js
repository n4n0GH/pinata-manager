import core from '@actions/core';
// import axios from 'axios';
import fsPath from 'path'
import pinataSdk from '@pinata/sdk'
import IPFSGatewayTools from '@pinata/ipfs-gateway-tools/dist/browser'

const gatewayTools = new IPFSGatewayTools()

let pinataOptions = {
    pinataOptions: {
        cidVersion: 0,
        wrapWithDirectory: false,
    }
}

let cid = ''

const main = async () => {
    try {
        // @dev retrieve action inputs
        let sourcePath = core.getInput('path', {required: true})
        const secret = core.getInput('secret', {required: true})
        const key = core.getInput('key', {required: true})
        const pinName = core.getInput('pinName', {required: true})
        const unpinOld = core.getInput('unpinOld', {required: false})
        const gatewayName = core.getInput('gatewayName', {required: true})

        // @dev sanity check
        if (!sourcePath) throw new Error("No source path specified")
        if (!secret) throw new Error("Pinata JWT is missing")
        if (!key) throw new Error("Pinata API key is missing")
        if (!pinName) throw new Error("Name for the target pin not specified")
        if (!gatewayName) throw new Error("Gateway name not specified")
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
        await pinata.pinFromFS(sourcePath, pinataOptions).then((result) => {
            cid = result.IpfsHash.toString()
        })

        // @dev update the gateway
        const prefix = `https://${gatewayName}.mypinata.cloud/`
        const newGateway = await gatewayTools.convertToDesiredGateway(
            `${prefix}ipfs/${cid}`,
            prefix
        )
        core.setOutput('gateway', newGateway)

        // @dev unpin old file if applicable
        if (unpinOld) {
            // TODO
            // @dev retrieve current pins
            // @dev find pin with same name and unpin
            console.log('yeet');
        }

    } catch (e) {
        core.setFailed(e.message)
    }
}
