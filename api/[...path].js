import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function token(req) {
  const value = req.headers.authorization || ''
  return value.startsWith('Bearer ') ? value.slice(7) : ''
}

async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

async function userFor(req) {
  const accessToken = token(req)
  if (!accessToken || !url || !anonKey) return null
  const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
  const { data, error } = await client.auth.getUser(accessToken)
  if (error || !data.user) return null
  return { client, user: data.user }
}

export default async function handler(req, res) {
  const route = '/' + (Array.isArray(req.query?.path) ? req.query.path.join('/') : String(req.query?.path || ''))
  if (req.method === 'GET' && route === '/health') return json(res, 200, { ok: true })
  if (req.method === 'GET' && route === '/config') return json(res, 200, { invite_only: false })

  const auth = await userFor(req)
  if (!auth) return json(res, 401, { error: 'not signed in' })
  const { client, user } = auth

  if (req.method === 'GET' && route === '/me') {
    const { data, error } = await client.from('profiles').select('id,name,admin,disabled').eq('id', user.id).maybeSingle()
    if (error) return json(res, 500, { error: error.message })
    if (data?.disabled) return json(res, 403, { error: 'account disabled' })
    return json(res, 200, { user: data || { id: user.id, name: user.user_metadata?.name || user.email?.split('@')[0] || '', admin: false } })
  }

  if (route === '/data' && req.method === 'GET') {
    const { data, error } = await client.from('workout_states').select('state').eq('user_id', user.id).maybeSingle()
    if (error) return json(res, 500, { error: error.message })
    return json(res, 200, { state: data?.state || null })
  }

  if (route === '/data' && req.method === 'PUT') {
    const input = await body(req)
    if (!input.state || typeof input.state !== 'object') return json(res, 400, { error: 'state required' })
    delete input.state.active
    const { error } = await client.from('workout_states').upsert({ user_id: user.id, state: input.state, updated_at: new Date().toISOString() })
    if (error) return json(res, 500, { error: error.message })
    return json(res, 200, { ok: true, ts: input.state._ts || null })
  }

  if (route === '/logout' || route === '/logout/all') return json(res, 200, { ok: true })
  if (route === '/activity') return json(res, 200, { ok: true })
  return json(res, 404, { error: 'not found' })
}
