import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Hauna ruhusa' })
  }
  const token = authHeader.replace('Bearer ', '')

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token)
  if (callerError || !callerData?.user) {
    return res.status(401).json({ error: 'Token si sahihi' })
  }

  const { data: callerProfile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role:roles(name)')
    .eq('auth_id', callerData.user.id)
    .single()

  if (profileError || !callerProfile) {
    return res.status(403).json({ error: 'Profile haipo' })
  }

  const callerRole = callerProfile.role?.name
  if (!['md', 'admin'].includes(callerRole)) {
    return res.status(403).json({ error: 'Huna ruhusa ya kubadilisha password ya wengine' })
  }

  const { target_user_id, new_password } = req.body

  if (!target_user_id || !new_password) {
    return res.status(400).json({ error: 'target_user_id na new_password vinahitajika' })
  }

  if (new_password.length < 8) {
    return res.status(400).json({ error: 'Password lazima iwe na herufi 8 au zaidi' })
  }

  const { data: targetUser, error: targetError } = await supabaseAdmin
    .from('users')
    .select('auth_id, full_name, email')
    .eq('id', target_user_id)
    .single()

  if (targetError || !targetUser?.auth_id) {
    return res.status(404).json({ error: 'Mtumiaji huyo hajapatikana' })
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    targetUser.auth_id,
    { password: new_password }
  )

  if (updateError) {
    return res.status(500).json({ error: updateError.message })
  }

  return res.status(200).json({
    success: true,
    message: `Password ya ${targetUser.full_name} imebadilishwa`,
  })
}
