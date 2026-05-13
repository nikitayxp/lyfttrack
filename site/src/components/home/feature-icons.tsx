import type { SVGProps } from 'react';

export type FeatureIconName = 'quick-log' | 'smart-training' | 'hall-of-fame';

type FeatureIconProps = {
  name: FeatureIconName;
};

function IconBase({ children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

function QuickLogIcon() {
  return (
    <IconBase>
      <path d="M13 2L5 13h5l-1 9 8-11h-5l1-9Z" />
      <path d="M11.25 7.25h4.5" opacity={0.65} />
    </IconBase>
  );
}

function SmartTrainingIcon() {
  return (
    <IconBase>
      <path d="M9.2 4.6c-2.05 0-3.7 1.66-3.7 3.71 0 .7.2 1.37.55 1.94-.35.57-.55 1.24-.55 1.95 0 2.05 1.65 3.7 3.7 3.7H12V4.6h-2.8Z" />
      <path d="M14.8 4.6c2.05 0 3.7 1.66 3.7 3.71 0 .7-.2 1.37-.55 1.94.35.57.55 1.24.55 1.95 0 2.05-1.65 3.7-3.7 3.7H12V4.6h2.8Z" />
      <path d="M8.3 10h2.1" />
      <path d="M15.7 10h-2.1" />
      <path d="M8.3 13.8h2.1" />
      <path d="M15.7 13.8h-2.1" />
      <circle cx="7" cy="10" r="0.75" />
      <circle cx="17" cy="10" r="0.75" />
      <circle cx="7" cy="13.8" r="0.75" />
      <circle cx="17" cy="13.8" r="0.75" />
    </IconBase>
  );
}

function HallOfFameIcon() {
  return (
    <IconBase>
      <path d="M8 4h8v3.2a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5.5H5.5a1.5 1.5 0 0 0 0 3H8" />
      <path d="M16 5.5h2.5a1.5 1.5 0 1 1 0 3H16" />
      <path d="M12 11.2V16" />
      <path d="M9 20h6" />
      <path d="M8 16h8v4H8z" />
    </IconBase>
  );
}

export function FeatureIcon({ name }: FeatureIconProps) {
  return (
    <span className="feature-icon" aria-hidden="true">
      {name === 'quick-log' && <QuickLogIcon />}
      {name === 'smart-training' && <SmartTrainingIcon />}
      {name === 'hall-of-fame' && <HallOfFameIcon />}
    </span>
  );
}
