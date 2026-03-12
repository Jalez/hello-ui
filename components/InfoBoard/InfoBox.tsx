'use client';

import { cn } from "@/lib/utils/cn";

const InfoBox = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("flex flex-row items-center rounded-2xl pr-2 pl-2 border-primary", className)}>
      {children}
    </div>
  );
};

export default InfoBox;
