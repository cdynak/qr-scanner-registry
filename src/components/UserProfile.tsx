import React from 'react';
import type { User } from '../types';
import { cn } from '../lib/utils';

interface UserProfileProps {
  user: User;
  className?: string;
  showEmail?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function UserProfile({ 
  user, 
  className, 
  showEmail = true, 
  size = 'md' 
}: UserProfileProps) {
  const sizeClasses = {
    sm: {
      avatar: 'w-8 h-8',
      text: 'text-sm',
      name: 'text-sm font-medium',
      email: 'text-xs text-muted-foreground'
    },
    md: {
      avatar: 'w-10 h-10',
      text: 'text-base',
      name: 'text-base font-medium',
      email: 'text-sm text-muted-foreground'
    },
    lg: {
      avatar: 'w-12 h-12',
      text: 'text-lg',
      name: 'text-lg font-medium',
      email: 'text-base text-muted-foreground'
    }
  };

  const classes = sizeClasses[size];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('rounded-full overflow-hidden bg-muted flex-shrink-0', classes.avatar)}>
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={`${user.name}'s avatar`}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to initials if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<div class="w-full h-full bg-primary text-primary-foreground flex items-center justify-center font-medium ${classes.text}">${user.name.charAt(0).toUpperCase()}</div>`;
              }
            }}
          />
        ) : (
          <div className={cn(
            'w-full h-full bg-primary text-primary-foreground flex items-center justify-center font-medium',
            classes.text
          )}>
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn('truncate', classes.name)}>
          {user.name}
        </div>
        {showEmail && (
          <div className={cn('truncate', classes.email)}>
            {user.email}
          </div>
        )}
      </div>
    </div>
  );
}