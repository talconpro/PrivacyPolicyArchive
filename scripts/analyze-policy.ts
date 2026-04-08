import { analyzePolicyText } from '../shared/lib/analysis'

async function main() {
  const text = process.argv[2] || '示例协议文本：会收集账号、设备、日志信息，用于提供服务。'
  const analysis = await analyzePolicyText(text)
  console.log(JSON.stringify(analysis, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
