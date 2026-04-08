import axios from 'axios'

async function main() {
  const keyword = process.argv[2] || '微信'
  const country = process.argv[3] || 'cn'
  const { data } = await axios.get('https://itunes.apple.com/search', {
    params: {
      term: keyword,
      country,
      entity: 'software',
      limit: 5
    }
  })

  const items = (data.results || []).map((item: any) => ({
    trackId: item.trackId,
    name: item.trackName,
    sellerName: item.sellerName,
    artworkUrl: item.artworkUrl100,
    appStoreUrl: item.trackViewUrl
  }))

  console.log(JSON.stringify({ keyword, country, items }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
