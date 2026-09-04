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
    assert.equal(payload.stream, true)
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    if (payload.model === 'cancel-model' || payload.model === 'timeout-model') {
      const timer = setTimeout(() => response.end('data: [DONE]\n\n'), 20_000)
      response.once('close', () => clearTimeout(timer))
      return
    }
    if (payload.model === 'survivor-model') {
      const timer = setTimeout(() => response.end('data: {"choices":[{"delta":{"content":"survived"}}]}\n\ndata: [DONE]\n\n'), 200)
      response.once('close', () => clearTimeout(timer))
      return
    }
    assert.equal(payload.model, 'smoke-model')
    response.write('data: {"choices":[{"delta":{"content":"mock "}}]}\n\n')
    response.end('data: {"choices":[{"delta":{"content":"reply"}}]}\n\ndata: [DONE]\n\n')
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
    const result = await page.evaluate(({ baseUrl }) => window.desktop.aiRequest({ url: `${baseUrl}/chat/completions`, headers: { authorization: 'Bearer smoke-key', accept: 'text/event-stream' }, body: JSON.stringify({ model: 'smoke-model', stream: true }), timeoutMs: 120000 }), { baseUrl })
    assert.equal(result.status, 200)
    const reply = result.body.split(/\r?\n/).filter((line) => line.startsWith('data: {')).map((line) => JSON.parse(line.slice(5)).choices[0].delta.content).join('')
    assert.equal(reply, 'mock reply')
    const cancellation = await page.evaluate(async ({ baseUrl }) => {
      const send = (model, requestId, timeoutMs = 120_000) => window.desktop.aiRequest({ requestId, url: `${baseUrl}/chat/completions`, headers: { authorization: 'Bearer smoke-key', accept: 'text/event-stream' }, body: JSON.stringify({ model, stream: true }), timeoutMs })
      const canceled = send('cancel-model', 'cancel-one').then(() => 'resolved', (error) => String(error?.message || error))
      const survivor = send('survivor-model', 'leave-running')
      setTimeout(() => window.desktop.cancelAiRequest('cancel-one'), 50)
      const [cancelMessage, survivorResponse] = await Promise.all([canceled, survivor])
      const reusedResponse = await send('smoke-model', 'cancel-one')
      const timeoutMessage = await send('timeout-model', 'timeout-one', 5_000).then(() => 'resolved', (error) => String(error?.message || error))
      return { cancelMessage, survivorResponse, reusedResponse, timeoutMessage }
    }, { baseUrl })
    assert.match(cancellation.cancelMessage, /AI 请求已取消/)
    assert.doesNotMatch(cancellation.cancelMessage, /超时/)
    assert.equal(cancellation.survivorResponse.status, 200)
    assert.match(cancellation.survivorResponse.body, /survived/)
    assert.equal(cancellation.reusedResponse.status, 200)
    assert.match(cancellation.timeoutMessage, /响应超时时间/)
    assert.doesNotMatch(cancellation.timeoutMessage, /已取消/)
    console.log(JSON.stringify({ status: result.status, endpoint: `${baseUrl}/chat/completions`, body: result.body, cancellation }))
  } finally {
    await app.close()
    await new Promise((resolve) => server.close(resolve))
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
