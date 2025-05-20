'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { useEffect, useState } from 'react';

export default function PromptSettingsPage() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        const response = await fetch('/api/prompt', {
          headers: {
            'Authorization': `Bearer ${user?.id}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch prompt');
        }
        const data = await response.json();
        setPrompt(data.prompt || '');
      } catch (error) {
        console.error('Error fetching prompt:', error);
        toast.error('获取提示词失败', {
          description: '请稍后重试'
        });
      }
    };
    if (user?.id) {
      fetchPrompt();
    }
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) {
      toast.error('未登录', {
        description: '请先登录后再试'
      });
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to save prompt');
      }

      toast.success('保存成功', {
        description: '提示词已更新'
      });
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast.error('保存失败', {
        description: '请稍后重试'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!user?.id) {
      toast.error('未登录', {
        description: '请先登录后再试'
      });
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/prompt', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.id}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to reset prompt');
      }

      setPrompt('');
      toast.success('重置成功', {
        description: '提示词已恢复默认'
      });
    } catch (error) {
      console.error('Error resetting prompt:', error);
      toast.error('重置失败', {
        description: '请稍后重试'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">自定义提示词</h3>
        <p className="text-sm text-muted-foreground">
          自定义 AI 助手的提示词，以获得更好的对话效果。如果不设置，将使用系统默认提示词。
        </p>
      </div>
      <div className="space-y-4">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="输入自定义提示词..."
          className="min-h-[200px]"
        />
        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={loading}>
            保存
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            disabled={loading}
          >
            重置为默认
          </Button>
        </div>
      </div>
    </div>
  );
} 