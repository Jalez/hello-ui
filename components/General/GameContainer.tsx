'use client';

interface GameContainerProps {
  children: React.ReactNode;
}

export const GameContainer = ({ children }: GameContainerProps) => {
  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-1 flex-col border-none box-border"
    >
      {children}
    </div>
  );
};
