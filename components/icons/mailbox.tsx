"use client";

import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface MailboxIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface MailboxIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const MailboxIcon = forwardRef<MailboxIconHandle, MailboxIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start("animate");
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <div
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Mailbox body */}
          <path d="M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5C2 7 4 5 6.5 5H18c2.2 0 4 1.8 4 4v8Z" />
          {/* Flag — animates up on hover */}
          <motion.polyline
            animate={controls}
            points="15,9 18,9 18,11"
            variants={{
              normal: { translateY: 0 },
              animate: { translateY: -2 },
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
          {/* Divider between left and right compartments */}
          <path d="M6.5 5C9 5 11 7 11 9.5V17a2 2 0 0 1-2 2" />
          {/* Mail slot */}
          <line x1="6" x2="7" y1="10" y2="10" />
        </svg>
      </div>
    );
  }
);

MailboxIcon.displayName = "MailboxIcon";

export { MailboxIcon };
