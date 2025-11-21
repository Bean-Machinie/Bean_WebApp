import { SVGProps } from 'react';

const PlaygroundIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...props}
  >
    <rect x="4.5" y="12.5" width="7" height="7" rx="1.5" />
    <path d="M4.5 15.5h7" />
    <path d="M12.5 11 16 7.5 19.5 11" />
    <path d="M16 7.5V19.5" />
    <circle cx="16" cy="5" r="1.5" />
  </svg>
);

export default PlaygroundIcon;
