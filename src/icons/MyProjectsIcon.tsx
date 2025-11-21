import { SVGProps } from 'react';

const MyProjectsIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 8v8" />
    <path d="M8 12h8" />
  </svg>
);

export default MyProjectsIcon;
