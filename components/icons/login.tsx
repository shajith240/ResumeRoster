"use client";

import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useImperativeHandle } from "react";

export interface LogInIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface LogInIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const LogInIcon = forwardRef<LogInIconHandle, LogInIconProps>(
  ({ className, size = 28, ...props }, ref) => {
    const controls = useAnimation();

    useImperativeHandle(ref, () => ({
      startAnimation: () => controls.start("animate"),
      stopAnimation: () => controls.start("normal"),
    }));

    return (
      <div className={className} {...props}>
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
        >
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <motion.g
            animate={controls}
            variants={{
              normal: { x: 0 },
              animate: { x: [0, 3, 0], transition: { duration: 0.4, ease: "easeInOut" } },
            }}
          >
            <polyline points="10 17 15 12 10 7" />
            <line x1="3" x2="15" y1="12" y2="12" />
          </motion.g>
        </svg>
      </div>
    );
  }
);

LogInIcon.displayName = "LogInIcon";
export { LogInIcon };
