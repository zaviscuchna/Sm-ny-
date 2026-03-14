import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = { sm: 'w-6 h-6 text-[9px]', md: 'w-8 h-8 text-xs', lg: 'w-10 h-10 text-sm' }

export function UserAvatar({ name, color = '#6366f1', size = 'md', className }: UserAvatarProps) {
  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('')
  return (
    <div
      className={cn('rounded-full flex items-center justify-center text-white font-bold flex-shrink-0', sizes[size], className)}
      style={{ background: color }}
      title={name}
    >
      {initials}
    </div>
  )
}
