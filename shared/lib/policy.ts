import axios from 'axios'
import * as cheerio from 'cheerio'
import crypto from 'node:crypto'
import pdf from 'pdf-parse'

export function hashText(input: string) {
  return crypto.createHash('md5').update(input).digest('hex')
}

function cleanText(input: string) {
  return input
    .replace(/\s+/g, ' ')
    .replace(/隐私政策|用户协议/g, (m) => ` ${m} `)
    .trim()
}

export async function fetchPolicyText(url: string) {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'User-Agent': 'PrivacyPolicyArchiveBot/1.0 (+https://example.com)'
    }
  })
  const contentType = response.headers['content-type'] || ''
  let text = ''

  if (/pdf/i.test(contentType) || url.toLowerCase().endswith('.pdf')) {
    const parsed = await pdf(Buffer.from(response.data))
    text = parsed.text
  } else {
    const html = Buffer.from(response.data).toString('utf-8')
    const $ = cheerio.load(html)
    $('script,style,noscript').remove()
    text = $('main').text() || $('article').text() || $('body').text() || $.text()
  }

  const cleaned = cleanText(text)
  return {
    text: cleaned,
    contentHash: hashText(cleaned),
    length: cleaned.length
  }
}
