const http = require('http')
const path = require('path')
const assert = require('node:assert/strict')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')

async function main() {
  const server = http.createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk
    assert.equal(request.url, '/v1/chat/completions')
    assert.equal(request.headers.authorization, 'Bearer smoke-key')
    const payload = JSON.parse(body)
    assert.equal(payload.model, 'smoke-model')
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: 'mock ' }, { type: 'text', text: 'reply' }] } }] }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}/v1`
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron')
  const args = process.env.PDFUCK_SMOKE_EXECUTABLE ? [`--user-data-dir=${path.join(root, 'tmp', 'ai-smoke-user')}`] : [path.join(root, 'out/main/index.js')]
  const app = await electron.launch({ executablePath: executable, args, env: { ...process.env, PDFUCK_TEST_USER_DATA: path.join(root, 'tmp', 'ai-smoke-user') } })
  try {
    const page = await app.firstWindow()
    await page.waitForSelector('.titlebar', { timeout: 60000 })
    const result = await page.evaluate(({ baseUrl }) => window.desktop.aiRequest({ url: `${baseUrl}/chat/completions`, headers: { authorization: 'Bearer smoke-key' }, body: JSON.stringify({ model: 'smoke-model' }) }), { baseUrl })
    assert.equal(result.status, 200)
    const responsePayload = JSON.parse(result.body)
    assert.equal(responsePayload.choices[0].message.content.map((item) => item.text).join(''), 'mock reply')
    console.log(JSON.stringify({ status: result.status, endpoint: `${baseUrl}/chat/completions`, body: result.body }))
  } finally {
    await app.close()
    await new Promise((resolve) => server.close(resolve))
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
