import { Router } from 'express'
import { cacheSeconds } from 'route-cache'
import { Bar, Match, Market } from '../../models'

export const markets = Router()

markets.get('/:market_id/deals', cacheSeconds(3, (req, res) => {
  return req.originalUrl + '|' + req.app.get('network').name + '|' + req.params.market_id + '|' + req.query.limit
}), async (req, res) => {
  const network = req.app.get('network')
  const market_id = parseInt(req.params.market_id)
  const limit = parseInt(req.query.limit) || 200

  if (isNaN(market_id)) return res.status(403).send('Invalid market id')

  const matches = await Match.find({ chain: network.name, market: market_id })
    .select('_id time bid ask unit_price type trx_id')
    .sort({ time: -1 })
    .limit(limit)

  res.json(matches)
})

markets.get('/:market_id/charts', async (req, res) => {
  const network = req.app.get('network')
  const market_id = parseInt(req.params.market_id)
  if (isNaN(market_id)) return res.status(403).send('Invalid market id')

  const market = await Market.findOne({ id: market_id, chain: network.name })

  if (!market) {
    return res.status(404).send(`Market with id ${market_id} not found or closed :(`)
  }

  const { from, to, resolution, limit } = req.query
  if (!resolution) return res.status(404).send('Incorrect resolution..')

  const where = { chain: network.name, timeframe: resolution.toString(), market: parseInt(market_id) }

  if (from && to) {
    where.time = {
      $gte: new Date(parseFloat(from) * 1000),
      $lte: new Date(parseFloat(to) * 1000)
    }
  }

  const q = [
    { $match: where },
    { $sort: { time: -1 } },
    {
      $project: {
        time: { $toLong: '$time' },
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 1
      }
    }
  ]

  if (limit) q.push({ $limit: parseInt(limit) })

  const charts = await Bar.aggregate(q)

  res.json(charts)
})

markets.get('/:market_id', cacheSeconds(60, (req, res) => {
  return req.originalUrl + '|' + req.app.get('network').name + '|' + req.params.market_id
}), async (req, res) => {
  const network = req.app.get('network')
  const market_id = parseInt(req.params.market_id)
  if (isNaN(market_id)) return res.status(403).send('Invalid market id')

  const market = await Market.findOne({ id: market_id, chain: network.name })
  return market ? res.json(market) : res.status(404).send('Market not found')
})

markets.get('/', cacheSeconds(3, (req, res) => {
  return req.originalUrl + '|' + req.app.get('network').name
}), async (req, res) => {
  const network = req.app.get('network')

  const markets = await Market.find({ chain: network.name })
  res.json(markets)
})
