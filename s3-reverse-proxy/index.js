const express = require('express')
const httpProxy = require('http-proxy')
require("dotenv").config({ path: "../.env" });

const app = express()
const PORT = 8000

const BASEPATH = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/__output`

const proxy = httpProxy.createProxy();

app.use((req, res) => {
    const hostname = req.hostname
    const subdomain = hostname.split('.')[0]

    // subdomain directly matches S3 folder since PROJECT_ID = subdomain
    const resolveTo = `${BASEPATH}/${subdomain}`

    return proxy.web(req, res, { target: resolveTo, changeOrigin: true }, (err) => {
        if (err) {
            console.error('Proxy error:', err)
            res.status(502).json({ error: 'Proxy error' })
        }
    })
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.path
    if (url === '/')
        proxyReq.path += 'index.html'
})

app.listen(PORT, () => {
    console.log(`Reverse proxy running on port ${PORT}`)
})