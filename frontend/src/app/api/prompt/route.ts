import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import { getSupabaseServerClient } from '@/lib/supabase/server'

async function getUser() {
  const supabase = getSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/prompt`, {
      headers: {
        'Authorization': `Bearer ${user.id}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch prompt')
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching prompt:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { prompt } = await req.json()

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/prompt`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.id}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    })

    if (!response.ok) {
      throw new Error('Failed to save prompt')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving prompt:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/prompt`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${user.id}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to reset prompt')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting prompt:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 