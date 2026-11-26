import { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface CoverImageProps {
  src: string;
  alt: string;
  title?: string;
  className?: string;
}

export function CoverImage({ src, alt, title, className = '' }: CoverImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#E2F5EC] via-[#FBF8F1] to-[#FEF3C7] text-[#3E2723] p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <BookOpen className="w-8 h-8 mb-3 text-[#4E342E]/75" strokeWidth={1.75} />
        {title && (
          <span className="font-display text-sm font-semibold leading-snug line-clamp-3">
            {title}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
