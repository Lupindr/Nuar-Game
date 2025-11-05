import { createHash } from 'crypto'
import { EventEmitter } from 'events'
import type { IncomingMessage } from 'http'
import type { Socket } from 'net'
import type http from 'http'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

const createAcceptValue = (key: string) =>
  createHash('sha1').update(key + GUID, 'utf8').digest('base64')

const encodeFrame = (payload: Buffer, opcode = 0x1) => {
  const payloadLength = payload.length
  const header: number[] = [0x80 | opcode]
  const parts: Buffer[] = []

  if (payloadLength < 126) {
    header.push(payloadLength)
  } else if (payloadLength < 65536) {
    header.push(126)
    const lengthBuffer = Buffer.alloc(2)
    lengthBuffer.writeUInt16BE(payloadLength, 0)
    parts.push(lengthBuffer)
  } else {
    header.push(127)
    const lengthBuffer = Buffer.alloc(8)
    const high = Math.floor(payloadLength / 2 ** 32)
    const low = payloadLength >>> 0
    lengthBuffer.writeUInt32BE(high, 0)
    lengthBuffer.writeUInt32BE(low, 4)
    parts.push(lengthBuffer)
  }

  return Buffer.concat([Buffer.from(header), ...parts, payload])
}

const decodeFrames = (buffer: Buffer, onFrame: (opcode: number, payload: Buffer) => void): Buffer => {
  let offset = 0

  while (offset + 2 <= buffer.length) {
    const byte1 = buffer[offset]
    const byte2 = buffer[offset + 1]
    const fin = (byte1 & 0x80) !== 0
    const opcode = byte1 & 0x0f
    const masked = (byte2 & 0x80) !== 0
    let payloadLength = byte2 & 0x7f
    let currentOffset = offset + 2

    if (payloadLength === 126) {
      if (currentOffset + 2 > buffer.length) break
      payloadLength = buffer.readUInt16BE(currentOffset)
      currentOffset += 2
    } else if (payloadLength === 127) {
      if (currentOffset + 8 > buffer.length) break
      const high = buffer.readUInt32BE(currentOffset)
      const low = buffer.readUInt32BE(currentOffset + 4)
      payloadLength = high * 2 ** 32 + low
      currentOffset += 8
    }

    if (masked) {
      if (currentOffset + 4 > buffer.length) break
    }

    const mask = masked ? buffer.slice(currentOffset, currentOffset + 4) : null
    if (masked) currentOffset += 4

    if (currentOffset + payloadLength > buffer.length) break

    let payload = buffer.slice(currentOffset, currentOffset + payloadLength)
    if (masked && mask) {
      const unmasked = Buffer.alloc(payload.length)
      for (let i = 0; i < payload.length; i++) {
        unmasked[i] = payload[i] ^ mask[i % 4]
      }
      payload = unmasked
    }

    offset = currentOffset + payloadLength

    if (!fin) {
      continue
    }

    onFrame(opcode, payload)
  }

  return buffer.slice(offset)
}

export class SimpleWebSocket extends EventEmitter {
  private buffer = Buffer.alloc(0)
  public readyState = 1

  constructor(private socket: Socket) {
    super()
    socket.setNoDelay(true)
    socket.on('data', (chunk) => this.handleData(chunk))
    socket.on('close', () => {
      this.readyState = 3
      this.emit('close')
    })
    socket.on('end', () => {
      this.readyState = 3
      this.emit('close')
    })
    socket.on('error', (error) => this.emit('error', error))
  }

  private handleData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk])

    // @ts-ignore
      this.buffer = decodeFrames(this.buffer, (opcode, payload) => {
      if (opcode === 0x8) {
        this.close()
        return
      }
      if (opcode === 0x9) {
        this.pong(payload)
        return
      }
      if (opcode === 0xa) {
        return
      }
      this.emit('message', payload.toString('utf8'))
    })
  }

  private pong(payload: Buffer) {
    const frame = encodeFrame(payload, 0xa)
    this.socket.write(frame)
  }

  send(data: string) {
    const payload = Buffer.from(data)
    const frame = encodeFrame(payload)
    this.socket.write(frame)
  }

  close() {
    if (this.readyState === 3) return
    this.readyState = 3
    if (!this.socket.destroyed) {
      const frame = encodeFrame(Buffer.alloc(0), 0x8)
      this.socket.write(frame)
      this.socket.destroy()
    }
  }
}

export class SimpleWebSocketServer extends EventEmitter {
  constructor(private server: http.Server) {
    super()
    server.on('upgrade', (request, socket: Socket, head) => {
      this.handleUpgrade(request, socket, head)
    })
  }

  private handleUpgrade(request: IncomingMessage, socket: Socket, head: Buffer) {
    const key = request.headers['sec-websocket-key']
    const upgrade = request.headers['upgrade']
    if (!key || typeof key !== 'string' || upgrade?.toLowerCase() !== 'websocket') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
      socket.destroy()
      return
    }

    const acceptValue = createAcceptValue(key)
    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptValue}`,
    ]

    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n')

    const ws = new SimpleWebSocket(socket)
    this.emit('connection', ws, request)
  }
}
