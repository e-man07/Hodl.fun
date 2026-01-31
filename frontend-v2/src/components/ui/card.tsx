import * as React from 'react';
import { cn } from '@/lib/utils';

// React 19: forwardRef no longer needed - refs passed as regular props
type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.Ref<HTMLDivElement>;
};

function Card({ className, ref, ...props }: CardProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground',
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ref, ...props }: CardProps) {
  return (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  );
}

type HeadingLevel = 'h2' | 'h3' | 'h4';

type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  ref?: React.Ref<HTMLHeadingElement>;
  as?: HeadingLevel;
};

function CardTitle({ className, ref, as: Component = 'h2', ...props }: CardTitleProps) {
  return (
    <Component
      ref={ref}
      className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement> & {
  ref?: React.Ref<HTMLParagraphElement>;
};

function CardDescription({ className, ref, ...props }: CardDescriptionProps) {
  return (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  );
}

function CardContent({ className, ref, ...props }: CardProps) {
  return (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  );
}

function CardFooter({ className, ref, ...props }: CardProps) {
  return (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
