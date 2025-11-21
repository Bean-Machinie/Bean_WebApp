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
    <path d="M5 16.5c0-2.485 2.343-4.5 5.234-4.5H14a4 4 0 1 0 0-8H8.8" />
    <path d="M7 18.5c0 1.933 1.85 3.5 4.133 3.5H17l-1.2-3H9.6L8 14.5" />
    <circle cx="8" cy="7" r="2.25" />
  </svg>
);

export default PlaygroundIcon;
