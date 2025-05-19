'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { useUser } from '@/hooks/use-user'

export default function PromptSettingsPage() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { user } = useUser()

  useEffect(() => {
    fetchPrompt()
  }, [])

  const fetchPrompt = async () => {
    try {
      const response = await fetch('/api/prompt')
      if (response.ok) {
        const data = await response.json()
        setPrompt(data.prompt || '')
      }
    } catch (error) {
      console.error('Failed to fetch prompt:', error)
      toast({
        title: '获取Prompt失败',
        description: '请稍后重试',
        variant: 'destructive',
      })
    }
  }

  const handleSave = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const response = await fetch('/api/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      })

      if (response.ok) {
        toast({
          title: '保存成功',
          description: 'Prompt已更新',
        })
      } else {
        throw new Error('Failed to save prompt')
      }
    } catch (error) {
      console.error('Failed to save prompt:', error)
      toast({
        title: '保存失败',
        description: '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const response = await fetch('/api/prompt', {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchPrompt()
        toast({
          title: '重置成功',
          description: 'Prompt已恢复默认设置',
        })
      } else {
        throw new Error('Failed to reset prompt')
      }
    } catch (error) {
      console.error('Failed to reset prompt:', error)
      toast({
        title: '重置失败',
        description: '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">自定义 Prompt</h1>
          <div className="space-x-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={loading}
            >
              重置为默认
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
            >
              保存
            </Button>
          </div>
        </div>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            在这里你可以自定义AI助手的系统Prompt。如果不确定如何修改，建议保持默认设置。
          </p>
          
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[600px] font-mono"
            placeholder="输入自定义prompt..."
            disabled={loading}
          />
        </div>
      </div>
    </div>
  )
} 