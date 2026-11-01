import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

// ==================== Fade In ====================
type FadeInProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
};

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  direction = 'up',
  distance = 20,
  className,
  ...props
}: FadeInProps) {
  const directionMap = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    none: {},
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directionMap[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ==================== Stagger Container ====================
type StaggerContainerProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children: React.ReactNode;
  staggerDelay?: number;
};

export function StaggerContainer({
  children,
  staggerDelay = 0.1,
  className,
  ...props
}: StaggerContainerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ==================== Stagger Item ====================
type StaggerItemProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
};

export function StaggerItem({
  children,
  direction = 'up',
  distance = 16,
  className,
  ...props
}: StaggerItemProps) {
  const directionMap = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, ...directionMap[direction] },
        visible: { opacity: 1, x: 0, y: 0 },
      }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ==================== Scale In ====================
type ScaleInProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children: React.ReactNode;
  delay?: number;
};

export function ScaleIn({ children, delay = 0, className, ...props }: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ==================== Slide In ====================
type SlideInProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  distance?: number;
  delay?: number;
};

export function SlideIn({
  children,
  direction = 'left',
  distance = 100,
  delay = 0,
  className,
  ...props
}: SlideInProps) {
  const dirMap = {
    left: { x: -distance },
    right: { x: distance },
    up: { y: -distance },
    down: { y: distance },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...dirMap[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ==================== Hover Scale (wrapper) ====================
type HoverScaleProps = {
  children: React.ReactNode;
  scale?: number;
  className?: string;
};

export function HoverScale({ children, scale = 1.02, className }: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ==================== Count Up Number ====================
type CountUpProps = {
  value: number;
  duration?: number;
  suffix?: string;
  className?: string;
};

export function CountUp({ value, duration = 1.5, suffix = '', className }: CountUpProps) {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    let start = 0;
    const end = value;
    const startTime = Date.now();
    const durationMs = duration * 1000;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.floor(eased * end);
      setDisplay(start);
      if (progress >= 1) clearInterval(timer);
    }, 16);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span className={className}>{display}{suffix}</span>;
}
